// jsdom probe of the exam-history *model* API, not the rendered UI.
//
// It calls the exported functions the UI calls (submit -> correct -> clear ->
// malformed import -> valid import) against jsdom's `localStorage`, in a context
// with no Web Locks. It does not dispatch DOM events, read rendered controls or
// assert anything about focus/layout: it is a substitute for the parts of the
// browser suite that only exercise model+storage, and it is NOT a browser result
// (FAILURE_LEDGER.md F7).
import { readFile } from 'node:fs/promises';
// The probe needs jsdom, which is not a dependency of this repo: it is resolved
// from wherever the operator installed it. Fail with an instruction, not a
// module-resolution stack trace.
const JSDOM_PATH = process.env.JSDOM_PATH || '/tmp/r8/node_modules/jsdom/lib/api.js';
const { JSDOM } = await import(JSDOM_PATH).catch(() => {
  console.error(`jsdom is not installed at ${JSDOM_PATH}. Install it (npm i jsdom) and set JSDOM_PATH to its lib/api.js.\nThis probe is not a repo dependency; see audit-evidence/round8/EVIDENCE_MANIFEST.md.`);
  process.exit(2);
});

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

console.log(fails ? `\n${fails} check(s) failed` : '\nall model-API checks passed (not a browser result)');
process.exit(fails ? 1 : 0);
