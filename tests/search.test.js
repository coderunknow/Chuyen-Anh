import { describe, it, expect } from 'vitest';
import { createSearchIndex, search, sortResults } from '../src/lib/search.js';

const vocab = [
  { id: '1', word: 'Adversity', pos: 'n', meaning: 'nghịch cảnh', tags: [] },
  { id: '2', word: 'Meticulous', pos: 'adj', meaning: 'tỉ mỉ, kỹ lưỡng', tags: ['difficult'] },
  { id: '3', word: 'Ambiguity', pos: 'n', meaning: 'sự mơ hồ', tags: [] }
];

const progressMap = {
  '1': { id: '1', state: 'new', difficulty: 0, wrongCount: 0, nextReview: Date.now() },
  '2': { id: '2', state: 'weak', difficulty: 0.8, wrongCount: 5, nextReview: Date.now() - 1000 },
  '3': { id: '3', state: 'mastered', difficulty: 0.1, wrongCount: 0, nextReview: Date.now() + 100000 }
};

const favorites = new Set(['2']);

describe('search', () => {
  it('creates index', () => {
    const idx = createSearchIndex(vocab, progressMap, favorites);
    expect(idx.length).toBe(3);
    expect(idx[0].wordLower).toBe('adversity');
  });

  it('searches English', () => {
    const idx = createSearchIndex(vocab, progressMap, favorites);
    const res = search(idx, 'adver');
    expect(res.length).toBe(1);
    expect(res[0].word).toBe('Adversity');
  });

  it('searches Vietnamese', () => {
    const idx = createSearchIndex(vocab, progressMap, favorites);
    const res = search(idx, 'tỉ mỉ');
    expect(res.length).toBe(1);
    expect(res[0].word).toBe('Meticulous');
  });

  it('case insensitive', () => {
    const idx = createSearchIndex(vocab, progressMap, favorites);
    const res = search(idx, 'METICULOUS');
    expect(res.length).toBe(1);
  });

  it('filters by state', () => {
    const idx = createSearchIndex(vocab, progressMap, favorites);
    const res = search(idx, '', { state: 'weak' });
    expect(res.length).toBe(1);
    expect(res[0].word).toBe('Meticulous');
  });

  it('filters favorites', () => {
    const idx = createSearchIndex(vocab, progressMap, favorites);
    const res = search(idx, '', { state: 'favorites' });
    expect(res.length).toBe(1);
  });

  it('sorts', () => {
    const idx = createSearchIndex(vocab, progressMap, favorites);
    const sorted = sortResults(idx, 'az');
    expect(sorted[0].word).toBe('Adversity');
    const sorted2 = sortResults(idx, 'za');
    expect(sorted2[0].word).toBe('Meticulous');
  });
});
