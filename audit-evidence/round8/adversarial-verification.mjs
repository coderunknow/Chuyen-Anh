// Ad-hoc adversarial probe for the round-8 persistence layer, covering the
// interleavings the Node suite drives *and* the ones it cannot express through a
// single-threaded test file (a peer writing between the read and the write of a
// different tab, repeatedly).
//
// Run: node audit-evidence/round8/adversarial-verification.mjs
// It prints one line per scenario and exits non-zero when a scenario disagrees.
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const KEY = 'chuyen-anh.exam-results.v1';
const record = records[0];
const questions = app.parseExamQuestions(record.markdown, record.id);
const keys = Array.isArray(record.answerKey) ? record.answerKey : [];

function store(data = new Map(), hook = null) {
  return {
    getItem: key => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => {
      data.set(key, value);
      if (hook && key === KEY) hook(data);
    },
    removeItem: key => data.delete(key),
    data
  };
}

function attempt(id, submittedAt) {
  const chosen = questions.slice(0, 2);
  const session = app.createExamPracticeSession(record.id, chosen, submittedAt - 10);
  for (const question of chosen) app.recordExamPracticeResponse(session, question.id, question.options?.[0]?.id ?? 'x');
  app.submitExamPractice(session, submittedAt);
  return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
}

let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) failures += 1;
};

// 1. Two tabs, different attempts, interleaved writes.
{
  const s = store();
  const a = app.loadExamResultHistory(s);
  const b = app.loadExamResultHistory(s);
  const [ra, rb] = await Promise.all([
    app.persistExamResultHistory(app.addExamResult(a, attempt('i-a', 5000)), a, s),
    app.persistExamResultHistory(app.addExamResult(b, attempt('i-b', 6000)), b, s)
  ]);
  const ids = app.loadExamResultHistory(s).attempts.map(x => x.id).sort();
  check('interleaved submissions keep both', ra.ok && rb.ok && ids.join() === 'i-a,i-b', ids.join());
}

// 2. A peer writes after every write, endlessly: the bounded repair must either win
//    or report failure — never report success with the record missing.
{
  const inner = store();
  const seed = app.loadExamResultHistory(inner);
  await app.persistExamResultHistory(app.addExamResult(seed, attempt('peer-1', 5000)), seed, inner);
  const stale = inner.data.get(KEY);
  const hostile = store(inner.data, data => data.set(KEY, stale)); // always revert
  const tab = app.loadExamResultHistory(hostile);
  const result = await app.persistExamResultHistory(app.addExamResult(tab, attempt('doomed', 6000)), tab, hostile);
  const present = app.loadExamResultHistory(inner).attempts.some(x => x.id === 'doomed');
  check('a peer that always wins yields failure, not a false success', !result.ok && !present,
    `ok=${result.ok} present=${present} reason=${result.reason}`);
}

// 3. Delete then resurrect attempt: tombstone wins, every time, in both directions.
{
  const s = store();
  const seed = app.loadExamResultHistory(s);
  await app.persistExamResultHistory(app.addExamResult(seed, attempt('victim', 5000)), seed, s);
  const staleTab = app.loadExamResultHistory(s);
  const before = app.loadExamResultHistory(s);
  await app.persistExamResultHistory(app.deleteExamResult(before, 'victim'), before, s);
  const back = await app.persistExamResultHistory(app.addExamResult(staleTab, attempt('other', 7000)), staleTab, s);
  const ids = app.loadExamResultHistory(s).attempts.map(x => x.id);
  check('deleted attempt does not return via a stale tab', back.ok && ids.join() === 'other', ids.join());
}

// 4. Clear, then a legitimate new attempt from a tab that still lists the cleared ones.
{
  const s = store();
  const seed = app.loadExamResultHistory(s);
  const withTwo = app.addExamResult(app.addExamResult(seed, attempt('c1', 5000)), attempt('c2', 6000));
  await app.persistExamResultHistory(withTwo, seed, s);
  const staleTab = app.loadExamResultHistory(s);
  const clearing = app.loadExamResultHistory(s);
  await app.persistExamResultHistory(app.clearExamResultHistory(clearing), clearing, s);
  const res = await app.persistExamResultHistory(app.addExamResult(staleTab, attempt('fresh', 9000)), staleTab, s);
  const ids = app.loadExamResultHistory(s).attempts.map(x => x.id);
  check('Clear keeps the post-Clear attempt and drops the cleared ones', res.ok && ids.join() === 'fresh', ids.join());
}

// 5. Corrections from two tabs to different questions of one exam both survive.
{
  const s = store();
  const seed = app.loadExamResultHistory(s);
  await app.persistExamResultHistory(app.addExamResult(seed, attempt('cx', 5000)), seed, s);
  const t1 = app.loadExamResultHistory(s);
  const t2 = app.loadExamResultHistory(s);
  const c1 = app.applyExamKeyCorrection(t1, { examId: record.id, questionId: questions[0].id, candidates: ['x1'], now: 5100 });
  const c2 = app.applyExamKeyCorrection(t2, { examId: record.id, questionId: questions[1].id, candidates: ['x2'], now: 5200 });
  const [r1, r2] = await Promise.all([
    app.persistExamResultHistory(c1.history, t1, s),
    app.persistExamResultHistory(c2.history, t2, s)
  ]);
  const final = app.loadExamResultHistory(s);
  check('two corrections to different questions coexist',
    r1.ok && r2.ok && final.corrections.length === 2 && app.validateExamResultHistory(final).ok,
    `corrections=${final.corrections.length}`);
}

// 6. A window of repeated concurrent saves must converge to a self-consistent store.
{
  const s = store();
  const tabs = [app.loadExamResultHistory(s), app.loadExamResultHistory(s), app.loadExamResultHistory(s)];
  const results = await Promise.all(tabs.map((tab, index) =>
    app.persistExamResultHistory(app.addExamResult(tab, attempt(`burst-${index}`, 5000 + index * 10)), tab, s)));
  const final = app.loadExamResultHistory(s);
  check('a burst of three concurrent saves stays valid and loses nothing obvious',
    results.every(r => r.ok) && app.validateExamResultHistory(final).ok && final.attempts.length >= 1,
    `attempts=${final.attempts.map(x => x.id).join(',')}`);
}

// 7. The correction limit is one rule, not four: all four boundaries agree.
{
  const target = { id: 'q-limit-probe', number: 1, prompt: 'p', responseType: 'text', options: [], flags: [] };
  const atLimit = 'a'.repeat(1000);
  const over = 'a'.repeat(1001);
  const boundary = [
    app.examCorrectionExceedsLimit(atLimit) === false,
    app.examCorrectionExceedsLimit(over) === true,
    app.examCorrectionCandidates(target, atLimit) !== null,
    app.examCorrectionCandidates(target, over) === null,
    app.examCorrectionValidation(target, atLimit).ok === true,
    app.examCorrectionValidation(target, over).reason === 'too-long'
  ];
  check('the 1,000-character rule holds at every boundary', boundary.every(Boolean), boundary.join());
}

// 8. A store holding a record this build cannot read is never replaced by an empty one.
{
  const s = store(new Map([[KEY, '{"schemaVersion":1,"attempts":[]}']]));
  const before = s.data.get(KEY);
  const result = await app.persistExamResultHistory(app.addExamResult(app.emptyExamResultHistory(), attempt('nope', 5000)),
    app.emptyExamResultHistory(), s);
  check('an unreadable store is refused, not overwritten', !result.ok && s.data.get(KEY) === before, result.reason);
}

console.log(failures ? `\n${failures} scenario(s) failed` : '\nall scenarios passed');
process.exit(failures ? 1 : 0);
