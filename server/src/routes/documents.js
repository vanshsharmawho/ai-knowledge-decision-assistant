import { Router } from 'express';
import multer from 'multer';
import fs from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { requireAdmin } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { Errors } from '../utils/AppError.js';
import { config } from '../config.js';
import { Document } from '../models/Document.js';
import { Chunk } from '../models/Chunk.js';
import { extractPages } from '../services/pdf.js';
import { chunkPages } from '../services/chunker.js';
import { embedTexts } from '../services/gemini.js';

const router = Router();
router.use(requireAdmin);

// Keep the upload in memory: max 10 MB, validated before anything touches disk.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.limits.maxBytesPerPdf, files: 1 },
  fileFilter: (_req, file, cb) => {
    const okName = /\.pdf$/i.test(file.originalname);
    const okType = ['application/pdf', 'application/x-pdf', 'application/octet-stream'].includes(file.mimetype);
    if (!okName || !okType) return cb(Errors.badRequest('INVALID_FILE_TYPE', 'Only PDF files can be uploaded.'));
    cb(null, true);
  },
});

function limitsInfo(count) {
  return {
    maxDocuments: config.limits.maxDocsPerOrg,
    maxPagesPerPdf: config.limits.maxPagesPerPdf,
    maxMbPerPdf: config.limits.maxBytesPerPdf / (1024 * 1024),
    documentsUsed: count,
  };
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const docs = await Document.find({ organizationId: req.org._id }).sort({ createdAt: -1 });
    res.json({ documents: docs.map((d) => d.toPublic()), limits: limitsInfo(docs.length) });
  })
);

/**
 * Upload one PDF. Optional `replaceDocumentId` field replaces an existing document
 * (the old one is removed only after the new one is processed successfully).
 */
router.post(
  '/',
  upload.single('file'),
  asyncHandler(async (req, res) => {
    if (!req.file) throw Errors.badRequest('NO_FILE', 'Please choose a PDF to upload.');
    const orgId = req.org._id;
    const replaceId = req.body.replaceDocumentId;

    let toReplace = null;
    if (replaceId) {
      if (!mongoose.isValidObjectId(replaceId)) throw Errors.badRequest('INVALID_ID', 'Invalid document id.');
      toReplace = await Document.findOne({ _id: replaceId, organizationId: orgId }).select('+storagePath');
      if (!toReplace) throw Errors.notFound('The document to replace was not found.');
    }

    const count = await Document.countDocuments({ organizationId: orgId });
    if (!toReplace && count >= config.limits.maxDocsPerOrg) {
      throw Errors.badRequest(
        'DOCUMENT_LIMIT_REACHED',
        `You can have at most ${config.limits.maxDocsPerOrg} documents. Delete or replace one first.`
      );
    }

    const filename = path.basename(req.file.originalname).replace(/[^\w.\- ()]/g, '_');

    // Validate + extract BEFORE saving, so invalid files never enter the knowledge base.
    const { numPages, pages } = await extractPages(req.file.buffer);

    const docId = new mongoose.Types.ObjectId();
    const dir = path.join(config.storageDir, orgId.toString());
    const storagePath = path.join(dir, `${docId}.pdf`);
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(storagePath, req.file.buffer);

    const doc = await Document.create({
      _id: docId,
      organizationId: orgId,
      filename,
      sizeBytes: req.file.size,
      pageCount: numPages,
      status: 'processing',
      storagePath,
    });

    try {
      const pieces = chunkPages(pages);
      const embeddings = await embedTexts(pieces.map((p) => `${filename} (page ${p.page})\n${p.text}`));
      await Chunk.insertMany(
        pieces.map((p, i) => ({
          organizationId: orgId,
          documentId: doc._id,
          filename,
          page: p.page,
          chunkIndex: p.chunkIndex,
          text: p.text,
          embedding: embeddings[i],
        }))
      );
      doc.status = 'ready';
      doc.chunkCount = pieces.length;
      await doc.save();
    } catch (err) {
      console.error('[documents] processing failed:', err.message);
      await Chunk.deleteMany({ documentId: doc._id });
      doc.status = 'failed';
      doc.error = 'Processing failed (the AI embedding service may be unavailable). Delete and try again.';
      await doc.save();
      return res.status(502).json({
        error: { code: 'PROCESSING_FAILED', message: doc.error },
        document: doc.toPublic(),
      });
    }

    if (toReplace) await removeDocument(toReplace);

    res.status(201).json({ document: doc.toPublic() });
  })
);

router.delete(
  '/:id',
  asyncHandler(async (req, res) => {
    if (!mongoose.isValidObjectId(req.params.id)) throw Errors.badRequest('INVALID_ID', 'Invalid document id.');
    // organizationId in the filter: an org can never delete another org's document
    const doc = await Document.findOne({ _id: req.params.id, organizationId: req.org._id }).select('+storagePath');
    if (!doc) throw Errors.notFound('Document not found.');
    await removeDocument(doc);
    res.json({ deleted: true });
  })
);

async function removeDocument(doc) {
  await Chunk.deleteMany({ documentId: doc._id, organizationId: doc.organizationId });
  await Document.deleteOne({ _id: doc._id, organizationId: doc.organizationId });
  await fs.unlink(doc.storagePath).catch(() => {});
}

export default router;
