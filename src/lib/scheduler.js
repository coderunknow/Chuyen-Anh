/**
 * Evidence-informed scheduler: SM-2 inspired, Leitner-like states
 * States: new, learning, weak, review, mastered
 *
 * Progress shape per word:
 * {
 *   id,
 *   state,
 *   correctCount,
 *   wrongCount,
 *   streak,
 *   lastReviewed: timestamp (ms) or null,
 *   nextReview: timestamp (ms),
 *   ease: number (1.3-2.5),
 *   interval: number (days),
 *   difficulty: 0-1 (internal)
 * }
 */

export const STATES = {
  NEW: 'new',
  LEARNING: 'learning',
  WEAK: 'weak',
  REVIEW: 'review',
  MASTERED: 'mastered'
};

export function createInitialProgress(id) {
  return {
    id,
    state: STATES.NEW,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    lastReviewed: null,
    nextReview: Date.now(), // due immediately
    ease: 2.5,
    interval: 0,
    difficulty: 0
  };
}

export function ensureProgress(progressMap, vocab) {
  const result = { ...progressMap };
  for (const entry of vocab) {
    if (!result[entry.id]) {
      result[entry.id] = createInitialProgress(entry.id);
    }
  }
  return result;
}

/**
 * Update progress after answer
 * @param {object} p - current progress
 * @param {boolean} correct
 * @param {number} responseTimeMs - optional, for difficulty adjustment
 * @returns new progress
 */
export function updateProgress(p, correct, responseTimeMs = 0) {
  const now = Date.now();
  let { ease, interval, streak, correctCount, wrongCount, state } = p;

  if (correct) {
    correctCount += 1;
    streak += 1;

    // SM-2 like interval growth
    if (state === STATES.NEW) {
      interval = 1; // 1 day
      state = STATES.LEARNING;
    } else if (state === STATES.LEARNING) {
      interval = streak >= 2 ? 3 : 1;
      if (correctCount >= 3 && streak >= 2) {
        state = STATES.REVIEW;
      }
    } else if (state === STATES.WEAK) {
      interval = Math.max(1, Math.round(interval * 0.5 + 1));
      if (streak >= 2) state = STATES.REVIEW;
    } else if (state === STATES.REVIEW) {
      interval = Math.round(interval * ease);
      // Cap and promote to mastered
      if (interval >= 21 && correctCount >= 5 && streak >= 3) {
        state = STATES.MASTERED;
      }
    } else if (state === STATES.MASTERED) {
      interval = Math.round(interval * ease * 1.1);
    }

    ease = Math.min(2.8, ease + 0.08);
    // Fast correct reduces difficulty
    if (responseTimeMs && responseTimeMs < 3000) {
      ease = Math.min(2.8, ease + 0.02);
    }

  } else {
    wrongCount += 1;
    streak = 0;
    ease = Math.max(1.3, ease - 0.2);
    // On wrong, interval resets significantly
    if (state === STATES.MASTERED || state === STATES.REVIEW) {
      interval = 1;
      state = STATES.WEAK;
    } else if (state === STATES.LEARNING) {
      interval = 0;
      state = STATES.WEAK;
    } else {
      interval = 0;
      state = STATES.WEAK;
    }
  }

  // Clamp interval
  interval = Math.max(0, Math.min(interval, 180));

  const nextReview = now + interval * 24 * 60 * 60 * 1000;

  // Determine difficulty 0-1 based on wrong ratio and ease
  const total = correctCount + wrongCount;
  const wrongRatio = total > 0 ? wrongCount / total : 0;
  const difficulty = Math.min(1, Math.max(0, wrongRatio * 0.7 + (2.8 - ease) / 1.5 * 0.3));

  // Auto state correction: if weak ratio high
  if (total >= 3 && wrongRatio > 0.5 && state !== STATES.NEW) {
    state = STATES.WEAK;
  }

  return {
    ...p,
    state,
    correctCount,
    wrongCount,
    streak,
    lastReviewed: now,
    nextReview,
    ease,
    interval,
    difficulty
  };
}

export function isDue(p, now = Date.now()) {
  return p.nextReview <= now;
}

export function getDueWords(progressMap, now = Date.now()) {
  return Object.values(progressMap).filter(p => isDue(p, now));
}

/**
 * Select words for a session
 * @param {Array} vocab
 * @param {Object} progressMap
 * @param {Object} options { size, mode: 'due'|'new'|'weak'|'random'|'all', favorites Set }
 */
export function selectSession(vocab, progressMap, options = {}) {
  const { size = 20, mode = 'due', favorites = null } = options;
  const now = Date.now();
  const progressList = Object.values(progressMap);

  let candidates = [];

  if (mode === 'favorites' && favorites) {
    const favIds = new Set(favorites);
    candidates = vocab.filter(v => favIds.has(v.id)).map(v => ({
      vocab: v,
      progress: progressMap[v.id]
    }));
  } else if (mode === 'new') {
    candidates = vocab.filter(v => {
      const p = progressMap[v.id];
      return p && p.state === STATES.NEW;
    }).map(v => ({ vocab: v, progress: progressMap[v.id] }));
  } else if (mode === 'weak') {
    candidates = progressList
      .filter(p => p.state === STATES.WEAK)
      .map(p => ({
        vocab: vocab.find(v => v.id === p.id),
        progress: p
      }))
      .filter(c => c.vocab);
    // Sort by wrongCount descending
    candidates.sort((a,b) => b.progress.wrongCount - a.progress.wrongCount);
  } else if (mode === 'due') {
    const due = progressList.filter(p => isDue(p, now));
    const weakDue = due.filter(p => p.state === STATES.WEAK);
    const learningDue = due.filter(p => p.state === STATES.LEARNING);
    const reviewDue = due.filter(p => p.state === STATES.REVIEW);
    const newDue = due.filter(p => p.state === STATES.NEW);
    // Prioritize weak, learning, review, new
    const ordered = [...weakDue, ...learningDue, ...reviewDue, ...newDue];
    // Also add some overdue mastered? No, mastered not due unless interval passed
    candidates = ordered.map(p => ({
      vocab: vocab.find(v => v.id === p.id),
      progress: p
    })).filter(c => c.vocab);

    // If not enough due, fill with new and weak
    if (candidates.length < size) {
      const remainingIds = new Set(candidates.map(c => c.vocab.id));
      const extra = vocab.filter(v => !remainingIds.has(v.id)).map(v => ({
        vocab: v,
        progress: progressMap[v.id]
      }));
      // Prioritize weak, learning, new
      extra.sort((a,b) => {
        const order = { weak: 0, learning: 1, new: 2, review: 3, mastered: 4 };
        return (order[a.progress.state]||5) - (order[b.progress.state]||5);
      });
      candidates = [...candidates, ...extra];
    }
  } else if (mode === 'random') {
    candidates = vocab.map(v => ({ vocab: v, progress: progressMap[v.id] }));
    // shuffle
    for (let i = candidates.length -1; i >0; i--) {
      const j = Math.floor(Math.random() * (i+1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
  } else { // all
    candidates = vocab.map(v => ({ vocab: v, progress: progressMap[v.id] }));
  }

  // Interleaving: avoid same state clustering too much, shuffle slightly but keep priority
  // For due mode we keep priority, but for others we interleave
  if (mode !== 'due' && mode !== 'weak') {
    // Simple interleaving by state
    const byState = {};
    for (const c of candidates) {
      const s = c.progress.state;
      if (!byState[s]) byState[s] = [];
      byState[s].push(c);
    }
    const states = Object.keys(byState);
    const interleaved = [];
    let idx = 0;
    let hasMore = true;
    while (hasMore && interleaved.length < candidates.length) {
      hasMore = false;
      for (const st of states) {
        if (byState[st][idx]) {
          interleaved.push(byState[st][idx]);
          hasMore = true;
        }
      }
      idx++;
    }
    // If interleaved has content, use it but preserve randomness for random mode
    if (mode !== 'random' && interleaved.length === candidates.length) {
      candidates = interleaved;
    }
  }

  return candidates.slice(0, size);
}

export function calculateStats(progressMap) {
  const all = Object.values(progressMap);
  const total = all.length;
  const byState = {
    new: 0,
    learning: 0,
    weak: 0,
    review: 0,
    mastered: 0
  };
  let correct = 0, wrong = 0;
  let due = 0;
  const now = Date.now();
  for (const p of all) {
    if (byState[p.state] !== undefined) byState[p.state]++;
    correct += p.correctCount;
    wrong += p.wrongCount;
    if (isDue(p, now)) due++;
  }
  const accuracy = (correct + wrong) > 0 ? Math.round(correct / (correct + wrong) * 100) : 0;
  return {
    total,
    ...byState,
    due,
    correct,
    wrong,
    accuracy,
    learned: total - byState.new,
    // learning includes weak? but we keep separate
  };
}
