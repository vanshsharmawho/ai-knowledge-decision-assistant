/**
 * Creates the two demo organizations and uploads their PDFs from test-data/.
 * Safe to run more than once. The server must be running (npm run dev).
 *
 *   npm run seed
 */
import { seedDemoOrgs } from './lib.js';

const orgs = await seedDemoOrgs();

console.log('\n──────── Demo organizations ready ────────');
for (const o of orgs) {
  console.log(`\n${o.name}`);
  console.log(`  dashboard login : ${o.email} / ${o.password}`);
  console.log(`  documents       : ${o.documents.map((d) => d.filename).join(', ')}`);
  console.log(`  assistant URL   : ${o.assistant.url}`);
}
console.log('\nTest questions: test-data/TEST_QUESTIONS.md');
