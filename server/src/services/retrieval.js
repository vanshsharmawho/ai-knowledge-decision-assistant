import mongoose from 'mongoose';
import { Chunk } from '../models/Chunk.js';
import { config } from '../config.js';
import { embedTexts } from './gemini.js';

/**
 * Hybrid retrieval scoped to ONE organization:
 *   vector similarity (meaning) + BM25 keyword score (exact terms like "CGPA", "Form B"),
 *   fused with Reciprocal Rank Fusion.
 *
 * Tenant isolation: the only way to get chunks is through createRetriever(orgId),
 * and every query below filters on organizationId.
 */

const STOPWORDS = new Set(
  'a an and are as at be by can could do does for from has have how i if in is it its me my of on or our so than that the their them then there these they this to was we what when where which who why will with would you your am im'.split(
    ' '
  )
);

function tokenize(text) {
  return (text.toLowerCase().match(/[a-z0-9][a-z0-9.%+-]*/g) || [])
    .map((t) => t.replace(/[.]+$/, ''))
    .filter((t) => t.length > 1 && !STOPWORDS.has(t));
}

function dot(a, b) {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

function bm25Scores(chunks, queryTokens) {
  const k1 = 1.4;
  const b = 0.75;
  const docs = chunks.map((c) => tokenize(c.text));
  const avgLen = docs.reduce((s, d) => s + d.length, 0) / (docs.length || 1);
  const df = new Map();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const N = docs.length;

  return docs.map((d) => {
    const tf = new Map();
    for (const t of d) tf.set(t, (tf.get(t) || 0) + 1);
    let score = 0;
    for (const q of new Set(queryTokens)) {
      const f = tf.get(q);
      if (!f) continue;
      const idf = Math.log(1 + (N - df.get(q) + 0.5) / (df.get(q) + 0.5));
      score += idf * ((f * (k1 + 1)) / (f + k1 * (1 - b + (b * d.length) / avgLen)));
    }
    return score;
  });
}

function rrf(rankLists, k = 60) {
  const scores = new Map();
  for (const list of rankLists) {
    list.forEach((id, rank) => scores.set(id, (scores.get(id) || 0) + 1 / (k + rank + 1)));
  }
  return scores;
}

async function atlasVectorSearch(orgId, queryVector, limit) {
  return Chunk.aggregate([
    {
      $vectorSearch: {
        index: config.retrieval.atlasIndex,
        path: 'embedding',
        queryVector,
        numCandidates: 150,
        limit,
        filter: { organizationId: new mongoose.Types.ObjectId(orgId) },
      },
    },
    { $project: { _id: 1, score: { $meta: 'vectorSearchScore' } } },
  ]);
}

/**
 * Load the organization's chunks once per request and search them many times
 * (the main question plus one search per decision condition).
 */
export async function createRetriever(orgId) {
  const chunks = await Chunk.find({ organizationId: orgId })
    .select('documentId filename page chunkIndex text embedding')
    .lean();
  const byId = new Map(chunks.map((c) => [c._id.toString(), c]));

  async function search(queries, topK = config.retrieval.topK) {
    const list = Array.isArray(queries) ? queries : [queries];
    if (chunks.length === 0) return list.map(() => []);

    const vectors = await embedTexts(list, 'RETRIEVAL_QUERY');

    return Promise.all(
      list.map(async (query, qi) => {
        const qv = vectors[qi];

        // 1) vector ranking
        let vectorRanked; // [{id, sim}]
        if (config.retrieval.useAtlasVectorSearch) {
          try {
            const hits = await atlasVectorSearch(orgId, qv, 20);
            vectorRanked = hits.map((h) => ({ id: h._id.toString(), sim: dot(qv, byId.get(h._id.toString())?.embedding || qv) }));
          } catch (err) {
            console.warn('[retrieval] Atlas vector search failed, using in-app search:', err.message);
          }
        }
        if (!vectorRanked) {
          vectorRanked = chunks
            .map((c) => ({ id: c._id.toString(), sim: dot(qv, c.embedding) }))
            .sort((a, b) => b.sim - a.sim)
            .slice(0, 20);
        }

        // 2) keyword ranking
        const qTokens = tokenize(query);
        const kw = bm25Scores(chunks, qTokens);
        const keywordRanked = chunks
          .map((c, i) => ({ id: c._id.toString(), score: kw[i] }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, 20);

        // 3) fuse
        const fused = rrf([vectorRanked.map((x) => x.id), keywordRanked.map((x) => x.id)]);
        const simById = new Map(vectorRanked.map((x) => [x.id, x.sim]));
        const kwById = new Map(keywordRanked.map((x) => [x.id, x.score]));

        return [...fused.entries()]
          .sort((a, b) => b[1] - a[1])
          .slice(0, topK)
          .map(([id, score]) => {
            const c = byId.get(id);
            return {
              id,
              documentId: c.documentId.toString(),
              filename: c.filename,
              page: c.page,
              text: c.text,
              score,
              similarity: simById.get(id) ?? dot(qv, c.embedding),
              keywordScore: kwById.get(id) || 0,
            };
          });
      })
    );
  }

  /**
   * For summary questions: the opening chunks of every document (in reading order),
   * since "summarise it" has no keywords to search for.
   */
  function overview(perDocument = 3, max = 12) {
    const byDoc = new Map();
    for (const c of [...chunks].sort((a, b) => a.page - b.page || a.chunkIndex - b.chunkIndex)) {
      const key = c.documentId.toString();
      if (!byDoc.has(key)) byDoc.set(key, []);
      if (byDoc.get(key).length < perDocument) byDoc.get(key).push(c);
    }
    return [...byDoc.values()]
      .flat()
      .slice(0, max)
      .map((c) => ({
        id: c._id.toString(),
        documentId: c.documentId.toString(),
        filename: c.filename,
        page: c.page,
        text: c.text,
        score: 0,
        similarity: 0,
        keywordScore: 0,
      }));
  }

  return { search, overview, chunkCount: chunks.length };
}
