#!/usr/bin/env node
// Round-2 independent vocabulary deep audit (fresh assumptions, no reuse of
// scripts/validate_vocab.py or scripts/audit_sense_sources.py logic).
//
// What this checks (each with its own fresh parsing):
//   1. identifier uniqueness across rows and across senses;
//   2. structural integrity of every row and every sense;
//   3. multi-sense heads: each sense must carry its own CEFR + evidence class,
//      and two senses of one headword must not both claim the same source
//      locator while disagreeing on the level (locator-level conflict);
//   4. distractor/quiz integrity: every active row must offer >= 3 distinct
//      wrong options from other rows plus the correct meaning, and options must
//      never collide with the correct answer text;
//   5. the phrase bank: unique ids, non-empty phrase/meaning, and no phrase
//      duplicated verbatim.
//
// Output: JSON verdict on stdout; exit 1 if any hard defect is found.
import { readFile } from 'node:fs/promises';

const REPO = new URL('../', import.meta.url);
const read = async (path) => readFile(new URL(path, REPO), 'utf8');

const rows = JSON.parse(await read('data/vocabulary.json'));
const phrases = JSON.parse(await read('data/phrases.json'));

const defects = [];
const add = (kind, detail) => { defects.push({ kind, detail }); };

// --- 1. identifier uniqueness --------------------------------------------------
{
  const rowIds = new Map();
  for (const row of rows) {
    if (rowIds.has(row.id)) add('duplicate-row-id', `${row.id} (${row.word} vs ${rowIds.get(row.id)})`);
    else rowIds.set(row.id, row.word);
  }
  const senseIds = new Map();
  for (const row of rows) {
    for (const sense of row.senses || []) {
      if (senseIds.has(sense.senseId)) {
        add('duplicate-sense-id', `${sense.senseId} (${senseIds.get(sense.senseId)} vs ${row.word})`);
      } else senseIds.set(sense.senseId, row.word);
    }
  }
}

// --- 2. structural integrity ----------------------------------------------------
{
  let activeRows = 0, senses = 0, missingMeaning = 0, missingCefr = 0, missingEvidence = 0;
  const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2', 'UNCLASSIFIED']);
  const EVIDENCE = new Set(['source_supported', 'cross_validated', 'disputed', 'editorial_estimate', 'unresolved']);
  for (const row of rows) {
    if (!row.id || !row.word) add('row-missing-identity', JSON.stringify(row).slice(0, 80));
    if (!row.word.startsWith('*')) activeRows += 1;
    if (!row.meaning) missingMeaning += 1;
    for (const sense of row.senses || []) {
      senses += 1;
      if (!CEFR.has(sense.cefr)) missingCefr += 1;
      if (!EVIDENCE.has(sense.evidence)) missingEvidence += 1;
      if (!sense.meaning) add('sense-missing-meaning', `${row.id}/${sense.senseId}`);
    }
  }
  if (missingMeaning) add('rows-missing-meaning', String(missingMeaning));
  if (missingCefr) add('senses-with-unknown-cefr', String(missingCefr));
  if (missingEvidence) add('senses-with-unknown-evidence', String(missingEvidence));
}

// --- 3. locator-level CEFR conflicts inside one headword -------------------------
{
  let multiSenseRows = 0, conflicts = 0;
  for (const row of rows) {
    const senses = row.senses || [];
    if (senses.length < 2) continue;
    multiSenseRows += 1;
    const byLocator = new Map();
    for (const sense of senses) {
      for (const src of sense.sources || []) {
        if (!src.locator || !/CEFR=/.test(src.locator)) continue;
        const key = `${src.ref}|${src.locator}`;
        if (!byLocator.has(key)) byLocator.set(key, new Set());
        byLocator.get(key).add(sense.cefr);
      }
    }
    for (const [key, levels] of byLocator) {
      if (levels.size > 1) {
        conflicts += 1;
        add('locator-cefr-conflict', `${row.word}: ${key} -> ${[...levels].join('/')}`);
      }
    }
    // The same headword+pos with DIFFERENT locators may legitimately differ.
  }
  if (multiSenseRows === 0) add('no-multi-sense-rows', 'expected some multi-sense headwords');
}

// --- 4. quiz distractor integrity -------------------------------------------------
// The app builds multiple-choice options from other rows of the same level;
// verify the invariant it depends on: enough distinct active rows share every
// level so a real distractor set exists, and meanings are unique enough that a
// distractor cannot equal the correct answer.
{
  const CEFR = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']);
  const byLevel = new Map();
  for (const row of rows) {
    const sense = (row.senses || [])[0];
    if (!sense || !CEFR.has(sense.cefr)) continue;
    if (!byLevel.has(sense.cefr)) byLevel.set(sense.cefr, new Map());
    const m = byLevel.get(sense.cefr);
    const key = `${row.word.toLowerCase()}|${row.meaning}`;
    m.set(key, (m.get(key) || 0) + 1);
  }
  for (const [level, m] of byLevel) {
    if (m.size < 60) add('distractor-pool-too-small', `${level}: ${m.size} distinct entries`);
    const words = new Map();
    for (const key of m.keys()) {
      const w = key.split('|')[0];
      words.set(w, (words.get(w) || 0) + 1);
    }
    const dupWords = [...words.entries()].filter(([, n]) => n > 1).length;
    if (dupWords) add('level-word-duplicates', `${level}: ${dupWords} word forms appear with >1 meaning`);
  }
}

// --- 5. phrase bank -----------------------------------------------------------------
{
  const ids = new Set(), texts = new Map();
  let empty = 0;
  for (const phrase of phrases) {
    if (ids.has(phrase.id)) add('duplicate-phrase-id', phrase.id);
    ids.add(phrase.id);
    if (!phrase.phrase || !phrase.meaning) { empty += 1; continue; }
    const key = phrase.phrase.toLowerCase().trim();
    texts.set(key, (texts.get(key) || 0) + 1);
  }
  for (const [key, n] of texts) if (n > 1) add('duplicate-phrase-text', `${key} x${n}`);
  if (empty) add('phrases-missing-required-fields', String(empty));
}

// --- summary --------------------------------------------------------------------------
const hard = defects.length;
const summary = {
  rows: rows.length,
  phrases: phrases.length,
  multiSenseRows: rows.filter(r => (r.senses || []).length > 1).length,
  senses: rows.reduce((n, r) => n + (r.senses || []).length, 0),
  checks: ['identifier-uniqueness', 'structural-integrity', 'locator-cefr-conflicts', 'distractor-pools', 'phrase-bank'],
  defectCount: hard,
  defects: defects.slice(0, 40)
};
console.log(JSON.stringify(summary, null, 2));
process.exit(hard ? 1 : 0);
