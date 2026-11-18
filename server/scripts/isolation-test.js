/**
 * Tenant isolation test: proves one organization can never see another's data.
 * Runs against the live API (start it first with npm run dev).
 *
 *   npm run test:isolation
 *
 * API-level checks (no AI involved):
 *   1. Each org's document list contains only its own files
 *   2. Org A cannot delete Org B's document (404, not 403, so ids can't be probed)
 *   3. An assistant token cannot be used as a dashboard login
 *   4. A fake assistant token is rejected
 * Assistant-level checks (uses the AI pipeline):
 *   5. Org A's assistant does not answer a question only Org B's documents can answer
 *   6. Org B's assistant does not answer a question only Org A's documents can answer
 *   7. When an org's assistant does answer, every reference is one of its own files
 */
import { call, seedDemoOrgs } from './lib.js';

const results = [];
function check(name, pass, detail = '') {
  results.push({ name, pass });
  console.log(`${pass ? '  PASS' : '  FAIL'}  ${name}${detail ? `  (${detail})` : ''}`);
}

const [A, B] = await seedDemoOrgs();
const aFiles = new Set(A.documents.map((d) => d.filename));
const bFiles = new Set(B.documents.map((d) => d.filename));

console.log('\n──────── API-level isolation ────────');

const { body: aDocs } = await call('GET', '/api/documents', { token: A.token });
check(
  '1a. Org A sees only its own documents',
  aDocs.documents.every((d) => aFiles.has(d.filename) && !bFiles.has(d.filename)),
  `${aDocs.documents.length} docs`
);
const { body: bDocs } = await call('GET', '/api/documents', { token: B.token });
check(
  '1b. Org B sees only its own documents',
  bDocs.documents.every((d) => bFiles.has(d.filename) && !aFiles.has(d.filename)),
  `${bDocs.documents.length} docs`
);

const victim = B.documents[0];
const del = await call('DELETE', `/api/documents/${victim.id}`, { token: A.token, expectError: true });
check("2.  Org A cannot delete Org B's document", del.status === 404, `HTTP ${del.status}`);
const still = await call('GET', '/api/documents', { token: B.token });
check("    Org B's document still exists", still.body.documents.some((d) => d.id === victim.id));

const misuse = await call('GET', '/api/documents', { token: A.assistant.token, expectError: true });
check('3.  Assistant token is rejected by the dashboard API', misuse.status === 403, `HTTP ${misuse.status}`);

const fake = await call('POST', '/api/ask', {
  json: { token: 'asst_' + 'x'.repeat(32), question: 'What is the deadline?' },
  expectError: true,
});
check('4.  Fake assistant token is rejected', fake.status === 401, `HTTP ${fake.status}`);

console.log('\n──────── Assistant-level isolation (uses the AI) ────────');

async function ask(org, question) {
  const { body } = await call('POST', '/api/ask', { json: { token: org.assistant.token, question } });
  return body;
}

const qOnlyB = 'How many earned leave days do I get per year?'; // answer is in Brightline's Leave_Policy.pdf
const r5 = await ask(A, qOnlyB);
check(
  `5.  Org A's assistant does not answer "${qOnlyB}"`,
  r5.status === 'not_found' && !r5.references.some((r) => bFiles.has(r.filename)),
  `status=${r5.status}`
);

const qOnlyA = 'When is the scholarship application deadline?'; // answer is in Northfield's Scholarship_Rules.pdf
const r6 = await ask(B, qOnlyA);
check(
  `6.  Org B's assistant does not answer "${qOnlyA}"`,
  r6.status === 'not_found' && !r6.references.some((r) => aFiles.has(r.filename)),
  `status=${r6.status}`
);

const r7 = await ask(A, qOnlyA);
check(
  "7.  Org A's own answer cites only Org A's files",
  r7.status === 'answered' && r7.references.length > 0 && r7.references.every((r) => aFiles.has(r.filename)),
  r7.references.map((r) => r.display).join('; ')
);

const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
process.exit(failed.length ? 1 : 0);
