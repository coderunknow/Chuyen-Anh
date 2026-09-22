import { describe, it, expect } from 'vitest';
import { generateQuestion, checkAnswer } from '../src/lib/modes.js';
import { createInitialProgress } from '../src/lib/scheduler.js';

const vocab = [
  { id: '1', word: 'Adversity', pos: 'n', meaning: 'nghịch cảnh', examples: [] },
  { id: '2', word: 'Meticulous', pos: 'adj', meaning: 'tỉ mỉ', examples: [] },
  { id: '3', word: 'Ambiguity', pos: 'n', meaning: 'sự mơ hồ', examples: [] },
  { id: '4', word: 'Deteriorate', pos: 'v', meaning: 'suy giảm', examples: [] }
];

describe('modes', () => {
  it('generates recognition question', () => {
    const progress = createInitialProgress('1');
    const item = { vocab: vocab[0], progress };
    const q = generateQuestion(item, vocab, progress, 'recognition');
    expect(q.mode).toBe('recognition');
    expect(q.prompt).toBe('Adversity');
    expect(q.options.length).toBe(4);
    expect(q.options.filter(o => o.correct).length).toBe(1);
  });

  it('generates recall question', () => {
    const progress = createInitialProgress('1');
    const item = { vocab: vocab[0], progress };
    const q = generateQuestion(item, vocab, progress, 'recall');
    expect(q.mode).toBe('recall');
    expect(q.prompt).toBe('nghịch cảnh');
  });

  it('generates spelling question', () => {
    const progress = createInitialProgress('1');
    const item = { vocab: vocab[0], progress };
    const q = generateQuestion(item, vocab, progress, 'spelling');
    expect(q.mode).toBe('spelling');
    expect(q.answer).toBe('Adversity');
  });

  it('checks spelling answer case insensitive', () => {
    const q = { mode: 'spelling', answer: 'Adversity' };
    expect(checkAnswer(q, 'adversity')).toBe(true);
    expect(checkAnswer(q, ' Adversity ')).toBe(true);
    expect(checkAnswer(q, 'wrong')).toBe(false);
  });

  it('checks multiple choice', () => {
    const q = {
      mode: 'recognition',
      options: [
        { id: '1', text: 'nghịch cảnh', correct: true },
        { id: '2', text: 'tỉ mỉ', correct: false }
      ]
    };
    expect(checkAnswer(q, '1')).toBe(true);
    expect(checkAnswer(q, '2')).toBe(false);
  });
});
