// rc10 — turn a transcribed reference word list into per-entry attestations.
//
// The cache (`evidence/oxford-wordlist.jsonl`) holds entries transcribed verbatim
// from the Oxford 3000/5000 list: headword, part of speech, CEFR level, plus the
// list URL, the alphabetical section it came from and the retrieval date. One
// list supports many rows — but each row gets its own record naming the exact
// entry that supports it, so a reviewer can re-check any single claim.
//
// Output: `evidence/reference-attestations.jsonl` with one record per matched row
// (agreeing or disagreeing), and a summary. Rows that no list entry covers are
// untouched and stay `machine_assessed`.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const ev = path.join(root, 'audit/rc10/evidence');

const readJsonl = file => fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const cache = readJsonl(path.join(ev, 'oxford-wordlist.jsonl'));
const audit = readJsonl(path.join(ev, 'p3-p4-audit.jsonl'));
const manual = new Set(readJsonl(path.join(ev, 'manual-verifications.jsonl')).map(row => `${row.kind}:${row.id}`));

const blocksPath = path.join(ev, 'correction-blocks.jsonl');
const blockedIds = new Set(fs.existsSync(blocksPath) ? readJsonl(blocksPath).map(row => row.id) : []);
// The seed set (and therefore the study surface) is B1–C2 on purpose; a reference
// level below that band is recorded, not written. Kept in sync with
// tools/apply-attested-corrections.py.
const STUDY_SCOPE = new Set(['B1', 'B2', 'C1', 'C2']);

const POS = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition', conj: 'conjunction', pron: 'pronoun', det: 'determiner', exclamation: 'exclamation', number: 'number', modal: 'modal verb', 'indefinite article': 'indefinite article' };
const SPOKEN = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb', prep: 'preposition' };

const index = new Map();
for (const entry of cache) {
  const key = entry.word.toLowerCase();
  if (!index.has(key)) index.set(key, []);
  index.get(key).push(entry);
}

const out = [];
for (const row of audit) {
  if (row.kind !== 'vocabulary' || manual.has(`vocabulary:${row.id}`)) continue;
  const wantPos = SPOKEN[row.pos] || '';
  const candidates = (index.get(String(row.item).toLowerCase()) || []).filter(entry => !wantPos || entry.pos === wantPos);
  if (!candidates.length) continue;
  const entry = candidates[0];
  const agree = entry.level === row.storedLevel;
  out.push({
    kind: 'vocabulary',
    id: row.id,
    item: row.item,
    pos: row.pos,
    storedLevel: row.storedLevel,
    reference: entry.source,
    url: entry.url,
    entryUrl: entry.entryUrl,
    locator: entry.locator,
    retrieved: entry.retrieved,
    referenceLabel: entry.level,
    evidenceStatus: 'source_attested',
    excerpt: `${entry.word} ${entry.pos} ${entry.level}`,
    decision: agree ? 'accept' : 'correct',
    newLevel: agree ? null : entry.level,
    /** ids 1–913 are frozen in the dev4 evidence ledger; see METHODOLOGY §7. */
    ledgerFrozen: Number(row.id) <= 913,
    reasoning: agree
      ? `Stored ${row.storedLevel} agrees with the level printed for this entry in the reference list.`
      : `Stored ${row.storedLevel} disagrees with the level printed for this entry in the reference list; the effective dataset ${Number(row.id) <= 913 ? 'keeps the stored value until the ledger revision is recorded' : 'takes the attested level'}.`
  });
}

fs.writeFileSync(path.join(ev, 'reference-attestations.jsonl'), out.map(row => JSON.stringify(row)).join('\n') + (out.length ? '\n' : ''));
const summary = {
  generatedAt: new Date().toISOString(),
  reference: cache[0]?.source,
  cacheEntries: cache.length,
  matched: out.length,
  // Compared against the record as it stands now; corrections already written are
  // listed in evidence/corrections-applied.jsonl.
  agreeWithCurrentRecord: out.filter(row => row.decision === 'accept').length,
  disagreeWithCurrentRecord: out.filter(row => row.decision === 'correct').length,
  frozenIds: out.filter(row => row.ledgerFrozen).length,
  applied: out.filter(row => row.decision === 'correct' && !row.ledgerFrozen
    && !blockedIds.has(row.id) && STUDY_SCOPE.has(row.newLevel))
    .map(row => ({ id: row.id, item: row.item, from: row.storedLevel, to: row.newLevel })),
  blocked: out.filter(row => row.decision === 'correct' && blockedIds.has(row.id))
    .map(row => ({ id: row.id, item: row.item, from: row.storedLevel, to: row.newLevel })),
  belowStudyScope: out.filter(row => row.decision === 'correct' && !row.ledgerFrozen
    && !blockedIds.has(row.id) && !STUDY_SCOPE.has(row.newLevel))
    .map(row => ({ id: row.id, item: row.item, from: row.storedLevel, to: row.newLevel })),
  pendingLedger: out.filter(row => row.decision === 'correct' && row.ledgerFrozen).map(row => ({ id: row.id, item: row.item, from: row.storedLevel, to: row.newLevel }))
};
fs.writeFileSync(path.join(ev, 'reference-attestations-summary.json'), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
