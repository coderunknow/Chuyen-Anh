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
  const [idRaw, wordRaw, posRaw, ...meaningParts] = parts;
  const id = idRaw.trim();
  const word = wordRaw.trim();
  const pos = posRaw.trim().toLowerCase();

  // The legacy list uses the final pipe-delimited field for an optional
  // difficulty marker. An empty final field is only a trailing delimiter;
  // it must not become part of the Vietnamese meaning.
  let marker = '';
  while (meaningParts.length && !meaningParts[meaningParts.length - 1].trim()) meaningParts.pop();
  if (meaningParts.length && /^(?:\+{1,2}|-{1,2})$/.test(meaningParts[meaningParts.length - 1].trim())) {
    marker = meaningParts.pop().trim();
  }
  const finalMeaning = meaningParts.join('|').trim();
  const markerTags = {
    '+': 'difficult',
    '++': 'very-difficult',
    '-': 'easy',
    '--': 'very-easy'
  };
  const tags = markerTags[marker] ? [markerTags[marker]] : [];

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
fs.writeFileSync(outPath, `${JSON.stringify(entries, null, 2)}\n`, 'utf-8');
console.log(`Converted ${entries.length} entries to ${outPath}`);
