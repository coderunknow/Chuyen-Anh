// rc10 — the resumable audit worklist for P3/P4.
//
// Joins the dataset to the per-entry exam evidence and orders the work by risk:
// entries with no occurrence in the 106-paper archive first (their exam value is
// unproven), then Unclassified, then the rest. Deterministic, so a resumed run
// sees the same order.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const evidenceDir = path.join(root, 'audit/rc10/evidence');

const readJsonl = file => fs.readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map(line => JSON.parse(line));
const vocabEvidence = readJsonl(path.join(evidenceDir, 'exam-occurrences-vocabulary.jsonl'));
const phraseEvidence = readJsonl(path.join(evidenceDir, 'exam-occurrences-phrases.jsonl'));

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vocabulary = JSON.parse(html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const phrases = JSON.parse(html.match(/<script id="phrase-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const byId = new Map(vocabEvidence.map(row => [row.id, row]));
const phraseById = new Map(phraseEvidence.map(row => [row.id, row]));

const levelOf = tags => (tags || []).map(tag => tag.match(/^level:(\w+)$/)?.[1]).filter(Boolean)[0] || 'UNCLASSIFIED';
const SOURCE_HINT = {
  editorial: 'editorial label, no dictionary citation in the row',
  dictionary: 'row cites a dictionary',
  'exam-corpus': 'row cites the exam archive'
};
const sourceOf = tags => {
  const tag = (tags || []).find(value => /^level-source:/.test(value));
  return tag ? tag.split(':')[1] : 'none';
};

const rows = vocabulary.map(entry => {
  const evidence = byId.get(entry.id);
  return {
    kind: 'vocabulary',
    id: entry.id,
    item: entry.word,
    pos: entry.pos || '',
    storedLevel: levelOf(entry.tags),
    levelSource: sourceOf(entry.tags),
    levelSourceNote: SOURCE_HINT[sourceOf(entry.tags)] || 'no level-source tag',
    familyHead: entry.familyHead || null,
    archived: (entry.tags || []).includes('curation:archived'),
    examOccurrences: evidence ? evidence.examOccurrenceCount : 0,
    examPapers: evidence ? evidence.papersWithOccurrence : 0,
    riskScore:
      (evidence && evidence.examOccurrenceCount === 0 ? 3 : 0)
      + (levelOf(entry.tags) === 'UNCLASSIFIED' ? 2 : 0)
      + (sourceOf(entry.tags) === 'editorial' ? 1 : 0)
      + ((entry.tags || []).includes('curation:archived') ? 1 : 0),
    status: 'not_inspected'
  };
});

const phraseRows = phrases.map(entry => {
  const evidence = phraseById.get(entry.id);
  return {
    kind: 'phrase',
    id: entry.id,
    item: entry.phrase,
    type: entry.type || '',
    storedLevel: levelOf(entry.tags),
    levelSource: sourceOf(entry.tags),
    examOccurrences: evidence ? evidence.examOccurrenceCount : 0,
    examPapers: evidence ? evidence.papersWithOccurrence : 0,
    riskScore: (evidence && evidence.examOccurrenceCount === 0 ? 3 : 0) + (levelOf(entry.tags) === 'UNCLASSIFIED' ? 2 : 0),
    status: 'not_inspected'
  };
});

const order = (a, b) => b.riskScore - a.riskScore
  || a.storedLevel.localeCompare(b.storedLevel)
  || String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
rows.sort(order);
phraseRows.sort(order);

const write = (name, data) => {
  const body = JSON.stringify(data, null, 2) + '\n';
  const file = path.join(evidenceDir, name);
  fs.writeFileSync(file, body);
  return { file: path.relative(root, file), sha256: crypto.createHash('sha256').update(body).digest('hex') };
};

const vocabFile = write('worklist-vocabulary.json', rows);
const phraseFile = write('worklist-phrases.json', phraseRows);

const by = (list, key) => list.reduce((acc, row) => { acc[row[key]] = (acc[row[key]] || 0) + 1; return acc; }, {});
console.log(JSON.stringify({
  vocabulary: { rows: rows.length, byLevel: by(rows, 'storedLevel'), bySource: by(rows, 'levelSource'), file: vocabFile },
  phrases: { rows: phraseRows.length, byLevel: by(phraseRows, 'storedLevel'), file: phraseFile },
  firstTenVocabulary: rows.slice(0, 10).map(row => `${row.id} ${row.item} (${row.storedLevel}/${row.levelSource}, exam=${row.examOccurrences})`),
  firstTenPhrases: phraseRows.slice(0, 10).map(row => `${row.id} ${row.item} (${row.storedLevel}, exam=${row.examOccurrences})`)
}, null, 2));
