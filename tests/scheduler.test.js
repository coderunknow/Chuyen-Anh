import { describe, it, expect } from 'vitest';
import { createInitialProgress, updateProgress, STATES, selectSession, calculateStats, isDue } from '../src/lib/scheduler.js';

describe('scheduler', () => {
  it('creates initial progress', () => {
    const p = createInitialProgress('1');
    expect(p.id).toBe('1');
    expect(p.state).toBe(STATES.NEW);
    expect(p.correctCount).toBe(0);
  });

  it('transitions new -> learning on correct', () => {
    let p = createInitialProgress('1');
    p = updateProgress(p, true);
    expect(p.state).toBe(STATES.LEARNING);
    expect(p.correctCount).toBe(1);
    expect(p.streak).toBe(1);
  });

  it('goes to weak on wrong', () => {
    let p = createInitialProgress('1');
    p = updateProgress(p, true);
    p = updateProgress(p, false);
    expect(p.state).toBe(STATES.WEAK);
    expect(p.wrongCount).toBe(1);
    expect(p.streak).toBe(0);
  });

  it('promotes to mastered after many correct', () => {
    let p = createInitialProgress('1');
    // Simulate 5 correct with increasing interval
    for (let i = 0; i < 5; i++) {
      p = updateProgress(p, true);
      // Fast forward nextReview to make it due
      p.nextReview = Date.now() - 1000;
      // Manually increase interval to simulate spaced repetition
      if (i >= 2) p.interval = 5 + i * 5;
    }
    // After enough, should be review or mastered
    expect([STATES.REVIEW, STATES.MASTERED]).toContain(p.state);
  });

  it('calculates stats', () => {
    const map = {
      '1': { ...createInitialProgress('1'), state: STATES.NEW },
      '2': { ...createInitialProgress('2'), state: STATES.MASTERED, correctCount: 5, wrongCount: 0 },
      '3': { ...createInitialProgress('3'), state: STATES.WEAK, correctCount: 1, wrongCount: 3 }
    };
    const stats = calculateStats(map);
    expect(stats.total).toBe(3);
    expect(stats.new).toBe(1);
    expect(stats.mastered).toBe(1);
    expect(stats.weak).toBe(1);
  });

  it('selects due words first', () => {
    const vocab = [
      { id: '1', word: 'abate' },
      { id: '2', word: 'abide' },
      { id: '3', word: 'abstruse' }
    ];
    const now = Date.now();
    const map = {
      '1': { ...createInitialProgress('1'), state: STATES.WEAK, nextReview: now - 1000, wrongCount: 5 },
      '2': { ...createInitialProgress('2'), state: STATES.NEW, nextReview: now - 1000 },
      '3': { ...createInitialProgress('3'), state: STATES.MASTERED, nextReview: now + 10000000 }
    };
    const session = selectSession(vocab, map, { size: 2, mode: 'due' });
    expect(session.length).toBe(2);
    // Weak should be first
    expect(session[0].vocab.id).toBe('1');
  });

  it('isDue works', () => {
    const p = createInitialProgress('1');
    p.nextReview = Date.now() - 1;
    expect(isDue(p)).toBe(true);
    p.nextReview = Date.now() + 100000;
    expect(isDue(p)).toBe(false);
  });
});
