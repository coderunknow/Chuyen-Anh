#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const mdPath = path.join(process.cwd(), 'Learned_Vocabulary_List.md');
const outPath = path.join(process.cwd(), 'data', 'vocabulary.json');

if (!fs.existsSync(mdPath)) {
  console.error('Legacy file not found:', mdPath);
  process.exit(1);
}

const content = fs.readFileSync(mdPath, 'utf-8');
const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#'));

const entries = [];
const seenIds = new Set();
const seenWords = new Map();

for (const line of lines) {
  const parts = line.split('|');
  if (parts.length < 4) {
    console.warn('Skipping malformed line:', line);
    continue;
  }
  const [idRaw, wordRaw, posRaw, meaningRaw, ...extra] = parts;
  const id = idRaw.trim();
  const word = wordRaw.trim();
  const pos = posRaw.trim().toLowerCase();
  const meaning = [meaningRaw, ...extra].join('|').trim(); // meaning may contain |
  // extra markers like + ++ from file? Clean
  const cleanMeaning = meaning.replace(/\|\++$/, '').replace(/\|+$/, '').trim();
  // Handle lines like "609|Retentive|adj|có khả năng...|+" where extra is marker
  let finalMeaning = cleanMeaning;
  let tags = [];
  // detect trailing + markers in original
  const plusMatch = line.match(/\|(\++)\s*$/);
  if (plusMatch) {
    const plus = plusMatch[1];
    if (plus === '+') tags.push('difficult');
    if (plus === '++') tags.push('very-difficult');
  }

  if (!id || !word || !pos || !finalMeaning) {
    console.warn('Skipping incomplete:', line);
    continue;
  }

  entries.push({
    id: String(id),
    word,
    pos: pos || 'unknown',
    meaning: finalMeaning,
    examples: [],
    tags,
    difficulty: 0,
    // additional metadata
    createdAt: new Date().toISOString().split('T')[0]
  });
}

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(entries, null, 2), 'utf-8');
console.log(`Converted ${entries.length} entries to ${outPath}`);
