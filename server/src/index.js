import fs from 'node:fs/promises';
import { config } from './config.js';
import { connectDb } from './db.js';
import { createApp } from './app.js';

async function main() {
  await fs.mkdir(config.storageDir, { recursive: true });
  await connectDb();
  if (!config.gemini.apiKey) console.warn('[warn] GEMINI_API_KEY is not set: document embeddings will fail.');
  if (!config.groq.apiKey && !config.gemini.apiKey) console.warn('[warn] No LLM key set: questions will fail.');
  console.log(`[llm] primary provider: ${config.llmProvider}${config.groq.apiKey ? ' (groq key set)' : ''}`);
  createApp().listen(config.port, () => console.log(`[api] listening on http://localhost:${config.port}`));
}

main().catch((err) => {
  console.error('[fatal]', err.message);
  process.exit(1);
});
