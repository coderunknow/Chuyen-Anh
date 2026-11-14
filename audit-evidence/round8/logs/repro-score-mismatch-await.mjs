// The score-mismatch repro, written for the API that exists now: every save is
// awaited and both `ok` and `reason` are reported, because a Promise is always
// truthy and a try/catch around an un-awaited call catches nothing.
//
// Run against any revision's index.html:  node repro-score-mismatch-await.mjs [path]
import { readFile } from 'node:fs/promises';
const target = process.argv[2] || 'index.html';
const html = await readFile(target, 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const record = records[0];
const questions = app.parseExamQuestions(record.markdown, record.id);
const keys = Array.isArray(record.answerKey) ? record.answerKey : [];

const store = () => {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
};
const build = (id, submittedAt) => {
  const session = app.createExamPracticeSession(record.id, questions.slice(0, 2), submittedAt - 10);
  for (const q of questions.slice(0, 2)) app.recordExamPracticeResponse(session, q.id, q.options?.[0]?.id ?? 'x');
  app.submitExamPractice(session, submittedAt);
  return app.createExamResultRecord(session, record, keys, { now: submittedAt, id });
};
// --- guarded call: every persistence result is awaited and inspected ---------
const report = async (label, run) => {
  let result;
  try { result = await run(); }
  catch (error) { console.log(`${label}: THREW: ${error?.message}`); return null; }
  const summary = result && typeof result === 'object' ? `ok=${result.ok}${result.ok ? '' : ` reason=${result.reason}`}` : `result=${String(result)}`;
  console.log(`${label}: ${summary}`);
  return result;
};

const disk = store();
// 1. An attempt and a correction exist.
let history = app.addExamResult(app.emptyExamResultHistory(), build('a1', 5000));
const corrected = app.applyExamKeyCorrection(history, { examId: record.id, questionId: questions[0].id, candidates: ['probe-answer'], now: 5100 });
history = corrected.history;
// This seeding step is what a save does on the pre-round-8 API: it is synchronous
// there and async here, so it is awaited through the same guard.
await report('seed base+c', () => app.persistExamResultHistory(history, app.emptyExamResultHistory(), disk));
if (!app.loadExamResultHistory(disk).attempts.length) app.saveExamResultHistory(history, disk);

// 2. Tab B boots with the correction in force.
const tabB = app.loadExamResultHistory(disk);
console.log(`tabB booted with corrections=${tabB.corrections.length} attempts=${tabB.attempts.map(a => a.id).join(',') || '(none)'}`);

// 3. Tab A (booted with the correction) submits a2, scored with it.
const tabA = app.loadExamResultHistory(disk);
await report('tabA save a2', () => app.persistExamResultHistory(app.addExamResult(tabA, build('a2', 6000)), tabA, disk));

// 4. Tab B submits b1 from its older base. Tab B's copy drops nothing it never
//    saw; the question is whether the merge keeps both facts.
await report('tabB save b1', () => app.persistExamResultHistory(app.addExamResult(tabB, build('b1', 7000)), tabB, disk));
console.log(`stored ids after: ${app.loadExamResultHistory(disk).attempts.map(a => a.id).join(',') || '(none)'}`);
