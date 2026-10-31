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

test('rc8 grading: provenance controls provisional scoring and missing keys receive fallback inference with VERY_LOW confidence', () => {
  const q = question();
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key()).result, 'correct');
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key()).provisional, true);
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key({ verificationStatus: 'official_verified' })).provisional, false);
  const fallbackGrade = app.gradeExamQuestion(q, 'choice-A', key({ verificationStatus: 'missing_answer', candidates: [] }));
  assert.ok(['correct', 'incorrect'].includes(fallbackGrade.result));
  assert.equal(fallbackGrade.provisional, true);
  assert.equal(fallbackGrade.confidence, 'VERY_LOW');
  assert.equal(fallbackGrade.sourceStatus, 'reasoned_inference');
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

test('rc8 scoring: universal full-paper denominator scores 100% of items including fallback, ambiguous and essay rubric items', () => {
  const essayQ = question({ id:'e', number:5, responseType:'essay', options:[], prompt:'Write an essay of about 150-200 words discussing whether technology improves education.' });
  const qs = [question({ id:'a' }), question({ id:'b' }), question({ id:'c' }), question({ id:'d' }), essayQ];
  const keys = [
    key({ questionId:'a', confidence:'HIGH', sourceStatus:'independently_cross_checked', verificationStatus:'independently_cross_checked' }),
    key({ questionId:'b', candidates:['choice-B'], confidence:'MEDIUM', sourceStatus:'single_source_transcription' }),
    key({ questionId:'c', verificationStatus:'missing_answer', candidates:[] }),
    key({ questionId:'d', verificationStatus:'ambiguous_review', sourceStatus:'ambiguous_source', confidence:'LOW', candidates:['choice-A','choice-B'] }),
    key({ questionId:'e', verificationStatus:'inferred_unverified', sourceStatus:'reasoned_inference', confidence:'LOW', candidates:['[150-200 words rubric]'], normalization:'essay-rubric' })
  ];
  const essayText = 'Nowadays, modern technology significantly transforms classroom education across the world. Firstly, digital platforms provide interactive resources that help students understand complex concepts effectively. Moreover, learners who live in remote regions can access high-quality courses online. However, excessive screen time may distract teenagers unless teachers establish clear guidelines. Therefore, schools should integrate educational technology thoughtfully while maintaining strong human mentorship.';
  const session = { questions: qs, responses: { a:'choice-A', b:'choice-A', c:'choice-A', e: essayText }, status:'submitted' };
  const result = app.scoreExamSession(session, keys);
  assert.equal(result.summary.total, 5);
  assert.equal(result.summary.denominator, 5);
  assert.equal(result.summary.answered, 4);
  assert.equal(result.summary.unanswered, 1);
  assert.equal(result.summary.graded, 4);
  assert.equal(result.summary.ungraded, 1);
  assert.equal(result.summary.provisional, 5);
  assert.equal(result.summary.officialScore, null);
  assert.ok(result.summary.earnedPoints > 1.5 && result.summary.earnedPoints <= 3);
  assert.equal(result.summary.percentage, Math.round((result.summary.earnedPoints / 5) * 1000) / 10);
  const gibberish = app.gradeExamEssayRubric(essayQ, 'test test test test test test test test test test');
  assert.ok(gibberish.earnedCredit <= 0.1, 'repetitive gibberish must not game the provisional essay rubric');
});

test('rc8 transcript fallback and legacy rc6 history migration preserve anti-tampering on direct imports', () => {
  const md = '## Đề thi\nPart 1. Listen and choose.\n1. Where is the speaker?\nA. Library\nB. Station\n## Transcript\nWelcome to the central railway station platform three. Passengers for London please board now.\n## Đáp án\n1. B\n';
  const qs = app.parseExamQuestions(md, '2025/test/so');
  const ks = app.extractExamAnswerKeys(md, qs, { id: '2025/test/so', quality: 'PDF-text' });
  assert.equal(ks[0].stimulusFallback, 'listening_transcript_fallback');
  assert.equal(ks[0].confidence, 'LOW');
  assert.match(app.extractExamTranscript(md), /railway station/);

  const q = question(); const keys = [key()];
  const session = app.createExamPracticeSession('2025/test/so', [q], 1000);
  app.recordExamPracticeResponse(session, q.id, 'choice-A'); app.submitExamPractice(session, 1000);
  const record = { id:'2025/test/so', year:2025, province:'Test', unit:'so', unitLabel:'Test', source:'https://example.com', assets:[], quality:'PDF-text', answers:'', note:'', contentSha256:'b'.repeat(64), markdown:'' };
  const attempt = app.createExamResultRecord(session, record, keys, { now: 1000, id: 'attempt-rc8' });
  const hist = app.addExamResult(app.emptyExamResultHistory(), attempt);
  const tampered = JSON.parse(JSON.stringify(hist));
  tampered.attempts[0].summary.earnedPoints = 999;
  assert.equal(app.validateExamResultHistory(tampered).ok, false);
  const legacy = JSON.parse(JSON.stringify(hist));
  legacy.attempts[0].scoringRuleVersion = 'rc6-equal-weight-v1';
  legacy.attempts[0].summary = { total: 1, answered: 1, unanswered: 0, graded: 1, correct: 1, incorrect: 0, percentage: 100, provisional: 1, ungraded: 0, officialScore: null, scoringRuleVersion: 'rc6-equal-weight-v1', verification: { source_transcription_unverified: 1 } };
  const s = store({ 'chuyen-anh.exam-results.v1': JSON.stringify(legacy) });
  const migrated = app.loadExamResultHistory(s);
  assert.equal(migrated.attempts.length, 1);
  assert.equal(migrated.attempts[0].scoringRuleVersion, 'rc8-universal-scoring-v1');
  assert.equal(migrated.attempts[0].summary.denominator, 1);
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

test('rc8 archive: all 106 records have unique question IDs, 100% scoring coverage, confidence labels and zero unearned official keys', async () => {
  let total = 0;
  for (const record of records) {
    const qs = app.parseExamQuestions(record.markdown, record.id);
    assert.ok(qs.length > 0, `${record.id} exposes no practice items`);
    assert.equal(new Set(qs.map(q => q.id)).size, qs.length, record.id);
    assert.equal(record.answerKey.length, qs.length, `${record.id} has one key record per parsed item`);
    assert.equal(new Set(record.answerKey.map(k => k.questionId)).size, qs.length, record.id);
    for (let i = 0; i < qs.length; i += 1) {
      const q = qs[i];
      const k = record.answerKey[i];
      assert.notEqual(k.verificationStatus, 'official_verified', `${record.id} ${q.id} must not claim official_verified without primary official proof`);
      assert.ok(['HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'].includes(k.confidence), `${record.id} ${q.id} missing valid confidence`);
      assert.ok(typeof k.sourceStatus === 'string' && k.sourceStatus.length > 0, `${record.id} ${q.id} missing sourceStatus`);
      const sampleAns = q.responseType === 'multiple' ? [q.options[0].id]
        : (q.responseType === 'choice' || q.responseType === 'true-false') ? q.options[0].id
        : 'Students should cultivate critical thinking skills because education empowers communities.';
      const g = app.gradeExamQuestion(q, sampleAns, k);
      assert.ok(['correct', 'partial', 'incorrect'].includes(g.result), `${record.id} ${q.id} (${q.responseType}) failed 100% scoring contract: got ${g.result}`);
    }
    total += qs.length;
  }
  assert.equal(records.length, 106);
  assert.ok(total >= 6800, 'all 106 papers including fenced PDFs, cloze tables, speaking prompts and HTML/OCR papers are extracted');
  assert.equal(typeof app.extractExamAnswerKeys, 'function');
});

test('rc6 build: the answer-key manifest and scoring audit regenerate byte-for-byte', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = execFileSync(process.execPath, ['scripts/exams/build_answer_keys.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /Checked answer keys: 106 papers/);
});
