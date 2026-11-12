// jsdom probe of the exam-history UI flow the browser suite asserts:
// submit -> correct -> reload -> export -> malformed import -> clear -> import.
import { readFile } from 'node:fs/promises';
import { JSDOM } from '/tmp/r8/node_modules/jsdom/lib/api.js';

const html = await readFile('index.html', 'utf8');
const dom = new JSDOM(html, { runScripts: 'outside-only', url: 'https://example.test/', pretendToBeVisual: true });
const { window } = dom;
let fails = 0;
const check = (name, ok, detail = '') => { console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`); if (!ok) fails += 1; };

// The store the app will use is jsdom's localStorage.
const KEY = 'chuyen-anh.exam-results.v1';
const store = window.localStorage;

const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
// Run inside the browser-like global so `localStorage` is the jsdom one.
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const record = records[0];
const questions = app.parseExamQuestions(record.markdown, record.id);
const keys = Array.isArray(record.answerKey) ? record.answerKey : [];

// jsdom has no indexedDB/navigator.locks: this is the file://-shaped fallback path.
check('jsdom context has no Web Locks (fallback path)', app.examHistoryLockSupport().supported !== true,
  JSON.stringify(app.examHistoryLockSupport()));

const chosen = questions.slice(0, 2);
const session = app.createExamPracticeSession(record.id, chosen, 5000);
for (const q of chosen) app.recordExamPracticeResponse(session, q.id, q.options?.[0]?.id ?? 'x');
app.submitExamPractice(session, 6000);
const attempt = app.createExamResultRecord(session, record, keys, { now: 6000, id: 'ui-attempt' });
const base = app.loadExamResultHistory(store);
const submitted = await app.persistExamResultHistory(app.addExamResult(base, attempt), base, store);
check('submit persists through the async API', submitted.ok && app.loadExamResultHistory(store).attempts.length === 1);

const corrected = app.applyExamKeyCorrection(app.loadExamResultHistory(store), {
  examId: record.id, questionId: chosen[0].id, candidates: ['ui-correction'], now: 6100
});
check('correction applies', corrected.ok);
const savedCorrection = await app.persistExamResultHistory(corrected.history, app.loadExamResultHistory(store), store);
check('correction persists', savedCorrection.ok);

const exported = app.exportExamResultHistory(app.loadExamResultHistory(store));
const before = app.loadExamResultHistory(store);
const cleared = await app.persistExamResultHistory(app.clearExamResultHistory(before), before, store);
check('clear empties the list', cleared.ok && app.loadExamResultHistory(store).attempts.length === 0);

const bad = await app.importExamResultHistory(JSON.stringify({ schemaVersion: 99, attempts: [{}] }), store);
check('malformed import is refused and changes nothing', !bad.ok && app.loadExamResultHistory(store).attempts.length === 0, bad.reason);

const good = await app.importExamResultHistory(exported, store);
check('valid import after clear restores the row', good.ok && app.loadExamResultHistory(store).attempts.length === 1,
  good.ok ? '' : good.reason);
check('the correction travels with the restored row', app.loadExamResultHistory(store).corrections.length === 1);

console.log(fails ? `\n${fails} check(s) failed` : '\nall UI-flow checks passed');
process.exit(fails ? 1 : 0);
