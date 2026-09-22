import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const vocabPath = path.resolve('data/vocabulary.json');

describe('vocabulary', () => {
  it('file exists and is valid JSON array', () => {
    expect(fs.existsSync(vocabPath)).toBe(true);
    const raw = fs.readFileSync(vocabPath, 'utf-8');
    const data = JSON.parse(raw);
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  it('has required fields', () => {
    const data = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));
    for (const entry of data.slice(0, 20)) {
      expect(entry.id).toBeDefined();
      expect(entry.word).toBeDefined();
      expect(entry.pos).toBeDefined();
      expect(entry.meaning).toBeDefined();
      expect(typeof entry.id).toBe('string');
      expect(typeof entry.word).toBe('string');
      expect(entry.word.trim().length).toBeGreaterThan(0);
      expect(entry.meaning.trim().length).toBeGreaterThan(0);
    }
  });

  it('has no duplicate ids', () => {
    const data = JSON.parse(fs.readFileSync(vocabPath, 'utf-8'));
    const ids = data.map(d => d.id);
    const set = new Set(ids);
    expect(set.size).toBe(ids.length);
  });

  it('parsing legacy format still works', () => {
    // Ensure we can still parse Learned_Vocabulary_List.md if needed
    const legacyPath = path.resolve('Learned_Vocabulary_List.md');
    if (fs.existsSync(legacyPath)) {
      const content = fs.readFileSync(legacyPath, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim() && !l.startsWith('#') && /^\d+\|/.test(l));
      expect(lines.length).toBeGreaterThan(0);
    }
  });
});
