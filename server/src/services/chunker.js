/**
 * Splits page texts into overlapping chunks (~900 chars) without crossing page
 * boundaries, so every chunk maps to exactly one page for references.
 */
const TARGET = 900;
const OVERLAP = 150;

export function chunkPages(pages) {
  const chunks = [];

  pages.forEach((pageText, i) => {
    const page = i + 1;
    const pieces = pageText
      .split(/\n\s*\n|\n(?=[A-Z0-9•\-–(])/)
      .map((p) => p.replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      // very long paragraphs are split into sentences
      .flatMap((p) => (p.length > TARGET ? p.split(/(?<=[.!?])\s+/) : [p]));

    let current = '';
    let hasNewText = false; // false when `current` holds only the overlap tail

    for (const piece of pieces) {
      if (hasNewText && (current + ' ' + piece).length > TARGET) {
        chunks.push({ page, text: current.trim() });
        // carry a tail into the next chunk so text split across chunks still matches
        current = current.slice(-OVERLAP);
        hasNewText = false;
      }
      current += (current ? '\n' : '') + piece;
      hasNewText = true;
    }
    if (hasNewText && current.trim().length > 30) chunks.push({ page, text: current.trim() });
  });

  return chunks.map((c, i) => ({ ...c, chunkIndex: i }));
}
