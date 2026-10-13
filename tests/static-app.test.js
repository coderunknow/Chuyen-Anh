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
  updateSearchFavorite,
  validateImportPayload,
  exportProgressBundle,
  saveProgress,
  savePrefs,
  saveFavorites,
  saveHistory,
  saveStreak,
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

// Every write throws, the way a full or blocked localStorage behaves at runtime.
function failingStore() {
  return {
    getItem() { throw new Error('blocked'); },
    setItem() { throw new Error('quota exceeded'); }
  };
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

test('a search favorite toggle updates the cached index without dropping the result set', () => {
  const index = createSearchIndex(vocab, {}, new Set());
  assert.equal(searchVocabulary(index, 'METIC').length, 1);
  assert.equal(searchVocabulary(index, 'advers').length, 1);

  assert.equal(updateSearchFavorite(index, '2', true), true);
  // The same in-memory index now answers the favorite filter with no rebuild.
  assert.equal(searchVocabulary(index, 'METIC', { state: 'favorites' })[0].entry.word, 'Meticulous');
  // A favorite toggle must not change what an unrelated query matches.
  assert.equal(searchVocabulary(index, 'advers').length, 1);
  assert.equal(searchVocabulary(index, 'advers')[0].entry.word, 'Adversity');
  assert.equal(searchVocabulary(index, 'METIC')[0].entry.word, 'Meticulous');

  assert.equal(updateSearchFavorite(index, '2', false), true);
  assert.deepEqual(searchVocabulary(index, '', { state: 'favorites' }), []);
  assert.equal(updateSearchFavorite(index, 'missing', true), false);
  assert.equal(updateSearchFavorite(null, '2', true), false);
});

test('ID 448 renders its canonical meaning and labels the retained old wording', () => {
  const entry = embeddedVocabulary.find(item => item.id === '448');
  // The canonical vocabulary data is unchanged.
  assert.equal(entry.meaning, 'công việc tay chân tầm thường, ít được coi trọng');
  assert.equal(entry.notes, 'Previous app definition (data/vocabulary.json): công việc lao dịch, tay chân vất vả, ít được coi trọng');

  const rendered = vocabularyMetadataHtml(entry);
  assert.match(rendered, /Nghĩa của phiên bản ứng dụng trước/);
  assert.match(rendered, /chỉ tham chiếu lịch sử; không phải nghĩa hiện tại/);
  assert.match(rendered, /công việc lao dịch, tay chân vất vả, ít được coi trọng/);
  // The internal metadata marker and the generic notes label are not learner-facing.
  assert.doesNotMatch(rendered, /Previous app definition/);
  assert.doesNotMatch(rendered, /data\/vocabulary\.json/);
  assert.doesNotMatch(rendered, /<dt>Ghi chú \/ phân biệt \/ nguồn<\/dt>/);

  // Ordinary notes keep the ordinary label.
  const plain = vocabularyMetadataHtml({ notes: '**Phân biệt:** acquire là có được.' });
  assert.match(plain, /<dt>Ghi chú \/ phân biệt \/ nguồn<\/dt>/);
  assert.doesNotMatch(plain, /Nghĩa của phiên bản ứng dụng trước/);
});

test('answer choices are a named button group rather than a radio group', () => {
  // The controls are ordinary buttons: they implement no radio roles, no
  // aria-checked and no arrow-key navigation.
  assert.match(appScript[1], /class="options" role="group" aria-label="\$\{optionsLabel\}"/);
  assert.match(appScript[1], /const optionsLabel = question\.mode === MODES\.RECOGNITION \? 'Chọn nghĩa tiếng Việt' : 'Chọn từ tiếng Anh';/);
  assert.doesNotMatch(appScript[1], /role="radiogroup"/);
  assert.doesNotMatch(appScript[1], /aria-checked/);
  assert.doesNotMatch(appScript[1], /type="radio"/);
});

test('resetting or importing progress clears the whole running session', () => {
  const start = appScript[1].indexOf('function clearActiveSession()');
  const end = appScript[1].indexOf('function persist()', start);
  assert.ok(start >= 0 && end > start, 'clearActiveSession must be defined before persist');
  const clearBody = appScript[1].slice(start, end);
  for (const reset of [
    'session = null;', 'question = null;', 'questionStarted = 0;',
    'answered = false;', 'revealed = false;', 'answerResult = null;',
    'firstLook = false;', 'sessionStats = null;', 'sessionSummary = null;'
  ]) {
    assert.ok(clearBody.includes(reset), `clearActiveSession must clear ${reset}`);
  }

  const importStart = appScript[1].indexOf('async function importFile(event)');
  const resetStart = appScript[1].indexOf('function resetProgress()');
  assert.ok(importStart >= 0 && resetStart > importStart, 'the settings flows must exist');
  assert.match(appScript[1].slice(importStart, resetStart), /clearActiveSession\(\);/);
  const resetBody = appScript[1].slice(resetStart, appScript[1].indexOf("document.addEventListener('keydown'", resetStart));
  assert.match(resetBody, /clearActiveSession\(\);/);
  // Exiting a session uses the same clearing, and the summary is not wiped by it.
  assert.match(appScript[1], /'#exit-session'\).addEventListener\('click', \(\) => \{ clearActiveSession\(\); renderShell\(\); \}\)/);
  assert.doesNotMatch(appScript[1], /function finishSession\(\)[\s\S]{0,400}?clearActiveSession\(\)/);
});

test('a failed write is reported instead of being followed by a success message', () => {
  // Persistence itself returns the outcome and never claims success.
  assert.match(appScript[1], /function persist\(\)[\s\S]*?return ok;/);
  const storage = failingStore();
  assert.equal(saveProgress({ '1': createInitialProgress('1', 0) }, storage), false);
  assert.equal(savePrefs({}, storage), false);
  assert.equal(saveFavorites(new Set(['1']), storage), false);
  assert.equal(saveHistory([], storage), false);
  assert.equal(saveStreak({ current: 0 }, storage), false);
  assert.equal(saveProgress({}, null), false);

  const importStart = appScript[1].indexOf('async function importFile(event)');
  const resetStart = appScript[1].indexOf('function resetProgress()');
  const importBody = appScript[1].slice(importStart, resetStart);
  const resetBody = appScript[1].slice(resetStart, appScript[1].indexOf("document.addEventListener('keydown'", resetStart));
  for (const [name, body, successToast] of [
    ['import', importBody, "toast('Đã nhập progress thành công.', 'success')"],
    ['reset', resetBody, "toast('Đã xóa progress.', 'success')"]
  ]) {
    const guard = body.indexOf('if (!persist())');
    assert.ok(guard >= 0, `${name} must check the persistence result`);
    assert.ok(body.indexOf(successToast) > guard, `${name} must not toast success before the write is confirmed`);
  }
  // The theme toggle is a direct prefs write and reports its own failure.
  assert.match(appScript[1], /if \(!savePrefs\(prefs, storage\)\) toast\('Không thể lưu giao diện trên thiết bị này\.', 'error'\);/);
  assert.match(appScript[1], /if \(saveFavorites\(favorites, storage\)\) \{/);
});

test('global shortcuts only act on the session that is actually on screen', () => {
  // The visible flashcard lives in the learn view; another view must not be
  // replaced or graded by Space/Enter/1-4/R.
  assert.match(appScript[1], /if \(!prefs\.keyboardShortcuts \|\| view !== 'learn' \|\| !session\?\.length\) return;/);
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

test('every generated mode keeps prompt, answer and options bound to its own record', () => {
  // 913 records x 4 requested learning modes = 3,652 generated questions. This
  // checks application/data association; it is not a dictionary review.
  let generated = 0;
  let cloze = 0;
  for (const entry of embeddedVocabulary) {
    const snapshot = structuredClone(entry);
    const progress = createInitialProgress(entry.id, 0);
    for (const requested of Object.values(MODES)) {
      const question = generateQuestion({ vocab: entry, progress }, embeddedVocabulary, requested);
      generated += 1;
      const correct = question.options === null ? [] : question.options.filter(option => option.correct).map(option => [option.id, option.text]);
      if (requested === MODES.CLOZE && !entry.examples?.length) {
        // Documented fallback: cloze needs an example sentence.
        assert.equal(question.mode, MODES.RECOGNITION, `${entry.id} cloze fallback`);
      }
      if (question.mode === MODES.RECOGNITION) {
        assert.equal(question.prompt, entry.word, `${entry.id} recognition prompt`);
        assert.equal(question.answer, entry.meaning, `${entry.id} recognition answer`);
        assert.deepEqual(correct, [[entry.id, entry.meaning]], `${entry.id} recognition option`);
      } else if (question.mode === MODES.RECALL) {
        assert.equal(question.prompt, entry.meaning, `${entry.id} recall prompt`);
        assert.equal(question.answer, entry.word, `${entry.id} recall answer`);
        assert.deepEqual(correct, [[entry.id, entry.word]], `${entry.id} recall option`);
      } else if (question.mode === MODES.SPELLING) {
        assert.equal(question.prompt, entry.meaning, `${entry.id} spelling prompt`);
        assert.equal(question.answer, entry.word, `${entry.id} spelling answer`);
        assert.equal(question.options, null, `${entry.id} spelling options`);
      } else {
        assert.equal(question.mode, MODES.CLOZE, `${entry.id} mode`);
        assert.equal(question.answer, entry.word, `${entry.id} cloze answer`);
        assert.deepEqual(question.example, entry.examples[0], `${entry.id} cloze example`);
        assert.deepEqual(correct, [[entry.id, entry.word]], `${entry.id} cloze option`);
        cloze += 1;
      }
    }
    assert.deepEqual(entry, snapshot, `${entry.id} was mutated while generating questions`);
  }
  assert.equal(generated, embeddedVocabulary.length * 4);
  assert.equal(cloze, 1, 'only the record with an example sentence is asked as cloze');
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
