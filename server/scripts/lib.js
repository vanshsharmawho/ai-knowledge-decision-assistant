import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import 'dotenv/config';

export const API = process.env.SMOKE_API || `http://localhost:${process.env.PORT || 5000}`;
const here = path.dirname(fileURLToPath(import.meta.url));
export const TEST_DATA = path.resolve(here, '../../test-data');

export const DEMO_ORGS = [
  {
    name: 'Northfield University',
    email: 'admin@northfield.test',
    password: 'northfield123',
    folder: 'org-a-university',
  },
  {
    name: 'Brightline Technologies',
    email: 'hr@brightline.test',
    password: 'brightline123',
    folder: 'org-b-company',
  },
];

export async function call(method, url, { token, json, form, expectError = false } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(API + url, { method, headers, body: json ? JSON.stringify(json) : form });
  } catch {
    throw new Error(`Cannot reach ${API}. Start the server first: npm run dev`);
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok && !expectError) throw new Error(`${method} ${url} → ${res.status} ${JSON.stringify(body)}`);
  return { status: res.status, body };
}

/** Log in to a demo org, creating it if needed. Returns the admin JWT. */
export async function loginOrRegister(org) {
  const login = await call('POST', '/api/auth/login', {
    json: { email: org.email, password: org.password },
    expectError: true,
  });
  if (login.status === 200) return login.body.token;
  const reg = await call('POST', '/api/auth/register', {
    json: { name: org.name, email: org.email, password: org.password },
  });
  return reg.body.token;
}

/** Upload every PDF in the org's test-data folder that isn't uploaded yet. */
export async function uploadFolder(token, folder) {
  const { body } = await call('GET', '/api/documents', { token });
  const existing = new Set(body.documents.filter((d) => d.status === 'ready').map((d) => d.filename));
  const dir = path.join(TEST_DATA, folder);
  const files = (await fs.readdir(dir)).filter((f) => f.toLowerCase().endsWith('.pdf'));
  for (const file of files) {
    if (existing.has(file)) {
      console.log(`  · ${file} already uploaded`);
      continue;
    }
    const form = new FormData();
    form.append('file', new Blob([await fs.readFile(path.join(dir, file))], { type: 'application/pdf' }), file);
    const { status, body: up } = await call('POST', '/api/documents', { token, form, expectError: true });
    if (status === 201) console.log(`  ✓ ${file}: ${up.document.pageCount} pages, ${up.document.chunkCount} chunks`);
    else console.log(`  ✗ ${file}: ${up?.error?.message || status}${up?.error?.details?.reason ? ` (${up.error.details.reason})` : ''}`);
  }
}

export async function seedDemoOrgs() {
  const result = [];
  for (const org of DEMO_ORGS) {
    console.log(`\n${org.name}`);
    const token = await loginOrRegister(org);
    await uploadFolder(token, org.folder);
    const { body: assistant } = await call('GET', '/api/assistant', { token });
    const { body: docs } = await call('GET', '/api/documents', { token });
    result.push({ ...org, token, assistant, documents: docs.documents });
  }
  return result;
}
