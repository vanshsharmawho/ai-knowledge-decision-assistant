// Import the library file directly: the package's index.js runs a debug test when imported as ESM.
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import { config } from '../config.js';
import { Errors } from '../utils/AppError.js';

/** Cheap check before parsing: real PDFs start with "%PDF-". */
export function looksLikePdf(buffer) {
  return buffer.length > 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

/**
 * Extracts text page by page, so every chunk can point to its page number.
 * Throws user-facing errors for invalid PDFs, too many pages, or no text.
 */
export async function extractPages(buffer) {
  if (!looksLikePdf(buffer)) {
    throw Errors.badRequest('INVALID_PDF', 'This file is not a valid PDF.');
  }

  let numPages;
  let pages;
  try {
    ({ numPages, pages } = await extractWithPdfParse(buffer));
  } catch (firstErr) {
    // pdf-parse bundles an old pdf.js that rejects some valid files ("bad XRef entry").
    // Retry with the current pdf.js before giving up.
    try {
      ({ numPages, pages } = await extractWithPdfjs(buffer));
    } catch (err) {
      throw Errors.badRequest('INVALID_PDF', 'This PDF could not be read. It may be corrupted or password-protected.', {
        reason: err.message || firstErr.message,
      });
    }
  }

  if (numPages > config.limits.maxPagesPerPdf) {
    throw Errors.badRequest(
      'PAGE_LIMIT_EXCEEDED',
      `This PDF has ${numPages} pages. The maximum is ${config.limits.maxPagesPerPdf} pages per PDF.`
    );
  }

  const cleaned = Array.from({ length: numPages }, (_, i) => (pages[i] || '').trim());
  if (!cleaned.some((p) => p.length > 20)) {
    throw Errors.badRequest(
      'NO_TEXT',
      'No readable text was found in this PDF. Scanned/image-only PDFs are not supported yet.'
    );
  }
  return { numPages, pages: cleaned };
}

/** Joins a page's text items into lines (same line = similar y position). */
function joinItems(items) {
  let lastY;
  let text = '';
  for (const item of items) {
    if (typeof item.str !== 'string') continue;
    const y = item.transform[5];
    if (lastY === undefined || Math.abs(y - lastY) < 2) {
      text += (text && !text.endsWith(' ') && !item.str.startsWith(' ') ? ' ' : '') + item.str;
    } else {
      text += '\n' + item.str;
    }
    lastY = y;
  }
  return text;
}

async function extractWithPdfParse(buffer) {
  const pages = [];
  const data = await pdfParse(buffer, {
    // Render at most one page past the limit; numpages still reports the real total.
    max: config.limits.maxPagesPerPdf + 1,
    pagerender: async (pageData) => {
      const content = await pageData.getTextContent({ normalizeWhitespace: true });
      const text = joinItems(content.items);
      pages[pageData.pageIndex] = text;
      return text;
    },
  });
  return { numPages: data.numpages, pages };
}

async function extractWithPdfjs(buffer) {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  try {
    const numPages = doc.numPages;
    const pages = [];
    const last = Math.min(numPages, config.limits.maxPagesPerPdf + 1);
    for (let i = 1; i <= last; i++) {
      const page = await doc.getPage(i);
      const content = await page.getTextContent();
      pages[i - 1] = joinItems(content.items);
    }
    return { numPages, pages };
  } finally {
    await doc.destroy();
  }
}
