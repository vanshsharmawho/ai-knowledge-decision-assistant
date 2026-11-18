/**
 * Quick end-to-end check of the backend, no frontend needed.
 *
 *   node scripts/smoke-test.js path/to/some.pdf "Your question here"
 *
 * Registers a throwaway organization, uploads the PDF, fetches the assistant
 * token, asks the question (with the pipeline trace) and prints the result.
 */
import fs from 'node:fs/promises';
import path from 'node:path';
import 'dotenv/config';

const API = process.env.SMOKE_API || `http://localhost:${process.env.PORT || 5000}`;
const [pdfPath, question = 'What is this document about?'] = process.argv.slice(2);

if (!pdfPath) {
  console.log('Usage: node scripts/smoke-test.js <file.pdf> "question"');
  process.exit(1);
}

async function call(method, url, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  const res = await fetch(API + url, { method, headers, body: json ? JSON.stringify(json) : form });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(body)}`);
  return body;
}

const stamp = Date.now();
const { token } = await call('POST', '/api/auth/register', {
  json: { name: `Smoke Test Org ${stamp}`, email: `smoke${stamp}@example.com`, password: 'password123' },
});
console.log('✓ registered');

const form = new FormData();
const buf = await fs.readFile(pdfPath);
form.append('file', new Blob([buf], { type: 'application/pdf' }), path.basename(pdfPath));
const { document } = await call('POST', '/api/documents', { token, form });
console.log(`✓ uploaded ${document.filename}: ${document.pageCount} pages, ${document.chunkCount} chunks`);

const assistant = await call('GET', '/api/assistant', { token });
console.log(`✓ assistant URL: ${assistant.url}`);

const t = Date.now();
const answer = await call('POST', '/api/ask', { json: { token: assistant.token, question, debug: true } });
console.log(`\n✓ answered in ${Date.now() - t} ms\n`);
console.log(JSON.stringify(answer, null, 2));
