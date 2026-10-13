import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const vocabularyScript = html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/i);
const appScript = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/i);
assert.ok(vocabularyScript, 'index.html must contain its vocabulary JSON');
assert.ok(appScript, 'index.html must contain its application module');
const embeddedRaw = vocabularyScript[1].trim();
const embeddedVocabulary = JSON.parse(embeddedRaw);
const app = await import(`data:text/javascript;base64,${Buffer.from(appScript[1], 'utf8').toString('base64')}`);

const {
  STATES,
  MODES,
  generateQuestion,
  createInitialProgress,
  updateProgress,
  calculateStats,
  isDue,
  selectSession,
  needsFirstLook,
  canGradeBySelection,
  createSearchIndex,
  searchVocabulary,
  validateImportPayload,
  exportProgressBundle,
  saveProgress,
  loadProgress,
  loadVocabulary,
  vocabularyMetadataHtml,
  normalize
} = app;

const vocab = [
  { id: '1', word: 'Adversity', pos: 'n', meaning: 'nghịch cảnh', examples: [], tags: [] },
  { id: '2', word: 'Meticulous', pos: 'adj', meaning: 'tỉ mỉ, kỹ lưỡng', examples: [], tags: ['work'] },
  { id: '3', word: 'Menial task', pos: 'phrase', meaning: 'công việc tay chân', examples: [{ en: 'A menial task.', vi: 'Việc tay chân.' }], tags: ['work'], synonyms: ['laborious work'] }
];

function store() {
  const data = new Map();
  return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('the only runtime deliverable is a self-contained HTML document', async () => {
  const sourceData = JSON.parse(await readFile(new URL('data/vocabulary.json', root), 'utf8'));
  assert.deepEqual(embeddedVocabulary, sourceData);
  assert.equal(embeddedVocabulary.length, 913);
  assert.match(html, /<style>[\s\S]*?<\/style>/i);
  assert.doesNotMatch(html, /<link\b/i);
  assert.doesNotMatch(html, /<script\b[^>]*\bsrc\s*=/i);
  assert.doesNotMatch(appScript[1], /^\s*import\s/m);
  assert.doesNotMatch(appScript[1], /\bfetch\s*\(/);
});

test('embedded vocabulary loads without fetch and passes runtime validation', async () => {
  const loaded = await loadVocabulary(embeddedRaw);
  assert.equal(loaded.data.length, 913);
  assert.equal(loaded.data[0].word, 'Adversity');
  assert.equal(loaded.data[912].word, 'Virtually');
  assert.match(loaded.version, /^[0-9a-f]+-[0-9a-f]{8}$/);
  await assert.rejects(() => loadVocabulary('not json'), /JSON không hợp lệ/);

  const previousDocument = globalThis.document;
  globalThis.document = {
    getElementById(id) {
      assert.equal(id, 'vocabulary-data');
      return { textContent: embeddedRaw };
    }
  };
  try {
    const fromPage = await loadVocabulary();
    assert.equal(fromPage.data.length, 913);
  } finally {
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  }
});

test('new progress transitions to learning, and wrong answers become weak and due', () => {
  const initial = createInitialProgress('1', 1000);
  const learned = updateProgress(initial, true, 1000, 1000);
  assert.equal(learned.state, STATES.LEARNING);
  assert.equal(learned.correctCount, 1);
  const weak = updateProgress(learned, false, 0, 2000);
  assert.equal(weak.state, STATES.WEAK);
  assert.equal(weak.wrongCount, 1);
  assert.equal(weak.nextReview, 2000);
});

test('repeated correct review answers can reach mastered', () => {
  let progress = createInitialProgress('1', 0);
  progress = { ...progress, state: STATES.REVIEW, interval: 20, correctCount: 4, streak: 2 };
  progress = updateProgress(progress, true, 1000, 1000);
  assert.equal(progress.state, STATES.MASTERED);
  assert.ok(progress.interval >= 21);
});

test('untouched new words are not misreported as overdue reviews', () => {
  const now = 1_000_000;
  const fresh = Object.fromEntries(vocab.map(entry => [entry.id, createInitialProgress(entry.id, now)]));
  assert.equal(calculateStats(fresh, now).new, 3);
  assert.equal(calculateStats(fresh, now).due, 0);
  assert.equal(isDue(fresh['1'], now), false);
  assert.deepEqual(selectSession(vocab, fresh, { size: 20, mode: 'due', now }), []);
  assert.equal(selectSession(vocab, fresh, { size: 20, mode: 'new', now }).length, 3);
  assert.equal(selectSession(vocab, fresh, { size: 20, mode: 'mixed', now }).length, 3);
});

test('due sessions never pull reviews forward while quick mixed sessions may fill', () => {
  const now = 1_000_000;
  const progress = {
    '1': { ...createInitialProgress('1', now), state: STATES.REVIEW, nextReview: now - 20 },
    '2': { ...createInitialProgress('2', now), state: STATES.WEAK, wrongCount: 2, nextReview: now - 10 },
    '3': { ...createInitialProgress('3', now), state: STATES.LEARNING, nextReview: now + 86_400_000 }
  };

  const due = selectSession(vocab, progress, { size: 20, mode: 'due', now });
  assert.deepEqual(due.map(item => item.vocab.id), ['2', '1']);
  assert.ok(due.every(item => item.progress.nextReview <= now));

  const mixed = selectSession(vocab, progress, { size: 20, mode: 'mixed', now });
  assert.deepEqual(mixed.map(item => item.vocab.id), ['2', '1', '3']);
  assert.deepEqual(selectSession(vocab, progress, { size: 20, mode: 'due', now: 0 }), []);
});

test('due selection respects size boundaries and deterministic overdue order', () => {
  const now = 10_000;
  const progress = {
    '1': { ...createInitialProgress('1', now), state: STATES.REVIEW, nextReview: now - 1 },
    '2': { ...createInitialProgress('2', now), state: STATES.REVIEW, nextReview: now - 100 },
    '3': { ...createInitialProgress('3', now), state: STATES.REVIEW, nextReview: now - 50 }
  };
  assert.deepEqual(
    selectSession(vocab, progress, { size: 2, mode: 'due', now }).map(item => item.vocab.id),
    ['2', '3']
  );
  assert.deepEqual(selectSession(vocab, progress, { size: 0, mode: 'due', now }), []);
});

test('stats and search include structured vocabulary metadata', () => {
  const progress = {
    '1': { ...createInitialProgress('1', 0), state: STATES.NEW },
    '2': { ...createInitialProgress('2', 0), state: STATES.WEAK, wrongCount: 3 },
    '3': { ...createInitialProgress('3', 0), state: STATES.MASTERED, correctCount: 5, nextReview: 9999999999999 }
  };
  const stats = calculateStats(progress, 10);
  assert.equal(stats.total, 3);
  assert.equal(stats.weak, 1);
  const index = createSearchIndex(vocab, progress, new Set(['2']));
  assert.equal(searchVocabulary(index, 'METIC', { state: 'favorites' })[0].entry.word, 'Meticulous');
  assert.equal(searchVocabulary(index, 'tay chan')[0].entry.word, 'Menial task');
  assert.equal(searchVocabulary(index, 'laborious work')[0].entry.word, 'Menial task');
  assert.equal(searchVocabulary(index, '', { state: 'weak' })[0].entry.word, 'Meticulous');
  assert.equal(normalize('Đúng đắn'), 'dung dan');
});

test('expanded metadata is rendered safely on answer feedback', () => {
  const rendered = vocabularyMetadataHtml({
    wordFamily: 'laborious (adj)',
    synonyms: ['strenuous work'],
    notes: '<img src=x onerror=alert(1)>'
  });
  assert.match(rendered, /Họ từ/);
  assert.match(rendered, /strenuous work/);
  assert.match(rendered, /&lt;img/);
  assert.doesNotMatch(rendered, /<img/);
});

test('progress save/load and import validation are atomic at the boundary', () => {
  const storage = store();
  const progress = { '1': createInitialProgress('1', 0) };
  assert.equal(saveProgress(progress, storage), true);
  assert.deepEqual(loadProgress(storage), progress);
  const bundle = exportProgressBundle({ progress, prefs: {}, favorites: new Set(['1']), history: [], streak: { current: 1, longest: 1, lastDate: '2026-09-22' } });
  const imported = validateImportPayload(bundle, new Set(['1']));
  assert.equal(imported.favorites.has('1'), true);
  assert.throws(() => validateImportPayload({ ...bundle, progress: { '1': { state: 'bad' } } }, new Set(['1'])));
  assert.deepEqual(loadProgress(storage), progress);
});

test('question mode constants remain available and cloze handles a regular plural', () => {
  assert.equal(MODES.RECOGNITION, 'recognition');
  assert.equal(STATES.MASTERED, 'mastered');
  const question = generateQuestion({ vocab: vocab[2], progress: createInitialProgress('3') }, vocab, MODES.CLOZE);
  assert.match(question.prompt, /_____/);
  assert.doesNotMatch(question.prompt, /menial tasks/);
});

test('corrective practice follows remaining cards without mutating their progress', () => {
  const first = { vocab: vocab[0], progress: updateProgress(createInitialProgress('1', 0), false, 0, 1000) };
  const second = { vocab: vocab[1], progress: createInitialProgress('2', 0) };
  const queue = [first, second];
  const before = structuredClone(first.progress);
  assert.equal(app.queuePractice(queue, first), true);
  assert.equal(queue.length, 3);
  assert.equal(queue[1], second);
  assert.equal(queue[2].vocab, first.vocab);
  assert.equal(queue[2].practice, true);
  assert.deepEqual(first.progress, before);
  assert.equal(isDue(first.progress, 1000), true);
  assert.equal(generateQuestion(queue[2], vocab, MODES.SPELLING).mode, MODES.SPELLING);
});

test('practice is bounded to one retry per card, including the last card', () => {
  const item = { vocab: vocab[0], progress: createInitialProgress('1', 0) };
  const queue = [item];
  assert.equal(app.queuePractice(queue, item), true);
  assert.equal(app.queuePractice(queue, item), false);
  queue.shift();
  assert.equal(app.queuePractice(queue, queue[0]), false);
  assert.equal(queue.length, 1);
  assert.equal(app.queuePractice([], item), false);
  assert.equal(app.queuePractice(null, item), false);
});

test('only a never-studied card is introduced before it is graded', () => {
  const item = (state, extra = {}) => ({
    vocab: vocab[0],
    progress: { ...createInitialProgress('1', 0), state },
    ...extra
  });
  assert.equal(needsFirstLook(item(STATES.NEW)), true);
  assert.equal(needsFirstLook(item(STATES.LEARNING)), false);
  assert.equal(needsFirstLook(item(STATES.WEAK)), false);
  assert.equal(needsFirstLook(item(STATES.REVIEW)), false);
  assert.equal(needsFirstLook(item(STATES.MASTERED)), false);
  // The introduction is shown once per card per session, and never for practice.
  assert.equal(needsFirstLook(item(STATES.NEW, { taught: true })), false);
  assert.equal(needsFirstLook(item(STATES.NEW, { practice: true })), false);
  assert.equal(needsFirstLook({ vocab: vocab[0] }), false);
  assert.equal(needsFirstLook(null), false);
  assert.equal(needsFirstLook(undefined), false);
  // The introduction itself is not an answer: deciding to show it must leave the
  // record untouched so the first graded retrieval is the one that is stored.
  const fresh = { vocab: vocab[0], progress: createInitialProgress('1', 0) };
  const snapshot = structuredClone(fresh.progress);
  assert.equal(needsFirstLook(fresh), true);
  assert.deepEqual(fresh.progress, snapshot);
  assert.equal(fresh.progress.state, STATES.NEW);
  assert.equal(fresh.progress.correctCount, 0);
  assert.equal(fresh.progress.wrongCount, 0);
});

test('a revealed answer can only be graded by explicit self-assessment', () => {
  assert.equal(canGradeBySelection({ answered: false, revealed: false, hasQuestion: true }), true);
  assert.equal(canGradeBySelection({ answered: true, revealed: false, hasQuestion: true }), false);
  assert.equal(canGradeBySelection({ answered: false, revealed: true, hasQuestion: true }), false);
  assert.equal(canGradeBySelection({ answered: false, revealed: false, hasQuestion: false }), false);
  assert.equal(canGradeBySelection({}), false, 'no question means nothing can be graded');
});

test('every multiple-choice question offers plausible, distinct options', () => {
  const vocabulary = embeddedVocabulary;
  const posTokens = entry => String(entry?.pos ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
  const sharesPos = (a, b) => {
    const right = new Set(posTokens(b));
    return posTokens(a).some(token => right.has(token));
  };
  const field = mode => (mode === MODES.RECOGNITION ? 'meaning' : 'word');
  // Index once: the assertion needs the number of *distinct* same-part-of-speech
  // option texts the implementation can pick from, not the number of entries.
  const byPosToken = new Map();
  for (const entry of vocabulary) {
    for (const token of new Set(posTokens(entry))) {
      if (!byPosToken.has(token)) byPosToken.set(token, []);
      byPosToken.get(token).push(entry);
    }
  }
  const peerTexts = (entry, mode) => {
    const answerText = normalize(entry[field(mode)]);
    const texts = new Set();
    for (const token of new Set(posTokens(entry))) {
      for (const other of byPosToken.get(token)) {
        if (other.id === entry.id) continue;
        const text = other[field(mode)];
        if (!text) continue;
        const key = normalize(text);
        if (key !== answerText) texts.add(key);
      }
    }
    return texts.size;
  };

  let statements = 0;
  let clozeStatements = 0;
  for (const entry of vocabulary) {
    const progress = createInitialProgress(entry.id, 0);
    for (const mode of [MODES.RECOGNITION, MODES.RECALL, MODES.CLOZE]) {
      const question = generateQuestion({ vocab: entry, progress, taught: true }, vocabulary, mode);
      if (question.mode !== mode) continue; // cloze needs an example sentence
      if (mode === MODES.CLOZE) clozeStatements += 1;
      statements += 1;
      assert.equal(question.options.length, 4, `${entry.word} must offer four options`);
      assert.equal(question.options.filter(option => option.correct).length, 1);
      assert.equal(question.options.filter(option => option.id === entry.id).length, 1);

      const texts = question.options.map(option => normalize(option.text));
      assert.equal(new Set(texts).size, 4, `${entry.word} repeated an option text`);
      // The dataset holds entries that share one gloss; none of them may become the answer.
      assert.equal(question.options.find(option => option.id === entry.id).text, entry[field(mode)]);

      const options = question.options.filter(option => option.id !== entry.id)
        .map(option => vocabulary.find(candidate => candidate.id === option.id));
      // Same part of speech whenever the dataset has enough peers; otherwise the
      // remaining slots fall back instead of leaving the question short.
      const expectedSamePos = Math.min(3, peerTexts(entry, mode));
      const actualSamePos = options.filter(option => sharesPos(option, entry)).length;
      assert.equal(actualSamePos, expectedSamePos,
        `${entry.word} (${entry.pos}, ${mode}) used ${actualSamePos} same-POS distractors, expected ${expectedSamePos}`);
    }
  }
  assert.ok(statements >= vocabulary.length * 2, `expected recognition and recall for every word, generated ${statements}`);
  assert.ok(clozeStatements >= 1, 'the record that has an example sentence must still be asked as cloze');
});

test('cloze options never repeat a word already printed in the sentence', () => {
  const fixture = [
    { id: 'a', word: 'Menial', pos: 'adj', meaning: 'tầm thường', examples: [{ en: 'He was tired of doing menial work all day.', vi: '' }] },
    { id: 'b', word: 'Tired', pos: 'adj', meaning: 'mệt mỏi' },
    { id: 'c', word: 'Work', pos: 'n', meaning: 'công việc' },
    { id: 'd', word: 'Day', pos: 'n', meaning: 'ngày' },
    { id: 'e', word: 'Lucid', pos: 'adj', meaning: 'rõ ràng' },
    { id: 'f', word: 'Gauge', pos: 'v', meaning: 'đo lường' },
    { id: 'g', word: 'Opaque', pos: 'adj', meaning: 'mờ đục' }
  ];
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const question = generateQuestion({ vocab: fixture[0], progress: createInitialProgress('a', 0), taught: true }, fixture, MODES.CLOZE);
    assert.match(question.prompt, /_____/);
    const texts = question.options.map(option => normalize(option.text));
    assert.equal(texts.includes('tired'), false, '"tired" is printed in the sentence');
    assert.equal(texts.includes('work'), false, '"work" is printed in the sentence');
    assert.equal(texts.includes('day'), false, '"day" is printed in the sentence');
    assert.equal(texts.includes('menial'), true);
    assert.equal(new Set(texts).size, question.options.length);
  }
});

test('each failed card gets its own retry, retaining the original queue order', () => {
  const queue = vocab.map(entry => ({ vocab: entry, progress: createInitialProgress(entry.id, 0) }));
  const originals = [...queue];
  originals.forEach(item => assert.equal(app.queuePractice(queue, item), true));
  assert.deepEqual(queue.map(item => item.vocab.id), ['1', '2', '3', '1', '2', '3']);
  assert.ok(queue.slice(3).every(item => item.practice));
  assert.ok(originals.every(item => !item.practice));
});
