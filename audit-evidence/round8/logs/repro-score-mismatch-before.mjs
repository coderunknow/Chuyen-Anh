// HISTORICAL REPRO — runs against the API as it existed at e663295, where
// `persistExamResultHistory` was synchronous and threw on a conflict.
//
// It is kept verbatim because its output is the "before" half of a before/after
// pair (logs/repro-score-mismatch-at-start-sha.log). It MUST NOT be reused against
// the current tree: the API is async, so `=== false` and a try/catch around an
// un-awaited call cannot observe `{ ok: false }`. The reusable version is
// `repro-score-mismatch-await.mjs` (CodeRabbit, PR #85).
import { readFile } from 'node:fs/promises';
const html = await readFile('index.html', 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const record = records[0];
const questions = app.parseExamQuestions(record.markdown, record.id);
const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
function store(initial = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
}
function build(id, submittedAt) {
  const session = app.createExamPracticeSession(record.id, questions.slice(0, 2), submittedAt - 10);
  for (const q of questions.slice(0, 2)) app.recordExamPracticeResponse(session, q.id, q.options?.[0]?.id ?? 'x');
  app.submitExamPractice(session, submittedAt);
  return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
}
const inner = store();
// 1. attempt A1 and a correction C exist.
let h = app.addExamResult(app.emptyExamResultHistory(), build('a1', 5000));
const corrected = app.applyExamKeyCorrection(h, { examId: record.id, questionId: questions[0].id, candidates: ['probe-answer'], now: 5100 });
h = corrected.history;
console.log('save base+c:', app.saveExamResultHistory(h, inner));
// 2. tab B boots (its base contains C and a1).
const tabB = app.loadExamResultHistory(inner);
console.log('tabB corrections:', tabB.corrections.length, 'attempts:', tabB.attempts.map(a=>a.id));
// 3. tab A (also booted with C) submits a2, scored WITH the correction in force.
const tabA = app.loadExamResultHistory(inner);
const nextA = app.addExamResult(tabA, build('a2', 6000));
const first = app.persistExamResultHistory(nextA, tabA, inner);
console.log('tabA save:', first === false ? 'FALSE' : 'ok');
// 4. tab B submits b1 using its older in-memory base.
const nextB = app.addExamResult(app.addExamResult(tabB, build('b1', 7000)), build('a2', 6000)); // tabB doesn't know a2 -> do not fabricate; keep it honest
const nextB2 = app.addExamResult(tabB, build('b1', 7000));
let out;
try { out = app.persistExamResultHistory(nextB2, tabB, inner); } catch (e) { out = 'THREW: ' + e.message; }
console.log('tabB save:', typeof out === 'string' ? out : (out === false ? 'FALSE' : 'ok'));
console.log('stored ids after:', app.loadExamResultHistory(inner).attempts.map(a=>a.id));
