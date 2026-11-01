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
  assert.equal(app.gradeExamQuestion(multi, ['choice-A'], key({ questionId:'m', candidates:['choice-A','choice-B'], normalization:'choice-set' })).result, 'incorrect');
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
        assert.ok(['invalid_key', 'missing_answer', 'incomplete_stimulus', 'ambiguous_review'].includes(k.verificationStatus), `${record.id} ${q.id} ungradeable status ${k.verificationStatus}`);
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
  assert.ok(total >= 6800, 'all 106 papers including fenced PDFs, cloze tables, speaking prompts and HTML/OCR papers are extracted');
  assert.equal(total, scorable + ungradeable);
  // 33 papers in the archive carry no answer section at all, and no constructed
  // response is keyed by a generated sentence; both are reported as ungradeable
  // instead of being guessed (issues #75/#77).
  assert.equal(scorable, 2947);
  assert.equal(ungradeable, 3857);
  assert.deepEqual(reasons, {
    'no-source-answer': 3106,
    'stimulus-incomplete': 465,
    'incomplete-options': 209,
    'multiple-letters-for-single-item': 23,
    'key-not-an-option': 22,
    'option-overflow': 21,
    'letter-with-mismatched-text': 11
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

test('rc9 builder (#77): a provisional choice key is only emitted with a positive margin, so option A is no longer the default', async () => {
  const manifest = JSON.parse(await readFile(new URL('../data/exam-answer-keys.json', import.meta.url), 'utf8'));
  const keys = manifest.records.flatMap(record => record.answerKeys);
  const inferredChoice = keys.filter(k => k.verificationStatus === 'inferred_unverified'
    && Array.isArray(k.candidates) && k.candidates.length > 0 && String(k.candidates[0]).startsWith('choice-'));
  assert.ok(inferredChoice.length > 0, 'some choice keys are still inferred from real cues');
  assert.ok(inferredChoice.length < 400, `inferred choice keys must shrink from 1,384, got ${inferredChoice.length}`);
  const optionA = inferredChoice.filter(k => k.candidates[0] === 'choice-A').length;
  assert.ok(optionA / inferredChoice.length < 0.5, `option A share must fall well below the audited 84.3%, got ${(optionA / inferredChoice.length * 100).toFixed(1)}%`);
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
  const placeholder = question({ id: 'p2', responseType: 'text', options: [], prompt: 'John and his father look very similar. IMAGE John is father.' });
  assert.equal(app.examStimulusState(placeholder, { hasImage: false }), 'literal-image-text',
    'the transcription kept the bare word IMAGE, which is not a picture');
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
