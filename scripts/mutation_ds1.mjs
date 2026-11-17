// Mutation controls for the fixed exam-persistence mode assertion (D-SR1).
// Mutant A: app always reports 'locked' -> must FAIL on a lockless context.
// Mutant B: app always reports 'unserialized' -> must FAIL on a locking context.
import { readFile } from 'node:fs/promises';

const originalNavigator = globalThis.navigator;
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];

async function runCase(mutant, envKind) {
  let src = appSource;
  if (mutant === 'always-locked') {
    src = src.replace("return { ...result, mode: 'unserialized' };", "return { ...result, mode: 'locked' };");
  } else if (mutant === 'always-unserialized') {
    src = src.replace("return { ...result, mode: 'locked' };\n    });", "return { ...result, mode: 'unserialized' };\n    });");
  }
  if (mutant && src === appSource) throw new Error(`mutant ${mutant} did not change the source`);
  const app = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
  if (envKind === 'lockless') {
    // Strip navigator.locks for this import context via a stub the module reads lazily.
    Object.defineProperty(globalThis, 'navigator', { value: {}, configurable: true, writable: true });
  } else {
    Object.defineProperty(globalThis, 'navigator', { value: originalNavigator, configurable: true, writable: true });
  }
  const KEY = 'chuyen-anh.exam-results.v1';
  const records = JSON.parse(html.match(/<script id="exam-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
  const record = records[0];
  const questions = app.parseExamQuestions(record.markdown, record.id);
  const keys = Array.isArray(record.answerKey) ? record.answerKey : [];
  const data = new Map();
  const store = {
    getItem: k => (data.has(k) ? data.get(k) : null),
    setItem: (k, v) => data.set(k, v),
    removeItem: k => data.delete(k)
  };
  const base = app.loadExamResultHistory(store);
  const chosen = questions.slice(0, 2);
  const session = app.createExamPracticeSession(record.id, chosen, 4990);
  for (const q of chosen) app.recordExamPracticeResponse(session, q.id, q.options?.[0]?.id ?? 'x');
  app.submitExamPractice(session, 5000);
  const rec = app.createExamResultRecord(session, record, keys, { now: 5000, id: 'mutant-a1' });
  const result = await app.persistExamResultHistory(app.addExamResult(base, rec), base, store);
  const lockAvailable = app.examHistoryLockSupport().available;
  const expected = lockAvailable ? 'locked' : 'unserialized';
  const pass = result.ok === true && result.mode === expected;
  console.log(`mutant=${mutant || 'none'} env=${envKind} lockAvailable=${lockAvailable} mode=${result.mode} => ${pass ? 'PASS' : 'FAIL(detected)'}`);
  return pass;
}

const results = [];
results.push(await runCase(null, 'locking'));
results.push(await runCase(null, 'lockless'));
results.push(await runCase('always-locked', 'lockless'));       // must be false (caught)
results.push(await runCase('always-unserialized', 'locking')); // must be false (caught)
const ok = results[0] && results[1] && !results[2] && !results[3];
console.log(ok ? 'MUTATION-CONTROLS: OK (both mutants caught, both honest contexts pass)' : 'MUTATION-CONTROLS: FAILED');
process.exit(ok ? 0 : 1);
