import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const root = new URL('../', import.meta.url);
const html = await readFile(new URL('index.html', root), 'utf8');
const vocabularyScript = html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/i);
const examScript = html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/i);
const styleBlock = html.match(/<style>([\s\S]*?)<\/style>/i);
const appScript = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/i);
assert.ok(vocabularyScript, 'index.html must contain its vocabulary JSON');
assert.ok(examScript, 'index.html must contain the offline exam archive JSON');
assert.ok(appScript, 'index.html must contain its application module');
const embeddedRaw = vocabularyScript[1].trim();
const embeddedVocabulary = JSON.parse(embeddedRaw);
const embeddedExamRaw = examScript[1].trim();
const embeddedExamRecords = JSON.parse(embeddedExamRaw);
const app = await import(`data:text/javascript;base64,${Buffer.from(appScript[1], 'utf8').toString('base64')}`);

const {
  STATES,
  MODES,
  STATE_LABELS,
  stateLabel,
  sessionModeLabel,
  recommendedSession,
  formatDuration,
  iconMarkup,
  generateQuestion,
  createInitialProgress,
  updateProgress,
  calculateStats,
  isDue,
  selectSession,
  needsFirstLook,
  canGradeBySelection,
  hasSubmissionAnswer,
  createSearchIndex,
  searchVocabulary,
  updateSearchFavorite,
  validateImportPayload,
  exportProgressBundle,
  saveProgress,
  loadPrefs,
  savePrefs,
  saveFavorites,
  saveHistory,
  saveStreak,
  loadLanguage,
  saveLanguage,
  translateUiText,
  loadHistory,
  ensureProgress,
  loadProgress,
  loadVocabulary,
  vocabularyMetadataHtml,
  normalize,
  loadExamArchive,
  filterExamArchive,
  renderExamMarkdown,
  parseExamQuestions,
  createExamPracticeSession,
  recordExamPracticeResponse,
  summarizeExamPractice,
  submitExamPractice,
  buildExamResultJson,
  gradeExamQuestion,
  getQuestionVerification,
  examResultFilename,
  selectSprintSession,
  sprintEligibleCount,
  SPRINT_AUTO_ADVANCE_MS,
  APP_VERSION,
  DEFAULT_PREFS,
  loadExamHistory,
  saveExamHistory,
  createExamAttempt,
  updateExamAttempt,
  examClockState
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

test('the embedded exam archive preserves all 106 selected transcription bodies and provenance', async () => {
  const plan = JSON.parse(await readFile(new URL('scripts/exams/selection.json', root), 'utf8'));
  const records = loadExamArchive(embeddedExamRaw);
  assert.equal(records.length, 106);
  assert.deepEqual(records.map(record => record.id), plan.map(record => record.key));
  assert.equal(records.filter(record => /HTML|OCR|cần-soát/i.test(record.quality)).length, 22);
  assert.equal(records.filter(record => record.answers.startsWith('Chưa')).length, 32);
  assert.equal(records.filter(record => record.answers.startsWith('Có')).length, 74);
  assert.doesNotMatch(embeddedExamRaw, /<\/script/i, 'source text cannot terminate its JSON script block');

  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    const source = await readFile(new URL(`De-chuyen-Anh-vao-10/${record.id}.md`, root), 'utf8');
    const body = source.replace(/^---\n[\s\S]*?\n---\n/, '');
    assert.equal(record.markdown, body, `${record.id} transcription body must be embedded without edits`);
    assert.equal(record.contentSha256, createHash('sha256').update(body, 'utf8').digest('hex'));
    assert.equal(record.source, plan[index].source);
    assert.equal(record.province, plan[index].province);
    assert.equal(record.year, plan[index].year);
  }

  const incompleteTranscripts = ['2026/an-giang/so', '2026/bac-ninh/so', '2026/hue/chuyen-khoa-hoc-hue'];
  for (const id of incompleteTranscripts) {
    const record = records.find(item => item.id === id);
    assert.match(record.note, /transcript.*không đầy đủ/i, `${id} explicitly warns that its stored transcript is incomplete`);
    assert.match(record.markdown.trimEnd(), /(?:…|\.\.\.)$/, `${id} retains the source's visible ellipsis instead of silently filling it in`);
  }
  assert.match(records.find(item => item.id === '2023/dak-lak/so').note, /không coi transcript là bản đầy đủ/i);
});

test('interface language is stored independently and is not added to prefs or the v1 backup', () => {
  const storage = store();
  assert.equal(loadLanguage(storage), 'vi', 'Vietnamese is the default');
  assert.equal(saveLanguage('en', storage), true);
  assert.equal(storage.getItem('chuyen-anh.language.v1'), 'en');
  assert.equal(loadLanguage(storage), 'en');
  assert.deepEqual(loadPrefs(storage), { sessionSize: 20, keyboardShortcuts: true, darkMode: false });
  assert.equal(saveLanguage('fr', storage), false, 'unsupported locales are rejected');
  assert.equal(loadLanguage(storage), 'en', 'an invalid choice must not overwrite the saved locale');
  assert.equal(loadLanguage({ getItem() { throw new Error('blocked'); } }), 'vi');
  assert.equal(saveLanguage('vi', { setItem() { throw new Error('blocked'); } }), false);

  const bundle = exportProgressBundle({
    progress: {}, prefs: loadPrefs(storage), favorites: new Set(), history: [],
    streak: { current: 0, longest: 0, lastDate: null }
  });
  assert.equal(bundle.version, 1);
  assert.equal(Object.hasOwn(bundle, 'language'), false);
});

test('English interface labels are localized while unknown source text and Vietnamese mode remain unchanged', () => {
  assert.equal(translateUiText('Kho đề Chuyên Anh', 'en'), 'Specialized English exam archive');
  assert.equal(translateUiText('106 bản chép · trang 1/5', 'en'), '106 transcriptions · page 1 of 5');
  assert.equal(translateUiText('913 từ.', 'en'), '913 words.');
  assert.equal(translateUiText('Tìm theo tiếng Anh, tiếng Việt, từ loại, tag hoặc ví dụ · 913 từ.', 'en'), 'Search English, Vietnamese, part of speech, tags, or examples · 913 words.');
  assert.equal(translateUiText('13/10/2026 · 4 thẻ', 'en'), '13/10/2026 · 4 cards');
  assert.equal(translateUiText('4 từ · 3 lượt · Ôn đến hạn', 'en'), '4 words · 3 turns · Due review');
  assert.equal(translateUiText('TỪ / PHIÊN', 'en'), 'WORDS / SESSION');
  assert.equal(translateUiText('Khó 0%', 'en'), 'Difficulty 0%');
  assert.equal(translateUiText('lượt còn lại', 'en'), 'turns left');
  assert.equal(translateUiText('Tiến độ của từ 17 không hợp lệ.', 'en'), 'Progress for word 17 is invalid.');
  assert.equal(translateUiText('Tệp sao lưu phải là một đối tượng JSON.', 'en'), 'The backup file must contain a JSON object.');
  assert.equal(translateUiText('Tất cả năm', 'en'), 'All years');
  assert.equal(translateUiText('  Tất cả năm  ', 'en'), '  All years  ');
  assert.equal(translateUiText('Kho đề Chuyên Anh', 'vi'), 'Kho đề Chuyên Anh');
  assert.equal(translateUiText('What are Parkour athletes expected to do?', 'en'), 'What are Parkour athletes expected to do?');
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

test('exam archive filters by year, location, format and unit', () => {
  const records = loadExamArchive(embeddedExamRaw);
  const papers2026 = filterExamArchive(records, { year: 2026 });
  assert.equal(papers2026.length, records.filter(record => record.year === 2026).length);
  assert.equal(filterExamArchive(records, { year: 2026, province: 'Vĩnh Long' }).length, 1);
  assert.equal(filterExamArchive(records, { query: 'vinh long' })[0].id, '2026/vinh-long/so');
  assert.equal(filterExamArchive(records, { format: 'needs-review' }).length, 22);
  assert.ok(filterExamArchive(records, { format: 'pdf' }).every(record => record.assets.some(asset => asset.type === 'pdf')));
  assert.ok(filterExamArchive(records, { unit: 'school' }).every(record => record.unit !== 'so'));
  assert.ok(filterExamArchive(records, { unit: 'department' }).every(record => record.unit === 'so'));
});

test('unreviewed corpus uses conservative transcript-only parsing and leaves OCR records read-only', () => {
  const records = loadExamArchive(embeddedExamRaw);
  assert.equal(embeddedExamRecords.length, 106);
  assert.equal(embeddedExamRecords.filter(record => record.review?.status === 'reviewed').length, 0);
  assert.equal(records.filter(record => /HTML|OCR|cần-soát/i.test(record.quality)).length, 22);
  assert.match(appScript[1], /if \(\/HTML\|OCR\|cần-soát\/i\.test\(record\.quality\)\) return \[\];/);
  assert.match(appScript[1], /unverified.{0,20}may be incomplete/i);
  assert.match(appScript[1], /không có đồng hồ, kiểm tra đúng\/sai, điểm số hoặc xếp hạng/);
  assert.doesNotMatch(appScript[1], /name="exam-timer-mode"|id="exam-start"|id="exam-duration"|role="timer"|class="exam-outline"/);
  assert.match(appScript[1], /examPracticeSessions = new Map\(\)/);
  assert.doesNotMatch(appScript[1], /examPracticeSessions[^;]*localStorage|localStorage[^;]*examPracticeSessions/);
});

test('transcript parser groups only present choices, marks items unverified, and stops before answer-key sections', () => {
  const source = [
    '# source title',
    '## Exam paper',
    'Choose the best option.',
    '**1.** Which drink do you prefer?',
    '| **A.** Tea | **B.** Coffee |',
    '| --- | --- |',
    '| **C.** Water | **D.** Juice |',
    '**2.** She moved to _______.',
    '10.00 a.m.: check in at the station.',
    '## Answer key',
    '**1.** B. This must never become a practice choice.',
    '**3.** A fabricated-after-cutoff prompt?'
  ].join('\n');
  const questions = parseExamQuestions(source);
  assert.equal(questions.length, 2);
  assert.deepEqual(questions[0].options.map(option => [option.label, option.text]), [
    ['A', 'Tea'], ['B', 'Coffee'], ['C', 'Water'], ['D', 'Juice']
  ]);
  assert.equal(questions[0].prompt, 'Which drink do you prefer?');
  assert.equal(questions[0].responseType, 'choice');
  assert.equal(questions[1].responseType, 'text');
  assert.equal(questions.every(question => question.verified === false), true);
  assert.doesNotMatch(JSON.stringify(questions), /This must never become|fabricated-after-cutoff/);

  const tablePrompt = parseExamQuestions([
    '## Exam paper',
    '1. Choose A, B, C or D to identify the item.',
    'Continue the instruction from the source.',
    '1. A. first B. second C. third D. fourth',
    '## Đáp án/hướng dẫn chấm trong nguồn',
    '1. correct answer is present here'
  ].join('\n'));
  assert.equal(tablePrompt.length, 1);
  assert.match(tablePrompt[0].prompt, /Choose A, B, C or D/);
  assert.match(tablePrompt[0].prompt, /Continue the instruction/);
  assert.equal(tablePrompt[0].options.length, 4);
});

test('corpus parsing stops before explicit answer and marking-scheme headings', () => {
  const records = loadExamArchive(embeddedExamRaw);
  let recordsWithKeyHeadings = 0;
  for (const record of records) {
    const lines = record.markdown.split(/\r?\n/);
    const keyHeadingIndex = lines.findIndex(line => /^\s*#{1,6}\s+/.test(line)
      && /(?:answers?(?:\s+key)?|marking\s*scheme|solutions?|đáp\s*án|hướng\s*dẫn\s*chấm)/i.test(line));
    if (keyHeadingIndex < 0) continue;
    recordsWithKeyHeadings += 1;
    const questions = parseExamQuestions(record.markdown);
    assert.ok(questions.every(question => question.sourceLine < keyHeadingIndex + 1), `${record.id} exposes no items from an answer/marking section`);
  }
  assert.ok(recordsWithKeyHeadings >= 50, 'the regression covers the majority of the corpus records that carry answer-key headings');
});

test('transcript practice supports selection, changes, incomplete submissions and in-session review without grading', () => {
  const questions = parseExamQuestions([
    '## Exam paper',
    '**1.** Which letter is printed: ___?',
    '**A.** First',
    '**B.** Second',
    '**2.** What is your response: _______?',
    '## Answer key',
    '**1.** A'
  ].join('\n'));
  const session = createExamPracticeSession('2026/demo/so', questions);
  assert.equal(session.status, 'in-progress');
  assert.equal(session.currentIndex, 0);
  assert.deepEqual(summarizeExamPractice(session), { total: 2, answered: 0, unanswered: 2 });
  assert.equal(recordExamPracticeResponse(session, questions[0].id, 'choice-Z'), false);
  assert.equal(recordExamPracticeResponse(session, questions[0].id, 'choice-A'), true);
  assert.deepEqual(summarizeExamPractice(session), { total: 2, answered: 1, unanswered: 1 });
  assert.equal(recordExamPracticeResponse(session, questions[0].id, 'choice-B'), true, 'a choice can be changed before submission');
  assert.equal(recordExamPracticeResponse(session, questions[1].id, '   '), true);
  assert.deepEqual(summarizeExamPractice(session), { total: 2, answered: 1, unanswered: 1 });
  assert.equal(recordExamPracticeResponse(session, questions[1].id, 'My answer'), true);
  assert.deepEqual(summarizeExamPractice(session), { total: 2, answered: 2, unanswered: 0 });
  assert.deepEqual(submitExamPractice(session, 1_800_000_000_000), { total: 2, answered: 2, unanswered: 0 });
  assert.equal(session.status, 'submitted');
  assert.equal(session.submittedAt, 1_800_000_000_000);
  assert.equal(recordExamPracticeResponse(session, questions[0].id, 'choice-A'), false, 'submitted selections are immutable');
  assert.equal(submitExamPractice(session, 1_800_000_000_001), null, 'a submission cannot be graded or re-submitted');
  assert.equal('score' in session, false);
  assert.equal('correct' in session, false);
  assert.equal('answerKey' in session, false);
  assert.deepEqual({ ...session.responses }, { [questions[0].id]: 'choice-B', [questions[1].id]: 'My answer' });
});

test('transcription rendering keeps source structure and escapes untrusted HTML', () => {
  const rendered = renderExamMarkdown([
    '# Paper title', '', '## Listening', '', '> **Instructions**', '',
    '| **A.** Choice |', '| --- |', '| B. Other choice |', '',
    '<u>Underlined</u><br>Next line', '',
    '[Source](https://example.test/paper?a=1&b=2)',
    '[Unsafe](javascript:alert(1))', '',
    '<img src=x onerror=alert(1)>', '',
    '```text', '<script>alert(1)</script>', '```'
  ].join('\n'), '2026/demo/so');
  assert.deepEqual(rendered.headings.map(heading => heading.label), ['Paper title', 'Listening']);
  assert.match(rendered.html, /<h3 id="exam-2026-demo-so-section-2">Listening<\/h3>/);
  assert.match(rendered.html, /<table class="exam-table">/);
  assert.match(rendered.html, /<u>Underlined<\/u><br>Next line/);
  assert.match(rendered.html, /href="https:\/\/example.test\/paper\?a=1&amp;b=2"/);
  assert.doesNotMatch(rendered.html, /href="javascript:/i);
  assert.doesNotMatch(rendered.html, /<img\b|<script\b/i);
  assert.match(rendered.html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
});

test('exam attempts use a separate local-only history and never extend the v1 flashcard backup', () => {
  const storage = store();
  const active = createExamAttempt('2026/vinh-long/so', 'countdown', 60, 1_000, 0.5);
  assert.equal(active.durationSeconds, 3_600);
  assert.equal(active.status, 'in-progress');
  assert.deepEqual(examClockState(active, 31_000), { elapsed: 30, remaining: 3_570, label: '59:30', expired: false });
  assert.equal(examClockState(active, 3_601_000).expired, true);
  assert.throws(() => createExamAttempt('2026/vinh-long/so', 'countdown', 0, 1_000), /1 đến 360 phút/);

  let attempts = updateExamAttempt([active], active.id, { notes: '1. B\n2. C' }, 2_000);
  attempts = updateExamAttempt(attempts, active.id, { status: 'completed', completedAt: 3_000 }, 3_000);
  assert.equal(saveExamHistory(attempts, storage), true);
  assert.deepEqual(loadExamHistory(storage), attempts);
  assert.equal(storage.getItem('chuyen-anh.exam-history.v1') !== null, true);
  assert.equal(storage.getItem('chuyen-anh.progress.v1'), null);

  const bundle = exportProgressBundle({
    progress: {}, prefs: {}, favorites: new Set(), history: [], streak: { current: 0, longest: 0, lastDate: null }
  });
  assert.deepEqual(Object.keys(bundle).sort(), ['app', 'exportedAt', 'favorites', 'history', 'prefs', 'progress', 'streak', 'version']);
  assert.equal('examAttempts' in bundle, false);
});

test('learner-facing labels stay local while persisted scheduler keys remain stable', () => {
  assert.deepEqual(STATE_LABELS, {
    new: 'Chưa học', learning: 'Đang học', weak: 'Từ yếu', review: 'Ôn tập', mastered: 'Thành thạo'
  });
  assert.deepEqual(Object.values(STATES), ['new', 'learning', 'weak', 'review', 'mastered']);
  assert.deepEqual(['due', 'weak', 'new', 'random', 'favorites', 'mixed'].map(sessionModeLabel), [
    'Ôn đến hạn', 'Từ yếu', 'Từ mới', 'Ngẫu nhiên', 'Yêu thích', 'Phiên nhanh'
  ]);
  assert.equal(stateLabel('future-state'), 'Trạng thái khác');
  assert.equal(sessionModeLabel('future-mode'), 'Phiên học');
  assert.equal(recommendedSession({ due: 0 }), 'quick10');
  assert.equal(recommendedSession({ due: 3 }), 'due');
  assert.equal(formatDuration(1), '1 giây');
  assert.equal(formatDuration(61), '1 phút 1 giây');
  assert.equal(formatDuration(120), '2 phút');
  assert.equal(formatDuration(61, 'en'), '1 min 1 sec');
  assert.equal(formatDuration(120, 'en'), '2 min');
  assert.match(iconMarkup('book'), /<svg[\s\S]*aria-hidden="true"[\s\S]*<\/svg>/);
  assert.doesNotMatch(iconMarkup('search'), /<(?:img|use)\b|\bsrc=/i);
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
  const optionRendererStart = appScript[1].indexOf('const optionsLabel =');
  const optionRendererEnd = appScript[1].indexOf("container.querySelector('#favorite-card')", optionRendererStart);
  assert.ok(optionRendererStart >= 0 && optionRendererEnd > optionRendererStart);
  assert.doesNotMatch(appScript[1].slice(optionRendererStart, optionRendererEnd), /type="radio"/);
  // Transcript-derived practice is ungraded and untimed; OCR-only records retain a read-only fallback.
  assert.doesNotMatch(appScript[1], /name="exam-timer-mode"|id="exam-start"|id="exam-duration"|role="timer"|class="exam-outline"/);
  assert.match(appScript[1], /id="exam-submit"/);
  assert.match(appScript[1], /function parseExamQuestions\(markdown\)/);
  assert.match(appScript[1], /Bản chép này chỉ đọc trong chế độ luyện tập/);
  assert.doesNotMatch(appScript[1], /exam-practice-locked/);
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
    ['import', importBody, "toast('Đã khôi phục tiến độ từ bản sao lưu.', 'success')"],
    ['reset', resetBody, "toast('Đã xóa dữ liệu học.', 'success')"]
  ]) {
    const guard = body.indexOf('if (!persist())');
    assert.ok(guard >= 0, `${name} must check the persistence result`);
    assert.ok(body.indexOf(successToast) > guard, `${name} must not toast success before the write is confirmed`);
  }
  // The theme toggle is a direct prefs write and reports its own failure.
  assert.match(appScript[1], /if \(!savePrefs\(prefs, storage\)\) toast\('Không thể lưu giao diện trên thiết bị này\.', 'error'\);/);
  assert.match(appScript[1], /if \(saveFavorites\(favorites, storage\)\) \{/);
});

test('programmatic page focus stays visually quiet while settings switches have names and focus', () => {
  assert.ok(styleBlock);
  assert.match(styleBlock[1], /\.content:focus \{ outline: none; \}/);
  assert.match(appScript[1], /aria-labelledby=\"dark-label\" aria-describedby=\"dark-help\"/);
  assert.match(appScript[1], /aria-labelledby=\"keys-label\" aria-describedby=\"keys-help\"/);
  assert.match(styleBlock[1], /\.switch input:focus-visible \+ span \{ outline: 3px solid/);
  assert.match(appScript[1], /aria-labelledby=\"size-label\" aria-describedby=\"size-help\"/);
});

test('global shortcuts only act on the session that is actually on screen', () => {
  // The visible flashcard lives in the learn view; another view must not be
  // replaced or graded by Space/Enter/1-4/R.
  assert.match(appScript[1], /if \(!prefs\.keyboardShortcuts \|\| view !== 'learn' \|\| !session\?\.length\) return;/);
});

test('an exported backup round-trips through the importer without loss or mutation', () => {
  const ids = new Set(vocab.map(entry => entry.id));
  // Progress as the scheduler actually produces it, so clamping cannot silently rewrite it.
  let scheduled = createInitialProgress('1', 0);
  for (const correct of [true, true, true, true, true, true, false, true]) scheduled = updateProgress(scheduled, correct, 1200, 1_700_000_000_000);
  const progress = { ...Object.fromEntries(vocab.map(entry => [entry.id, createInitialProgress(entry.id, 0)])), '1': scheduled };
  const streak = { current: 3, longest: 5, lastDate: '2026-10-13' };
  const prefs = { sessionSize: 20, keyboardShortcuts: true, darkMode: false };
  const history = [
    { date: '2026-10-12T00:00:00.000Z', total: 10, correct: 8, wrong: 2, accuracy: 80, mode: 'yêu thích', durationSec: 120 },
    { date: '2026-10-13T00:00:00.000Z', total: 5, correct: 5, wrong: 0, accuracy: 100, mode: 'mixed', durationSec: 45 }
  ];
  const first = exportProgressBundle({ progress, prefs, favorites: new Set(['2']), history, streak });
  assert.equal(first.app, 'chuyen-anh-flashcard');
  assert.equal(first.version, 1);
  assert.ok(typeof first.exportedAt === 'string');

  const imported = validateImportPayload(JSON.parse(JSON.stringify(first)), ids);
  // The scheduler's own output must survive the importer byte for byte.
  assert.deepEqual(imported.progress['1'], scheduled);
  assert.deepEqual(imported.streak, streak);
  assert.deepEqual(imported.prefs, prefs);
  assert.deepEqual(imported.history, history);
  assert.deepEqual([...imported.favorites], ['2']);
  // Vietnamese text in user data survives the round trip.
  assert.equal(imported.history[0].mode, 'yêu thích');

  // Exporting the imported state again must reproduce the same logical bundle.
  const second = exportProgressBundle({
    progress: ensureProgress(imported.progress, vocab, 0),
    prefs: imported.prefs,
    favorites: imported.favorites,
    history: imported.history,
    streak: imported.streak
  });
  const stripVolatile = ({ exportedAt, ...rest }) => rest;
  assert.deepEqual(stripVolatile(second), stripVolatile(first), 'a repeated import/export must not mutate the bundle');
  // Only the volatile timestamp may differ between two exports.
  assert.notEqual(second.exportedAt, undefined);

  // Unknown fields are dropped by the fixed record shapes instead of being carried around.
  const extras = validateImportPayload(JSON.parse(JSON.stringify({
    ...first,
    progress: { '1': { ...scheduled, unknownField: 'x' } },
    history: [{ ...history[0], unknownField: 'x' }],
    streak: { ...streak, unknownField: 'x' }
  })), new Set(['1']));
  assert.equal('unknownField' in extras.progress['1'], false);
  assert.equal('unknownField' in extras.history[0], false);
  assert.equal('unknownField' in extras.streak, false);
});

test('misidentified and malformed backups are rejected with an accurate message', () => {
  const bundle = exportProgressBundle({ progress: { '1': createInitialProgress('1', 0) }, prefs: {}, favorites: new Set(['1']), history: [], streak: { current: 0, longest: 0, lastDate: null } });
  const cases = [
    ['not an object', [], /đối tượng JSON/],
    ['wrong application id', { ...bundle, app: 'other-app' }, /không đúng phiên bản/],
    ['unsupported version', { ...bundle, version: 2 }, /không đúng phiên bản/],
    ['missing progress', { ...bundle, progress: undefined }, /thiếu tiến độ học/],
    ['invalid state', { ...bundle, progress: { '1': { state: 'nope' } } }, /không hợp lệ/],
    ['negative counters', { ...bundle, progress: { '1': { state: 'new', correctCount: -1 } } }, /không hợp lệ/],
    ['history is not an array', { ...bundle, history: 'nope' }, /Lịch sử phiên học không hợp lệ/],
    ['history entry without a real date', { ...bundle, history: [{ date: 'not-a-date', total: 1, correct: 0, wrong: 1, accuracy: 0, durationSec: 1, mode: 'x' }] }, /Lịch sử phiên học không hợp lệ/],
    ['streak is not numeric', { ...bundle, streak: { current: -1, longest: 0 } }, /Chuỗi ngày học liên tiếp không hợp lệ/],
    ['unsupported session size', { ...bundle, prefs: { sessionSize: 7, keyboardShortcuts: true, darkMode: false } }, /Cài đặt chứa giá trị không hợp lệ/]
  ];
  for (const [label, payload, pattern] of cases) {
    assert.throws(() => validateImportPayload(payload, new Set(['1'])), pattern, label);
  }
  // Validation happens before any write, so a rejected file cannot touch stored data.
  const storage = store();
  saveProgress({ '1': createInitialProgress('1', 0) }, storage);
  const before = JSON.stringify(loadProgress(storage));
  assert.throws(() => validateImportPayload({ ...bundle, app: 'other-app' }, new Set(['1'])));
  assert.equal(JSON.stringify(loadProgress(storage)), before);
});

test('session history keeps one retention window across storage, export and import', () => {
  const entries = Array.from({ length: 60 }, (_, index) => ({
    date: new Date(1_700_000_000_000 + index * 60_000).toISOString(),
    total: 1, correct: 1, wrong: 0, accuracy: 100, mode: 'due', durationSec: 10
  }));
  const storage = store();
  assert.equal(saveHistory(entries, storage), true);
  const stored = loadHistory(storage);
  assert.equal(stored.length, 50, 'storage keeps the last 50 sessions');
  assert.deepEqual(stored.map(entry => entry.date), entries.slice(-50).map(entry => entry.date));

  // A bundle built from the retained window round-trips unchanged: the oldest
  // sessions are already gone before the export, so import cannot drop any.
  const bundle = exportProgressBundle({
    progress: { '1': createInitialProgress('1', 0) }, prefs: {}, favorites: new Set(['1']), history: stored, streak: { current: 0, longest: 0, lastDate: null }
  });
  assert.equal(bundle.history.length, 50);
  const imported = validateImportPayload(JSON.parse(JSON.stringify(bundle)), new Set(['1']));
  assert.deepEqual(imported.history, stored, 'an exported backup must import without losing sessions');

  // The in-memory window is trimmed with the same constant, so an export can never
  // contain more rows than the importer keeps.
  const finishStart = appScript[1].indexOf('function finishSession()');
  const finishBody = appScript[1].slice(finishStart, appScript[1].indexOf('function renderSummary', finishStart));
  assert.match(finishBody, /history = history\.slice\(-HISTORY_LIMIT\);/);
  assert.match(appScript[1], /const HISTORY_LIMIT = 50;/);
  assert.equal((appScript[1].match(/-HISTORY_LIMIT\)/g) || []).length, 4, 'memory, load, save and import share the window');
  assert.doesNotMatch(appScript[1], /slice\(-50\)/, 'no bare retention literal may bypass the shared constant');
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

test('a blank spelling submission is not an attempt that can be graded', () => {
  const spelling = { mode: MODES.SPELLING, answer: 'Adversity' };
  const choice = { mode: MODES.RECOGNITION, options: [{ id: '1', text: 'a', correct: true }] };
  assert.equal(hasSubmissionAnswer(spelling, ''), false);
  assert.equal(hasSubmissionAnswer(spelling, '   '), false);
  assert.equal(hasSubmissionAnswer(spelling, '\t\n'), false);
  assert.equal(hasSubmissionAnswer(spelling, null), false);
  assert.equal(hasSubmissionAnswer(spelling, undefined), false);
  assert.equal(hasSubmissionAnswer(spelling, 'Adversity'), true);
  assert.equal(hasSubmissionAnswer(spelling, '  adversity  '), true);
  assert.equal(hasSubmissionAnswer(choice, '1'), true);
  assert.equal(hasSubmissionAnswer(choice, ''), false);
  assert.equal(hasSubmissionAnswer(null, 'x'), false, 'without a question there is nothing to submit');
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

// ---------------------------------------------------------------------------
// "Học cấp tốc" — the sprint must learn the requested vocabulary volume faster,
// never by quietly teaching fewer words. These tests fail if a hidden cap such
// as the historical SPRINT_SIZE = 7 returns.
// ---------------------------------------------------------------------------

const sprintPool = Array.from({ length: 30 }, (_, index) => ({
  id: String(index + 1),
  word: `Word ${index + 1}`,
  pos: index % 2 ? 'adj' : 'n',
  meaning: `nghĩa ${index + 1}`,
  examples: []
}));

function sprintProgress(entries, now, nextReviewFor = index => now + index * 1000) {
  const progress = {};
  entries.forEach((entry, index) => {
    progress[entry.id] = createInitialProgress(entry.id, nextReviewFor(index));
  });
  return progress;
}

test('a study sprint queues the configured session size instead of a hidden seven-word cap', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  const progress = sprintProgress(sprintPool, now);

  const sprint = selectSprintSession(sprintPool, progress, { size: 20, now });
  assert.equal(sprint.length, 20, '20 requested words over a 30-word pool must queue 20, not 7');
  assert.deepEqual(sprint.map(item => item.vocab.id), sprintPool.slice(0, 20).map(entry => entry.id),
    'the deterministic priority order is preserved');
  assert.equal(new Set(sprint.map(item => item.vocab.id)).size, 20, 'no word is queued twice');

  // The same settings must not produce a smaller lesson just because it is a sprint.
  const mixed = selectSession(sprintPool, progress, { size: 20, mode: 'mixed', now });
  assert.equal(sprint.length, mixed.length,
    'a sprint and a mixed session with the same settings queue the same volume');

  // The size is a real parameter, not a constant with a 7 baked in.
  assert.equal(selectSprintSession(sprintPool, progress, { size: 7, now }).length, 7,
    'an explicitly requested 7-word session is still 7');
  assert.equal(selectSprintSession(sprintPool, progress, { size: 10, now }).length, 10);
  assert.equal(selectSprintSession(sprintPool, progress, { size: 50, now }).length, 30,
    'a target larger than the pool queues the whole pool');
  assert.equal(selectSprintSession(sprintPool, progress, { now }).length, DEFAULT_PREFS.sessionSize,
    'the default target is the learner-configured session size');
  assert.equal(sprintEligibleCount(sprintPool, progress), 30);
});

test('a study sprint ranks due, weak, learning, new, review and mastered cards deterministically', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  const entries = [
    { id: 'w1', word: 'W1', pos: 'adj', meaning: 'm1' },
    { id: 'w2', word: 'W2', pos: 'adj', meaning: 'm2' },
    { id: 'l1', word: 'L1', pos: 'v', meaning: 'm3' },
    { id: 'w3', word: 'W3', pos: 'adj', meaning: 'm4' },
    { id: 'n1', word: 'N1', pos: 'n', meaning: 'm5' },
    { id: 'n2', word: 'N2', pos: 'n', meaning: 'm6' },
    { id: 'r1', word: 'R1', pos: 'n', meaning: 'm7' },
    { id: 'm1', word: 'M1', pos: 'n', meaning: 'm8' }
  ];
  const progress = {
    w1: { ...createInitialProgress('w1'), state: STATES.WEAK, wrongCount: 1, nextReview: now - 500 },
    w2: { ...createInitialProgress('w2'), state: STATES.WEAK, wrongCount: 9, nextReview: now - 400 },
    l1: { ...createInitialProgress('l1'), state: STATES.LEARNING, correctCount: 1, nextReview: now - 300 },
    w3: { ...createInitialProgress('w3'), state: STATES.WEAK, wrongCount: 7, nextReview: now + 5000 },
    n1: { ...createInitialProgress('n1'), nextReview: now + 100 },
    n2: { ...createInitialProgress('n2'), nextReview: now + 200 },
    r1: { ...createInitialProgress('r1'), state: STATES.REVIEW, correctCount: 4, nextReview: now + 1000 },
    m1: { ...createInitialProgress('m1'), state: STATES.MASTERED, correctCount: 9, nextReview: now + 2000 }
  };

  const order = selectSprintSession(entries, progress, { size: 8, now }).map(item => item.vocab.id);
  assert.deepEqual(order, ['w1', 'w2', 'l1', 'w3', 'n1', 'n2', 'r1', 'm1'],
    'due cards come first (weak before learning), then weak, new, review and mastered');
  assert.deepEqual(selectSprintSession(entries, progress, { size: 3, now }).map(item => item.vocab.id),
    ['w1', 'w2', 'l1'], 'a small target keeps the same priority prefix');
  assert.deepEqual(selectSprintSession(entries, progress, { size: 8, now }), selectSprintSession(entries, progress, { size: 8, now }),
    'the sprint order is deterministic across calls');

  const masteredOnly = { m1: { ...createInitialProgress('m1'), state: STATES.MASTERED, correctCount: 9, nextReview: now + 2000 } };
  assert.deepEqual(selectSprintSession(entries, masteredOnly, { size: 5, now }).map(item => item.vocab.id), ['m1'],
    'mastered cards are still reachable instead of producing an empty session');
});

test('a study sprint handles small pools, unknown ids and an empty pool without inventing words', () => {
  const now = Date.parse('2026-10-20T00:00:00Z');
  const small = sprintPool.slice(0, 5);
  const progress = sprintProgress(small, now);
  const queued = selectSprintSession(small, progress, { size: 20, now });
  assert.equal(queued.length, 5, 'a pool smaller than the target queues exactly the pool');
  assert.deepEqual(queued.map(item => item.vocab.id), ['1', '2', '3', '4', '5']);

  const stale = { ...progress, gone: { ...createInitialProgress('gone'), state: STATES.WEAK, wrongCount: 3, nextReview: now - 1 } };
  assert.equal(selectSprintSession(small, stale, { size: 20, now }).length, 5,
    'progress for an id that is no longer in the vocabulary is ignored');
  assert.equal(sprintEligibleCount(small, stale), 5);

  assert.deepEqual(selectSprintSession(small, progress, { size: 0, now }), [], 'a zero target queues nothing');
  assert.deepEqual(selectSprintSession([], {}, { size: 20, now }), [], 'an empty pool queues nothing');
  assert.deepEqual(selectSprintSession(small, {}, { size: 20, now }), [], 'no stored progress means no eligible card');
  assert.equal(selectSprintSession(small, progress, { size: Number.NaN, now }).length, 0,
    'an invalid target is not treated as "unlimited"');
});

test('exam grading never turns an unverified answer key into a confident grade', () => {
  const choice = {
    id: 'q1', prompt: 'Choose the correct option', responseType: 'choice', sourceLine: '1. A',
    options: [{ id: 'A', label: 'A', text: 'alpha' }, { id: 'B', label: 'B', text: 'beta' }]
  };
  const blank = { id: 'q2', prompt: 'Fill in blank 2', responseType: 'text', options: [], sourceLine: '2. ____' };

  assert.deepEqual(getQuestionVerification(choice), { status: 'unverified', answer: null, evidence: null });
  const ungraded = gradeExamQuestion(choice, 'A');
  assert.equal(ungraded.result, 'ungraded');
  assert.equal(ungraded.officialAnswer, null, 'an unknown key is not echoed as an official answer');
  assert.match(ungraded.reason, /Chưa có đáp án/);

  // A key is only usable when it is explicitly marked verified.
  const verified = { ...blank, verifiedAnswer: 'resilient', verificationStatus: 'verified', verificationEvidence: 'Cambridge, 2026-10-20' };
  assert.deepEqual(gradeExamQuestion(verified, 'Resilient').result, 'correct');
  assert.deepEqual(gradeExamQuestion(verified, 'resilience').result, 'incorrect');
  assert.equal(getQuestionVerification({ ...blank, verifiedAnswer: 'resilient', verificationStatus: 'pending' }).status, 'unverified',
    'a pending key is not treated as verified');
});

test('exported exam results report exactly what the learner did and what could be graded', () => {
  const record = {
    id: '2023/dak-lak/so', year: 2023, province: 'Đắk Lắk', unit: 'so',
    unitLabel: 'Sở GD&ĐT Đắk Lắk', source: 'https://example.test/de-thi',
    assets: [{ type: 'pdf', sha256: 'a'.repeat(64) }], contentSha256: 'b'.repeat(64),
    quality: 'PDF-text', note: 'Bản chép tham khảo, chưa đối chiếu từng câu.',
    answers: 'Chưa lấy được đáp án riêng', markdown: 'x'.repeat(6000)
  };
  const questions = [
    { id: 'q1', prompt: 'Choose the correct option', responseType: 'choice', sourceLine: '1. A', options: [{ id: 'A', label: 'A', text: 'alpha' }, { id: 'B', label: 'B', text: 'beta' }] },
    { id: 'q2', prompt: 'Fill in blank 2', responseType: 'text', options: [], sourceLine: '2. ____' },
    { id: 'q3', prompt: 'Fill in blank 3', responseType: 'text', options: [], sourceLine: '3. ____' }
  ];
  const session = createExamPracticeSession(record.id, questions);
  assert.equal(recordExamPracticeResponse(session, 'q1', 'B'), true);
  assert.equal(recordExamPracticeResponse(session, 'q1', 'Z'), false, 'an option that does not exist is rejected');
  assert.equal(recordExamPracticeResponse(session, 'q2', '  resilient  '), true);
  const submitted = submitExamPractice(session, 5000);
  assert.deepEqual(submitted, { total: 3, answered: 2, unanswered: 1 });

  const result = buildExamResultJson(session, record, { now: 6000 });
  assert.equal(result.app, 'Chuyên Anh');
  assert.equal(result.version, APP_VERSION, 'the result carries the application version');
  assert.equal(result.version, 'v1.0.0-beta1');
  assert.equal(result.schemaVersion, '1.0.0');
  assert.deepEqual(result.summary, {
    total: 3, answered: 2, unanswered: 1,
    graded: 0, correct: 0, incorrect: 0, ungraded: 3, accuracy: null
  }, 'with no verified key nothing is graded and accuracy stays unknown');
  assert.equal(result.questions[0].learnerAnswer, 'B');
  assert.equal(result.questions[1].learnerAnswer, '  resilient  ', 'the stored response is unchanged');
  assert.equal(result.questions[2].answered, false);
  assert.equal(result.questions[2].learnerAnswer, null, 'an unanswered item is null, never a guessed answer');
  assert.deepEqual(result.questions.map(item => item.result), ['ungraded', 'ungraded', 'ungraded']);
  assert.equal(result.provenance.answersField, record.answers);
  assert.equal(result.attempt.gradingPolicy, 'verified-only');
  assert.deepEqual(JSON.parse(JSON.stringify(result)), result, 'the result survives a JSON round trip');

  assert.equal(examResultFilename(result), 'ket-qua-2023-dak-lak-so-1970-01-01.json');
  const unicodeRecord = { ...record, id: '2026/hue/chuyên-khoa-học-huế' };
  const unicodeName = examResultFilename({ ...result, exam: { ...result.exam, id: unicodeRecord.id } });
  assert.match(unicodeName, /^ket-qua-2026-hue-[a-z0-9-]+-1970-01-01\.json$/,
    'a Vietnamese source id becomes a stable ASCII-safe download name');
  assert.equal(/[^a-z0-9.-]/.test(unicodeName), false, 'no separator, accent or space can reach the filename');
});

test('the sprint pace constant is a bounded delay, not a lesson size', () => {
  assert.equal(Number.isFinite(SPRINT_AUTO_ADVANCE_MS), true);
  assert.equal(SPRINT_AUTO_ADVANCE_MS >= 800 && SPRINT_AUTO_ADVANCE_MS <= 5000, true,
    'auto-advance leaves time to read the feedback');
});

test('the sprint and session headers translate without leaking Vietnamese fragments', () => {
  assert.equal(translateUiText('Phiên nhanh · 10 từ đã xếp · 3 lượt còn lại', 'en'),
    'Quick session · 10 words queued · 3 turns left');
  assert.equal(translateUiText('Học cấp tốc · 10 từ đã xếp · 10 lượt còn lại', 'en'),
    'Study sprint · 10 words queued · 10 turns left');
  assert.equal(translateUiText('Học cấp tốc · 10 từ / phiên', 'en'), 'Study sprint · 10 words / session');
  assert.equal(translateUiText('913 từ đủ điều kiện · xếp 10 · 10 đến hạn · 2 từ yếu', 'en'),
    '913 eligible words · 10 queued · 10 due · 2 weak');
  assert.match(translateUiText('Chế độ cấp tốc: tự chuyển sau 1,6 giây (nhấn Enter để tiếp ngay).', 'en'),
    /advances automatically/);
  assert.equal(translateUiText('Phiên nhanh · 1 từ đã xếp · 1 lượt còn lại', 'en'),
    'Quick session · 1 word queued · 1 turn left', 'counts agree in the singular');
  assert.equal(translateUiText('Học cấp tốc · 10 từ / phiên', 'vi'), 'Học cấp tốc · 10 từ / phiên');
});
