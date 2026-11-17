// D-SR2 evidence harness: executes the REAL SQL from both Supabase migrations
// in an in-memory Postgres (PGlite / WASM) and demonstrates:
//   (A) OLD behavior (20261029_telemetry_ingest.sql): keyless calls (client_key
//       = null) consume the global 120/10min budget with NO per-client cap, so a
//       keyless flood exhausts the quota for every honest client.
//   (B) HARDENED behavior (20261031_telemetry_hardening.sql): non-32-hex
//       client_key rejected; keyless calls bucketed 'client:missing' cap 5;
//       global budget survives for other clients.
// Read-only w.r.t. any external system: everything runs locally in WASM.
//
// Window-boundary note: the SQL windows are 600-second floors of now(). A long
// scenario straddling a boundary would reset its counters and fake a failure,
// so every scenario reads telemetry.rate_limits.window_start before and after
// and retries from a fresh database (up to 3 attempts) if the window changed.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
// PGlite is optional session tooling, not an app dependency. Point
// PGLITE_NODE_PATH at a directory containing node_modules/@electric-sql/pglite
// (a trailing slash or a file path both work — createRequire resolves from the
// given base), e.g.:
//   npm install --prefix /tmp/pw --no-save --package-lock=false @electric-sql/pglite
//   PGLITE_NODE_PATH=/tmp/pw/ node scripts/pglite_rate_limit_evidence.mjs
const PGLITE_BASE = process.env.PGLITE_NODE_PATH || '/tmp/pw/';
let PGlite;
try {
  PGlite = createRequire(PGLITE_BASE)('@electric-sql/pglite').PGlite;
} catch {
  console.error('PGlite is not installed. Install it outside the repository, then re-run:');
  console.error('  npm install --prefix /tmp/pw --no-save --package-lock=false @electric-sql/pglite');
  console.error('  PGLITE_NODE_PATH=/tmp/pw/ node scripts/pglite_rate_limit_evidence.mjs');
  process.exit(2);
}

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
  return { counts, okCount, firstGlobal, firstClient };
}

async function windowStart(db) {
  // The same 600-second floor the SQL function computes (20261031 migration,
  // v_window). Reading the DB's clock avoids mistaking "no rows yet" for a
  // window change.
  const res = await db.query(
    "select to_timestamp((floor(extract(epoch from now()) / 600) * 600)::double precision)::text as w"
  );
  return res.rows[0].w;
}

// Runs `scenario(db)` against a fresh database; if the 10-minute window
// changed between the first and the last statement, retries with a new
// database (up to 3 attempts). Returns { value, windowChanged }.
async function withStableWindow(label, scenario) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const db = await freshDb();
    const before = await windowStart(db);
    const value = await scenario(db);
    const after = await windowStart(db);
    if (before === after) return { value, windowChanged: false };
    if (attempt < 3) {
      console.log(`${label}: the 10-minute window changed mid-scenario (${before} -> ${after}); retrying in a fresh database (attempt ${attempt + 1})`);
    }
  }
  console.log(`${label}: the window changed on every retry; treating the scenario as inconclusive`);
  return { value: null, windowChanged: true };
}

// ---------- (A) OLD function: keyless flood ----------
const { value: old, windowChanged: oldWindowChanged } = await withStableWindow('A', async (db) => {
  const statuses = [];
  for (let i = 0; i < 130; i += 1) statuses.push(await ingest(db, null));
  const res = summarise(statuses);
  const honest = await ingest(db, 'a'.repeat(32));
  return { res, honest };
});
console.log('A) OLD migration, 130 keyless calls:', JSON.stringify(old.res.counts),
  `firstGlobalBucketIndex=${old.res.firstGlobal} firstClientRefusal=${old.res.firstClient}`);
console.log('A) honest client after the keyless flood:', JSON.stringify(old.honest));
const oldEvidenceOk = !oldWindowChanged && old.res.okCount === 120 && old.res.firstGlobal === 120
  && old.res.firstClient === -1 && old.honest.status === 'rate_limited';

// malformed client_key accepted by OLD function (no format validation)?
{
  const dbA2 = await freshDb();
  const evilKey = await ingest(dbA2, "x'); insert into telemetry.reports values (gen_random_uuid());--");
  const evilRows = await dbA2.query('select count(*)::int as n from telemetry.reports');
  console.log('A) OLD migration accepts a non-hex, injection-shaped client_key:',
    JSON.stringify(evilKey), 'reports rows after:', evilRows.rows[0].n);
}

// ---------- (B) HARDENED function: same flood ----------
// B1: a short keyless burst (10 calls): 5 stored, 5 refused client-side, and
//     the global attempt budget (120) still has room for another client.
// B2: the full 130-call flood: only 5 rows stored (vs 120 old), but refused
//     attempts still increment the global counter (the hardened function
//     counts attempts globally BEFORE the per-client check), so a flood of
//     >120 attempts still closes the window for everyone. Disclosed property.
const { value: b1, windowChanged: b1WindowChanged } = await withStableWindow('B1', async (db) => {
  await db.exec(hardSql); // create or replace with the hardened function
  const burst = [];
  for (let i = 0; i < 10; i += 1) burst.push(await ingest(db, null));
  const burstRes = summarise(burst);
  const other = await ingest(db, 'b'.repeat(32)); // a different honest client, same window
  const malformed = await ingest(db, "x'); insert into telemetry.reports values (gen_random_uuid());--");
  return { burstRes, other, malformed };
});
console.log('B1) HARDENED migration, 10 keyless calls:', JSON.stringify(b1.burstRes.counts),
  `firstClientRefusal=${b1.burstRes.firstClient} firstGlobalRefusal=${b1.burstRes.firstGlobal}`);
console.log('B1) a different honest client in the same window:', JSON.stringify(b1.other));
console.log('B1) HARDENED migration rejects the injection-shaped client_key:', JSON.stringify(b1.malformed));

const { value: b2, windowChanged: b2WindowChanged } = await withStableWindow('B2', async (db) => {
  await db.exec(hardSql);
  const flood = [];
  for (let i = 0; i < 130; i += 1) flood.push(await ingest(db, null));
  return summarise(flood);
});
console.log('B2) HARDENED migration, 130 keyless calls:', JSON.stringify(b2.counts),
  `firstClientRefusal=${b2.firstClient} firstGlobalRefusal=${b2.firstGlobal}`);

const newEvidenceOk = !b1WindowChanged && !b2WindowChanged
  && b1.burstRes.okCount === 5 && b1.burstRes.firstClient === 5 && b1.burstRes.firstGlobal === -1
  && b1.other.status === 'ok' && b1.malformed.status === 'invalid'
  && b2.okCount === 5 && b2.firstClient === 5;

console.log(`RESULT old-behavior-demonstrated=${oldEvidenceOk} hardened-behavior-demonstrated=${newEvidenceOk}`);
process.exit(oldEvidenceOk && newEvidenceOk ? 0 : 1);
