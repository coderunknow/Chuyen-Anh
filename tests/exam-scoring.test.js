import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

function store(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: key => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, value),
    removeItem: key => data.delete(key),
    snapshot: () => Object.fromEntries(data)
  };
}
const choice = (id, label, text) => ({ id, label, text });
function question(overrides = {}) {
  return {
    id: 'q-1-test', number: 1, prompt: 'Choose the best answer.', instruction: '',
    responseType: 'choice', options: [choice('choice-A', 'A', 'go'), choice('choice-B', 'B', 'goes')],
    flags: [], ...overrides
  };
}
function key(overrides = {}) {
  return {
    questionId: 'q-1-test', verificationStatus: 'source_transcription_unverified',
    candidates: ['choice-A'], acceptedAlternatives: [], normalization: 'choice-id',
    sources: [{ kind: 'transcription', locator: 'answer section', url: null }], limitations: [], ...overrides
  };
}

test('rc6 markdown: escaped delimiters stay literal and code spans are not re-parsed', () => {
  const out = app.renderExamMarkdown('\\[literal](https://example.com) and `**code**` and &amp;').html;
  assert.doesNotMatch(out, /<a /);
  assert.match(out, /<code>\*\*code\*\*<\/code>/);
  assert.match(out, /&amp;/);
  assert.doesNotMatch(out, /&amp;amp;/);
});

test('rc6 markdown: tables keep headers, alignment and escaped pipes; unsafe links/images stay inert', () => {
  const out = app.renderExamMarkdown('| H | Right |\n| :--- | ---: |\n| a\\|b | 2 |').html;
  assert.match(out, /<th scope="col"[^>]*>H<\/th>/);
  assert.match(out, /text-align:right/);
  assert.match(out, /a\|b/);
  const unsafe = app.renderExamMarkdown('[x](javascript:alert(1)) ![x](https://example.com/a.png) [y](data:text/html,x)').html;
  assert.doesNotMatch(unsafe, /<a |<img /);
});

test('rc6 markdown: ordered numbering, hard breaks and blockquote structure survive', () => {
  const out = app.renderExamMarkdown('5\\. fifth\n6\\. sixth\n\nline one  \nline two\n\n> quote **bold**\n>\n> second paragraph').html;
  assert.match(out, /<ol start="5">/);
  assert.match(out, /line one<br>/);
  assert.match(out, /<blockquote>[\s\S]*<strong>bold<\/strong>[\s\S]*second paragraph/);
});

test('rc6 parser: stable IDs do not depend on array position and fenced questions are parsed', () => {
  const md = '## Đề thi\n\n```text\nPart 1\n1. She ____ home.\nA. go\nB. goes\n2. They ____ home.\nA. go\nB. goes\n```\n';
  const a = app.parseExamQuestions(md, '2025/test/so');
  const b = app.parseExamQuestions(md.replace('Part 1', 'Part 1\n'), '2025/test/so');
  assert.equal(a.length, 2);
  assert.deepEqual(a.map(q => q.id), b.map(q => q.id));
  assert.doesNotMatch(a[0].id, /^q-\d+-1$/);
});

test('rc6 parser: answer material never becomes a practice question or option', () => {
  const md = '## Đề thi\n1. She ____ home.\nA. go\nB. goes\n## Đáp án/hướng dẫn chấm trong nguồn\n1. B\n2. A\n';
  const qs = app.parseExamQuestions(md, '2025/test/so');
  assert.equal(qs.length, 1);
  assert.equal(qs[0].options.length, 2);
  assert.doesNotMatch(JSON.stringify(qs), /verifiedAnswer|candidates|answerKey/);
});

test('rc6 grading: provenance controls provisional scoring and missing keys stay ungraded', () => {
  const q = question(); const session = { questions: [q], responses: { [q.id]: 'choice-A' }, status: 'submitted' };
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key()).result, 'correct');
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key()).provisional, true);
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key({ verificationStatus: 'official_verified' })).provisional, false);
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key({ verificationStatus: 'missing_answer', candidates: [] })).result, 'ungraded');
  assert.equal(app.gradeExamQuestion(q, '', key()).result, 'ungraded');
  assert.equal(app.gradeExamQuestion(q, 'choice-Z', key()).result, 'ungraded');
});

test('rc6 grading: multiple choices, true/false, alternatives and explicit normalization', () => {
  const multi = question({ id: 'm', responseType: 'multiple', options: [choice('choice-A','A','a'),choice('choice-B','B','b'),choice('choice-C','C','c')] });
  assert.equal(app.gradeExamQuestion(multi, ['choice-B','choice-A'], key({ questionId:'m', candidates:['choice-A','choice-B'], normalization:'choice-set' })).result, 'correct');
  assert.equal(app.gradeExamQuestion(multi, ['choice-A'], key({ questionId:'m', candidates:['choice-A','choice-B'], normalization:'choice-set' })).result, 'incorrect');
  const tf = question({ id:'tf', responseType:'true-false', options:[choice('choice-T','T','True'),choice('choice-F','F','False')] });
  assert.equal(app.gradeExamQuestion(tf, 'choice-T', key({ questionId:'tf', candidates:['true'], normalization:'true-false' })).result, 'correct');
  const text = question({ id:'t', responseType:'text', options:[] });
  assert.equal(app.gradeExamQuestion(text, '  COLOUR  ', key({ questionId:'t', candidates:['color'], acceptedAlternatives:['colour'], normalization:'case-whitespace' })).result, 'correct');
  assert.equal(app.gradeExamQuestion(text, 'colours', key({ questionId:'t', candidates:['color'], acceptedAlternatives:['colour'], normalization:'case-whitespace' })).result, 'incorrect');
});

test('rc6 scoring: denominator excludes ungraded items and ambiguous keys require review', () => {
  const qs = [question({ id:'a' }), question({ id:'b' }), question({ id:'c' }), question({ id:'d' })];
  const keys = [key({ questionId:'a' }), key({ questionId:'b', candidates:['choice-B'] }), key({ questionId:'c', verificationStatus:'missing_answer', candidates:[] }), key({ questionId:'d', verificationStatus:'ambiguous_review', candidates:['choice-A','choice-B'] })];
  const session = { questions: qs, responses: { a:'choice-A', b:'choice-A', c:'choice-A' }, status:'submitted' };
  const result = app.scoreExamSession(session, keys);
  assert.equal(result.summary.total, 4);
  assert.equal(result.summary.graded, 2);
  assert.equal(result.summary.correct, 1);
  assert.equal(result.summary.incorrect, 1);
  assert.equal(result.summary.ungraded, 2);
  assert.equal(result.summary.provisional, 2);
  assert.equal(result.summary.percentage, 50);
  assert.equal(result.summary.officialScore, null);
});

test('rc6 history: versioned round trip, atomic invalid import, deterministic conflicts and legacy isolation', () => {
  const q = question(); const keys = [key()];
  const session = app.createExamPracticeSession('2025/test/so', [q], 1000);
  app.recordExamPracticeResponse(session, q.id, 'choice-A'); app.submitExamPractice(session, 1000);
  const record = { id:'2025/test/so', year:2025, province:'Test', unit:'so', unitLabel:'Test', source:'https://example.com', assets:[], quality:'PDF-text', answers:'', note:'', contentSha256:'a'.repeat(64), markdown:'' };
  const attempt = app.createExamResultRecord(session, record, keys, { now: 1000, id: 'attempt-1' });
  let history = app.emptyExamResultHistory();
  history = app.addExamResult(history, attempt);
  const corrected = app.applyExamKeyCorrection(history, { examId: record.id, questionId: q.id, candidates:['choice-B'], normalization:'choice-id', note:'user review', now:2000 });
  assert.equal(corrected.ok, true);
  assert.equal(corrected.history.attempts[0].summary.correct, 0);
  const exported = app.exportExamResultHistory(corrected.history);
  const imported = app.validateExamResultHistory(JSON.parse(exported));
  assert.equal(imported.ok, true);
  const merged = app.mergeExamResultHistory(corrected.history, imported.value);
  assert.equal(merged.ok, true);
  assert.equal(merged.history.attempts.length, 1);
  const conflict = app.applyExamKeyCorrection(corrected.history, { examId:record.id, questionId:q.id, candidates:['choice-A'], normalization:'choice-id', note:'other', now:3000, replace:true });
  const badMerge = app.mergeExamResultHistory(corrected.history, conflict.history);
  assert.equal(badMerge.ok, false);
  const s = store({ 'chuyen-anh.progress.v1': '{"1":{"correctCount":9}}', 'chuyen-anh.phrase-progress.v1': '{"P001":{"correctCount":8}}' });
  assert.equal(app.saveExamResultHistory(corrected.history, s), true);
  const before = s.snapshot();
  assert.equal(app.importExamResultHistory(JSON.stringify({ schemaVersion: 99 }), s).ok, false);
  assert.deepEqual(s.snapshot(), before);
  assert.equal(app.loadExamResultHistory(s).attempts.length, 1);
});

test('rc6 archive: every record has unique question IDs and a machine-readable scoring audit', async () => {
  let total = 0;
  for (const record of records) {
    const qs = app.parseExamQuestions(record.markdown, record.id);
    assert.ok(qs.length > 0, `${record.id} exposes no practice items`);
    assert.equal(new Set(qs.map(q => q.id)).size, qs.length, record.id);
    assert.equal(record.answerKey.length, qs.length, `${record.id} has one key record per parsed item`);
    assert.equal(new Set(record.answerKey.map(k => k.questionId)).size, qs.length, record.id);
    total += qs.length;
  }
  assert.ok(total > 3405, 'fenced PDFs and previously omitted objective items must not disappear');
  assert.equal(typeof app.extractExamAnswerKeys, 'function');
});

test('rc6 build: the answer-key manifest and scoring audit regenerate byte-for-byte', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = execFileSync(process.execPath, ['scripts/exams/build_answer_keys.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /Checked answer keys: 106 papers/);
});
