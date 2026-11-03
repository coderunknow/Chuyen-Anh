// rc10 — per-entry examination evidence from the repository's own exam archive.
//
// What this does: for every vocabulary row and every phrase, it finds the exact
// occurrences inside the 111 exam-paper transcriptions under
// `De-chuyen-Anh-vao-10/**` and writes one evidence record per entry.
//
// What this is NOT: it is not a claim that the word appeared in an *official*
// paper. Every transcription in that archive is a re-post (`xac_minh:
// ban-dang-lai-…`, source `tailieudieuky.com`), so the evidence class recorded
// here is `archive_transcription_repost`, never `official_paper`. The record
// carries the paper id, the front-matter provenance fields, the page anchor and
// a short excerpt so a reviewer can check the occurrence by hand.
//
// Reproducible: same repository state in, same JSONL out.
//
// Usage: node audit/rc10/tools/exam-evidence.mjs [--limit N]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const archiveRoot = path.join(root, 'De-chuyen-Anh-vao-10');
const outDir = path.join(root, 'audit/rc10/evidence');
const ACCESS_DATE = '2026-11-02';
const MAX_PAPERS_PER_ENTRY = 3;
const MAX_EXCERPT_WORDS = 14;

const read = file => fs.readFileSync(file, 'utf8');

// ---- the archive -----------------------------------------------------------
function listPapers(dir) {
  const papers = [];
  for (const year of fs.readdirSync(dir)) {
    const yearDir = path.join(dir, year);
    if (!fs.statSync(yearDir).isDirectory()) continue;
    for (const unit of fs.readdirSync(yearDir)) {
      const unitDir = path.join(yearDir, unit);
      if (!fs.statSync(unitDir).isDirectory()) continue;
      for (const name of fs.readdirSync(unitDir)) {
        if (!name.endsWith('.md')) continue;
        papers.push(path.join(unitDir, name));
      }
    }
  }
  return papers.sort();
}

function parseFrontMatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---\n/);
  const fields = {};
  if (!match) return { fields, body: text };
  for (const line of match[1].split('\n')) {
    const entry = line.match(/^([a-z_]+):\s*"?(.*?)"?\s*$/);
    if (entry) fields[entry[1]] = entry[2];
  }
  return { fields, body: text.slice(match[0].length) };
}

// The transcriptions wrap page text in ```text fences; the page heading above
// each fence is the anchor a reviewer needs.
function extractUnits(body) {
  const units = [];
  const lines = body.split('\n');
  let section = 'unknown';
  let buffer = null;
  for (const line of lines) {
    const heading = line.match(/^#{1,6}\s+(.*)$/);
    if (heading) {
      section = heading[1].trim();
      continue;
    }
    if (line.trim().startsWith('```')) {
      if (buffer) { units.push({ section, text: buffer.join('\n') }); buffer = null; } else { buffer = []; }
      continue;
    }
    if (buffer) buffer.push(line);
  }
  if (buffer) units.push({ section, text: buffer.join('\n') });
  return units;
}

const papers = listPapers(archiveRoot).map(file => {
  const { fields, body } = parseFrontMatter(read(file));
  const units = extractUnits(body);
  return {
    id: fields.id || path.relative(archiveRoot, file).replace(/\.md$/, ''),
    year: fields.nam_thi || '',
    province: fields.tinh_thanh || '',
    unit: fields.don_vi || '',
    sourceUrl: fields.nguon_trang || '',
    accessDate: fields.ngay_truy_cap || '',
    verified: fields.xac_minh || '',
    quality: fields.chat_luong || '',
    contentSha256: fields.sha256_noi_dung || '',
    units
  };
});

// ---- indexing --------------------------------------------------------------
// Normalised token -> [{ paper, unit, token position }]. Inflections are not
// folded: "argue" and "argued" are different tokens, and the record says which
// one was found.
const normalize = value => String(value).toLowerCase().replace(/[’']/g, "'").trim();
const WORD_RE = /[a-z][a-z'’-]*/g;
const postings = new Map();
for (const paper of papers) {
  for (const unit of paper.units) {
    const tokens = normalize(unit.text).match(WORD_RE) || [];
    tokens.forEach((token, index) => {
      const clean = token.replace(/[’']/g, "'");
      if (!postings.has(clean)) postings.set(clean, []);
      const list = postings.get(clean);
      // One posting per paper+section is enough to cite; keep memory bounded.
      const last = list[list.length - 1];
      if (last && last.paperId === paper.id && last.section === unit.section) return;
      list.push({ paperId: paper.id, section: unit.section, index, tokens });
    });
  }
}

function excerptAt(tokens, index) {
  const start = Math.max(0, index - Math.floor(MAX_EXCERPT_WORDS / 2));
  const slice = tokens.slice(start, start + MAX_EXCERPT_WORDS);
  return `${start > 0 ? '… ' : ''}${slice.join(' ')} …`;
}

function occurrencesFor(headword) {
  const key = normalize(headword);
  const hits = postings.get(key);
  if (!hits) return [];
  const byPaper = new Map();
  for (const hit of hits) {
    if (!byPaper.has(hit.paperId)) byPaper.set(hit.paperId, []);
    byPaper.get(hit.paperId).push(hit);
  }
  const records = [];
  for (const [paperId, hitsInPaper] of byPaper) {
    const paper = papers.find(candidate => candidate.id === paperId);
    const first = hitsInPaper[0];
    records.push({
      evidenceClass: 'archive_transcription_repost',
      paperId,
      year: paper.year,
      province: paper.province,
      unit: paper.unit,
      section: first.section,
      occurrencesInPaper: hitsInPaper.length,
      excerpt: excerptAt(first.tokens, first.index),
      provenance: {
        sourceUrl: paper.sourceUrl,
        accessDate: paper.accessDate,
        verifiedLabel: paper.verified,
        transcriptionQuality: paper.quality,
        contentSha256: paper.contentSha256
      },
      retrieved: ACCESS_DATE,
      note: 'Re-posted transcription; occurrence is verifiable in this archive, not an official-paper verification.'
    });
  }
  records.sort((a, b) => b.occurrencesInPaper - a.occurrencesInPaper);
  return records.slice(0, MAX_PAPERS_PER_ENTRY);
}

// ---- entries ---------------------------------------------------------------
const html = read(path.join(root, 'index.html'));
const vocabulary = JSON.parse(html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const phrases = JSON.parse(html.match(/<script id="phrase-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const limitArg = process.argv.indexOf('--limit');
const limit = limitArg > -1 ? Number(process.argv[limitArg + 1]) : Infinity;

fs.mkdirSync(outDir, { recursive: true });

function writeJsonl(name, rows) {
  const file = path.join(outDir, name);
  const body = rows.map(row => JSON.stringify(row)).join('\n') + (rows.length ? '\n' : '');
  fs.writeFileSync(file, body);
  return { file, sha256: crypto.createHash('sha256').update(body).digest('hex'), bytes: Buffer.byteLength(body) };
}

const vocabRows = [];
for (const entry of vocabulary.slice(0, Number.isFinite(limit) ? limit : undefined)) {
  const records = occurrencesFor(entry.word);
  vocabRows.push({
    kind: 'vocabulary',
    id: entry.id,
    item: entry.word,
    pos: entry.pos || '',
    storedLevel: (entry.tags || []).map(tag => tag.match(/^level:(\w+)$/)?.[1]).filter(Boolean)[0] || 'UNCLASSIFIED',
    examOccurrenceCount: records.reduce((sum, record) => sum + record.occurrencesInPaper, 0),
    papersWithOccurrence: records.length,
    examEvidence: records
  });
}

const phraseRows = [];
for (const entry of phrases.slice(0, Number.isFinite(limit) ? limit : undefined)) {
  const head = String(entry.phrase).split(/\s+/)[0];
  const full = normalize(entry.phrase).match(WORD_RE)?.join(' ');
  const phraseHits = [];
  if (full) {
    for (const paper of papers) {
      for (const unit of paper.units) {
        const normalizedText = normalize(unit.text).replace(/\s+/g, ' ');
        const at = normalizedText.indexOf(full);
        if (at === -1) continue;
        const before = normalizedText.slice(0, at).split(' ').length;
        const tokens = normalizedText.match(WORD_RE) || [];
        phraseHits.push({
          evidenceClass: 'archive_transcription_repost',
          paperId: paper.id,
          year: paper.year,
          province: paper.province,
          unit: paper.unit,
          section: unit.section,
          occurrencesInPaper: 1,
          excerpt: excerptAt(tokens, before),
          provenance: {
            sourceUrl: paper.sourceUrl,
            accessDate: paper.accessDate,
            verifiedLabel: paper.verified,
            transcriptionQuality: paper.quality,
            contentSha256: paper.contentSha256
          },
          retrieved: ACCESS_DATE,
          note: 'Re-posted transcription; exact string match of the whole phrase.'
        });
        break;
      }
      if (phraseHits.filter(hit => hit.paperId === paper.id).length) continue;
    }
  }
  const records = phraseHits.slice(0, MAX_PAPERS_PER_ENTRY);
  phraseRows.push({
    kind: 'phrase',
    id: entry.id,
    item: entry.phrase,
    type: entry.type || '',
    storedLevel: (entry.tags || []).map(tag => tag.match(/^level:(\w+)$/)?.[1]).filter(Boolean)[0] || 'UNCLASSIFIED',
    headToken: head,
    examOccurrenceCount: phraseHits.length,
    papersWithOccurrence: new Set(phraseHits.map(hit => hit.paperId)).size,
    examEvidence: records
  });
}

const vocabFile = writeJsonl('exam-occurrences-vocabulary.jsonl', vocabRows);
const phraseFile = writeJsonl('exam-occurrences-phrases.jsonl', phraseRows);

const summary = {
  generatedAt: new Date().toISOString(),
  accessDate: ACCESS_DATE,
  archive: {
    papers: papers.length,
    years: [...new Set(papers.map(paper => paper.year))].sort(),
    note: 'All transcriptions are re-posts (xac_minh: ban-dang-lai-*); evidence class is archive_transcription_repost.'
  },
  vocabulary: {
    rows: vocabRows.length,
    withOccurrence: vocabRows.filter(row => row.examOccurrenceCount > 0).length,
    withoutOccurrence: vocabRows.filter(row => row.examOccurrenceCount === 0).length,
    file: path.relative(root, vocabFile.file),
    sha256: vocabFile.sha256,
    bytes: vocabFile.bytes
  },
  phrases: {
    rows: phraseRows.length,
    withOccurrence: phraseRows.filter(row => row.examOccurrenceCount > 0).length,
    withoutOccurrence: phraseRows.filter(row => row.examOccurrenceCount === 0).length,
    file: path.relative(root, phraseFile.file),
    sha256: phraseFile.sha256,
    bytes: phraseFile.bytes
  }
};
fs.writeFileSync(path.join(outDir, 'exam-occurrences-summary.json'), JSON.stringify(summary, null, 2) + '\n');

console.log(JSON.stringify(summary, null, 2));
