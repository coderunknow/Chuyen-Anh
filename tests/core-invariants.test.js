import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);

// Round 5 mutation testing found these behaviours pinned by nothing: changing
// the ease cap, the learning interval, the wrong-answer penalty, the mastered
// cap, the exam normaliser's NFC fold, the apostrophe contract, the essay credit
// band, the history limit or the import size cap left every suite green. Each
// test below fails when its behaviour is changed.

const T0 = 1_800_000_000_000;
const walk = (steps) => {
  let progress = app.createInitialProgress('item', T0);
  for (let i = 0; i < steps; i += 1) progress = app.updateProgress(progress, steps[i]?.correct ?? true, steps[i]?.rt ?? 1000, T0 + i * 3_600_000);
  return progress;
};

test('SRS: ease stays inside 1.3…2.8 for both directions', () => {
  let progress = app.createInitialProgress('item', T0);
  for (let i = 0; i < 60; i += 1) progress = app.updateProgress(progress, true, 500, T0 + i * 3_600_000);
  assert.equal(progress.ease, 2.8, 'sixty fast correct answers must stop at the 2.8 cap');
  for (let i = 0; i < 60; i += 1) progress = app.updateProgress(progress, false, 0, T0 + i * 3_600_000);
  assert.equal(progress.ease, 1.3, 'wrong answers must stop at the 1.3 floor');
});

test('SRS: a wrong answer is immediately due, weak, and costs 0.2 ease', () => {
  const learned = app.updateProgress(app.createInitialProgress('item', T0), true, 1000, T0);
  const before = learned.ease;
  const failed = app.updateProgress(learned, false, 0, T0 + 1000);
  assert.equal(failed.interval, 0);
  assert.equal(failed.nextReview, T0 + 1000, 'a missed item is due at once');
  assert.equal(failed.state, app.STATES.WEAK);
  assert.equal(Math.round((before - failed.ease) * 100) / 100, 0.2);
  assert.equal(failed.streak, 0);
});

test('SRS: learning interval is 3 days on the second consecutive correct answer', () => {
  let progress = app.updateProgress(app.createInitialProgress('item', T0), true, 1000, T0);
  assert.equal(progress.interval, 1, 'first correct answer keeps a one-day interval');
  progress = app.updateProgress(progress, true, 1000, T0 + 86_400_000);
  assert.equal(progress.interval, 3);
});

test('SRS: a mastered item never schedules beyond 180 days and never below 7', () => {
  let progress = app.createInitialProgress('item', T0);
  for (let i = 0; i < 40; i += 1) progress = app.updateProgress(progress, true, 500, T0 + i * 86_400_000);
  assert.equal(progress.state, app.STATES.MASTERED);
  assert.equal(progress.interval, 180, 'a long-lived mastered item settles on the 180-day cap, not below it');
});

test('exam normaliser folds decomposed Vietnamese input onto the composed key', () => {
  const question = { id: 'q', number: 1, prompt: 'p', responseType: 'text', options: [], flags: [] };
  const key = { questionId: 'q', verificationStatus: 'source_transcription_unverified', candidates: ['nghịch cảnh'], normalization: 'case-whitespace', acceptedAlternatives: [] };
  const composed = app.gradeExamQuestion(question, 'nghịch cảnh', key);
  const decomposed = app.gradeExamQuestion(question, 'nghịch cảnh'.normalize('NFD'), key);
  assert.equal(composed.result, 'correct');
  assert.equal(decomposed.result, 'correct', 'NFD input must fold to NFC before comparison');
});

test('punctuation contract strips apostrophes and hyphens; the plain contract does not', () => {
  const question = { id: 'q', number: 1, prompt: 'p', responseType: 'text', options: [], flags: [] };
  const keyFor = (contract, candidates) => ({ questionId: 'q', verificationStatus: 'source_transcription_unverified', candidates, normalization: contract, acceptedAlternatives: [] });
  assert.equal(app.gradeExamQuestion(question, 'dont', keyFor('case-whitespace-punctuation', ["don't"])).result, 'correct');
  assert.equal(app.gradeExamQuestion(question, 'dont', keyFor('case-whitespace', ["don't"])).result, 'incorrect');
  assert.equal(app.gradeExamQuestion(question, 'wellknown', keyFor('case-whitespace-punctuation', ['well-known'])).result, 'correct');
});

test('an empty or whitespace-only response is never graded correct', () => {
  const question = { id: 'q', number: 1, prompt: 'p', responseType: 'text', options: [], flags: [] };
  const key = { questionId: 'q', verificationStatus: 'source_transcription_unverified', candidates: [''], normalization: 'case-whitespace', acceptedAlternatives: [''] };
  for (const answer of ['', '   ', '\t\n']) {
    const graded = app.gradeExamQuestion(question, answer, key);
    assert.notEqual(graded.result, 'correct', `response ${JSON.stringify(answer)} must not match an empty key`);
  }
  // A key that normalises away (punctuation-only, punctuation contract) must not
  // let a punctuation-only response count as an answer.
  const punctuationKey = { questionId: 'q', verificationStatus: 'source_transcription_unverified', candidates: ['.'], normalization: 'case-whitespace-punctuation', acceptedAlternatives: [] };
  for (const answer of ['...', '.', '?!']) {
    assert.notEqual(app.gradeExamQuestion(question, answer, punctuationKey).result, 'correct',
      `a response that normalises to nothing is not an answer: ${JSON.stringify(answer)}`);
  }
});

test('essay rubric override maps credit to the documented verdict bands', () => {
  const question = { id: 'e', number: 1, prompt: 'Write.', responseType: 'essay', options: [], flags: [] };
  const key = { questionId: 'e', verificationStatus: 'source_transcription_unverified', candidates: [], rubric: { min: 0, max: 1 }, normalization: 'case-whitespace', acceptedAlternatives: [] };
  const verdictFor = (credit) => {
    const session = { examId: 'band/1/so', status: 'submitted', startedAt: 1, submittedAt: 2, questions: [question], keys: [key],
      responses: { e: 'A full essay response that a rubric can be applied to.' } };
    const correction = { examId: 'band/1/so', questionId: 'e', candidates: [String(credit)], normalization: 'rubric-credit', verificationStatus: 'user_confirmed' };
    return app.scoreExamSession(session, [key], [correction], 'band/1/so').results[0];
  };
  assert.equal(verdictFor(0.6).result, 'correct', '0.60 is the first correct credit');
  assert.equal(verdictFor(0.59).result, 'partial');
  assert.equal(verdictFor(0.25).result, 'partial', '0.25 is the first partial credit');
  assert.equal(verdictFor(0.24).result, 'incorrect');
  assert.equal(verdictFor(1.5).result, 'ungraded');
  assert.equal(verdictFor(-0.1).result, 'ungraded');
});

test('exam history keeps the newest 50 attempts and prunes papers of dropped ones', () => {
  const question = { id: 'q1', number: 1, prompt: 'p', responseType: 'choice',
    options: [{ id: 'a', label: 'A', text: 'a' }, { id: 'b', label: 'B', text: 'b' }], flags: [] };
  const key = [{ questionId: 'q1', verificationStatus: 'source_transcription_unverified', candidates: ['a'], normalization: 'case-whitespace', acceptedAlternatives: [] }];
  const record = { id: 'limit/1/so', year: 2025, province: 'P', unit: 'so', unitLabel: 'P', source: 'https://example.com', assets: [], quality: 'PDF-text', answers: '', note: '', contentSha256: 'd'.repeat(64), markdown: '' };
  const session = app.createExamPracticeSession(record.id, question ? [question] : [], 1000);
  app.recordExamPracticeResponse(session, 'q1', 'a');
  app.submitExamPractice(session, 2000);
  const attempt = app.createExamResultRecord(session, record, key, { now: 2000, id: 'attempt-0' });
  let history = app.emptyExamResultHistory();
  for (let i = 0; i < 51; i += 1) history = app.addExamResult(history, { ...JSON.parse(JSON.stringify(attempt)), id: `attempt-${i}` });
  assert.equal(history.attempts.length, 50, 'the history keeps exactly 50 attempts');
  assert.equal(history.attempts[0].id, 'attempt-1', 'the oldest attempt is the one dropped');
  assert.equal(history.attempts.at(-1).id, 'attempt-50');
});

test('a history import larger than 4 MB is refused before parsing', async () => {
  const big = JSON.stringify({ schemaVersion: app.EXAM_HISTORY_SCHEMA_VERSION, attempts: [], papers: {}, corrections: [], pad: 'x'.repeat(4 * 1024 * 1024) });
  const store = { getItem: () => null, setItem: () => {}, removeItem: () => {} };
  const result = await app.importExamResultHistory(big, store);
  assert.deepEqual(result, { ok: false, reason: 'too-large-or-invalid' });
});

test('an unclassified sense is in scope only when Unclassified is selected', () => {
  const entry = { id: 'u1', word: 'u', meaning: 'm', pos: 'n', senses: [{ senseId: 'u1-s1', meaning: 'm', pos: 'n', cefr: app.CEFR_UNCLASSIFIED }] };
  const selection = (levels, unclassified) => ({ version: app.CEFR_SELECTION_VERSION, levels, unclassified });
  assert.equal(app.entryMatchesCefr(entry, selection(['B2'], false)), false);
  assert.equal(app.entryMatchesCefr(entry, selection(['B2'], true)), true, 'Unclassified must reach an unclassified sense');
  assert.equal(app.entryMatchesCefr(entry, selection([app.CEFR_UNCLASSIFIED], false)), false,
    'listing the token as a level is not a selection: only the flag admits unclassified rows');
  assert.deepEqual(app.sanitizeCefrSelection(selection(['B2'], true)).unclassified, true);
});
