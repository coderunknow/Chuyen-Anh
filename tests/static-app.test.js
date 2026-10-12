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
  queueRepeatedCard,
  shouldHandleGlobalShortcut,
  createInitialProgress,
  updateProgress,
  calculateStats,
  createSearchIndex,
  updateSearchFavorite,
  searchVocabulary,
  validateImportPayload,
  exportProgressBundle,
  saveProgress,
  savePrefs,
  saveFavorites,
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
  assert.ok(appScript[1].includes('toggleFavorite(id, false);'));
  assert.ok(appScript[1].includes('updateSearchFavorite(index, id, favorites.has(id));'));
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
  const runtimeEntry = (id, word) => ({
    id, word, pos: 'n', meaning: 'a sample meaning', examples: [], tags: [],
    wordFamily: '', synonyms: [], antonyms: [], collocations: [],
    register: '', connotation: '', notes: ''
  });
  await assert.rejects(() => loadVocabulary(JSON.stringify([
    runtimeEntry('a', 'resume'), runtimeEntry('b', 'résumé')
  ])), /Trùng word/);

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

test('search favorites update the cached index without losing active matches', () => {
  const index = createSearchIndex(vocab, {}, new Set());
  assert.equal(searchVocabulary(index, 'METIC').length, 1);
  assert.equal(updateSearchFavorite(index, '2', true), true);
  assert.equal(searchVocabulary(index, 'METIC', { state: 'favorites' })[0].entry.word, 'Meticulous');
  assert.equal(searchVocabulary(index, 'METIC').length, 1);
  assert.equal(updateSearchFavorite(index, 'missing', true), false);
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

test('ID 448 historical wording is clearly separated from its canonical meaning', () => {
  const entry = embeddedVocabulary.find(item => item.id === '448');
  assert.equal(entry.meaning, 'công việc tay chân tầm thường, ít được coi trọng');
  const rendered = vocabularyMetadataHtml(entry);
  assert.match(rendered, /Nghĩa của phiên bản ứng dụng trước/);
  assert.match(rendered, /chỉ tham chiếu lịch sử; không phải nghĩa hiện tại/);
  assert.match(rendered, /công việc lao dịch, tay chân vất vả, ít được coi trọng/);
  assert.doesNotMatch(rendered, /Previous app definition/);
  assert.doesNotMatch(rendered, /<dt>Ghi chú \/ phân biệt \/ nguồn<\/dt>/);
});

test('meanings remain attached to their own entries in every generated learning mode', () => {
  for (const entry of embeddedVocabulary) {
    const originalMeaning = entry.meaning;
    const progress = createInitialProgress(entry.id, 0);
    for (const requestedMode of Object.values(MODES)) {
      const question = generateQuestion({ vocab: entry, progress }, embeddedVocabulary, requestedMode);
      const correctOptions = (question.options || []).filter(option => option.correct);
      if (question.mode === MODES.RECOGNITION) {
        assert.equal(question.prompt, entry.word, `${entry.id} recognition prompt`);
        assert.equal(question.answer, entry.meaning, `${entry.id} recognition answer`);
        assert.deepEqual(correctOptions.map(option => [option.id, option.text]), [[entry.id, entry.meaning]]);
      } else if (question.mode === MODES.RECALL) {
        assert.equal(question.prompt, entry.meaning, `${entry.id} recall prompt`);
        assert.equal(question.answer, entry.word, `${entry.id} recall answer`);
        assert.deepEqual(correctOptions.map(option => [option.id, option.text]), [[entry.id, entry.word]]);
      } else if (question.mode === MODES.SPELLING) {
        assert.equal(question.prompt, entry.meaning, `${entry.id} spelling prompt`);
        assert.equal(question.answer, entry.word, `${entry.id} spelling answer`);
      } else {
        assert.equal(question.mode, MODES.CLOZE);
        assert.equal(question.answer, entry.word, `${entry.id} cloze answer`);
        assert.deepEqual(question.example, entry.examples[0], `${entry.id} cloze example`);
        assert.deepEqual(correctOptions.map(option => [option.id, option.text]), [[entry.id, entry.word]]);
      }
      assert.equal(entry.meaning, originalMeaning, `${entry.id} meaning was mutated`);
    }
  }
});

test('repeating a card extends the session denominator and keeps completion accurate', () => {
  const first = { vocab: { id: '1' }, progress: createInitialProgress('1', 0) };
  const second = { vocab: { id: '2' }, progress: createInitialProgress('2', 0) };
  const session = [first, second];
  const sessionStats = { total: 2, correct: 1, wrong: 0 };

  assert.equal(queueRepeatedCard(session, first, sessionStats), true);
  assert.equal(sessionStats.total, 3);
  session.shift(); // advance past the already-answered original card
  assert.equal(sessionStats.total - session.length, 1);
  sessionStats.correct += 1; // repeated card
  session.shift();
  sessionStats.correct += 1; // second original card
  session.shift();
  assert.equal(sessionStats.total - session.length, 3);
  assert.equal(Math.round(sessionStats.correct / sessionStats.total * 100), 100);
});

test('answer choices use button-group semantics instead of a radio-group role', () => {
  assert.ok(appScript[1].includes('class="options" role="group" aria-label='));
  assert.ok(!appScript[1].includes('role="radiogroup"'));
});

test('card transitions restore focus to the next actionable control', () => {
  assert.ok(appScript[1].includes('nextButton.focus({ preventScroll: true })'));
  assert.ok(appScript[1].includes("content.querySelector('#question-area [data-option], #spelling-input')?.focus({ preventScroll: true })"));
});

test('global shortcuts defer Enter and Space to focused native controls', () => {
  const button = { tagName: 'BUTTON', closest: () => true };
  const input = { tagName: 'INPUT' };
  const content = { tagName: 'MAIN', closest: () => false };
  assert.equal(shouldHandleGlobalShortcut({ key: 'Enter', target: button }), false);
  assert.equal(shouldHandleGlobalShortcut({ key: ' ', target: button }), false);
  assert.equal(shouldHandleGlobalShortcut({ key: '1', target: button }), true);
  assert.equal(shouldHandleGlobalShortcut({ key: 'Enter', target: input }), false);
  assert.equal(shouldHandleGlobalShortcut({ key: ' ', target: content }), true);
});

test('resetting or importing progress clears stale active-session state', () => {
  const start = appScript[1].indexOf('function clearActiveSession()');
  const end = appScript[1].indexOf('function persist()', start);
  assert.ok(start >= 0 && end > start);
  const clearSession = appScript[1].slice(start, end);
  for (const reset of [
    'session = null;', 'question = null;', 'answered = false;',
    'revealed = false;', 'answerResult = null;', 'sessionStats = null;',
    'sessionSummary = null;'
  ]) assert.ok(clearSession.includes(reset), `missing reset: ${reset}`);
  assert.ok(appScript[1].includes('clearActiveSession(); // the imported scheduler state must not reuse stale session progress'));
  const resetStart = appScript[1].indexOf('function resetProgress()');
  const resetBody = appScript[1].slice(resetStart, appScript[1].indexOf("document.addEventListener('keydown'", resetStart));
  assert.ok(resetBody.includes('clearActiveSession();'));
});

test('progress save/load and import validation are atomic at the boundary', () => {
  const storage = store();
  const progress = { '1': createInitialProgress('1', 0) };
  assert.equal(saveProgress(progress, storage), true);
  assert.deepEqual(loadProgress(storage), progress);
  const failingStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('quota'); } };
  assert.equal(saveProgress(progress, failingStorage), false);
  assert.equal(savePrefs({}, failingStorage), false);
  assert.equal(saveFavorites(new Set(['1']), failingStorage), false);
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
