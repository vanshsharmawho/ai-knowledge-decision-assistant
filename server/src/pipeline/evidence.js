/**
 * Evidence = retrieved chunks shown to a model. Each gets a short label (E1, E2…)
 * so models can cite evidence without ever seeing database ids.
 */
export function labelEvidence(chunks) {
  return chunks.map((c, i) => ({ ...c, label: `E${i + 1}` }));
}

export function formatEvidence(evidence, maxChars = 1200) {
  if (!evidence.length) return '(no evidence found)';
  return evidence
    .map((e) => `[${e.label}] ${e.filename}, page ${e.page}\n${e.text.slice(0, maxChars)}`)
    .join('\n\n');
}

/** Merge chunk lists without duplicates, keeping the best-ranked first. */
export function mergeChunks(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    for (const c of list) {
      if (seen.has(c.id)) continue;
      seen.add(c.id);
      out.push(c);
    }
  }
  return out;
}

/** Turn cited labels back into unique "file — page" references. */
export function toReferences(labels, evidence) {
  const byLabel = new Map(evidence.map((e) => [e.label, e]));
  const seen = new Set();
  const refs = [];
  for (const label of labels || []) {
    const e = byLabel.get(label);
    if (!e) continue;
    const key = `${e.filename}#${e.page}`;
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ filename: e.filename, page: e.page, display: `${e.filename} — Page ${e.page}` });
  }
  return refs.sort((a, b) => a.filename.localeCompare(b.filename) || a.page - b.page);
}
