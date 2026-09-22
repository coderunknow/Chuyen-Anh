/**
 * Flashcard modes: generate question variants
 * Modes:
 * - recognition: show word, choose meaning
 * - recall: show meaning, choose word (or type)
 * - spelling: show meaning, type word
 * - reverse: same as recognition but Vietnamese->English etc
 * - context: cloze if example available else recognition
 * - cloze: fill blank
 */

export const MODES = {
  RECOGNITION: 'recognition',
  RECALL: 'recall',
  SPELLING: 'spelling',
  CLOZE: 'cloze',
  CONTEXT: 'context'
};

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function getRandomDistractors(vocab, current, count, field = 'meaning') {
  const others = vocab.filter(v => v.id !== current.id);
  const shuffled = shuffle(others);
  const distractors = [];
  for (const o of shuffled) {
    if (distractors.length >= count) break;
    const val = field === 'meaning' ? o.meaning : o.word;
    if (val && val !== current[field]) {
      distractors.push(o);
    }
  }
  return distractors;
}

export function generateQuestion(currentItem, vocab, progress, modeHint = null) {
  // Decide mode based on progress state and hint
  let mode = modeHint;
  if (!mode) {
    const state = progress.state;
    const rand = Math.random();
    if (state === 'new') {
      // New words: mostly recognition, some recall
      mode = rand < 0.7 ? MODES.RECOGNITION : MODES.RECALL;
    } else if (state === 'learning') {
      if (rand < 0.4) mode = MODES.RECOGNITION;
      else if (rand < 0.7) mode = MODES.RECALL;
      else mode = MODES.SPELLING;
    } else if (state === 'weak') {
      // Weak: varied, include spelling to strengthen
      if (rand < 0.3) mode = MODES.RECOGNITION;
      else if (rand < 0.6) mode = MODES.RECALL;
      else mode = MODES.SPELLING;
    } else if (state === 'review') {
      if (rand < 0.25) mode = MODES.RECOGNITION;
      else if (rand < 0.5) mode = MODES.RECALL;
      else if (rand < 0.75) mode = MODES.CLOZE;
      else mode = MODES.SPELLING;
    } else { // mastered
      if (rand < 0.3) mode = MODES.CLOZE;
      else if (rand < 0.6) mode = MODES.SPELLING;
      else mode = MODES.RECALL;
    }
  }

  const vocabEntry = currentItem.vocab;

  // If mode requires examples but none available, fallback
  if ((mode === MODES.CLOZE || mode === MODES.CONTEXT) && (!vocabEntry.examples || vocabEntry.examples.length === 0)) {
    // Fallback to recognition or recall
    mode = Math.random() < 0.5 ? MODES.RECOGNITION : MODES.RECALL;
  }

  let question = {};
  if (mode === MODES.RECOGNITION) {
    const distractors = getRandomDistractors(vocab, vocabEntry, 3, 'meaning');
    const options = shuffle([
      { id: vocabEntry.id, text: vocabEntry.meaning, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.meaning, correct: false }))
    ]);
    question = {
      mode,
      prompt: vocabEntry.word,
      subPrompt: vocabEntry.pos,
      options,
      answer: vocabEntry.meaning,
      hint: null
    };
  } else if (mode === MODES.RECALL) {
    const distractors = getRandomDistractors(vocab, vocabEntry, 3, 'word');
    const options = shuffle([
      { id: vocabEntry.id, text: vocabEntry.word, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.word, correct: false }))
    ]);
    question = {
      mode,
      prompt: vocabEntry.meaning,
      subPrompt: `(${vocabEntry.pos})`,
      options,
      answer: vocabEntry.word,
      hint: null
    };
  } else if (mode === MODES.SPELLING) {
    question = {
      mode,
      prompt: vocabEntry.meaning,
      subPrompt: `${vocabEntry.pos} • ${vocabEntry.word.length} chữ cái`,
      options: null, // free text
      answer: vocabEntry.word,
      hint: vocabEntry.word[0] + '•'.repeat(vocabEntry.word.length - 1)
    };
  } else if (mode === MODES.CLOZE || mode === MODES.CONTEXT) {
    const example = vocabEntry.examples && vocabEntry.examples[0] ? vocabEntry.examples[0] : null;
    let clozeText = '';
    if (example) {
      // Replace word with blank (case insensitive)
      const regex = new RegExp(vocabEntry.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
      clozeText = example.replace(regex, '______');
    } else {
      // Generate simple cloze: "He was tired of doing ______ tasks"
      clozeText = `______ : ${vocabEntry.meaning}`;
    }
    const distractors = getRandomDistractors(vocab, vocabEntry, 3, 'word');
    const options = shuffle([
      { id: vocabEntry.id, text: vocabEntry.word, correct: true },
      ...distractors.map(d => ({ id: d.id, text: d.word, correct: false }))
    ]);
    question = {
      mode,
      prompt: clozeText,
      subPrompt: vocabEntry.pos,
      options,
      answer: vocabEntry.word,
      hint: vocabEntry.meaning
    };
  }

  return question;
}

export function checkAnswer(question, userAnswer) {
  // userAnswer can be string (option id or typed) or object
  if (question.mode === MODES.SPELLING) {
    const normalizedCorrect = question.answer.toLowerCase().trim();
    const normalizedUser = (userAnswer || '').toLowerCase().trim();
    return normalizedCorrect === normalizedUser;
  } else {
    // Multiple choice: userAnswer is id of selected option
    const selected = question.options.find(o => o.id === userAnswer || o.text === userAnswer);
    if (!selected) return false;
    return selected.correct;
  }
}
