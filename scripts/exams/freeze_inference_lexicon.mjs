#!/usr/bin/env node
// rc10: write the reviewed boundary for exam answer-key *inference*.
//
// `scripts/exams/build_answer_keys.mjs` infers a provisional key for a paper whose
// own key is missing by scoring options against the lexical evidence in the
// teaching bank (the phrase bank and the vocabulary list). That makes the exam
// data depend on a dataset that keeps growing — and rc10 grew it by 2,000 words
// and 314 phrases. Measured on this branch: with the enlarged bank, eight items
// that had no key at all became "scorable", and one of them was wrong
// (`2022/bac-kan/so` q33, inferred "A. way" where the paper's own gloss reads
// "get/fall/settle into a routine", i.e. "C. routine").
//
// So the inference runs against a pinned lexicon instead: the vocabulary and
// phrases that existed when the keys were last reviewed. A larger bank must never
// make an inference look more confident about a specific paper.
//
//   node scripts/exams/freeze_inference_lexicon.mjs --from c427be2
//   node scripts/exams/freeze_inference_lexicon.mjs            # pin the current bank
//
// Extending the pin is a human decision: run this script, then review the
// diff of `data/exam-answer-keys.json` it makes possible, and say in the commit
// which new keys you accept and why.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = process.argv.slice(2);
const fromIndex = args.indexOf('--from');
const revision = fromIndex >= 0 ? args[fromIndex + 1] : null;
const out = path.join(root, 'scripts/exams/inference-lexicon.json');

function read(relative) {
  if (revision) {
    return JSON.parse(execFileSync('git', ['show', `${revision}:${relative}`],
      { cwd: root, encoding: 'utf8', maxBuffer: 1 << 30 }));
  }
  return JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
}

const vocabulary = read('data/vocabulary.json');
const phrases = read('data/phrases.json');
const resolved = revision
  ? execFileSync('git', ['rev-parse', revision], { cwd: root, encoding: 'utf8' }).trim()
  : null;

const pin = {
  generatedBy: 'scripts/exams/freeze_inference_lexicon.mjs',
  frozenAt: resolved || 'working tree',
  rule: 'Exam answer-key inference may only use the lexical evidence that existed '
    + 'when the keys were last reviewed. A row added to the teaching bank afterwards '
    + 'is not evidence about a specific exam paper, so it cannot change an inferred '
    + 'answer until a human reviews the extension.',
  counts: { vocabulary: vocabulary.length, phrases: phrases.length },
  vocabulary: vocabulary.map(row => String(row.word).toLowerCase()),
  phrases: phrases.map(row => String(row.phrase).toLowerCase())
};

fs.writeFileSync(out, JSON.stringify(pin, null, 1) + '\n');
console.log(`Pinned ${pin.counts.vocabulary} vocabulary rows and ${pin.counts.phrases} phrases `
  + `from ${pin.frozenAt} to ${path.relative(root, out)}.`);
