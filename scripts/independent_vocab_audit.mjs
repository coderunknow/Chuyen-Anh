// Independent CEFR sense audit: re-verifies a deterministic sample of
// source_supported senses against the pinned reference snapshots with fresh
// parsing code (TSV/CSV parsed here, not via scripts/audit_sense_sources.py).
// Every mismatch is printed; a summary reports agreement.
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../', import.meta.url));
const vocab = JSON.parse(await readFile(`${REPO}/data/vocabulary.json`, 'utf8'));

// --- Load references with independent parsers ---
const refs = {};
{
  const csv = await readFile(`${REPO}/audit/v100/refs/cefrj-vocabulary-profile-1.5.csv`, 'utf8');
  const map = new Map();
  for (const line of csv.split('\n').slice(1)) {
    const cols = line.split(',');
    if (cols.length < 3) continue;
    const head = cols[0].trim().toLowerCase();
    const pos = (cols[1] || '').trim().toLowerCase();
    const level = (cols[2] || '').trim().toUpperCase();
    if (!head || !level) continue;
    const key = `${head}|${pos}`;
    if (!map.has(key)) map.set(key, level);
  }
  refs['cefrj-vocabulary-profile-1.5'] = map;
}
{
  const csv = await readFile(`${REPO}/audit/v100/refs/octanove-vocabulary-profile-c1c2-1.0.csv`, 'utf8');
  const map = new Map();
  for (const line of csv.split('\n').slice(1)) {
    const cols = line.split(',');
    if (cols.length < 3) continue;
    const head = cols[0].trim().toLowerCase();
    const pos = (cols[1] || '').trim().toLowerCase();
    const level = (cols[2] || '').trim().toUpperCase();
    if (!head || !level) continue;
    const key = `${head}|${pos}`;
    if (!map.has(key)) map.set(key, level);
  }
  refs['octanove-vocabulary-profile-c1c2-1.0'] = map;
}
{
  const tsv = await readFile(`${REPO}/audit/v100/refs/oxford-3000.en.tsv`, 'utf8');
  const map = new Map();
  for (const line of tsv.split('\n').slice(1)) {
    const cols = line.split('\t');
    if (cols.length < 5) continue;
    const head = cols[0].trim().toLowerCase();
    const pos = (cols[3] || '').trim().toLowerCase();
    const level = (cols[4] || '').trim().toUpperCase();
    if (!head || !level) continue;
    const key = `${head}|${pos}`;
    if (!map.has(key)) map.set(key, level);
  }
  refs['oxford-3000-wordlist'] = map;
}
{
  const tsv = await readFile(`${REPO}/audit/v100/refs/oxford-5000-expanded.en.tsv`, 'utf8');
  const map = new Map();
  for (const line of tsv.split('\n').slice(1)) {
    const cols = line.split('\t');
    if (cols.length < 5) continue;
    const head = cols[0].trim().toLowerCase();
    const pos = (cols[3] || '').trim().toLowerCase();
    const level = (cols[4] || '').trim().toUpperCase();
    if (!head || !level) continue;
    const key = `${head}|${pos}`;
    if (!map.has(key)) map.set(key, level);
  }
  refs['oxford-5000-wordlist'] = map;
}
{
  const tsv = await readFile(`${REPO}/audit/v100/refs/cambridge-evp-verified.tsv`, 'utf8');
  const map = new Map();
  for (const line of tsv.split('\n').slice(1)) {
    const cols = line.split('\t');
    if (cols.length < 4) continue;
    const head = cols[0].trim().toLowerCase();
    const pos = (cols[1] || '').trim().toLowerCase();
    const level = (cols[3] || '').trim().toUpperCase();
    if (!head || !level) continue;
    const key = `${head}|${pos}`;
    if (!map.has(key)) map.set(key, level);
  }
  refs['cambridge-evp'] = map;
}

// POS aliasing between the app's short POS and reference POS labels.
const POS_ALIAS = {
  n: ['noun', 'n'], v: ['verb', 'v'], adj: ['adjective', 'adj'], adv: ['adverb', 'adv'],
  prep: ['preposition', 'prep'], conj: ['conjunction', 'conj'], pron: ['pronoun', 'pron'],
  det: ['determiner', 'det'], exclaim: ['exclamation', 'exclaim'], number: ['number', 'num']
};

let checked = 0, agree = 0;
const mismatches = [];
const unverifiable = [];

// Deterministic sample: every candidate sense whose FIRST source ref is loaded,
// stride tuned to yield roughly 200 checked senses.
const rows = vocab.rows || vocab;
const candidates = [];
const refNames = {};
for (const row of rows) {
  for (const sense of row.senses || []) {
    if (sense.evidence !== 'source_supported' && sense.evidence !== 'cross_validated') continue;
    const src = (sense.sources || [])[0];
    if (!src) continue;
    refNames[src.ref] = (refNames[src.ref] || 0) + 1;
    if (!refs[src.ref]) continue;
    candidates.push({ row, sense, src });
  }
}
console.error('first-source ref distribution:', JSON.stringify(refNames));
const stride = Math.max(1, Math.floor(candidates.length / 200));
for (let i = 0; i < candidates.length && checked < 220; i += stride) {
  const { row, sense, src } = candidates[i];
  const map = refs[src.ref];
  const posList = POS_ALIAS[sense.pos] || [sense.pos];
  const head = row.word.toLowerCase();
  const locMatch = /headword=([^,]+), pos=([^,]+), CEFR=([A1-C2])/i.exec(src.locator || '');
  let found = null;
  for (const pos of posList) {
    const v = map.get(`${head}|${pos}`);
    if (v !== undefined) { found = { pos, level: v }; break; }
  }
  if (!found) { unverifiable.push(`${row.word}/${sense.pos}@${src.ref}`); continue; }
  checked += 1;
  if (found.level === sense.cefr) { agree += 1; continue; }
  mismatches.push({
    word: row.word, senseId: sense.senseId, ref: src.ref,
    stored: sense.cefr, reference: found.level, refPos: found.pos,
    locator: src.locator
  });
}

console.log(JSON.stringify({
  sampleTarget: 220, checked, agree,
  agreementPct: checked ? +(100 * agree / checked).toFixed(1) : null,
  mismatches, unverifiableCount: unverifiable.length,
  unverifiableSample: unverifiable.slice(0, 8)
}, null, 2));
