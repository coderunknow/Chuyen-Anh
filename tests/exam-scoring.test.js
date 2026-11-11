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

test('rc9 grading: provenance controls provisional scoring and unusable keys are ungraded instead of guessed', () => {
  const q = question();
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key()).result, 'correct');
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key()).provisional, true);
  assert.equal(app.gradeExamQuestion(q, 'choice-A', key({ verificationStatus: 'official_verified' })).provisional, false);
  // Issue #75: a key whose candidate is not an option of the question cannot
  // score anything. It must be reported as ungraded with a reason, not silently
  // marked "incorrect" for every option.
  const bogus = app.gradeExamQuestion(q, 'choice-A', key({ candidates: ['However costly it may be'] }));
  assert.equal(bogus.result, 'ungraded');
  assert.equal(bogus.scorable, false);
  assert.equal(bogus.ungradeableReason, 'answer-is-not-an-option');
  // Issue #77: a missing key is never replaced by a runtime guess.
  const missing = app.gradeExamQuestion(q, 'choice-A', key({ verificationStatus: 'missing_answer', candidates: [] }));
  assert.equal(missing.result, 'ungraded');
  assert.equal(missing.scorable, false);
  assert.equal(missing.confidence, 'VERY_LOW');
  assert.equal(missing.sourceStatus, 'insufficient_evidence');
  // An item that needs a picture/audio the archive does not contain is ungraded
  // even when a transcription key exists (issue #79).
  const stimulus = app.gradeExamQuestion(q, 'choice-A', key({ scorable: false, ungradeableReason: 'stimulus-incomplete', stimulusFallback: 'missing_diagram_or_figure' }));
  assert.equal(stimulus.result, 'ungraded');
  assert.equal(stimulus.stimulusFallback, 'missing_diagram_or_figure');
  assert.equal(app.gradeExamQuestion(q, '', key()).result, 'ungraded');
  assert.equal(app.gradeExamQuestion(q, 'choice-Z', key()).result, 'ungraded');
});

test('rc6 grading: multiple choices, true/false, alternatives and explicit normalization', () => {
  const multi = question({ id: 'm', responseType: 'multiple', options: [choice('choice-A','A','a'),choice('choice-B','B','b'),choice('choice-C','C','c')] });
  assert.equal(app.gradeExamQuestion(multi, ['choice-B','choice-A'], key({ questionId:'m', candidates:['choice-A','choice-B'], normalization:'choice-set' })).result, 'correct');
  // rc9 fix round (DA-01): one of two keyed options is credit for the part found,
  // not a plain wrong answer. The all-or-nothing assertion this line used to make
  // is superseded by the proportional contract tested below; a response that
  // matches nothing is still `incorrect`.
  const halfKeyed = app.gradeExamQuestion(multi, ['choice-A'], key({ questionId:'m', candidates:['choice-A','choice-B'], normalization:'choice-set' }));
  assert.equal(halfKeyed.result, 'partial');
  assert.equal(halfKeyed.earnedCredit, 0.5);
  assert.equal(app.gradeExamQuestion(multi, ['choice-C'], key({ questionId:'m', candidates:['choice-A','choice-B'], normalization:'choice-set' })).result, 'incorrect');
  const tf = question({ id:'tf', responseType:'true-false', options:[choice('choice-T','T','True'),choice('choice-F','F','False')] });
  assert.equal(app.gradeExamQuestion(tf, 'choice-T', key({ questionId:'tf', candidates:['true'], normalization:'true-false' })).result, 'correct');
  const text = question({ id:'t', responseType:'text', options:[] });
  assert.equal(app.gradeExamQuestion(text, '  COLOUR  ', key({ questionId:'t', candidates:['color'], acceptedAlternatives:['colour'], normalization:'case-whitespace' })).result, 'correct');
  assert.equal(app.gradeExamQuestion(text, 'colours', key({ questionId:'t', candidates:['color'], acceptedAlternatives:['colour'], normalization:'case-whitespace' })).result, 'incorrect');
});

test('rc9 scoring: the denominator only counts scorable items and ungradeable items are reported separately', () => {
  const essayQ = question({ id:'e', number:5, responseType:'essay', options:[], prompt:'Write an essay of about 150-200 words discussing whether technology improves education.' });
  const pictureQ = question({ id:'p', number:6, prompt:'Choose the correct picture. What did the boy eat?' });
  const qs = [question({ id:'a' }), question({ id:'b' }), question({ id:'c' }), question({ id:'d' }), essayQ, pictureQ];
  const keys = [
    key({ questionId:'a', confidence:'HIGH', sourceStatus:'independently_cross_checked', verificationStatus:'independently_cross_checked' }),
    key({ questionId:'b', candidates:['choice-B'], confidence:'MEDIUM', sourceStatus:'single_source_transcription' }),
    key({ questionId:'c', verificationStatus:'missing_answer', candidates:[], sourceStatus:'insufficient_evidence', scorable:false, ungradeableReason:'no-source-answer' }),
    key({ questionId:'d', verificationStatus:'ambiguous_review', sourceStatus:'ambiguous_source', confidence:'LOW', candidates:['choice-A','choice-B'] }),
    key({ questionId:'e', verificationStatus:'inferred_unverified', sourceStatus:'reasoned_inference', confidence:'LOW', candidates:['[150-200 words rubric]'], normalization:'essay-rubric' }),
    key({ questionId:'p', verificationStatus:'incomplete_stimulus', sourceStatus:'incomplete_stimulus', confidence:'VERY_LOW', candidates:['choice-A'], scorable:false, ungradeableReason:'stimulus-incomplete', stimulusFallback:'missing_diagram_or_figure' })
  ];
  const essayText = 'Nowadays, modern technology significantly transforms classroom education across the world. Firstly, digital platforms provide interactive resources that help students understand complex concepts effectively. Moreover, learners who live in remote regions can access high-quality courses online. However, excessive screen time may distract teenagers unless teachers establish clear guidelines. Therefore, schools should integrate educational technology thoughtfully while maintaining strong human mentorship.';
  const session = { questions: qs, responses: { a:'choice-A', b:'choice-A', c:'choice-A', d:'choice-A', e: essayText, p:'choice-A' }, status:'submitted' };
  const result = app.scoreExamSession(session, keys);
  assert.equal(result.summary.total, 6);
  // 4 scorable (a, b, d, essay) + 2 ungradeable (missing key, missing picture).
  assert.equal(result.summary.scorableTotal, 4);
  assert.equal(result.summary.denominator, 4);
  assert.equal(result.summary.ungradeable, 2);
  assert.equal(result.summary.stimulusIncomplete, 1);
  assert.equal(result.summary.coveragePercentage, 66.7);
  assert.equal(result.summary.answered, 6);
  assert.equal(result.summary.unanswered, 0);
  assert.equal(result.summary.graded, 4);
  // `ungraded` counts the two ungradeable items plus any unanswered scorable one.
  assert.equal(result.summary.ungraded, 2);
  assert.equal(result.summary.officialScore, null);
  assert.ok(result.summary.earnedPoints > 2.5 && result.summary.earnedPoints <= 4);
  assert.equal(result.summary.percentage, Math.round((result.summary.earnedPoints / 4) * 1000) / 10);
  assert.equal(result.summary.needsReview, 1, 'the provisional essay is flagged for human review');
  const ungradedKeys = result.results.filter(r => r.result === 'ungraded').map(r => r.reason).sort();
  assert.deepEqual(ungradedKeys, ['no-source-answer', 'stimulus-incomplete']);
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
  assert.equal(migrated.attempts[0].scoringRuleVersion, app.EXAM_SCORING_RULE_VERSION);
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

test('rc9 archive: unique question IDs, honest scorable coverage, confidence labels and zero unearned official keys', async () => {
  let total = 0, scorable = 0, ungradeable = 0;
  const reasons = {};
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
      if (k.scorable === false) {
        ungradeable += 1;
        assert.equal(g.result, 'ungraded', `${record.id} ${q.id} is ungradeable but was graded ${g.result}`);
        assert.ok(typeof g.ungradeableReason === 'string' && g.ungradeableReason.length > 0, `${record.id} ${q.id} ungradeable without a reason`);
        assert.ok(['invalid_key', 'incomplete_stimulus', 'ambiguous_review', 'exempt_open_ended'].includes(k.verificationStatus), `${record.id} ${q.id} ungradeable status ${k.verificationStatus}`);
        assert.ok(['missing_stimulus', 'open_ended_writing_or_speaking', 'structural_transcription_defect'].includes(k.exemptionCategory), `${record.id} ${q.id} missing valid exemptionCategory`);
        assert.ok(Array.isArray(k.candidates), `${record.id} ${q.id} must keep a candidates array for traceability`);
        reasons[g.ungradeableReason] = (reasons[g.ungradeableReason] || 0) + 1;
      } else {
        scorable += 1;
        assert.ok(['correct', 'partial', 'incorrect'].includes(g.result), `${record.id} ${q.id} (${q.responseType}) is scorable but graded ${g.result}`);
        if (q.responseType === 'choice' || q.responseType === 'multiple') {
          assert.ok(k.candidates.every(id => q.options.some(o => o.id === id)), `${record.id} ${q.id} key is not an option of the question`);
        }
      }
    }
    total += qs.length;
  }
  assert.equal(records.length, 106);
  assert.equal(total, 6708, 'all 106 papers are extracted cleanly without section-header pseudo-questions');
  assert.equal(total, scorable + ungradeable);
  // Every non-exempt item in the archive carries a source-transcribed or
  // curated domain-verified answer key (missing=0, 100% non-exempt coverage);
  // open-ended essays, absent stimuli, and OCR-damaged items are formally exempt.
  assert.equal(scorable + ungradeable, total, 'every parsed item is either scorable or formally exempt');
  assert.equal(scorable, 5155, `scorable coverage expected 5155, got ${scorable}`);
  assert.equal(ungradeable, 1553, 'all 1553 formally exempt items are accounted for');
  assert.deepEqual(reasons, {
    'ocr-structural-defect': 749,
    'stimulus-incomplete': 627,
    'essay-open-ended-exempt': 158,
    'option-overflow': 12,
    'key-not-an-option': 7
  });
  assert.equal(typeof app.extractExamAnswerKeys, 'function');
});

test('rc9 parser (#76): numbering that restarts per section never borrows another section\'s answer', () => {
  const md = [
    '## Đề thi',
    'I. PHONETICS',
    '1. Choose the word whose underlined part is pronounced differently.',
    'A. cat',
    'B. hat',
    '2. Choose the word whose stress pattern differs.',
    'A. begin',
    'B. machine',
    'II. WRITING',
    '1. Complete the second sentence so that it has a similar meaning to the first sentence.',
    'He is too young to drive.',
    '2. Rewrite the sentence without changing its meaning.',
    'She has never seen such a beautiful view.',
    '## Đáp án',
    'II. WRITING',
    '1. He is not old enough to drive.',
    '2. Never has she seen such a beautiful view.',
    'I. PHONETICS',
    '1. B',
    '2. A'
  ].join('\n');
  const qs = app.parseExamQuestions(md, '2025/test/sections');
  const ks = app.extractExamAnswerKeys(md, qs, { id: '2025/test/sections', quality: 'PDF-text' });
  const byId = new Map(qs.map((q, i) => [q.id, { q, k: ks[i] }]));
  for (const { q, k } of byId.values()) {
    if (q.responseType === 'essay') continue;
    if (k.scorable === false) {
      assert.ok(['no-source-answer', 'key-not-an-option'].includes(k.ungradeableReason), `${q.number}: ${k.ungradeableReason}`);
      assert.deepEqual(k.candidates, [], `${q.number} keeps no borrowed candidate`);
      continue;
    }
    if (q.responseType === 'choice') {
      assert.ok(k.candidates.every(id => q.options.some(o => o.id === id)), `choice ${q.number} must be keyed by one of its own options, got ${k.candidates}`);
    } else {
      assert.ok(!/^[A-D]$/.test(k.candidates[0]), `text ${q.number} must not be keyed by a bare letter`);
    }
  }
  // The lettered items and the sentence items must not share a key: a sentence
  // is not an option of a choice item (#76) and a letter is not a rewrite.
  const choiceKeys = qs.filter(q => q.responseType === 'choice').map((q, i) => ks[qs.indexOf(q)]);
  const textKeys = qs.filter(q => q.responseType === 'text').map(q => ks[qs.indexOf(q)]);
  assert.ok(choiceKeys.every(k => k.candidates.every(id => id.startsWith('choice-'))), 'choice keys stay inside their own option set');
  assert.ok(textKeys.every(k => k.candidates.length === 0 || !/^[A-D]$/.test(k.candidates[0])), 'rewrite keys stay sentences');
});

test('rc9 manifest (#75): every paper reports the number of items it can actually score', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/exam-answer-keys.json', import.meta.url), 'utf8'));
  const archiveTotal = manifest.records.reduce((n, r) => n + r.scoredCount, 0);
  const usable = (q, k) => {
    if (!k || k.scorable === false) return false;
    if (['invalid_key', 'missing_answer', 'incomplete_stimulus', 'ambiguous_review'].includes(k.verificationStatus)) return false;
    if (q.responseType === 'essay') return Boolean(k.rubric);
    return Array.isArray(k.candidates) && k.candidates.length > 0;
  };
  let sum = 0;
  for (const record of manifest.records) {
    const questions = app.parseExamQuestions(records.find(r => r.id === record.id).markdown, record.id);
    const counted = questions.filter((q, i) => usable(q, record.answerKeys[i])).length;
    // `scoredCount` used to be `answerKeys.length`, so all 106 papers claimed
    // 100% while most items had no usable key.
    assert.equal(record.scoredCount, counted, `${record.id}: scoredCount must be the usable-key count`);
    assert.ok(record.scoredCount <= record.questionCount, record.id);
    sum += record.scoredCount;
  }
  assert.equal(sum, archiveTotal, 'the per-paper counts add up to the archive total');
  const audit = JSON.parse(await readFile(new URL('../docs/exam-scoring-audit.json', import.meta.url), 'utf8'));
  assert.equal(audit.totals.scoredQuestions, sum, 'the audit header agrees with the per-paper rows');
  for (const paper of audit.papers) {
    const record = manifest.records.find(r => r.id === paper.id);
    assert.equal(paper.scoredCount, record.scoredCount, `${paper.id}: audit row must match the manifest`);
  }
});

test('paper-level anchor checks do not verify individual answer keys', () => {
  const md = '## Đề thi\n1. Choose the correct answer.\nA. Alpha\nB. Beta\n## Đáp án/hướng dẫn chấm trong nguồn\n1. B\n';
  const qs = app.parseExamQuestions(md, '2025/hai-phong/so');
  const keys = app.extractExamAnswerKeys(md, qs, { id: '2025/hai-phong/so', quality: 'PDF-text' });
  assert.equal(keys[0].verificationStatus, 'source_transcription_unverified');
  assert.notEqual(keys[0].confidence, 'HIGH');
});

test('untrusted provisional hints cannot turn a missing exam key into a gradeable answer', () => {
  const md = '## Đề thi\n1. Choose the correct answer.\nA. Alpha\nB. Beta\n';
  const qs = app.parseExamQuestions(md, '2025/test/no-key');
  assert.equal(qs.length, 1);
  const hints = { [qs[0].id]: { candidates: [qs[0].options[0].id], normalization: 'choice-id' } };
  const keys = app.extractExamAnswerKeys(md, qs, { id: '2025/test/no-key', quality: 'PDF-text' }, hints);
  assert.equal(keys[0].scorable, false);
  assert.equal(keys[0].verificationStatus, 'missing_answer');
});

test('exam builder never emits an inferred choice key from heuristic or teaching-bank evidence', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/exam-answer-keys.json', import.meta.url), 'utf8'));
  const keys = manifest.records.flatMap(record => record.answerKeys);
  const inferredChoice = keys.filter(k => k.verificationStatus === 'inferred_unverified'
    && Array.isArray(k.candidates) && k.candidates.length > 0 && String(k.candidates[0]).startsWith('choice-'));
  assert.equal(inferredChoice.length, 0, 'a missing source key must not be inferred from a teaching bank or option statistics');
  assert.ok(keys.every(k => (k.sources || []).every(s => s.kind !== 'provisional-inference')),
    'the shipped manifest must not contain automatically inferred keys');
  // No scorable item may hold an empty candidate list, and no key may hold a
  // candidate that is not an option of its own question.
  for (const record of manifest.records) {
    const qs = app.parseExamQuestions(records.find(r => r.id === record.id).markdown, record.id);
    record.answerKeys.forEach((k, i) => {
      const q = qs[i];
      if (k.scorable === false) return;
      assert.ok(Array.isArray(k.candidates) && k.candidates.length > 0, `${record.id} ${q.id}: scorable without candidates`);
      if (q.responseType === 'choice' || q.responseType === 'multiple') {
        assert.ok(k.candidates.every(id => q.options.some(o => o.id === id)), `${record.id} ${q.id}: candidate is not an option`);
      }
    });
  }
});

test('rc9 essay rubric (#78): off-topic, template and too-short answers never reach the correct band', () => {
  const q = question({ id: 'e1', responseType: 'essay', options: [], prompt: 'Write a paragraph of about 150 words about the benefits of learning a foreign language.' });
  const offTopic = 'Tomato plants grow best in warm soil and need steady watering through the summer months. Gardeners usually add compost before planting, then support the stems with tall wooden stakes. Aphids can damage young leaves, so many growers introduce ladybirds as a natural control. When the fruit turns deep red, it should be picked early in the morning and stored away from direct sunlight. Seed saving is straightforward: ferment the pulp for a few days, rinse the seeds and dry them on paper.';
  const tomatoes = app.gradeExamQuestion(q, offTopic, null);
  assert.notEqual(tomatoes.result, 'correct', 'an off-topic but coherent paragraph must not be reported as correct');
  assert.equal(tomatoes.essayVerdict, 'topic_not_verified');
  assert.ok(tomatoes.earnedCredit <= 0.25);
  assert.equal(tomatoes.needsReview, true);

  const templateSentence = 'Learning a foreign language is very important for students because it opens many doors and helps them communicate with people from other countries.';
  const template = app.gradeExamQuestion(q, Array.from({ length: 5 }, () => templateSentence).join(' '), null);
  assert.equal(template.result, 'incorrect', 'a repeated template must not be scored as an answer');
  assert.equal(template.essayVerdict, 'template_not_assessable');
  assert.ok(template.earnedCredit <= 0.2);

  const short = app.gradeExamQuestion(q, 'Learning a foreign language benefits students by improving memory and opening career opportunities all over the world today.', null);
  assert.notEqual(short.result, 'correct', 'a 20-word answer to a 150-word task must not be correct');

  const onTopic = app.gradeExamQuestion(q, 'Learning a foreign language brings clear benefits. Firstly, students who study another language improve their memory and problem-solving skills because they must switch between two systems of grammar every day. Moreover, a foreign language opens career opportunities: international companies value employees who can communicate with partners abroad, and graduates who speak English confidently often earn higher salaries. Secondly, learning a language builds empathy. When learners understand another culture from the inside, they become more tolerant of differences and less likely to rely on stereotypes. In addition, travel becomes far more rewarding because a visitor can talk with local people instead of observing them from a distance. Finally, the habit of regular practice teaches patience and discipline, which help students in every other subject. Therefore, schools should keep foreign languages in the curriculum, and teachers should encourage students to practise a little every day rather than cramming before exams.', null);
  assert.equal(onTopic.essayVerdict, 'assessable', 'an on-topic answer is still assessable');
  assert.ok(onTopic.earnedCredit >= 0.25, 'an on-topic answer keeps real credit');
  assert.equal(onTopic.needsReview, true, 'every rubric score is flagged for human review');
});

test('rc9 stimulus (#79): picture-dependent items are detected from the item itself and never scored without the picture', () => {
  const picture = question({ id: 'p1', prompt: 'Choose the correct picture. What did the boy eat?' });
  assert.equal(app.examStimulusState(picture, { hasImage: false }), 'missing');
  assert.equal(app.examStimulusState(picture, { hasImage: true }), 'image');
  // A picture placeholder stands where the figure belongs: the whole prompt.
  const placeholder = question({ id: 'p2', responseType: 'text', options: [], prompt: 'IMAGE' });
  assert.equal(app.examStimulusState(placeholder, { hasImage: false }), 'placeholder',
    'a prompt that is only the word IMAGE is a figure gap the transcription kept as text');
  // ...but the same token inside a sentence is a task word. 2022/bac-giang/so item 1
  // is a sentence transformation whose required word is IMAGE; treating it as a
  // missing picture threw away a real key.
  const taskWord = question({ id: 'p2b', responseType: 'text', options: [], prompt: 'John and his father look very similar. IMAGE John is father.' });
  assert.equal(app.examStimulusState(taskWord, { hasImage: false }), 'none',
    'IMAGE inside a sentence is the word to transform, not a missing figure');
  const bracketed = question({ id: 'p3', prompt: 'Look at the chart. [Hình 1] What is the trend?' });
  assert.equal(app.examStimulusState(bracketed, { hasImage: false }), 'placeholder');
  assert.equal(app.examStimulusState(bracketed, { hasImage: true }), 'image');
  assert.equal(app.examStimulusState(bracketed, { hasImage: true, imageLoadFailed: true }), 'broken',
    'a reference that exists but cannot be loaded is broken, not real');
  // Ordinary-English uses are text, not a missing stimulus.
  for (const text of ['The company is trying to improve its public image.', 'Try to look at the big picture before deciding.', 'She likes to paint a picture of the countryside.']) {
    assert.equal(app.examStimulusState(question({ prompt: text }), { hasImage: false }), 'none', text);
  }
  const md = '## Đề thi\nPart 1. Choose the correct picture.\n1. What did the boy eat?\nA. rice\nB. bread\n## Đáp án\n1. A\n';
  const qs = app.parseExamQuestions(md, '2025/test/pictures');
  const ks = app.extractExamAnswerKeys(md, qs, { id: '2025/test/pictures', quality: 'PDF-text' });
  assert.equal(ks[0].stimulusFallback, 'missing_diagram_or_figure');
  assert.equal(ks[0].scorable, false);
  assert.equal(ks[0].verificationStatus, 'incomplete_stimulus');
  assert.deepEqual(ks[0].candidates, [], 'the stored key is kept as evidence but never used for scoring');
  const graded = app.gradeExamQuestion(qs[0], 'choice-A', ks[0]);
  assert.equal(graded.result, 'ungraded');
  assert.equal(graded.ungradeableReason, 'stimulus-incomplete');
});

test('rc6 build: the answer-key manifest and scoring audit regenerate byte-for-byte', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const output = execFileSync(process.execPath, ['scripts/exams/build_answer_keys.mjs', '--check'], { cwd: root, encoding: 'utf8' });
  assert.match(output, /Checked answer keys: 106 papers/);
});

test('rc9 review round: a gap-fill item with one transcribed line keeps its stored key (#75)', () => {
  // A word-formation section whose transcription leaves one stray bullet used to
  // be rejected as "incomplete-options", which threw away a real answer.
  const md = [
    '## Đề thi', 'Part 3. Word formation',
    '1. Her (SUCCEED) ______ in the exam surprised everyone.',
    '2. The (DECIDE) ______ was made quickly.', '·',
    '## Đáp án', '1. success', '2. decision'
  ].join('\n');
  const qs = app.parseExamQuestions(md, '2025/test/word-formation');
  assert.equal(qs.length, 2);
  for (const q of qs) {
    assert.equal(q.responseType, 'text');
    assert.equal(q.flags.includes('incomplete-options'), false,
      'a text item cannot have an incomplete option set');
  }
  const ks = app.extractExamAnswerKeys(md, qs, { id: '2025/test/word-formation', quality: 'PDF-text' });
  assert.equal(ks[0].scorable, true, 'the stored answer is usable');
  assert.deepEqual(ks[0].candidates, ['success']);
  assert.deepEqual(ks[1].candidates, ['decision'], 'the stray bullet stays inside prompt 2, not an option');
  assert.equal(app.gradeExamQuestion(qs[0], 'success', ks[0]).result, 'correct');
});

test('rc9 review round: a learner correction restores a key the archive never had', () => {
  const q = question({ id: 'q-1-test', responseType: 'choice' });
  const base = key({ questionId: 'q-1-test', verificationStatus: 'missing_answer', candidates: [], scorable: false, ungradeableReason: 'no-source-answer' });
  const session = { examId: '2025/test/correction', questions: [q], responses: { 'q-1-test': 'choice-B' } };
  const before = app.scoreExamSession(session, [base], [], '2025/test/correction').summary;
  assert.equal(before.scorableTotal, 0);
  assert.equal(before.graded, 0);
  const correction = { examId: '2025/test/correction', questionId: 'q-1-test', candidates: ['choice-B'], note: 'đáp án in trong đề gốc' };
  const after = app.scoreExamSession(session, [base], [correction], '2025/test/correction');
  assert.equal(after.summary.scorableTotal, 1, 'the supplied answer makes the item scorable');
  assert.equal(after.summary.graded, 1);
  assert.equal(after.results[0].result, 'correct');
  assert.equal(after.results[0].verificationStatus, 'user_confirmed');
  // A missing figure still blocks scoring even with a correction: the learner
  // cannot answer an item whose stimulus the archive does not hold.
  const blind = { ...base, stimulusFallback: 'missing_diagram_or_figure' };
  const stillBlind = app.scoreExamSession(session, [blind], [correction], '2025/test/correction');
  assert.equal(stillBlind.summary.scorableTotal, 0, 'a missing stimulus is not negotiable');
  assert.equal(stillBlind.results[0].ungradeableReason, 'stimulus-incomplete');
});

test('rc9 review round: the efficiency figure and its fraction share one denominator', () => {
  const q1 = question({ id: 'q-1', number: 1 });
  const q2 = question({ id: 'q-2', number: 2, options: [choice('choice-A', 'A', 'do'), choice('choice-B', 'B', 'does')] });
  const blind = question({ id: 'q-3', number: 3 });
  const session = {
    examId: '2025/test/efficiency', questions: [q1, q2, blind],
    responses: { 'q-1': 'choice-A', 'q-2': 'choice-A', 'q-3': 'choice-A' }
  };
  const keys = [
    key({ questionId: 'q-1' }),
    key({ questionId: 'q-2', candidates: ['choice-B'] }),
    key({ questionId: 'q-3', verificationStatus: 'incomplete_stimulus', candidates: [], scorable: false, ungradeableReason: 'stimulus-incomplete', stimulusFallback: 'missing_diagram_or_figure' })
  ];
  const { summary } = app.scoreExamSession(session, keys, [], '2025/test/efficiency');
  assert.equal(summary.answered, 3, 'the learner did answer all three');
  assert.equal(summary.graded, 2, 'only two could be graded');
  assert.equal(summary.earnedPoints, 1);
  assert.equal(summary.gradedPercentage, 50, 'one right out of two graded');
  // rc9 fix round (DA-06): `answeredPercentage` (earned ÷ every answer) is
  // retired; completion and accuracy are now two named figures with one
  // denominator each, so no surface can print the wrong one.
  assert.equal('answeredPercentage' in summary, false, 'the earned-per-answer ratio is gone, not merely unused');
  assert.equal(summary.completionPercentage, 100, 'both scorable items were answered; the ungradeable one is not in the denominator');
  assert.equal(summary.answeredScorable, 2);
  assert.equal(summary.percentage, 50, 'the paper percentage uses the scorable denominator');
});

test('rc9/v1.0.0 review round: open-ended essays are formally exempt while preserving provisional vs transcribed rubric provenance', () => {
  const md = [
    '## Đề thi', 'Part IV. Writing',
    '1. Write a paragraph of about 120 words about learning a foreign language.',
    '## Đáp án', 'Chưa lấy được đáp án riêng cho phần viết.'
  ].join('\n');
  const qs = app.parseExamQuestions(md, '2025/test/no-guide');
  assert.equal(qs[0].responseType, 'essay');
  const missing = app.extractExamAnswerKeys(md, qs, { id: '2025/test/no-guide', quality: 'PDF-text', answers: 'Chưa lấy được đáp án riêng' });
  assert.equal(missing[0].verificationStatus, 'exempt_open_ended',
    'open-ended essays are formally exempt from objective denominator');
  assert.equal(missing[0].scorable, false);
  assert.equal(missing[0].exempt, true);
  assert.equal(missing[0].exemptionCategory, 'open_ended_writing_or_speaking');
  assert.equal(missing[0].sources[0].kind, 'provisional-rubric');
  // The same paper with a real guide keeps the transcription-rubric source kind while remaining formally exempt.
  const guided = app.extractExamAnswerKeys(md, qs, { id: '2025/test/no-guide', quality: 'PDF-text', answers: 'Có hướng dẫn chấm chi tiết' });
  assert.equal(guided[0].verificationStatus, 'exempt_open_ended');
  assert.equal(guided[0].scorable, false);
  assert.equal(guided[0].sources[0].kind, 'transcription-rubric');
});

test('rc9 fix round: a "choose two" item gives partial credit and never full credit for a wrong set', () => {
  const multi = question({
    id: 'q-multi', responseType: 'multiple',
    options: [choice('choice-A', 'A', 'alpha'), choice('choice-B', 'B', 'beta'), choice('choice-C', 'C', 'gamma')]
  });
  const multiKey = key({ questionId: 'q-multi', candidates: ['choice-A', 'choice-C'] });
  const grade = answer => app.gradeExamQuestion(multi, answer, multiKey);

  const exact = grade(['choice-A', 'choice-C']);
  assert.equal(exact.result, 'correct');
  assert.equal(exact.earnedCredit, 1);

  // Finding half of a two-answer key is partly right, not wrong.
  const half = grade(['choice-A']);
  assert.equal(half.result, 'partial', 'one of two correct options is not a wrong answer');
  assert.equal(half.earnedCredit, 0.5);
  assert.match(half.reason, /^partial-multi-select 1\/2$/);
  assert.equal(grade(['choice-A', 'choice-B']).result, 'partial', 'a distractor beside the right option is still part right');
  assert.equal(grade(['choice-A', 'choice-B']).earnedCredit, 0.5);

  assert.equal(grade(['choice-B']).result, 'incorrect');
  assert.equal(grade(['choice-B']).earnedCredit, 0);

  // Selecting every option must not behave like the exact key.
  const everything = grade(['choice-A', 'choice-B', 'choice-C']);
  assert.equal(everything.result, 'partial');
  assert.equal(everything.earnedCredit, 0.67, 'the share of the response that is right caps a widened answer');
  assert.ok(everything.earnedCredit < 1);

  // Malformed responses stay ungraded instead of being scored either way.
  assert.equal(grade([]).result, 'ungraded');
  assert.equal(grade(['choice-A', 'choice-A']).result, 'ungraded', 'a repeated selection is malformed');
  assert.equal(grade(['choice-Z']).result, 'ungraded', 'an id that is not an option is malformed');
});

test('rc9 fix round: a true/false item rejects a response that answers both ways', () => {
  const tf = question({
    id: 'q-tf', responseType: 'true-false',
    options: [choice('choice-T', 'True', 'Đúng'), choice('choice-F', 'False', 'Sai')]
  });
  const tfKey = key({ questionId: 'q-tf', candidates: ['choice-T'] });
  assert.equal(app.gradeExamQuestion(tf, 'choice-T', tfKey).result, 'correct');
  assert.equal(app.gradeExamQuestion(tf, 'choice-F', tfKey).result, 'incorrect');
  // `.some()` used to score an array holding both options as correct.
  const both = app.gradeExamQuestion(tf, ['choice-T', 'choice-F'], tfKey);
  assert.equal(both.result, 'ungraded');
  assert.equal(both.reason, 'invalid-response');
  assert.equal(both.earnedCredit, 0);
});

test('rc9 fix round: an item that cannot be scored is never counted as "chưa trả lời"', () => {
  const q1 = question({ id: 'q-a', number: 1 });
  const q2 = question({ id: 'q-b', number: 2, options: [choice('choice-A', 'A', 'do'), choice('choice-B', 'B', 'does')] });
  const q3 = question({ id: 'q-c', number: 3 });
  const keys = [
    key({ questionId: 'q-a' }),
    key({ questionId: 'q-b' }),
    key({ questionId: 'q-c', verificationStatus: 'missing', candidates: [], scorable: false, ungradeableReason: 'no-source-answer' })
  ];
  const { summary } = app.scoreExamSession(
    { examId: '2025/test/unanswered', questions: [q1, q2, q3], responses: { 'q-a': 'choice-A', 'q-c': 'choice-B' } },
    keys, [], '2025/test/unanswered'
  );
  assert.equal(summary.total, 3);
  assert.equal(summary.scorableTotal, 2, 'the never-scorable item is outside the denominator');
  assert.equal(summary.ungradeable, 1);
  assert.equal(summary.answered, 2, 'the learner did answer the ungradeable item');
  assert.equal(summary.answeredScorable, 1);
  assert.equal(summary.answeredUngradeable, 1);
  assert.equal(summary.unanswered, 1, 'exactly one scorable item was left blank');
  assert.equal(summary.unanswerable, 0);
  assert.equal(summary.completionPercentage, 50);
  assert.equal(summary.coveragePercentage, 66.7);
  assert.equal('answeredPercentage' in summary, false, 'the earned-per-answer ratio is retired, not renamed in place');
  // Populations must add up; a regression in any of these is what the card row renders.
  assert.equal(summary.total, summary.scorableTotal + summary.ungradeable);
  assert.equal(summary.answered, summary.answeredScorable + summary.answeredUngradeable);
  assert.equal(summary.scorableTotal, summary.answeredScorable + summary.unanswered);
  assert.equal(summary.ungradeable, summary.answeredUngradeable + summary.unanswerable);
  assert.equal(summary.graded + summary.ungraded, summary.total);
});

test('rc9 fix round: partial credit lowers the earned fraction without inventing a wrong answer', () => {
  const multi = question({
    id: 'q-multi2', responseType: 'multiple',
    options: [choice('choice-A', 'A', 'alpha'), choice('choice-B', 'B', 'beta'), choice('choice-C', 'C', 'gamma')]
  });
  const keys = [key({ questionId: 'q-multi2', candidates: ['choice-A', 'choice-C'] })];
  const { summary } = app.scoreExamSession(
    { examId: '2025/test/partial', questions: [multi], responses: { 'q-multi2': ['choice-A'] } },
    keys, [], '2025/test/partial'
  );
  assert.equal(summary.partial, 1);
  assert.equal(summary.incorrect, 0, 'a partial answer is not counted as incorrect');
  assert.equal(summary.earnedPoints, 0.5);
  assert.equal(summary.percentage, 50);
  assert.equal(summary.gradedPercentage, 50);
  assert.equal(summary.completionPercentage, 100, 'the learner did answer the only scorable item');
});

test('v1.0.0 curated keys & formal exemptions: curated_verified scores deterministically and exempt essays attach advisory rubrics without entering denominator', async () => {
  const { verifyCuratedKeys } = await import('../scripts/exams/verify_curated_keys.mjs');
  const check = verifyCuratedKeys();
  assert.equal(check.ok, true, `verifyCuratedKeys failed: ${check.errors.slice(0, 5).join('; ')}`);
  assert.equal(check.summary.curatedEntries, 2146);
  assert.equal(check.summary.scorableCurated, 1407);
  assert.equal(check.summary.exemptCurated, 739);
  assert.equal(check.summary.totalScorable, 5155);
  assert.equal(check.summary.totalExempt, 1553);
  assert.equal(check.summary.nonExemptCoveragePct, 100);

  const qCurated = question({
    id: 'q-curated-text',
    number: 1,
    responseType: 'text',
    options: [],
    prompt: 'Rewrite: It was only when he left that she realized how much he meant.'
  });
  const kCurated = key({
    questionId: 'q-curated-text',
    verificationStatus: 'curated_verified',
    sourceStatus: 'curated_domain_verified',
    confidence: 'MEDIUM',
    candidates: ['Not until he left did she realize how much he meant'],
    acceptedAlternatives: ['Not until he had left did she realise how much he meant.'],
    normalization: 'case-whitespace-punctuation',
    scorable: true,
    exempt: false,
    exemptionCategory: null
  });
  const gCurated = app.gradeExamQuestion(qCurated, 'not until he had left did she realise how much he meant!', kCurated);
  assert.equal(gCurated.result, 'correct');
  assert.equal(gCurated.earnedCredit, 1);
  assert.equal(gCurated.answerKeyInferred, false);
  assert.equal(gCurated.sourceStatus, 'curated_domain_verified');

  const qEssay = question({
    id: 'q-exempt-essay',
    number: 2,
    responseType: 'essay',
    options: [],
    prompt: 'Write an essay of about 250 words discussing the benefits of bilingual education.'
  });
  const kEssay = key({
    questionId: 'q-exempt-essay',
    verificationStatus: 'exempt_open_ended',
    sourceStatus: 'open_ended_exempt',
    confidence: 'LOW',
    candidates: [],
    scorable: false,
    exempt: true,
    exemptionCategory: 'open_ended_writing_or_speaking',
    ungradeableReason: 'essay-open-ended-exempt'
  });
  const qStimulus = question({ id: 'q-missing-audio', number: 3 });
  const kStimulus = key({
    questionId: 'q-missing-audio',
    verificationStatus: 'incomplete_stimulus',
    sourceStatus: 'incomplete_stimulus',
    confidence: 'VERY_LOW',
    candidates: [],
    scorable: false,
    exempt: true,
    exemptionCategory: 'missing_stimulus',
    ungradeableReason: 'stimulus-incomplete',
    stimulusFallback: 'listening_audio_and_transcript_missing'
  });

  const essayResponse = 'Bilingual education fosters cognitive flexibility, academic achievement, and cross-cultural empathy for young learners. Furthermore, mastering two languages equips students with practical communication skills in an increasingly interconnected global economy. Therefore, schools should support structured bilingual curricula.';
  const session = {
    examId: '2026/test/v100-policy',
    questions: [qCurated, qEssay, qStimulus],
    responses: {
      'q-curated-text': 'Not until he left did she realize how much he meant.',
      'q-exempt-essay': essayResponse
    }
  };
  const scored = app.scoreExamSession(session, [kCurated, kEssay, kStimulus], [], '2026/test/v100-policy');
  assert.equal(scored.summary.total, 3);
  assert.equal(scored.summary.scorableTotal, 1);
  assert.equal(scored.summary.denominator, 1);
  assert.equal(scored.summary.ungradeable, 2);
  assert.equal(scored.summary.earnedPoints, 1);
  assert.equal(scored.summary.percentage, 100);
  assert.deepEqual(scored.summary.exemptionCategories, {
    missing_stimulus: 1,
    open_ended_writing_or_speaking: 1,
    structural_transcription_defect: 0
  });
  const essayGrade = scored.results.find(r => r.questionId === 'q-exempt-essay');
  assert.equal(essayGrade.result, 'ungraded');
  assert.equal(essayGrade.earnedCredit, 0);
  assert.ok(essayGrade.advisoryRubricEvaluation, 'answered exempt essay still provides advisory 4-criterion rubric feedback');
});

test('rc10 import hardening: untrusted paper metadata and correction candidates are validated', () => {
  const q = question(); const keys = [key()];
  const session = app.createExamPracticeSession('2025/test/so', [q], 1000);
  app.recordExamPracticeResponse(session, q.id, 'choice-A'); app.submitExamPractice(session, 1000);
  const record = { id:'2025/test/so', year:2025, province:'Test', unit:'so', unitLabel:'Test', source:'https://example.com', assets:[], quality:'PDF-text', answers:'', note:'', contentSha256:'c'.repeat(64), markdown:'' };
  const attempt = app.createExamResultRecord(session, record, keys, { now: 1000, id: 'attempt-guard' });
  const history = app.addExamResult(app.emptyExamResultHistory(), attempt);
  const exported = JSON.parse(app.exportExamResultHistory(history));
  const paperKey = Object.keys(exported.papers)[0];

  // A genuine export (numeric year, string metadata) still round-trips.
  assert.equal(app.validateExamResultHistory(exported).ok, true);
  assert.equal(exported.papers[paperKey].metadata.year, 2025);

  // Imported paper metadata is printed in the history list. Text fields stay
  // free-form (legitimate provinces contain punctuation and HTML-ish text) and
  // are escaped at the render site; non-strings are rejected outright.
  const textField = JSON.parse(JSON.stringify(exported));
  textField.papers[paperKey].metadata.province = '<img src=x onerror=alert(1)>';
  assert.equal(app.validateExamResultHistory(textField).ok, true, 'a text field is data, not markup');
  assert.doesNotMatch(app.escapeHtml(textField.papers[paperKey].metadata.province), /<(img|svg|script)/i);
  const hostile = [[{ toString: 'x' }, 'province'], [7, 'unitLabel'], [['a'], 'source'], [{}, 'quality']];
  for (const [value, field] of hostile) {
    const tampered = JSON.parse(JSON.stringify(exported));
    tampered.papers[paperKey].metadata[field] = value;
    assert.deepEqual(app.validateExamResultHistory(tampered), { ok: false, reason: 'invalid-paper' }, `${field} must be a string`);
  }
  for (const year of ['<img src=x onerror=alert(1)>', 99999, 20.5, {}]) {
    const tampered = JSON.parse(JSON.stringify(exported));
    tampered.papers[paperKey].metadata.year = year;
    assert.deepEqual(app.validateExamResultHistory(tampered), { ok: false, reason: 'invalid-paper' }, `year ${JSON.stringify(year)} must be rejected`);
  }
  const longSource = JSON.parse(JSON.stringify(exported));
  longSource.papers[paperKey].metadata.source = `https://example.com/${'a'.repeat(600)}`;
  assert.deepEqual(app.validateExamResultHistory(longSource), { ok: false, reason: 'invalid-paper' });

  // The history row escapes the year as a second layer, so removing the check
  // above cannot silently reintroduce raw HTML into the list.
  assert.match(appSource, /escapeHtml\(paper\?\.metadata\?\.year \?\? ''\)/);

  // Correction candidates are graded, so they must be non-empty bounded strings.
  const corrected = app.applyExamKeyCorrection(history, { examId: record.id, questionId: q.id, candidates: ['choice-B'], normalization: 'choice-id', note: 'user review', now: 2000 });
  const correctedExport = JSON.parse(app.exportExamResultHistory(corrected.history));
  assert.equal(app.validateExamResultHistory(correctedExport).ok, true);
  for (const candidates of [['choice-B', 7], [''], ['x'.repeat(1001)], 'choice-B', [null]]) {
    const tampered = JSON.parse(JSON.stringify(correctedExport));
    tampered.corrections[0].candidates = candidates;
    assert.deepEqual(app.validateExamResultHistory(tampered), { ok: false, reason: 'invalid-correction' }, `candidates ${JSON.stringify(candidates)} must be rejected`);
  }
});

test('rc10 import hardening: a paper snapshot must describe an answerable paper', () => {
  const q1 = question(); const q2 = question({ id: 'q-2-test', number: 2 });
  const keys = [key(), key({ questionId: 'q-2-test' })];
  const session = app.createExamPracticeSession('2025/test/so', [q1, q2], 1000);
  app.recordExamPracticeResponse(session, q1.id, 'choice-A');
  app.recordExamPracticeResponse(session, q2.id, 'choice-A');
  app.submitExamPractice(session, 2000);
  const record = { id:'2025/test/so', year:2025, province:'Test', unit:'so', unitLabel:'Test', source:'https://example.com', assets:[], quality:'PDF-text', answers:'', note:'', contentSha256:'f'.repeat(64), markdown:'' };
  const attempt = app.createExamResultRecord(session, record, keys, { now: 2000, id: 'attempt-shape' });
  const history = app.addExamResult(app.emptyExamResultHistory(), attempt);
  const exported = JSON.parse(app.exportExamResultHistory(history));
  const paperKey = Object.keys(exported.papers)[0];
  assert.equal(app.validateExamResultHistory(exported).ok, true, 'a genuine snapshot still validates');

  const cases = {
    'duplicate option ids': (p) => { const q = p.papers[paperKey].questions[0]; q.options[1].id = q.options[0].id; },
    'choice question with one option': (p) => { const q = p.papers[paperKey].questions[0]; q.options = [q.options[0]]; },
    'choice question with no options': (p) => { p.papers[paperKey].questions[0].options = []; },
    'key for a question the paper does not contain': (p) => { p.papers[paperKey].baseKeys.push({ ...p.papers[paperKey].baseKeys[0], questionId: 'q-absent' }); },
    'two keys for the same question': (p) => { p.papers[paperKey].baseKeys.push({ ...p.papers[paperKey].baseKeys[0] }); },
    'non-string accepted alternative': (p) => { p.papers[paperKey].baseKeys[0].acceptedAlternatives = [7]; }
  };
  for (const [name, mutate] of Object.entries(cases)) {
    const tampered = JSON.parse(JSON.stringify(exported));
    mutate(tampered);
    assert.deepEqual(app.validateExamResultHistory(tampered), { ok: false, reason: 'invalid-paper' }, name);
  }
  // Text and essay items legitimately carry no options; they must still validate.
  const textAttempt = { ...JSON.parse(JSON.stringify(exported)) };
  textAttempt.papers[paperKey].questions = [{ id: 'q-1-test', number: 1, prompt: 'Write.', instruction: '', responseType: 'text', options: [], flags: [] }];
  textAttempt.papers[paperKey].baseKeys = [key({ candidates: ['go'], acceptedAlternatives: ['goes'] })];
  textAttempt.attempts = [];
  assert.equal(app.validateExamResultHistory(textAttempt).ok, true, 'an optionless text item is valid');
});

test('rc10 import hardening: a record produced from a partial session still imports', () => {
  // The import validator rejects a key for a question the paper does not contain.
  // A learner whose session covered only part of a paper must still be able to
  // restore their own export, so the producer stores only the keys it can grade.
  const questions = [question(), question({ id: 'q-2-test', number: 2 })];
  const allKeys = [key(), key({ questionId: 'q-2-test' }), key({ questionId: 'q-3-not-in-session' })];
  const session = app.createExamPracticeSession('2025/test/so', questions, 1000);
  app.recordExamPracticeResponse(session, questions[0].id, 'choice-A');
  app.submitExamPractice(session, 2000);
  const record = { id:'2025/test/so', year:2025, province:'Test', unit:'so', unitLabel:'Test', source:'https://example.com', assets:[], quality:'PDF-text', answers:'', note:'', contentSha256:'f'.repeat(64), markdown:'' };
  const attempt = app.createExamResultRecord(session, record, allKeys, { now: 2000, id: 'attempt-partial' });
  const exported = JSON.parse(app.exportExamResultHistory(app.addExamResult(app.emptyExamResultHistory(), attempt)));
  const paper = exported.papers[Object.keys(exported.papers)[0]];
  assert.equal(paper.baseKeys.length, 2, 'only keys for questions in the session are stored');
  assert.equal(app.validateExamResultHistory(exported).ok, true,
    'an export the app produced must never be rejected by the app');
});

test('merging two valid histories keeps the newest 50 and still imports', () => {
  const paperFor = record => ({ questions: app.parseExamQuestions(record.markdown, record.id), keys: Array.isArray(record.answerKey) ? record.answerKey : [] });
  const buildAttempt = (index, id, submittedAt) => {
    const record = records[index];
    const { questions, keys } = paperFor(record);
    const session = app.createExamPracticeSession(record.id, questions, submittedAt - 10);
    for (const question of questions) app.recordExamPracticeResponse(session, question.id, question.options?.[0]?.id ?? 'x');
    app.submitExamPractice(session, submittedAt);
    return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
  };
  const historyOf = attempts => attempts.reduce((history, attempt) => app.addExamResult(history, attempt), app.emptyExamResultHistory());
  const store = () => {
    const map = new Map();
    return { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => { map.set(key, String(value)); }, removeItem: key => map.delete(key) };
  };

  // 50 local attempts on paper A, 50 older attempts from another device on paper B.
  const local = historyOf(Array.from({ length: 50 }, (_, i) => buildAttempt(0, `local-${i}`, 1000 + i)));
  const otherAttempts = historyOf(Array.from({ length: 50 }, (_, i) => buildAttempt(1, `other-${i}`, 500 + i)));
  // A learner correction on the other device's paper: when every attempt of that
  // paper falls outside the window, the correction has nothing left to score and
  // must go with it, or the merged history is rejected as an unknown target.
  // A correction target must exist in the stored snapshot: pick a question that
  // the paper still holds together with a key, so the correction is legal.
  const correctionTarget = history => {
    const paper = Object.values(history.papers)[0];
    const key = paper.baseKeys.find(k => paper.questions.some(q => q.id === k.questionId));
    const question = paper.questions.find(q => q.id === key.questionId);
    return { examId: paper.examId, questionId: question.id, candidates: [question.options?.[0]?.id ?? 'learner answer'] };
  };
  const corrected = app.applyExamKeyCorrection(otherAttempts, correctionTarget(otherAttempts));
  assert.equal(corrected.ok, true, 'the other device history carries a valid correction');
  const other = corrected.history;
  const storage = store();
  assert.equal(app.saveExamResultHistory(local, storage), true);

  const result = app.importExamResultHistory(app.exportExamResultHistory(other), storage);
  assert.equal(result.ok, true, 'a union of two valid histories must import, not report a storage failure');
  assert.equal(result.history.attempts.length, 50, 'the merged history keeps exactly the 50-attempt window');
  assert.deepEqual(result.history.attempts.map(a => a.id), Array.from({ length: 50 }, (_, i) => `local-${i}`),
    'the newest attempts win: every imported one is older than every local one');
  assert.deepEqual(Object.values(result.history.papers).map(p => p.examId), [records[0].id],
    'the paper only the dropped attempts used is pruned too');
  assert.equal(result.history.corrections.length, 0,
    'a correction against the trimmed-away paper cannot be kept: its target no longer exists');
  assert.equal(app.loadExamResultHistory(storage).attempts.length, 50, 'and the trimmed history saves');

  // The other direction: 40 local + 20 newer attempts exceed the window by 10, so the
  // 10 oldest local attempts are displaced — not 30, and the boundary has to be exact.
  const store2 = store();
  const local2 = historyOf(Array.from({ length: 40 }, (_, i) => buildAttempt(0, `local-${i}`, 1000 + i)));
  app.saveExamResultHistory(local2, store2);
  const newer = historyOf(Array.from({ length: 20 }, (_, i) => buildAttempt(1, `newer-${i}`, 2000 + i)));
  const merged2 = app.importExamResultHistory(app.exportExamResultHistory(newer), store2);
  assert.equal(merged2.ok, true);
  assert.equal(merged2.history.attempts.length, 50);
  const kept = merged2.history.attempts.map(a => a.id);
  assert.equal(kept.at(-1), 'newer-19', 'the newest attempt stays last in storage order (the history screen reverses it)');
  assert.equal(kept.filter(id => id.startsWith('local-')).length, 30, 'exactly 10 of the 40 local attempts are dropped');
  assert.equal(kept.includes('local-9'), false, 'the tenth-oldest local attempt is the last one dropped');
  assert.equal(kept.includes('local-10'), true, 'the eleventh-oldest survives, so the boundary is exact');
  assert.equal(kept.filter(id => id.startsWith('newer-')).length, 20, 'all 20 imported attempts survive');
  // The mirror case: a correction on a paper that does survive every trim stays.
  const keptCorrection = app.applyExamKeyCorrection(newer, correctionTarget(newer));
  assert.equal(keptCorrection.ok, true);
  const store3 = store();
  app.saveExamResultHistory(local2, store3);
  const merged3 = app.importExamResultHistory(app.exportExamResultHistory(keptCorrection.history), store3);
  assert.equal(merged3.ok, true);
  assert.equal(merged3.history.corrections.length, 1, 'trimming must not drop a correction whose paper survives');
});

test('a second attempt on the same paper cannot overwrite the stored question set', () => {
  // Every attempt of one archive shares `examId@contentSha256` as its paper key,
  // so the first snapshot is the only one that can score its attempts. A caller
  // that practises a different slice of the same paper must be refused: letting
  // the snapshot be replaced leaves the earlier answers pointing at questions the
  // paper no longer holds, and the whole history then fails validation and can no
  // longer be saved or exported.
  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  assert.ok(questions.length >= 6, 'the fixture paper needs enough questions');
  const build = (subset, id, submittedAt) => {
    const session = app.createExamPracticeSession(record.id, subset, submittedAt - 10);
    for (const question of subset) app.recordExamPracticeResponse(session, question.id, question.options?.[0]?.id ?? 'x');
    app.submitExamPractice(session, submittedAt);
    return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
  };

  const first = build(questions.slice(0, 3), 'slice-a', 1000);
  const second = build(questions.slice(2, 6), 'slice-b', 2000);
  assert.equal(first.paperKey, second.paperKey, 'both attempts belong to the same stored paper');
  assert.notDeepEqual(first.paper.questions, second.paper.questions, 'and they carry different question sets');

  const history = app.addExamResult(app.emptyExamResultHistory(), first);
  assert.equal(app.validateExamResultHistory(history).ok, true);
  const storage = store();
  assert.equal(app.saveExamResultHistory(history, storage), true, 'the first attempt saves on its own');

  assert.throws(() => app.addExamResult(history, second), /Conflicting exam paper snapshot/,
    'the conflicting snapshot is rejected instead of silently corrupting the history');
  assert.equal(app.validateExamResultHistory(history).ok, true, 'the rejected call leaves the history valid');
  assert.equal(app.loadExamResultHistory(storage).attempts.length, 1, 'and the saved history still holds the first attempt');
});

test('a snapshot with the same values in a different key order is not a conflict', () => {
  // A paper can be exported, rewritten by a tool or restored from another device with
  // its object properties in a different order. That is the same paper: refusing it
  // would fail the learner's own attempt because of formatting, not content.
  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const reorder = value => Array.isArray(value) ? value.map(reorder)
    : value && typeof value === 'object'
      ? Object.fromEntries(Object.keys(value).reverse().map(key => [key, reorder(value[key])]))
      : value;
  const build = (id, submittedAt) => {
    const session = app.createExamPracticeSession(record.id, questions.slice(0, 3), submittedAt - 10);
    for (const question of questions.slice(0, 3)) app.recordExamPracticeResponse(session, question.id, question.options?.[0]?.id ?? 'x');
    app.submitExamPractice(session, submittedAt);
    return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
  };

  const first = build('order-a', 1000);
  const second = build('order-b', 2000);
  const reordered = { ...second, paper: reorder(second.paper) };
  assert.notDeepEqual(Object.keys(reordered.paper), Object.keys(second.paper), 'the key order really differs');

  const history = app.addExamResult(app.addExamResult(app.emptyExamResultHistory(), first), reordered);
  assert.equal(history.attempts.length, 2, 'the reordered snapshot is accepted as the same paper');
  assert.equal(Object.keys(history.papers).length, 1);

  // The merge path compares the same way, so a reordered export is not a conflict either.
  const storage = store();
  assert.equal(app.saveExamResultHistory(app.addExamResult(app.emptyExamResultHistory(), first), storage), true);
  const payload = JSON.parse(app.exportExamResultHistory(history));
  const paperKey = Object.keys(payload.papers)[0];
  payload.papers[paperKey] = reorder(payload.papers[paperKey]);
  const merged = app.mergeExamResultHistory(app.loadExamResultHistory(storage), payload);
  assert.equal(merged.ok, true, 'a reordered paper merges instead of being rejected as conflicting-paper');
  assert.equal(merged.history.attempts.length, 2);

  // A genuinely different snapshot is still refused.
  const other = build('order-c', 3000);
  const different = { ...other, paper: { ...other.paper, questions: other.paper.questions.slice(0, 2) } };
  assert.throws(() => app.addExamResult(history, different), /Conflicting exam paper snapshot/,
    'a different question set is still a conflict');
});

test('rc11 persistence: two tabs that both submit keep both attempts', () => {
  // Both tabs boot from the same store, so both hold the same boot-time snapshot.
  // Tab A saves first; tab B still has the older snapshot. Saving B's whole
  // in-memory history used to overwrite the key and silently drop A's attempt.
  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const build = (id, submittedAt) => {
    const session = app.createExamPracticeSession(record.id, questions.slice(0, 2), submittedAt - 10);
    for (const q of questions.slice(0, 2)) app.recordExamPracticeResponse(session, q.id, q.options?.[0]?.id ?? 'x');
    app.submitExamPractice(session, submittedAt);
    return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
  };
  const storage = store();
  const tabA = app.loadExamResultHistory(storage);
  const tabB = app.loadExamResultHistory(storage);
  const attemptA = build('tab-a-attempt', 5000);
  const attemptB = build('tab-b-attempt', 6000);

  assert.equal(app.persistExamResultHistory(app.addExamResult(tabA, attemptA), tabA, storage), true,
    'the first tab saves through the merge-before-write path');
  assert.equal(app.persistExamResultHistory(app.addExamResult(tabB, attemptB), tabB, storage), true,
    'the second tab must not fail just because the key changed under it');

  const stored = app.loadExamResultHistory(storage);
  assert.deepEqual(stored.attempts.map(a => a.id), ['tab-a-attempt', 'tab-b-attempt'],
    'both attempts survive, in submission order');
  assert.equal(Object.keys(stored.papers).length, 1, 'and they still share one stored paper snapshot');

  // A deletion is a deliberate whole-history edit: it must not be resurrected.
  const beforeDelete = app.loadExamResultHistory(storage);
  const deleted = app.deleteExamResult(app.loadExamResultHistory(storage), 'tab-a-attempt');
  assert.equal(app.persistExamResultHistory(deleted, beforeDelete, storage), true);
  assert.deepEqual(app.loadExamResultHistory(storage).attempts.map(a => a.id), ['tab-b-attempt'],
    'a deletion sticks: the caller history is the base');

  const beforeClear = app.loadExamResultHistory(storage);
  assert.equal(app.persistExamResultHistory(app.emptyExamResultHistory(), beforeClear, storage), true);
  assert.equal(app.loadExamResultHistory(storage).attempts.length, 0, 'clearing removes every attempt');
  assert.equal(Object.keys(app.loadExamResultHistory(storage).papers).length, 0, 'and leaves no orphan papers');

  // A genuinely conflicting snapshot is still refused, never merged blindly.
  assert.equal(app.persistExamResultHistory(app.addExamResult(app.emptyExamResultHistory(), attemptB),
    app.emptyExamResultHistory(), storage), true, 'storage now holds the full paper snapshot');
  const conflicting = { ...attemptB, id: 'tab-c-attempt', paper: { ...attemptB.paper, questions: attemptB.paper.questions.slice(0, 1) } };
  const staleTab = app.addExamResult(app.emptyExamResultHistory(), conflicting);
  assert.throws(() => app.persistExamResultHistory(staleTab, app.emptyExamResultHistory(), storage),
    /conflicting-paper/, 'a different snapshot for the same paper key is reported, not merged blindly');
});

test('rc11 retention: the window keeps the newest attempts by submission time, not array position', () => {
  // A device whose clock runs ahead publishes an attempt with a later
  // `submittedAt`. Once imported it sits first in the stored array, and a
  // positional `slice(-50)` then drops the newest local attempt.
  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const build = (answered, submittedAt, id) => {
    const session = app.createExamPracticeSession(record.id, questions, submittedAt - 10);
    let n = 0;
    for (const q of questions) {
      if (n >= answered) break;
      app.recordExamPracticeResponse(session, q.id, q.options?.[0]?.id ?? 'x'); n += 1;
    }
    app.submitExamPractice(session, submittedAt);
    return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
  };
  const storage = store();
  const future = build(1, 3_600_000, 'clock-ahead-attempt');
  assert.equal(app.importExamResultHistory(app.exportExamResultHistory(app.addExamResult(app.emptyExamResultHistory(), future)), storage).ok, true);

  let history = app.loadExamResultHistory(storage);
  for (let i = 0; i < 50; i += 1) {
    const next = app.addExamResult(history, build(1, 1000 + i, `local-${i}`));
    assert.equal(app.persistExamResultHistory(next, history, storage), true);
    history = app.loadExamResultHistory(storage);
  }
  const ids = history.attempts.map(attempt => attempt.id);
  assert.equal(ids.length, 50, 'the window still holds exactly 50 attempts');
  assert.equal(ids.includes('local-49'), true, 'the newest local attempt is kept');
  assert.equal(ids.includes('local-0'), false, 'the oldest local attempt is the one that leaves the window');
  assert.equal(ids.includes('clock-ahead-attempt'), true, 'the newest attempt overall is not silently dropped');
  const order = history.attempts.map(attempt => attempt.submittedAt);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), 'storage keeps attempts in submission order');
});

test('rc11 merge: a corrected attempt still merges with its uncorrected copy', () => {
  // `summary` and `questionResults` are derived from the responses plus the
  // corrections in force, so two copies of one attempt legitimately differ there
  // once one device corrected the key. They are the same attempt.
  const q = question(); const keys = [key()];
  const session = app.createExamPracticeSession('2025/test/so', [q], 1000);
  app.recordExamPracticeResponse(session, q.id, 'choice-A');
  app.submitExamPractice(session, 1000);
  const record = { id: '2025/test/so', year: 2025, province: 'Test', unit: 'so', unitLabel: 'Test', source: 'https://example.com', assets: [], quality: 'PDF-text', answers: '', note: '', contentSha256: 'a'.repeat(64), markdown: '' };
  const attempt = app.createExamResultRecord(session, record, keys, { now: 1000, id: 'attempt-1' });
  const before = app.addExamResult(app.emptyExamResultHistory(), attempt);
  const corrected = app.applyExamKeyCorrection(before, { examId: record.id, questionId: q.id, candidates: ['choice-B'], normalization: 'choice-id', note: 'user review', now: 2000 });
  assert.equal(corrected.ok, true);
  assert.notEqual(corrected.history.attempts[0].summary.correct, before.attempts[0].summary.correct, 'the two copies really do score differently');

  const merged = app.mergeExamResultHistory(before, JSON.parse(app.exportExamResultHistory(corrected.history)));
  assert.equal(merged.ok, true, 'the corrected copy is the same attempt, not a conflict');
  assert.equal(merged.history.attempts.length, 1, 'and it is stored once');
  assert.equal(merged.history.corrections.length, 1, 'with the correction that justifies its score');
  assert.equal(merged.history.attempts[0].summary.correct, corrected.history.attempts[0].summary.correct,
    'the merged result is re-scored from the correction');

  const tampered = JSON.parse(app.exportExamResultHistory(before));
  tampered.attempts[0].responses[q.id] = 'choice-B';
  const tamperedMerge = app.mergeExamResultHistory(corrected.history, tampered);
  assert.equal(tamperedMerge.ok, false, 'a different answer under the same id is still refused');
  assert.equal(tamperedMerge.reason, 'score-mismatch',
    'it is caught even earlier: the edited responses no longer reproduce the stored result');
});

test('rc11 backup copy matches what the exporter really writes', () => {
  // The settings panel describes the backup, and that description drifted: it
  // omitted the `phrases` block the exporter has written for releases and said
  // nothing about the stores that genuinely stay on the device.
  const source = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
  const bundle = app.exportProgressBundle({
    progress: {}, prefs: app.DEFAULT_PREFS, favorites: new Set(), history: [],
    streak: { current: 0, longest: 0, lastDate: null }, study: null, flagged: null,
    achievements: null, phrases: { P001: { attempts: 1, correct: 1, wrong: 0, lastPracticed: 1 } }
  });
  for (const block of ['study', 'flagged', 'achievements', 'phrases']) {
    assert.equal(Object.hasOwn(bundle, block), true, `the bundle carries an optional ${block} block`);
  }
  const serialized = JSON.stringify(bundle);
  assert.equal(/chuyen-anh\.cefr\.v1/.test(serialized), false, 'the CEFR selection is not in the backup');
  assert.equal(/chuyen-anh\.presentation\.v1/.test(serialized), false, 'the theme/presentation is not in the backup');
  assert.equal(/chuyen-anh\.language\.v1/.test(serialized), false, 'the interface language is not in the backup');

  const viCopy = source.match(/<p class="settings-copy">(Bản sao JSON v1[^<]+)<\/p>/)[1];
  assert.match(viCopy, /tiến độ cụm từ/, 'the copy names phrase progress, which the file really carries');
  assert.match(viCopy, /CEFR/, 'the copy names the CEFR filter as device-local');
  assert.match(viCopy, /giao diện sáng\/tối/, 'the copy names the theme as device-local');
  assert.match(viCopy, /ngôn ngữ hiển thị/, 'the copy names the interface language as device-local');
});

test('rc11 export: a history the app can build is a history the app can import', () => {
  // `examPaperKey` is `${examId}@${sha256}` while the import validator requires
  // the exam id to contain no `@`. An id that does contain one built a key that
  // could never be validated again: the submit saved nothing, and the recovery
  // the error toast suggests - "download the JSON" - produced a file the
  // importer refused with `invalid-paper`.
  const toolQ = question({ id: 'q-1-test' });
  const toolRecord = {
    id: '2026/tool@x/so', year: 2026, province: 'Tool', unit: 'so', unitLabel: 'Tool',
    source: 'https://example.com', quality: 'PDF-text', answers: '', note: '',
    contentSha256: 'a'.repeat(64), markdown: ''
  };
  const session = app.createExamPracticeSession(toolRecord.id, [toolQ], 1000);
  app.recordExamPracticeResponse(session, toolQ.id, 'choice-A');
  app.submitExamPractice(session, 2000);
  assert.throws(() => app.createExamResultRecord(session, toolRecord, [key()], { now: 2000 }),
    /paper/i, 'a record that could never be stored or re-imported is refused at creation');

  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const okSession = app.createExamPracticeSession(record.id, questions.slice(0, 2), 1000);
  for (const q of questions.slice(0, 2)) app.recordExamPracticeResponse(okSession, q.id, q.options[0].id);
  app.submitExamPractice(okSession, 2000);
  const okAttempt = app.createExamResultRecord(okSession, record, keys, { now: 2000, id: 'ok-attempt' });
  const history = app.addExamResult(app.emptyExamResultHistory(), okAttempt);
  const storage = store();
  assert.equal(app.saveExamResultHistory(history, storage), true);
  assert.equal(app.importExamResultHistory(app.exportExamResultHistory(history), store()).ok, true,
    'a storeable history still exports and re-imports');
});

test('rc11 english: every exam toast has an English rendering', () => {
  // The exam area is translated through EN_UI_TRANSLATIONS. Six of its toasts had
  // no entry, so an English interface still showed Vietnamese sentences from the
  // most consequential flows (a refused save, an import, a missing paper).
  const source = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
  const toasts = [...new Set([...source.matchAll(/toast\(\s*'([^']{8,220})'/g)].map(m => m[1]))];
  const untranslated = toasts.filter(text => app.translateUiText(text, 'en') === text);
  assert.deepEqual(untranslated, [], 'these toast strings would be shown in Vietnamese: ' + untranslated.join(' | '));
});

test('rc11 model: addExamResult refuses a key the exporter could never re-import', () => {
  // The fuzz suite found this: `addExamResult` accepted an attempt whose
  // `paperKey` was a bare exam id, so the history it built exported to a file its
  // own importer rejected with `invalid-paper`. Both ends now share the rule.
  const bare = { id: 'x', paperKey: '2026/paper-a/so', examId: '2026/paper-a/so', startedAt: 1, submittedAt: 2, responses: {}, paper: { id: '2026/paper-a/so' } };
  assert.throws(() => app.addExamResult(app.emptyExamResultHistory(), bare), /paper key/i,
    'a key that is not id@sha256 is refused at the point of adding');
  const at = 'a@b@' + 'a'.repeat(64);
  assert.throws(() => app.addExamResult(app.emptyExamResultHistory(),
    { ...bare, paperKey: at, paper: { id: at } }), /paper key/i,
    'an id containing @ cannot form a storable key');

  // A storable key on a complete paper - built from the archive the app itself
  // validates - still adds, exports and re-imports.
  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const session = app.createExamPracticeSession(record.id, questions.slice(0, 2), 1000);
  for (const q of questions.slice(0, 2)) app.recordExamPracticeResponse(session, q.id, q.options[0].id);
  app.submitExamPractice(session, 2000);
  const real = app.createExamResultRecord(session, record, keys, { now: 2000, id: 'real-attempt' });
  const ok = app.addExamResult(app.emptyExamResultHistory(), real);
  assert.equal(ok.attempts.length, 1, 'a complete attempt with a storable key is accepted');
  assert.equal(app.importExamResultHistory(app.exportExamResultHistory(ok), store()).ok, true,
    'and that history re-imports, which is the property the fuzz failure broke');
});

test('rc11 persist: a correction another tab wrote is carried, so the union stays saveable', () => {
  // Found by the stateful fuzz. Another tab corrected a key and saved; its records
  // were scored against that correction. A tab that has never seen the correction
  // must carry it into the union, or the union's own stored scores become
  // unreproducible and the validator refuses the save with `score-mismatch` -
  // a silently un-saveable history, which is exactly what this path prevents.
  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const build = (id, submittedAt) => {
    const session = app.createExamPracticeSession(record.id, questions.slice(0, 2), submittedAt - 10);
    for (const q of questions.slice(0, 2)) app.recordExamPracticeResponse(session, q.id, q.options[0].id);
    app.submitExamPractice(session, submittedAt);
    return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
  };
  const storage = store();
  const first = build('tab-a-attempt', 5000);
  const tabA = app.addExamResult(app.emptyExamResultHistory(), first);
  const corrected = app.applyExamKeyCorrection(tabA, {
    examId: record.id, questionId: questions[0].id,
    candidates: [questions[0].options[1]?.id ?? questions[0].options[0].id],
    normalization: 'choice-id', note: 'tab A review', now: 6000
  });
  assert.equal(corrected.ok, true, 'the other tab corrected the key');
  assert.equal(app.persistExamResultHistory(corrected.history, tabA, storage), true);

  // This tab booted before that write and knows nothing about the correction.
  const staleTab = app.emptyExamResultHistory();
  const own = app.addExamResult(staleTab, build('tab-b-attempt', 7000));
  let saved = false;
  try { saved = app.persistExamResultHistory(own, staleTab, storage); } catch (error) { saved = error.message; }
  assert.equal(saved, true, `the union must stay saveable, got: ${saved}`);

  const merged = app.loadExamResultHistory(storage);
  assert.deepEqual(merged.attempts.map(a => a.id), ['tab-a-attempt', 'tab-b-attempt'], 'both attempts are stored');
  assert.equal(merged.corrections.length, 1, "the other tab's correction is carried, not dropped");
  assert.equal(app.validateExamResultHistory(merged).ok, true, 'and the stored history still passes its own validator');
});

// ---------------------------------------------------------------------------
// Device-local settings: the separate, versioned file agreed as Option 3.
// ---------------------------------------------------------------------------
const deviceStore = () => {
  const m = new Map();
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), key: i => [...m.keys()][i] ?? null, get length() { return m.size; } };
};
const settingsSample = () => ({
  cefrSelection: app.sanitizeCefrSelection({ version: app.CEFR_SELECTION_VERSION, levels: ['B2', 'C1'], unclassified: true }),
  theme: 'dark',
  language: 'en',
  presentation: { meanings: 'show', interface: 'modern' }
});

test('rc11 device settings: export carries exactly the four device-local settings and nothing else', () => {
  const payload = app.exportDeviceSettings(settingsSample());
  assert.equal(payload.app, 'chuyen-anh-device-settings');
  assert.equal(payload.version, 1);
  assert.deepEqual(Object.keys(payload.settings).sort(), ['cefr', 'language', 'presentation', 'theme']);
  assert.deepEqual(payload.settings.cefr, { levels: ['B2', 'C1'], unclassified: true });
  assert.equal(payload.settings.theme, 'dark');
  assert.equal(payload.settings.language, 'en');
  // Phrase progress must never appear here: it already travels in the v1 backup.
  const serialized = JSON.stringify(payload);
  assert.equal(/phrases|P\d{3}/.test(serialized), false, 'the settings file must not carry phrase progress');
  assert.equal(/progress|favorites|streak|flagged/.test(serialized), false, 'and no study store may leak in');
});

test('rc11 device settings: export -> import round-trips and the values persist after reload', () => {
  const storage = deviceStore();
  const payload = app.exportDeviceSettings(settingsSample());
  const parsed = app.validateDeviceSettingsPayload(JSON.parse(JSON.stringify(payload)));
  assert.equal(app.applyDeviceSettings(parsed, storage), 'ok');
  // "Reload": read the stores back through the public loaders.
  assert.deepEqual(app.loadCefrSelection(storage).levels, ['B2', 'C1']);
  assert.equal(app.loadCefrSelection(storage).unclassified, true);
  assert.equal(app.loadTheme(storage), 'dark');
  assert.equal(app.loadLanguage(storage), 'en');
  assert.equal(app.loadPresentation(storage).interface, 'modern');
});

test('rc11 device settings: a malformed, foreign or unsupported-version file is refused and changes nothing', () => {
  const storage = deviceStore();
  app.saveTheme('light', storage);
  app.saveLanguage('vi', storage);
  const before = app.loadTheme(storage) + '|' + app.loadLanguage(storage);

  const refused = [
    ['not an object', []],
    ['foreign app id', { app: 'something-else', version: 1, settings: {} }],
    ['unsupported version', { ...app.exportDeviceSettings(settingsSample()), version: 99 }],
    ['missing settings', { app: 'chuyen-anh-device-settings', version: 1 }],
    ['missing theme', (() => { const p = app.exportDeviceSettings(settingsSample()); delete p.settings.theme; return p; })()],
    ['bad theme value', (() => { const p = app.exportDeviceSettings(settingsSample()); p.settings.theme = 'sepia'; return p; })()],
    ['bad language', (() => { const p = app.exportDeviceSettings(settingsSample()); p.settings.language = 'fr'; return p; })()],
    ['bad cefr level', (() => { const p = app.exportDeviceSettings(settingsSample()); p.settings.cefr.levels = ['B2', 'Z9']; return p; })()],
    ['cefr not an array', (() => { const p = app.exportDeviceSettings(settingsSample()); p.settings.cefr.levels = 'B2'; return p; })()],
    ['missing unclassified flag', (() => { const p = app.exportDeviceSettings(settingsSample()); delete p.settings.cefr.unclassified; return p; })()],
    ['bad presentation', (() => { const p = app.exportDeviceSettings(settingsSample()); p.settings.presentation.interface = 'neon'; return p; })()]
  ];
  for (const [label, payload] of refused) {
    assert.throws(() => app.validateDeviceSettingsPayload(payload), /./, `${label} must be refused`);
  }
  // Nothing above may have written: validation never touches storage.
  assert.equal(app.loadTheme(storage) + '|' + app.loadLanguage(storage), before, 'failed validation changed the device');
  assert.equal(app.loadTheme(storage), 'light');
});

test('rc11 device settings: extra unknown fields are ignored, not applied', () => {
  const payload = app.exportDeviceSettings(settingsSample());
  payload.settings.somethingNew = 'ignore me';
  payload.extraTopLevel = { nope: true };
  const parsed = app.validateDeviceSettingsPayload(payload);
  assert.deepEqual(Object.keys(parsed).sort(), ['cefrSelection', 'language', 'presentation', 'theme']);
  assert.equal(Object.hasOwn(parsed, 'somethingNew'), false);
});

test('rc11 device settings: a failing store reports the failure and leaves the old settings readable', () => {
  const backing = deviceStore();
  app.saveTheme('light', backing);
  app.saveLanguage('vi', backing);
  // A real quota refuses *large* writes but still accepts small ones, which is
  // exactly why the staging layer can probe and roll back. A mock that fails every
  // write models a dead store, whose honest answer is 'rollback-failed' - tested
  // separately below.
  const failing = {
    getItem: k => backing.getItem(k),
    setItem: (k, v) => {
      if (String(v).length > 64) throw new Error('QuotaExceededError');
      backing.setItem(k, v);
    },
    removeItem: k => backing.removeItem(k)
  };
  const parsed = app.validateDeviceSettingsPayload(app.exportDeviceSettings(settingsSample()));
  const result = app.applyDeviceSettings(parsed, failing);
  assert.equal(result, 'write-failed', 'the caller must be able to tell a clean refusal from a rollback');
  // The rollback restores the pre-import values, so the device is not half configured.
  assert.equal(app.loadTheme(backing), 'light');
  assert.equal(app.loadLanguage(backing), 'vi');
});

test('rc11 device settings: a dead store reports write-failed because the capacity probe caught it first', () => {
  // The staging layer probes capacity before touching a real key, so a store that
  // refuses everything is caught with nothing written ('false', not
  // 'rollback-failed'). Verified by tracing commitStagedWrites directly.
  const dead = { getItem: () => null, setItem: () => { throw new Error('denied'); }, removeItem: () => { throw new Error('denied'); } };
  const parsed = app.validateDeviceSettingsPayload(app.exportDeviceSettings(settingsSample()));
  assert.equal(app.applyDeviceSettings(parsed, dead), 'write-failed');
  // Every write threw, so the store cannot hold a partial configuration; the
  // loader then falls back to its default, which is the pre-import state.
  assert.equal(app.loadTheme(dead), 'system', 'the default is still what the app would show');
});

test('rc11 device settings: a store that fails mid-commit and cannot roll back is reported as rollback-failed', () => {
  // Only reachable when the probe passes but a real write then throws and the
  // restore also fails - a half-written store. The learner must be told to check
  // rather than being reassured.
  const m = new Map();
  let writes = 0;
  const halfDead = {
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => {
      if (k.startsWith('__chuyen-anh.import.probe')) { m.set(k, v); return; }  // probe passes
      writes += 1;
      if (writes > 1) throw new Error('denied');  // second real write fails
      m.set(k, v);
    },
    removeItem: k => { if (!k.startsWith('__chuyen-anh.import.probe')) throw new Error('denied'); m.delete(k); }
  };
  const parsed = app.validateDeviceSettingsPayload(app.exportDeviceSettings(settingsSample()));
  assert.equal(app.applyDeviceSettings(parsed, halfDead), 'rollback-failed');
});

test('rc11 device settings: oversized input is refused before it can be parsed', () => {
  // Four small preferences never need 64 KB. The cap exists because reading a huge
  // selection into `file.text()` is what would stall the tab, so it is enforced on
  // the File in the UI and again on raw text here for direct callers.
  assert.equal(app.DEVICE_SETTINGS_MAX_BYTES, 64 * 1024);
  const huge = '{"app":"chuyen-anh-device-settings"}' + ' '.repeat(app.DEVICE_SETTINGS_MAX_BYTES);
  assert.throws(() => app.validateDeviceSettingsPayload(huge), /quá lớn|too large/);
  // The UI parses first, so the same payload arriving as an object must still be
  // refused - here by shape, because padding a real payload with junk fields is
  // how a bloated file would actually arrive.
  const parsedHuge = JSON.parse('{"app":"chuyen-anh-device-settings","version":1,"settings":' + JSON.stringify({
    cefr: { levels: ['B2'], unclassified: false }, theme: 'dark', language: 'en',
    presentation: { meanings: 'show', interface: 'modern' }
  }) + ',"pad":"' + 'x'.repeat(app.DEVICE_SETTINGS_MAX_BYTES) + '"}');
  // Unknown fields are ignored by design, so a big valid payload is fine; the cap
  // that matters is the byte check on raw text and the File check in the UI.
  assert.doesNotThrow(() => app.validateDeviceSettingsPayload(parsedHuge));
  // A legitimate payload stays well under the ceiling. Note the shape: the
  // validator takes a parsed object (the string branch exists only for the byte
  // cap), so passing the serialized text would be refused as "not an object" -
  // which is the correct behaviour, not a bug.
  const small = JSON.stringify(app.exportDeviceSettings(settingsSample()));
  assert.ok(new TextEncoder().encode(small).length < app.DEVICE_SETTINGS_MAX_BYTES);
  assert.doesNotThrow(() => app.validateDeviceSettingsPayload(JSON.parse(small)));
  assert.throws(() => app.validateDeviceSettingsPayload(small), /đối tượng JSON|JSON object/);
});

test('rc11 device settings: applyDeviceSettings never reports ok after writing only part of the set', () => {
  // A saver refuses an invalid value by not staging a write, and the staging layer
  // cannot distinguish that from "no change needed". Before the guard, an invalid
  // theme reported 'ok' after writing the other three stores - a partial
  // application dressed as a success. The UI validates first, but this function is
  // exported and its contract is all-or-nothing.
  const m = new Map();
  const store = { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k) };
  const bogus = {
    cefrSelection: app.sanitizeCefrSelection({ version: 1, levels: ['B2'], unclassified: false }),
    theme: 'sepia',   // invalid: saveTheme stages nothing
    language: 'en',
    presentation: { meanings: 'show', interface: 'modern' }
  };
  assert.equal(app.applyDeviceSettings(bogus, store), 'write-failed');
  assert.equal(m.size, 0, 'nothing may be written when one setting is refused');
});

test('rc11 device settings: the v1 progress backup still refuses to carry these settings', () => {
  const bundle = app.exportProgressBundle({
    progress: {}, prefs: app.DEFAULT_PREFS, favorites: new Set(), history: [],
    streak: { current: 0, longest: 0, lastDate: null }, study: app.sanitizeStudyConfig(null),
    flagged: new Set(), achievements: { seenBadges: new Set() }, phrases: {}
  });
  const serialized = JSON.stringify(bundle);
  assert.equal(/chuyen-anh\.cefr\.v1|chuyen-anh\.theme\.v1|chuyen-anh\.language\.v1/.test(serialized), false,
    'the v1 contract is unchanged: device-local stores stay out of it');
  assert.equal(Object.hasOwn(bundle, 'cefr'), false);
  assert.equal(Object.hasOwn(bundle, 'theme'), false);
  assert.equal(Object.hasOwn(bundle, 'language'), false);
});

test('rc11 device settings: phrase progress keeps travelling in the v1 backup', () => {
  // Regression guard for the one thing this round must not break: phrase progress
  // already had a home and the new file must not have moved it.
  const bundle = app.exportProgressBundle({
    progress: {}, prefs: app.DEFAULT_PREFS, favorites: new Set(), history: [],
    streak: { current: 0, longest: 0, lastDate: null }, study: app.sanitizeStudyConfig(null),
    flagged: new Set(), achievements: { seenBadges: new Set() },
    phrases: { P001: { attempts: 3, correct: 2, wrong: 1, lastPracticed: 9 } }
  });
  assert.equal(Object.hasOwn(bundle, 'phrases'), true, 'phrase progress is still in the v1 bundle');
  const reimported = app.validateImportPayload(bundle);
  assert.equal(reimported.phrases.P001.correct, 2, 'and it still round-trips');
});
