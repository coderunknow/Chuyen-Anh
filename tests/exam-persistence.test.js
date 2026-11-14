// Round 8: asynchronous, cross-tab-safe exam-history persistence.
//
// Every test here is adversarial: it reproduces an *interleaving*, not a sequence
// of sequential calls. The store is a real map behind an instrumented facade, so a
// test can make another "tab" write at the exact instant this one is between its
// read and its write - which is the only way to show that the round-7 read-back
// repair could not have caught the loss it claimed to prevent.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const KEY = 'chuyen-anh.exam-results.v1';
const record = records[0];
const questions = app.parseExamQuestions(record.markdown, record.id);
const keys = Array.isArray(record.answerKey) ? record.answerKey : [];

/** A store backed by one shared map, with hooks that fire inside a write. */
function makeStore({ onWrite } = {}) {
  const data = new Map();
  // The store object exists before the hook can fire, and the hook receives that
  // same object: the previous version passed an undeclared `api` binding, so
  // `onWrite` threw a ReferenceError the first time any test supplied one
  // (CodeRabbit, PR #85).
  const store = {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, value);
      if (key === KEY && onWrite) onWrite({ data, store });
    },
    removeItem: key => { data.delete(key); }
  };
  return { store, snapshot: () => Object.fromEntries(data), raw: () => data.get(KEY) };
}

function attempt(id, submittedAt, { count = 2 } = {}) {
  const chosen = questions.slice(0, count);
  const session = app.createExamPracticeSession(record.id, chosen, submittedAt - 10);
  for (const question of chosen) app.recordExamPracticeResponse(session, question.id, question.options?.[0]?.id ?? 'x');
  app.submitExamPractice(session, submittedAt);
  return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
}

const save = async (next, base, storage) => {
  const result = await app.persistExamResultHistory(next, base, storage);
  return result;
};

const stored = storage => app.loadExamResultHistory(storage);

test('r8 persistence: a locked write reports the mode it obtained', async () => {
  const { store } = makeStore();
  const base = app.loadExamResultHistory(store);
  const result = await save(app.addExamResult(base, attempt('a1', 5000)), base, store);
  assert.equal(result.ok, true);
  // Node has no `navigator.locks`, so the honest answer is "unserialized" - the
  // weaker mode, verified after the write. The app must never claim "locked" when
  // it did not get a lock, and this assertion is what pins that honesty.
  assert.equal(result.mode, 'unserialized');
  assert.equal(app.examHistoryLockSupport().available, false);
  assert.equal(result.history.attempts.length, 1);
});

test('r8 persistence: two tabs creating different attempts concurrently keep both', async () => {
  const { store } = makeStore();
  const tabA = app.loadExamResultHistory(store);
  const tabB = app.loadExamResultHistory(store);
  const [a, b] = await Promise.all([
    save(app.addExamResult(tabA, attempt('tab-a', 5000)), tabA, store),
    save(app.addExamResult(tabB, attempt('tab-b', 6000)), tabB, store)
  ]);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const storedIds = stored(store).attempts.map(item => item.id).sort();
  assert.deepEqual(storedIds, ['tab-a', 'tab-b'], 'neither concurrent submission is lost');
});

test('r8 persistence: a write that lands between read and write is repaired, not adopted silently', async () => {
  // The interleaving the round-7 read-back could not detect: tab B's stale write
  // clobbers tab A's attempt *after* A had already returned. A's write was
  // confirmed at the time; the loss happens afterwards. What the persistence
  // layer owes the next writer is that B's merge brings A's attempt back rather
  // than overwriting it, which is what this measures.
  const { store } = makeStore();
  const tabA = app.loadExamResultHistory(store);
  const saved = await save(app.addExamResult(tabA, attempt('a1', 5000)), tabA, store);
  assert.equal(saved.ok, true);
  const staleSnapshot = app.loadExamResultHistory(store);

  // Tab B booted before A wrote; it still holds the empty history.
  const tabB = app.emptyExamResultHistory();
  const b = await save(app.addExamResult(tabB, attempt('b1', 6000)), tabB, store);
  assert.equal(b.ok, true);
  assert.deepEqual(stored(store).attempts.map(item => item.id).sort(), ['a1', 'b1'],
    'the stale tab merges instead of overwriting');
  assert.equal(staleSnapshot.attempts.length, 1);
});

test('r8 persistence: a stale tab cannot resurrect an attempt another tab deleted', async () => {
  const { store } = makeStore();
  const first = app.loadExamResultHistory(store);
  await save(app.addExamResult(first, attempt('victim', 5000)), first, store);

  // Tab B boots with the attempt, then tab A deletes it.
  const tabB = app.loadExamResultHistory(store);
  const beforeDelete = app.loadExamResultHistory(store);
  await save(app.deleteExamResult(beforeDelete, 'victim'), beforeDelete, store);
  assert.deepEqual(stored(store).attempts, []);

  // Tab B now saves something of its own. Its in-memory history still lists the
  // deleted attempt; a merge that treated "not in my base" as "new" would put it
  // back.
  const b = await save(app.addExamResult(tabB, attempt('fresh', 7000)), tabB, store);
  assert.equal(b.ok, true);
  assert.deepEqual(stored(store).attempts.map(item => item.id), ['fresh'],
    'the deleted attempt stays deleted while the new one is saved');
});

test('r8 persistence: a stale tab cannot resurrect history cleared by another tab', async () => {
  const { store } = makeStore();
  const first = app.loadExamResultHistory(store);
  const withAttempts = app.addExamResult(app.addExamResult(first, attempt('one', 5000)), attempt('two', 6000));
  await save(withAttempts, first, store);

  const staleTab = app.loadExamResultHistory(store);
  const beforeClear = app.loadExamResultHistory(store);
  const cleared = await save(app.clearExamResultHistory(beforeClear), beforeClear, store);
  assert.equal(cleared.ok, true);
  assert.deepEqual(stored(store).attempts, []);
  assert.ok(stored(store).generation >= 1, 'the Clear is recorded as a generation, not as an empty store');

  const b = await save(app.addExamResult(staleTab, attempt('after', 9000)), staleTab, store);
  assert.equal(b.ok, true);
  assert.deepEqual(stored(store).attempts.map(item => item.id), ['after'],
    'only the post-Clear attempt survives; the cleared ones do not come back');
});

test('r8 persistence: a legitimate attempt created while another tab clears survives', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('old', 5000)), boot, store);

  // The clearing tab sees the old attempt; the submitting tab submitted a *new*
  // attempt at the same moment and does not know the Clear happened.
  const clearingTab = app.loadExamResultHistory(store);
  const submittingTab = app.loadExamResultHistory(store);
  const submitted = app.addExamResult(submittingTab, attempt('new', 6000));
  const [clearResult, submitResult] = await Promise.all([
    save(app.clearExamResultHistory(clearingTab), clearingTab, store),
    save(submitted, submittingTab, store)
  ]);
  assert.equal(clearResult.ok, true);
  assert.equal(submitResult.ok, true);
  assert.deepEqual(stored(store).attempts.map(item => item.id), ['new'],
    'the Clear removes what it saw; the attempt created after it is legitimate and kept');
  assert.ok(stored(store).generation >= 1);
});

test('r8 persistence: clearing twice is idempotent and never leaves orphan papers', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('one', 5000)), boot, store);
  const before = app.loadExamResultHistory(store);
  await save(app.clearExamResultHistory(before), before, store);
  const again = app.loadExamResultHistory(store);
  const second = await save(app.clearExamResultHistory(again), again, store);
  assert.equal(second.ok, true);
  assert.deepEqual(stored(store).attempts, []);
  assert.deepEqual(stored(store).papers, {}, 'a Clear leaves no paper snapshots behind');
});

test('r8 persistence: an attempt created while another tab saves a correction keeps both facts', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('a1', 5000)), boot, store);

  const correctingTab = app.loadExamResultHistory(store);
  const submittingTab = app.loadExamResultHistory(store);
  const corrected = app.applyExamKeyCorrection(correctingTab, {
    examId: record.id, questionId: questions[0].id, candidates: ['tab-a-correction'], now: 5100
  });
  assert.equal(corrected.ok, true);
  const [correctionSave, submitSave] = await Promise.all([
    save(corrected.history, correctingTab, store),
    save(app.addExamResult(submittingTab, attempt('a2', 6000)), submittingTab, store)
  ]);
  assert.equal(correctionSave.ok, true);
  assert.equal(submitSave.ok, true);
  const final = stored(store);
  assert.deepEqual(final.attempts.map(item => item.id).sort(), ['a1', 'a2']);
  assert.equal(final.corrections.length, 1, 'the correction is not lost to the concurrent submission');
  assert.equal(app.validateExamResultHistory(final).ok, true, 'the stored union is self-consistent');
});

test('r8 persistence: multiple corrections to different questions of one exam all survive', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('a1', 5000)), boot, store);
  const first = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
    examId: record.id, questionId: questions[0].id, candidates: ['first'], now: 5100
  });
  assert.equal(first.ok, true);
  const second = app.applyExamKeyCorrection(first.history, {
    examId: record.id, questionId: questions[1].id, candidates: ['second'], now: 5200
  });
  assert.equal(second.ok, true);
  const result = await save(second.history, first.history, store);
  assert.equal(result.ok, true);
  assert.equal(stored(store).corrections.length, 2);
  assert.deepEqual(stored(store).corrections.map(item => item.questionId).sort(),
    [questions[0].id, questions[1].id].sort(), 'each correction stays attached to its own question');
});

test('r8 persistence: two tabs correcting the same question conflict instead of overwriting', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('a1', 5000)), boot, store);
  const tabA = app.loadExamResultHistory(store);
  const tabB = app.loadExamResultHistory(store);
  const a = app.applyExamKeyCorrection(tabA, { examId: record.id, questionId: questions[0].id, candidates: ['from-a'], now: 5100 });
  const b = app.applyExamKeyCorrection(tabB, { examId: record.id, questionId: questions[0].id, candidates: ['from-b'], now: 5200 });
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
  const firstSave = await save(a.history, tabA, store);
  assert.equal(firstSave.ok, true);

  // POLICY CHANGE (round 8 / RC11). This used to be "last explicit choice wins":
  // tab B's save succeeded and tab A's correction was silently replaced. A
  // correction id is derived from exam+question, so two tabs correcting the same
  // question mint the same id, and tab B's snapshot had never seen A's record - so
  // B was not editing it, it was clobbering a record it did not know existed, and
  // the save reported success while A's work was gone (CodeRabbit, PR #85).
  // A correction is data the learner typed, so it is now a reported conflict.
  const secondSave = await save(b.history, tabB, store);
  assert.equal(secondSave.ok, false, 'clobbering an unseen correction is refused');
  assert.equal(secondSave.reason, 'conflicting-correction');
  const final = stored(store);
  assert.equal(final.corrections.length, 1, 'one question keeps exactly one correction record');
  assert.deepEqual(final.corrections[0].candidates, ['from-a'],
    'the correction already stored is not silently replaced');
  assert.equal(app.validateExamResultHistory(final).ok, true);

  // The edit path still works: a tab that KNOWS the stored correction may replace
  // it, because that is an edit of a record it can see, not a blind overwrite.
  const aware = app.loadExamResultHistory(store);
  const edited = app.applyExamKeyCorrection(aware, {
    examId: record.id, questionId: questions[0].id, candidates: ['from-a-edited'], now: 6000, replace: true
  });
  assert.equal(edited.ok, true);
  const editSave = await save(edited.history, aware, store);
  assert.equal(editSave.ok, true, 'a visible correction can still be edited');
  assert.deepEqual(stored(store).corrections[0].candidates, ['from-a-edited']);
});

test('r8 persistence: reloading either tab after concurrent writes shows the same history', async () => {
  const { store } = makeStore();
  const tabA = app.loadExamResultHistory(store);
  const tabB = app.loadExamResultHistory(store);
  await save(app.addExamResult(tabA, attempt('a1', 5000)), tabA, store);
  await save(app.addExamResult(tabB, attempt('b1', 6000)), tabB, store);
  const reloadedA = app.loadExamResultHistory(store);
  const reloadedB = app.loadExamResultHistory(store);
  assert.deepEqual(reloadedA.attempts.map(item => item.id), reloadedB.attempts.map(item => item.id));
  assert.deepEqual(reloadedA.attempts.map(item => item.id), ['a1', 'b1']);
});

test('r8 persistence: a store that rejects writes reports failure and keeps the old history intact', async () => {
  const { store, raw } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('a1', 5000)), boot, store);
  const before = raw();
  const broken = {
    getItem: store.getItem,
    setItem: () => { throw new Error('QuotaExceededError'); },
    removeItem: store.removeItem
  };
  const result = await save(app.addExamResult(app.loadExamResultHistory(broken), attempt('b1', 6000)),
    app.loadExamResultHistory(broken), broken);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'storage-write-failed');
  assert.equal(raw(), before, 'a failed write leaves the stored history untouched');
});

test('r8 persistence: an unreadable store is never overwritten with an empty history', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('a1', 5000)), boot, store);
  const damaged = { ...store, getItem: () => '{not json', setItem: () => { throw new Error('must not be called'); } };
  const inspected = app.inspectExamResultStore(damaged);
  assert.equal(inspected.status, 'unreadable');
  assert.equal(inspected.reason, 'invalid-json');
  const result = await save(app.addExamResult(app.emptyExamResultHistory(), attempt('b1', 6000)),
    app.emptyExamResultHistory(), damaged);
  assert.equal(result.ok, false);
  assert.match(result.reason, /^store-/);
});

test('r8 persistence: a storage that throws on read is a failure, not an empty history', async () => {
  const throwing = { getItem: () => { throw new Error('denied'); }, setItem: () => true, removeItem: () => {} };
  const inspected = app.inspectExamResultStore(throwing);
  assert.equal(inspected.status, 'unreadable');
  assert.equal(inspected.reason, 'storage-read-failed');
  const result = await save(app.addExamResult(app.emptyExamResultHistory(), attempt('a1', 5000)),
    app.emptyExamResultHistory(), throwing);
  assert.equal(result.ok, false);
});

test('r8 persistence: repeated retries converge instead of oscillating', async () => {
  const { store } = makeStore();
  let base = app.loadExamResultHistory(store);
  for (let i = 0; i < 5; i += 1) {
    const next = app.addExamResult(base, attempt(`retry-${i}`, 5000 + i * 10));
    const result = await save(next, base, store);
    assert.equal(result.ok, true, `retry ${i} saves`);
    base = result.history;
  }
  assert.deepEqual(stored(store).attempts.map(item => item.id),
    ['retry-0', 'retry-1', 'retry-2', 'retry-3', 'retry-4']);
  // Re-saving the identical history is a no-op that still reports success.
  const repeat = await save(base, base, store);
  assert.equal(repeat.ok, true);
  assert.equal(stored(store).attempts.length, 5);
});

test('r8 tombstones: they are bounded so history cannot grow without limit', async () => {
  const { store } = makeStore();
  let history = app.loadExamResultHistory(store);
  // 60 deletions is more than the retained-attempt window, which is where a
  // tombstone list would otherwise start to outgrow the data it protects.
  for (let i = 0; i < 60; i += 1) {
    const next = app.addExamResult(history, attempt(`gone-${i}`, 5000 + i * 10));
    history = app.deleteExamResult(next, `gone-${i}`);
  }
  const result = await save(history, app.emptyExamResultHistory(), store);
  assert.equal(result.ok, true);
  assert.ok(stored(store).tombstones.attempts.length <= 500);
});

test('r8 correction limit: exactly 1000 characters is accepted, 1001 is refused everywhere', async () => {
  const text = questions[0].responseType === 'text' ? null : null;
  const answerQuestion = questions.find(question => question.responseType === 'text' && question.options.length === 0);
  const target = answerQuestion || { id: 'q-limit', number: 1, prompt: 'p', responseType: 'text', options: [], flags: [] };
  const atLimit = 'a'.repeat(1000);
  const overLimit = 'a'.repeat(1001);

  assert.equal(app.examCorrectionLength(atLimit), 1000);
  assert.equal(app.examCorrectionExceedsLimit(atLimit), false);
  assert.equal(app.examCorrectionExceedsLimit(overLimit), true);
  // The limit counts characters, not UTF-16 units: 1,000 emoji are 1,000
  // characters and 2,000 units.
  const emoji = '🙂'.repeat(1000);
  assert.equal(app.examCorrectionLength(emoji), 1000);
  assert.equal(app.examCorrectionExceedsLimit(emoji), false);

  const accepted = app.examCorrectionValidation(target, atLimit);
  assert.equal(accepted.ok, true);
  const refused = app.examCorrectionValidation(target, overLimit);
  assert.equal(refused.ok, false);
  assert.equal(refused.reason, 'too-long');
  assert.equal(refused.length, 1001);
  assert.equal(refused.limit, 1000);
  assert.equal(app.examCorrectionCandidates(target, overLimit), null,
    'the parser refuses over-limit input instead of returning it');

  const history = app.addExamResult(app.emptyExamResultHistory(), {
    ...attempt('limit-attempt', 5000),
    paper: { ...attempt('limit-attempt', 5000).paper, questions: [...questions.slice(0, 2), target], baseKeys: [...keys.filter(key => questions.slice(0, 2).some(question => question.id === key.questionId)), { questionId: target.id, verificationStatus: 'source_transcription_unverified', candidates: ['x'], acceptedAlternatives: [], normalization: 'case-whitespace', sources: [], limitations: [] }] }
  });
  const applied = app.applyExamKeyCorrection(history, { examId: record.id, questionId: target.id, candidates: [overLimit] });
  assert.equal(applied.ok, false, 'the model refuses an over-limit candidate');
  assert.equal(applied.reason, 'correction-too-long');
});

test('r8 correction migration: an over-long historical correction is preserved, not truncated or dropped', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  const saved = await save(app.addExamResult(boot, attempt('legacy-attempt', 5000)), boot, store);
  assert.equal(saved.ok, true);

  // History written before the cap existed: a valid schema-v1 record whose
  // candidate is 1,400 characters. It must load, survive a save, and still be
  // there afterwards - the compatibility policy is "tag and keep", not "reject".
  const longText = 'x'.repeat(1400);
  // Start from a correction the app itself produced (so every field has the real
  // shape), then lengthen only the candidate - exactly the historical record the
  // old, uncapped input could create.
  const seeded = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
    examId: record.id, questionId: questions[0].id, candidates: ['short'], now: 5000
  });
  assert.equal(seeded.ok, true);
  const raw = JSON.parse(JSON.stringify(seeded.history));
  raw.corrections[0].candidates = [longText];
  raw.corrections[0].createdAt = 5000;
  store.setItem(KEY, JSON.stringify(raw));

  const loaded = app.loadExamResultHistory(store);
  assert.equal(loaded.corrections.length, 1, 'the historical correction is not dropped');
  assert.equal(loaded.corrections[0].candidates[0], longText, 'and is not truncated');
  assert.equal(loaded.corrections[0].legacyOverLimit, true, 'it is tagged as pre-limit history');

  const resaved = await save(app.addExamResult(loaded, attempt('after-legacy', 8000)), loaded, store);
  assert.equal(resaved.ok, true, 'the migrated history is still saveable');
  const after = app.loadExamResultHistory(store);
  assert.equal(after.corrections[0].candidates[0], longText);
  assert.deepEqual(after.attempts.map(item => item.id).sort(), ['after-legacy', 'legacy-attempt']);

  // New input of the same length is still refused: compatibility preserved the
  // record without weakening the rule for new data.
  assert.equal(app.examCorrectionValidation(questions[0], longText).ok, false);
});

test('r8 snapshot selection: the snapshot that backs the correction is the one carried', async () => {
  // Two content versions of the same exam. The correction targets a question only
  // the *second* snapshot contains; the round-7 code took the first paper with a
  // matching examId and produced an unvalidatable payload.
  const firstQuestions = questions.slice(0, 2);
  const secondQuestion = { ...questions[0], id: 'q-newer-version' };
  const papers = {
    [`${record.id}@${'1'.repeat(64)}`]: {
      id: `${record.id}@${'1'.repeat(64)}`, examId: record.id, contentSha256: '1'.repeat(64),
      metadata: {}, questions: firstQuestions,
      baseKeys: keys.filter(key => firstQuestions.some(question => question.id === key.questionId))
    },
    [`${record.id}@${'2'.repeat(64)}`]: {
      id: `${record.id}@${'2'.repeat(64)}`, examId: record.id, contentSha256: '2'.repeat(64),
      metadata: {}, questions: [...firstQuestions, secondQuestion],
      baseKeys: [
        ...keys.filter(key => firstQuestions.some(question => question.id === key.questionId)),
        { questionId: secondQuestion.id, verificationStatus: 'source_transcription_unverified', candidates: [secondQuestion.options?.[0]?.id ?? 'x'], acceptedAlternatives: [], normalization: 'choice-id', sources: [], limitations: [] }
      ]
    }
  };
  const correction = { id: 'corr-newer', examId: record.id, questionId: secondQuestion.id };
  assert.deepEqual(app.examCorrectionPaperKeys(papers, correction), [`${record.id}@${'2'.repeat(64)}`],
    'only the snapshot containing the question and its base key is selected');
  assert.deepEqual(app.examCorrectionPaperKeys(papers, { id: 'x', examId: record.id, questionId: 'absent' }), [],
    'no snapshot backs a question none of them contains');
});

test('r8 scoring: an attempt is not refused when another tab already held the correction it was scored with', async () => {
  // CodeRabbit 4537334892, reproduced: tab A holds correction C and submits a2
  // (scored with C in force). Tab B booted *before* C existed and submits b1. The
  // union's correction list must be grown from the store, or the merged a2 stops
  // reproducing its own summary and the whole save is refused as score-mismatch.
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('a1', 5000)), boot, store);
  const tabA = app.loadExamResultHistory(store);
  const corrected = app.applyExamKeyCorrection(tabA, {
    examId: record.id, questionId: questions[0].id,
    candidates: [questions[0].options[1]?.id ?? questions[0].options[0].id],
    normalization: 'choice-id', note: 'tab A', now: 5100
  });
  assert.equal(corrected.ok, true);
  const savedA = await save(app.addExamResult(corrected.history, attempt('a2', 6000)), corrected.history, store);
  assert.equal(savedA.ok, true);

  const staleTab = app.emptyExamResultHistory();
  const result = await save(app.addExamResult(staleTab, attempt('b1', 7000)), staleTab, store);
  assert.equal(result.ok, true, `the union must stay saveable (reason: ${result.reason})`);
  const final = stored(store);
  assert.deepEqual(final.attempts.map(item => item.id).sort(), ['a1', 'a2', 'b1']);
  assert.equal(final.corrections.length, 1, "the other tab's correction is carried");
  assert.equal(app.validateExamResultHistory(final).ok, true);
});

test('r8 scoring: an attempt scored before a correction re-scores when the union carries it', async () => {
  // The mirror image of the previous test, and the reason the invariant is
  // "the union is self-consistent", not "every stored summary is immutable": a
  // correction changes the score of attempts already stored, and the merged
  // history must reflect that rather than keep a summary nothing reproduces.
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  const withAttempt = await save(app.addExamResult(boot, attempt('a1', 5000)), boot, store);
  assert.equal(withAttempt.ok, true);
  const before = stored(store).attempts[0].summary;
  const correctingTab = app.loadExamResultHistory(store);
  const staleTab = app.emptyExamResultHistory();
  const corrected = app.applyExamKeyCorrection(correctingTab, {
    examId: record.id, questionId: questions[0].id,
    candidates: [questions[0].options[1]?.id ?? questions[0].options[0].id],
    normalization: 'choice-id', note: 'changes the score', now: 5100
  });
  assert.equal(corrected.ok, true);
  const [correctionSave, submitSave] = await Promise.all([
    save(corrected.history, correctingTab, store),
    save(app.addExamResult(staleTab, attempt('b1', 7000)), staleTab, store)
  ]);
  assert.equal(correctionSave.ok, true);
  assert.equal(submitSave.ok, true);
  const final = stored(store);
  assert.equal(app.validateExamResultHistory(final).ok, true,
    'every stored summary reproduces from the stored corrections');
  assert.ok(final.corrections.length === 1);
  assert.ok(before.total > 0);
});

test('r8 correction UI: the 1,000-character limit is visible and enforced at the input', () => {
  // The requirement is that the limit is visible at the UI boundary, not only in
  // the persistence validator - a learner must not discover it by losing a save.
  const inputTag = appSource.match(/id="exam-key-correct-input"[^>]*/)?.[0] || '';
  // The limit counts code points per answer, which `maxlength` cannot express: it
  // counts UTF-16 units over the whole field, so it blocked a legitimate
  // 600-emoji answer and accepted two 700-character answers (CodeRabbit, PR #85).
  // Enforcement moved to an input handler that uses the same two model functions
  // the save uses, and the measured length is shown to the learner.
  assert.doesNotMatch(inputTag, /maxlength=/, 'no UTF-16 maxlength on a code-point-limited answer');
  assert.match(inputTag, /aria-describedby="exam-key-correct-hint"/,
    'the input is programmatically associated with the hint that states the limit');
  assert.match(appSource, /id="exam-key-correct-hint"/);
  assert.match(appSource, /Tối đa 1000 ký tự/);
  assert.match(appSource, /At most 1000 characters/);
  assert.match(appSource, /examCorrectionOverLimitPart\(question, correctionInput\.value, key\)/,
    'the input handler refuses an edit with the same rule the save applies');
  assert.match(appSource, /id="exam-key-correct-length"/, 'the measured length is shown');
  // A refused over-limit correction must explain itself rather than surface as a
  // generic storage error: the handler routes through examCorrectionValidation.
  assert.match(appSource, /examCorrectionValidation\(question,/);
  assert.match(appSource, /validation\.reason === 'too-long'/);
});

test('r8 persistence: importing a backup after Clear restores it, because the learner asked for it', async () => {
  // Tombstones exist so a *stale tab* cannot resurrect deleted data. An explicit
  // import is the opposite actor: the learner chose the file. If the tombstone won
  // there, "Clear all" then "Import" would silently import nothing.
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  await save(app.addExamResult(boot, attempt('backup-attempt', 5000)), boot, store);
  const withCorrection = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
    examId: record.id, questionId: questions[0].id, candidates: ['backup-correction'], now: 5100
  });
  assert.equal(withCorrection.ok, true);
  await save(withCorrection.history, app.loadExamResultHistory(store), store);
  const exported = app.exportExamResultHistory(app.loadExamResultHistory(store));

  const beforeClear = app.loadExamResultHistory(store);
  await save(app.clearExamResultHistory(beforeClear), beforeClear, store);
  assert.deepEqual(stored(store).attempts, [], 'the Clear really removed the attempt');

  const imported = await app.importExamResultHistory(exported, store);
  assert.equal(imported.ok, true, `import must succeed (reason: ${imported.reason})`);
  assert.deepEqual(stored(store).attempts.map(item => item.id), ['backup-attempt'],
    'the backup the learner explicitly imported is restored');
  assert.deepEqual(stored(store).corrections.map(item => item.id), [withCorrection.correction.id],
    'and the correction travels with it, as the export/import round trip promises');

  // The stale-tab guarantee is untouched: a tab that still holds a record deleted
  // *after* the import still cannot write it back.
  const staleTab = app.loadExamResultHistory(store);
  const deleted = app.loadExamResultHistory(store);
  await save(app.deleteExamResult(deleted, 'backup-attempt'), deleted, store);
  const back = await save(app.addExamResult(staleTab, attempt('unrelated', 8000)), staleTab, store);
  assert.equal(back.ok, true);
  assert.deepEqual(stored(store).attempts.map(item => item.id), ['unrelated']);
});

// ---------------------------------------------------------------------------
// Findings from the CodeRabbit review of PR #85. Each test fails against the
// code as reviewed and passes against the fix, so the thread is closed by a
// check rather than by an argument.
// ---------------------------------------------------------------------------

test('r8 review: the Web Locks path is exercised, not just the fallback', async () => {
  // The fallback test alone would keep passing if the app stopped asking for a
  // lock at all. This installs a controllable facade and asserts what the app
  // actually requests, what it reports, and that a second save waits.
  const calls = [];
  let running = 0;
  let peakRunning = 0;
  let busy = false;
  let overlapped = false;
  const waiters = [];
  let releaseFirst;
  const held = new Promise(resolve => { releaseFirst = resolve; });
  const original = globalThis.navigator;
  Object.defineProperty(globalThis, 'navigator', {
    value: {
      locks: {
        // A real exclusive lock: a second request is not granted while the first
        // holds it. Calls are counted when *requested*, runs when *entered*, so
        // the test can tell "asked for the lock" from "started the critical
        // section" - the difference the fallback test cannot observe.
        request: async (name, options, run) => {
          calls.push({ name, mode: options?.mode });
          while (busy) await new Promise(resolve => waiters.push(resolve));
          busy = true;
          try {
            if (calls.length === 1) await held;
            running += 1;
            peakRunning = Math.max(peakRunning, running);
            if (running > 1) overlapped = true;
            try { return await run(); } finally { running -= 1; }
          } finally {
            busy = false;
            waiters.shift()?.();
          }
        }
      }
    },
    configurable: true,
    writable: true
  });
  try {
    assert.equal(app.examHistoryLockSupport().available, true);
    const { store } = makeStore();
    const base = app.loadExamResultHistory(store);
    const first = save(app.addExamResult(base, attempt('lock-1', 5000)), base, store);
    // Let the first save reach the lock, then start a second one.
    await new Promise(resolve => setTimeout(resolve, 0));
    const second = save(app.addExamResult(base, attempt('lock-2', 6000)), base, store);
    await new Promise(resolve => setTimeout(resolve, 10));
    // Both saves have *asked* for the lock, but only one is inside the critical
    // section: that is what exclusive means, and it is the property the fallback
    // test could not observe.
    assert.equal(calls.length, 2, 'both saves asked for the lock');
    // Neither critical section has started: the lock is held by this test, so a
    // save that ran here would have ignored the lock entirely.
    assert.equal(running, 0, 'nothing runs while the lock is held');
    releaseFirst();
    const [a, b] = await Promise.all([first, second]);
    assert.equal(a.ok, true);
    assert.equal(b.ok, true);
    assert.equal(a.mode, 'locked');
    assert.equal(b.mode, 'locked');
    assert.equal(calls[0].name, 'chuyen-anh.exam-results.v1');
    assert.equal(calls[0].mode, 'exclusive');
    assert.equal(overlapped, false, 'the critical sections never overlapped');
    assert.equal(peakRunning, 1, 'and only ever one ran at a time');
    assert.deepEqual(stored(store).attempts.map(item => item.id).sort(), ['lock-1', 'lock-2']);
  } finally {
    Object.defineProperty(globalThis, 'navigator', { value: original, configurable: true, writable: true });
  }
});

test('r8 review: an empty string in the store is unreadable, not an empty history', async () => {
  const { store } = makeStore();
  const base = app.loadExamResultHistory(store);
  store.setItem(KEY, '');
  assert.equal(app.inspectExamResultStore(store).status, 'unreadable',
    'a blank value is a present-but-unreadable store, not an absent key');
  const result = await save(app.addExamResult(base, attempt('after-blank', 5000)), base, store);
  assert.equal(result.ok, false);
  assert.equal(result.reason, 'store-invalid-json');
  assert.equal(app.inspectExamResultStore(store).status, 'unreadable',
    'the blank value is still there; it was refused, not overwritten');
});

test('r8 review: two 700-character answers are accepted, the limit is per answer', () => {
  const text = questions.find(question => question.responseType === 'text') || questions[0];
  const long = 'x'.repeat(700);
  const validation = app.examCorrectionValidation(text, `${long}; ${long}`);
  assert.equal(validation.ok, true, 'each answer is within the limit');
  assert.equal(validation.candidates[0], long);
  assert.deepEqual(validation.acceptedAlternatives, [long]);
  // The measured length in a refusal is the length of the offending answer.
  const refused = app.examCorrectionValidation(text, `${long}; ${'y'.repeat(1001)}`);
  assert.equal(refused.reason, 'too-long');
  assert.equal(refused.length, 1001);
});

test('r8 review: a legacy over-limit accepted alternative is preserved, not refused', async () => {
  const target = questions[0];
  const { store } = makeStore();
  // A correction needs a paper snapshot to target, and the snapshot arrives with
  // the first saved attempt (this is why the migration test seeds one too).
  const boot = app.loadExamResultHistory(store);
  assert.equal((await save(app.addExamResult(boot, attempt('legacy-alt-attempt', 4000)), boot, store)).ok, true);
  const seeded = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
    examId: record.id, questionId: target.id, candidates: ['short'], now: 5000
  });
  assert.equal(seeded.ok, true);
  const raw = JSON.parse(JSON.stringify(seeded.history));
  // Exactly the shape the uncapped input could create: a long *alternative*.
  raw.corrections[0].acceptedAlternatives = ['z'.repeat(1400)];
  delete raw.corrections[0].legacyOverLimit;
  store.setItem(KEY, JSON.stringify(raw));
  const loaded = app.loadExamResultHistory(store);
  assert.equal(loaded.corrections.length, 1, 'the historical record is not dropped');
  assert.deepEqual(loaded.corrections[0].acceptedAlternatives, ['z'.repeat(1400)], 'and not truncated');
  assert.equal(loaded.corrections[0].legacyOverLimit, true, 'it is tagged');
});

test('r8 review: an import replaces a same-id correction instead of failing', async () => {
  const { store } = makeStore();
  const target = questions[0];
  const boot = app.loadExamResultHistory(store);
  assert.equal((await save(app.addExamResult(boot, attempt('import-target', 4000)), boot, store)).ok, true);
  // The learner corrects the key, exports, clears, then edits the same question
  // again and imports the older backup: both carry one id (exam+question).
  const first = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
    examId: record.id, questionId: target.id, candidates: ['from-backup'], now: 5000
  });
  assert.equal((await save(first.history, app.loadExamResultHistory(store), store)).ok, true);
  const backup = app.exportExamResultHistory(app.loadExamResultHistory(store));
  const edited = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
    examId: record.id, questionId: target.id, candidates: ['edited-later'], now: 6000, replace: true
  });
  assert.equal((await save(edited.history, app.loadExamResultHistory(store), store)).ok, true);
  const imported = await app.importExamResultHistory(backup, store);
  assert.equal(imported.ok, true, 'the chosen backup is restorable, not a conflict');
  const after = stored(store);
  assert.equal(after.corrections.length, 1);
  assert.deepEqual(after.corrections[0].candidates, ['from-backup'],
    'the imported file wins for the ids it carries, because the learner chose it');
});

test('r8 review: a newer correction from another tab is not overwritten by a stale one', async () => {
  const { store } = makeStore();
  const target = questions[0];
  const boot = app.loadExamResultHistory(store);
  assert.equal((await save(app.addExamResult(boot, attempt('stale-tab-seed', 4000)), boot, store)).ok, true);
  const seeded = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
    examId: record.id, questionId: target.id, candidates: ['v1'], now: 5000
  });
  assert.equal((await save(seeded.history, app.loadExamResultHistory(store), store)).ok, true);

  // Tab A snapshots the history, then tab B edits the same correction.
  const tabA = stored(store);
  const edited = app.applyExamKeyCorrection(stored(store), {
    examId: record.id, questionId: target.id, candidates: ['v2-newer'], now: 7000, replace: true
  });
  assert.equal((await save(edited.history, stored(store), store)).ok, true);

  // Tab A now saves something unrelated. Its stale correction must not win.
  const tabASave = await save(app.addExamResult(tabA, attempt('tab-a-attempt', 8000)), tabA, store);
  assert.equal(tabASave.ok, true);
  const after = stored(store);
  assert.deepEqual(after.corrections[0].candidates, ['v2-newer'], 'the newer edit survives');
  assert.ok(after.attempts.some(item => item.id === 'tab-a-attempt'), 'and the new attempt is kept too');
});

test('r8 review: a Clear that is overwritten by a stale tab is detected, not reported as success', async () => {
  // Unlocked mode, and the stale write lands *after* the clear's verification.
  // Nothing the previous checks looked at can see this: a Clear writes no attempt,
  // and the overwrite removes the very tombstones the resurrection check reads.
  const { store } = makeStore();
  const base = app.loadExamResultHistory(store);
  const filled = app.addExamResult(base, attempt('doomed', 5000));
  assert.equal((await save(filled, base, store)).ok, true);
  const seenByStaleTab = stored(store);

  const cleared = app.clearExamResultHistory(seenByStaleTab);
  const clearSave = await save(cleared, seenByStaleTab, store);
  assert.equal(clearSave.ok, true);
  assert.equal(app.inspectExamResultStore(store).history.generation, 1, 'the clear bumped the generation');

  // Now the stale tab writes its pre-clear state back, as an interleaving would.
  store.setItem(KEY, JSON.stringify(seenByStaleTab));
  // A later save must notice the store went backwards rather than accept the
  // resurrected attempt as someone else's legitimate record.
  const later = await save(app.addExamResult(cleared, attempt('after-clear', 9000)), cleared, store);
  assert.equal(later.ok, false, 'the resurrected store is reported, not silently accepted');
  assert.equal(later.reason, 'lost-clear');
  assert.ok(!stored(store).attempts.some(item => item.id === 'after-clear'),
    'and nothing was written over the store while it is in that state');
});

// ---------------------------------------------------------------------------
// Findings from the Copilot review of PR #85. Each test targets one claim and
// fails against the code as reviewed.
// ---------------------------------------------------------------------------

test('r8 copilot: a delete is detectable after a stale overwrite, because it bumps generation', async () => {
  // A delete writes a tombstone, but a stale overwrite carries the pre-delete copy
  // - tombstones and all - so the tombstone is gone by the time the read-back runs.
  // The monotonic marker is what survives, and it is what the tab that observed the
  // delete can compare against. (A tab that never observed the delete cannot be
  // protected by any counter - that limitation is stated in DESIGN_LOG.md.)
  const { store } = makeStore();
  const base = app.loadExamResultHistory(store);
  assert.equal((await save(app.addExamResult(base, attempt('del-me', 5000)), base, store)).ok, true);
  const seen = stored(store);
  assert.equal(seen.generation, 0);
  const deleted = await save(app.deleteExamResult(seen, 'del-me'), seen, store);
  assert.equal(deleted.ok, true);
  const afterDelete = stored(store);
  assert.equal(afterDelete.generation, 1, 'the delete bumped generation');
  assert.equal(afterDelete.attempts.length, 0);
  assert.equal(afterDelete.tombstones.attempts.length, 1, 'and recorded the tombstone');

  // A stale tab writes its pre-delete copy back over the store.
  store.setItem(KEY, JSON.stringify(seen));
  assert.equal(app.inspectExamResultStore(store).history.generation, 0, 'the store went backwards');
  // The tab that observed the delete now saves: it must report the loss, not merge
  // the resurrected attempt back in as if it were someone else's new record.
  const later = await save(app.addExamResult(afterDelete, attempt('later', 9000)), afterDelete, store);
  assert.equal(later.ok, false, 'the lost delete is reported instead of absorbed');
  assert.equal(later.reason, 'lost-clear');
});

test('r8 copilot: a stale save keeps the stored attempt, and a substituted one is refused', async () => {
  // Two different things can change a stored attempt under one id, and they need
  // opposite answers:
  //  - a re-score rewrites only the derived score, which the merge recomputes
  //    anyway, so the stored record is the newer truth and must not be replaced by
  //    a stale tab's copy;
  //  - a concurrent import (or a hand-edited store) can substitute a record whose
  //    *identity* moved - answers, timestamps - which is a different attempt wearing
  //    the same id. Adopting it would make it the learner's saved result, and
  //    overwriting it would discard the other writer's data, so it is reported.
  const { store } = makeStore();
  const base = app.loadExamResultHistory(store);
  assert.equal((await save(app.addExamResult(base, attempt('shared-id', 5000)), base, store)).ok, true);
  const tabA = stored(store);

  // (a) legitimate re-score: same identity, different derived score. The store's
  // own validator refuses a summary that does not reproduce from its answers
  // (`store-score-mismatch`), which is the honest answer for a hand-edited store
  // and is covered in the scoring suite. What matters here is that the score path
  // is *not* confused with substitution: a re-score keeps the identity, so it can
  // never be mistaken for a different attempt wearing the same id.
  const rescored = JSON.parse(JSON.stringify(stored(store)));
  rescored.attempts[0].summary = { ...rescored.attempts[0].summary, percentage: 42, scale10: 4.2 };
  store.setItem(KEY, JSON.stringify(rescored));
  const out = await save(app.addExamResult(tabA, attempt('unrelated', 7000)), tabA, store);
  assert.equal(out.ok, false);
  assert.equal(out.reason, 'store-score-mismatch', 'an unreproducible stored score is refused, not adopted');
  // Restore a store the app itself produced before testing substitution.
  store.setItem(KEY, JSON.stringify(tabA));

  // (b) substitution: the same id whose identity moved. `submittedAt` is part of
  // the identity and not part of scoring, so the stored history still validates -
  // this is the shape a concurrent import produces, not a corrupt store.
  const tabB = stored(store);
  const swapped = JSON.parse(JSON.stringify(stored(store)));
  swapped.attempts.find(item => item.id === 'shared-id').submittedAt = 999999;
  store.setItem(KEY, JSON.stringify(swapped));
  const conflicted = await save(app.addExamResult(tabB, attempt('another', 8000)), tabB, store);
  assert.equal(conflicted.ok, false, 'a substituted attempt is not adopted as our own save');
  assert.equal(conflicted.reason, 'conflicting-attempt');
  assert.equal(
    stored(store).attempts.find(item => item.id === 'shared-id').submittedAt,
    999999,
    'and neither copy is silently overwritten'
  );
});

test('r8 copilot: a claim this operation makes is not silently dropped by a tombstone', async () => {
  const { store } = makeStore();
  const boot = app.loadExamResultHistory(store);
  assert.equal((await save(app.addExamResult(boot, attempt('shared', 5000)), boot, store)).ok, true);
  const target = questions[0];
  const withCorrection = app.applyExamKeyCorrection(stored(store), {
    examId: record.id, questionId: target.id, candidates: ['v1'], now: 5100
  });
  assert.equal(withCorrection.ok, true);
  assert.equal((await save(withCorrection.history, stored(store), store)).ok, true);
  const tabBase = stored(store);

  // Another tab deletes the attempt and the correction it backed (delete-wins).
  const trashed = app.deleteExamResult(tabBase, 'shared');
  assert.equal((await save(trashed, tabBase, store)).ok, true);

  // This tab edits the correction and saves. The tombstone removes it; the caller
  // must be told rather than shown "saved" for a record that is not stored.
  const edited = app.applyExamKeyCorrection(tabBase, {
    examId: record.id, questionId: target.id, candidates: ['v2-edited'], now: 9000, replace: true
  });
  assert.equal(edited.ok, true);
  const out = await save(edited.history, tabBase, store);
  assert.equal(out.ok, false, 'the discarded claim is reported');
  assert.equal(out.reason, 'tombstoned-claim');
  assert.equal(stored(store).corrections.length, 0, 'and the deleted record stays deleted');
});

test('r8 copilot: the legacy writer cannot overwrite an unreadable store', () => {
  const { store } = makeStore();
  const base = app.loadExamResultHistory(store);
  const built = app.addExamResult(base, attempt('legacy-write', 5000));
  store.setItem(KEY, '{not json');
  assert.equal(app.saveExamResultHistory(built, store), false,
    'the legacy synchronous writer refuses what the async path refuses');
  assert.equal(app.inspectExamResultStore(store).reason, 'invalid-json',
    'and the unreadable value is untouched');
});

test('r8 copilot: the correction input actually reverts an over-limit edit', () => {
  const text = questions.find(question => question.responseType === 'text') || questions[0];
  const valid = 'x'.repeat(1000);
  const overLimit = 'x'.repeat(1001);
  // Typing the 1,001st character must leave the field holding the last valid value,
  // not the over-limit text with trailing whitespace trimmed.
  assert.equal(app.examCorrectionAcceptedInput(text, overLimit, valid), valid);
  assert.equal(app.examCorrectionAcceptedInput(text, 'short', valid), 'short');
  // A paste of two answers each within the limit is still accepted, and a paste of
  // an over-limit *alternative* is refused as a whole - the rule is per answer.
  assert.equal(app.examCorrectionAcceptedInput(text, `${'a'.repeat(700)}; ${'b'.repeat(700)}`, ''), `${'a'.repeat(700)}; ${'b'.repeat(700)}`);
  assert.equal(app.examCorrectionAcceptedInput(text, `${'a'.repeat(700)}; ${'b'.repeat(1001)}`, `${'a'.repeat(700)}; ok`), `${'a'.repeat(700)}; ok`);
});

test('r8 review 2: an over-limit edit does not erase a preloaded legacy correction', () => {
  // A legacy correction is over the limit and is preloaded into the field. Because
  // it is not "valid", it is never recorded as the last valid value, so falling
  // back to '' would clear the learner's whole answer on the first over-limit
  // keystroke (CodeRabbit, PR #85, second review). The rule must fall back to the
  // value the field was rendered with.
  const text = questions.find(question => question.responseType === 'text') || questions[0];
  const legacy = 'x'.repeat(1200);
  const typed = `${legacy}y`;
  // `examCorrectionRestoreValue` is what the handler calls to choose the fallback.
  assert.equal(app.examCorrectionRestoreValue(undefined, legacy), legacy,
    'the preloaded text comes back, not an empty field');
  assert.equal(app.examCorrectionRestoreValue(undefined, undefined), '');
  assert.equal(app.examCorrectionRestoreValue('typed-ok', legacy), 'typed-ok',
    'once a valid edit exists it is the better fallback');
  // And the accept rule still refuses to keep the over-limit text itself.
  assert.equal(app.examCorrectionAcceptedInput(text, typed, app.examCorrectionRestoreValue(undefined, legacy)), legacy);
  assert.notEqual(app.examCorrectionAcceptedInput(text, typed, legacy), typed);
});
