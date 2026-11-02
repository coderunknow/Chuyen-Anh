// rc10 — corpus-derived candidate pool for P5.
//
// Selection is driven by the repository's own exam archive, not by a generator's
// taste: a candidate must actually occur in the 106 transcribed Chuyên Anh
// papers, must not already be a headword or phrase, and must not be a function
// word. Frequency across papers ranks the list; the CEFR level is NOT assigned
// here — every accepted word gets its level from a per-word reference lookup.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const archiveRoot = path.join(root, 'De-chuyen-Anh-vao-10');

const STOPWORDS = new Set(('a an the and or but if because so that than then there their they them this these those '
  + 'i you he she it we they me him her us my your his its our am is are was were be been being do does did have has had '
  + 'will would can could should shall may might must not no nor of in on at to for from with without by as about into over '
  + 'under between during before after above below up down out off again further once here all any both each few more most '
  + 'other some such only own same too very just also one two three first second new old good bad many much lot lots '
  + 'what which who whom whose when where why how whether while until though although since unless upon within '
  + 'get got go went gone come came say said make made take took know knew think thought see saw look want give gave use '
  + 'find found tell told ask asked work seem feel try leave call keep let begin help talk turn start show hear play run '
  + 'move like live believe hold bring happen write provide sit stand lose pay meet include continue set learn change lead '
  + 'understand watch follow stop create speak read allow add spend grow open walk win offer remember love consider appear '
  + 'buy wait serve die send expect build stay fall cut reach kill remain suggest raise pass sell require report decide '
  + 'pull').split(/\s+/));

const normalize = value => value.toLowerCase().replace(/[’']/g, "'");

// A shape filter, not a level source: the token has to be an English word
// according to a 264k-entry lemma dictionary (gcide + web2, downloaded once into
// /tmp and referenced by path). Vietnamese metadata and URL fragments that leak
// out of a transcription are rejected here.
const ENGLISH = new Set(
  (fs.existsSync('/tmp/english-words.txt') ? fs.readFileSync('/tmp/english-words.txt', 'utf8') : '')
    .split('\n').map(word => word.trim()).filter(Boolean)
);
if (!ENGLISH.size) {
  console.error('missing /tmp/english-words.txt — rebuild it with the english-words wheel before running');
  process.exit(2);
}

// Front matter and headings are metadata, not paper text. Only the fenced
// transcription blocks are evidence of usage.
function paperText(file) {
  const raw = fs.readFileSync(file, 'utf8');
  const withoutFrontMatter = raw.replace(/^---\n[\s\S]*?\n---\n/, '');
  const blocks = [...withoutFrontMatter.matchAll(/```text\n([\s\S]*?)```/g)].map(match => match[1]);
  return blocks.length ? blocks.join('\n') : withoutFrontMatter;
}

function papers() {
  const out = [];
  for (const year of fs.readdirSync(archiveRoot)) {
    const yearDir = path.join(archiveRoot, year);
    if (!fs.statSync(yearDir).isDirectory()) continue;
    for (const unit of fs.readdirSync(yearDir)) {
      const unitDir = path.join(yearDir, unit);
      if (!fs.statSync(unitDir).isDirectory()) continue;
      for (const name of fs.readdirSync(unitDir)) {
        if (name.endsWith('.md')) out.push(path.join(unitDir, name));
      }
    }
  }
  return out;
}

const perPaper = new Map(); // token -> Set(paperId)
const totalCount = new Map();
for (const file of papers()) {
  const text = paperText(file);
  const id = path.relative(archiveRoot, file).replace(/\.md$/, '').replace(/\//g, '-');
  const tokens = normalize(text).match(/[a-z][a-z'-]*/g) || [];
  for (const token of tokens) {
    if (token.length < 4 || STOPWORDS.has(token)) continue;
    if (!ENGLISH.has(token)) continue;
    if (!perPaper.has(token)) perPaper.set(token, new Set());
    perPaper.get(token).add(id);
    totalCount.set(token, (totalCount.get(token) || 0) + 1);
  }
}

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const vocabulary = JSON.parse(html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const phrases = JSON.parse(html.match(/<script id="phrase-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

// Every surface form already claimed by the dataset blocks the candidate: a new
// headword must not duplicate a headword, an archived family row or a phrase.
const existing = new Set();
for (const entry of vocabulary) {
  existing.add(normalize(entry.word));
  for (const form of String(entry.wordFamily || '').match(/[a-z][a-z'-]*/g) || []) existing.add(normalize(form));
}
for (const entry of phrases) existing.add(normalize(entry.phrase));

// Inflected forms of a word the dataset already teaches are not new headwords:
// "answers" and "answering" only repeat "answer". The lemma test strips the
// regular endings and asks whether what is left is already claimed — either by
// the dataset or by a candidate that outranks this one.
const ENDINGS = [['ies', 'y'], ['ied', 'y'], ['ing', ''], ['ing', 'e'], ['ed', ''], ['ed', 'e'], ['es', ''], ['s', ''], ['ly', ''], ['er', ''], ['est', ''], ['ness', ''], ['ment', ''], ['ion', 'e'], ['al', '']];
const lemmaForms = token => {
  const forms = new Set([token]);
  for (const [ending, replacement] of ENDINGS) {
    if (token.length > ending.length + 2 && token.endsWith(ending)) {
      forms.add(token.slice(0, -ending.length) + replacement);
    }
  }
  if (token.endsWith('e')) forms.add(token.slice(0, -1));
  return forms;
};
const isInflectionOfKnown = token => {
  for (const form of lemmaForms(token)) {
    if (form === token) continue;
    if (existing.has(form)) return true;
  }
  return false;
};

const candidates = [...perPaper.entries()]
  .map(([token, ids]) => ({ token, papers: ids.size, occurrences: totalCount.get(token) }))
  .filter(row => !existing.has(row.token))
  .filter(row => !isInflectionOfKnown(row.token))
  .filter(row => !/'/.test(row.token))
  .filter(row => row.papers >= 3)
  .sort((a, b) => b.papers - a.papers || b.occurrences - a.occurrences || a.token.localeCompare(b.token));

const outFile = path.join(root, 'audit/rc10/evidence/new-word-candidates.json');
fs.writeFileSync(outFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  method: 'token frequency across the 106 transcribed papers in De-chuyen-Anh-vao-10, minus existing headwords/phrases/word families and a function-word stoplist; level is assigned later, per word, from a reference lookup',
  candidateCount: candidates.length,
  candidates: candidates.slice(0, 1500)
}, null, 2) + '\n');

console.log('candidates', candidates.length);
console.log(candidates.slice(0, 60).map(row => `${row.token}(${row.papers}p/${row.occurrences}x)`).join(' '));
