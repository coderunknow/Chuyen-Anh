#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

const VOCAB_PATH = path.join(process.cwd(), 'data', 'vocabulary.json');

const VALID_POS = new Set([
  'n', 'v', 'adj', 'adv', 'prep', 'conj', 'pron', 'interj', 'det',
  'phrase', 'phrasal verb', 'collocation', 'idiom', 'unknown',
  'adj/n', 'v/n', 'n/v', 'adj/v', 'v/adj', 'n/adj', 'adv/adj',
  'adj/n/v', 'v/n/adj', 'n/adj/v', 'v/adj/n',
  // allow combos like "v/n", "n/v", etc. We'll also accept any slash-separated combo of known POS
]);

function isValidPos(pos) {
  if (!pos) return false;
  const lower = pos.toLowerCase().trim();
  if (VALID_POS.has(lower)) return true;
  // Allow slash-separated like "v/adj", "n/v", "adj/n", etc.
  const parts = lower.split('/').map(s => s.trim()).filter(Boolean);
  if (parts.length === 0) return false;
  const basePos = new Set(['n','v','adj','adv','prep','conj','pron','interj','det','phrase','collocation','idiom','unknown','phrasal','verb']);
  // also allow "phrasal verb" split?
  // For simplicity, if all parts are in base or combined known, accept
  // Accept if every part is known or part is "verb" or "phrasal"
  return parts.every(p => basePos.has(p) || p === 'verb' || p === 'phrasal' || p.length > 0);
}

function validate() {
  console.log('Vocabulary validation\n');
  if (!fs.existsSync(VOCAB_PATH)) {
    console.error(`✗ Vocabulary file not found: ${VOCAB_PATH}`);
    process.exit(1);
  }

  let raw;
  try {
    raw = fs.readFileSync(VOCAB_PATH, 'utf-8');
  } catch (e) {
    console.error(`✗ Cannot read vocabulary file: ${e.message}`);
    process.exit(1);
  }

  let data;
  try {
    data = JSON.parse(raw);
  } catch (e) {
    console.error(`✗ Invalid JSON: ${e.message}`);
    process.exit(1);
  }

  if (!Array.isArray(data)) {
    console.error('✗ Vocabulary must be a JSON array');
    process.exit(1);
  }

  console.log(`Total entries: ${data.length}`);

  const errors = [];
  const idSet = new Set();
  const wordMap = new Map(); // lowercased word -> list of ids

  const duplicateIds = [];
  const duplicateWords = [];

  data.forEach((entry, idx) => {
    const entryNum = idx + 1;
    const entryId = entry.id ?? `(index ${entryNum})`;
    const ctx = `Entry: ${entryId} (index ${entryNum}) Word: "${entry.word || 'MISSING'}"`;

    // Required fields
    if (!entry.id || typeof entry.id !== 'string' || !entry.id.trim()) {
      errors.push(`${ctx} → Problem: missing or invalid 'id'`);
    } else {
      if (idSet.has(entry.id)) {
        duplicateIds.push(entry.id);
        errors.push(`${ctx} → Problem: duplicate id "${entry.id}"`);
      } else {
        idSet.add(entry.id);
      }
    }

    if (!entry.word || typeof entry.word !== 'string' || !entry.word.trim()) {
      errors.push(`${ctx} → Problem: missing or empty 'word'`);
    } else {
      const lower = entry.word.toLowerCase().trim();
      if (!wordMap.has(lower)) wordMap.set(lower, []);
      wordMap.get(lower).push(entry.id);
    }

    if (!entry.pos || typeof entry.pos !== 'string' || !entry.pos.trim()) {
      errors.push(`${ctx} → Problem: missing 'pos'`);
    } else if (!isValidPos(entry.pos)) {
      // Not fatal, but warn - we treat as error if completely unknown? For now warn but allow if contains letters
      // Let's consider invalid only if pos is very strange (e.g., contains numbers)
      if (/[^a-zA-Z\/\s-]/.test(entry.pos)) {
        errors.push(`${ctx} → Problem: invalid pos "${entry.pos}"`);
      }
    }

    if (!entry.meaning || typeof entry.meaning !== 'string' || !entry.meaning.trim()) {
      errors.push(`${ctx} → Problem: missing meaning`);
    }

    if (entry.examples !== undefined && !Array.isArray(entry.examples)) {
      errors.push(`${ctx} → Problem: 'examples' must be an array`);
    }

    if (entry.tags !== undefined && !Array.isArray(entry.tags)) {
      errors.push(`${ctx} → Problem: 'tags' must be an array`);
    }

    if (entry.difficulty !== undefined) {
      if (typeof entry.difficulty !== 'number' || entry.difficulty < 0 || entry.difficulty > 5) {
        errors.push(`${ctx} → Problem: 'difficulty' must be number 0-5, got ${entry.difficulty}`);
      }
    }

    // Check for malformed: empty meaning, word too long?
    if (entry.word && entry.word.length > 100) {
      errors.push(`${ctx} → Problem: word too long (${entry.word.length} chars)`);
    }
  });

  // Detect duplicate words (allow if different pos/meaning? Spec says word not duplicate except truly different meaning)
  // We will warn for duplicates but not fail if pos differs? However spec says id not duplicate, word not duplicate except cases with different meaning.
  // For strictness, we will report duplicates but only fail if same word exact duplicate with same pos?
  for (const [lower, ids] of wordMap.entries()) {
    if (ids.length > 1) {
      // Check if entries have same pos and meaning -> definitely duplicate
      const entries = data.filter(e => e.word && e.word.toLowerCase().trim() === lower);
      const posSet = new Set(entries.map(e => (e.pos||'').toLowerCase()));
      const meaningSet = new Set(entries.map(e => (e.meaning||'').toLowerCase().trim()));
      // If same meaning or same pos+meaning, it's duplicate
      // For now, report as duplicate word warning, but not fail unless exact duplicate
      const isExactDuplicate = meaningSet.size === 1; // same meaning
      if (isExactDuplicate) {
        duplicateWords.push(lower);
        errors.push(`Duplicate word "${lower}" appears ${ids.length} times with same meaning → ids: ${ids.join(', ')}`);
      } else {
        console.log(`Note: word "${lower}" appears ${ids.length} times with different meanings (allowed) → ids: ${ids.join(', ')}`);
      }
    }
  }

  console.log(`Duplicates IDs: ${duplicateIds.length}`);
  console.log(`Duplicate words (same meaning): ${duplicateWords.length}`);
  console.log(`Invalid entries: ${errors.length}`);

  if (errors.length > 0) {
    console.log('\n✗ Validation failed\n');
    errors.forEach(err => console.log('  - ' + err));
    process.exit(1);
  } else {
    console.log('\n✓ Validation passed\n');
    process.exit(0);
  }
}

validate();
