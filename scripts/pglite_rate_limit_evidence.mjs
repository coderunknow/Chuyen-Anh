// D-SR2 evidence harness: executes the REAL SQL from both Supabase migrations
// in an in-memory Postgres (PGlite / WASM) and demonstrates:
//   (A) OLD behavior (20261029_telemetry_ingest.sql): keyless calls (client_key
//       = null) consume the global 120/10min budget with NO per-client cap, so a
//       keyless flood exhausts the quota for every honest client.
//   (B) HARDENED behavior (20261031_telemetry_hardening.sql): non-32-hex
//       client_key rejected; keyless calls bucketed 'client:missing' cap 5;
//       global budget survives for other clients.
// Read-only w.r.t. any external system: everything runs locally in WASM.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(process.env.PGLITE_NODE_PATH || '/tmp/pw/');
const { PGlite } = require('@electric-sql/pglite');

const REPO = fileURLToPath(new URL('../', import.meta.url));
const oldSql = await readFile(`${REPO}/supabase/migrations/20261029_telemetry_ingest.sql`, 'utf8');
const hardSql = await readFile(`${REPO}/supabase/migrations/20261031_telemetry_hardening.sql`, 'utf8');

const payload = JSON.stringify({
  contract: 1, product: 'Chuyen-Anh', appVersion: 'v1.0.0-rc11',
  events: [{ at: '2026-11-17T00:00:00.000Z', kind: 'boot', name: 'app-boot' }],
  environment: { language: 'vi', interface: 'classic', theme: 'system', viewport: 'desktop', reducedMotion: false }
});

async function freshDb() {
  const db = new PGlite();
  await db.exec(oldSql); // base schema + old function
  return db;
}

async function ingest(db, key) {
  const res = await db.query('select public.telemetry_ingest($1::jsonb, $2) as r', [payload, key]);
  return res.rows[0].r;
}

function summarise(statuses) {
  const counts = {};
  for (const s of statuses) counts[s.status] = (counts[s.status] || 0) + 1;
  const firstGlobal = statuses.findIndex(s => s.status === 'rate_limited' && s.scope === 'global');
  const firstClient = statuses.findIndex(s => s.status === 'rate_limited' && s.scope === 'client');
  const okCount = statuses.filter(s => s.status === 'ok').length;
  const storedRows = null;
  return { counts, okCount, firstGlobal, firstClient };
}

// ---------- (A) OLD function: keyless flood ----------
const dbA = await freshDb();
const oldStatuses = [];
for (let i = 0; i < 130; i += 1) oldStatuses.push(await ingest(dbA, null));
const oldRes = summarise(oldStatuses);
// honest client arrives after the flood with a valid-looking key
const honestAfterFlood = await ingest(dbA, 'a'.repeat(32));
console.log('A) OLD migration, 130 keyless calls:', JSON.stringify(oldRes.counts),
  `firstGlobalBucketIndex=${oldRes.firstGlobal} firstClientRefusal=${oldRes.firstClient}`);
console.log('A) honest client after the keyless flood:', JSON.stringify(honestAfterFlood));
const oldEvidenceOk = oldRes.okCount === 120 && oldRes.firstGlobal === 120 && oldRes.firstClient === -1
  && honestAfterFlood.status === 'rate_limited';

// malformed client_key accepted by OLD function (no format validation)?
const dbA2 = await freshDb();
const evilKey = await ingest(dbA2, "x'); insert into telemetry.reports values (gen_random_uuid());--");
const evilRows = await dbA2.query('select count(*)::int as n from telemetry.reports');
console.log('A) OLD migration accepts a non-hex, injection-shaped client_key:',
  JSON.stringify(evilKey), 'reports rows after:', evilRows.rows[0].n);

// ---------- (B) HARDENED function: same flood ----------
// Two scenarios:
//   B1: a short keyless burst (10 calls): 5 stored, 5 refused client-side, and
//       the global attempt budget (120) still has room for another client.
//   B2: the full 130-call flood: only 5 rows stored (vs 120 old), but refused
//       attempts still increment the global counter (the hardened function
//       counts attempts globally BEFORE the per-client check), so a flood of
//       >120 attempts still closes the window for everyone. Disclosed property.
const dbB = await freshDb();
await dbB.exec(hardSql); // create or replace with the hardened function
const burst = [];
for (let i = 0; i < 10; i += 1) burst.push(await ingest(dbB, null));
const burstRes = summarise(burst);
const otherClient = await ingest(dbB, 'b'.repeat(32)); // a different honest client, same window
console.log('B1) HARDENED migration, 10 keyless calls:', JSON.stringify(burstRes.counts),
  `firstClientRefusal=${burstRes.firstClient} firstGlobalRefusal=${burstRes.firstGlobal}`);
console.log('B1) a different honest client in the same window:', JSON.stringify(otherClient));
const malformedKey = await ingest(dbB, "x'); insert into telemetry.reports values (gen_random_uuid());--");
console.log('B1) HARDENED migration rejects the injection-shaped client_key:', JSON.stringify(malformedKey));

const dbB2 = await freshDb();
await dbB2.exec(hardSql);
const flood = [];
for (let i = 0; i < 130; i += 1) flood.push(await ingest(dbB2, null));
const floodRes = summarise(flood);
console.log('B2) HARDENED migration, 130 keyless calls:', JSON.stringify(floodRes.counts),
  `firstClientRefusal=${floodRes.firstClient} firstGlobalRefusal=${floodRes.firstGlobal}`);

const newEvidenceOk = burstRes.okCount === 5 && burstRes.firstClient === 5 && burstRes.firstGlobal === -1
  && otherClient.status === 'ok' && malformedKey.status === 'invalid'
  && floodRes.okCount === 5 && floodRes.firstClient === 5;

console.log(`RESULT old-behavior-demonstrated=${oldEvidenceOk} hardened-behavior-demonstrated=${newEvidenceOk}`);
process.exit(oldEvidenceOk && newEvidenceOk ? 0 : 1);
