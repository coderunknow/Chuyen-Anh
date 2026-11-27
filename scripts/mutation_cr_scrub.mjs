#!/usr/bin/env node
// Mutation controls for the review-round scrubber regression tests
// (tests/telemetry-api.test.js and tests/static-app.test.js).
//
// For each mutant, the script breaks ONE review-round fix in the production
// source, runs the regression test, and requires the test to FAIL. A mutant
// that survives would mean the regression test does not actually guard the
// fix. The source file is restored afterwards in a `finally` block.
//
// Usage: node scripts/mutation_cr_scrub.mjs
// Exit 0 = every mutant killed; exit 1 = a mutant survived (the fix is not
// guarded); exit 2 = the environment could not run the check.

import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const SERVER = join(REPO, 'api', 'telemetry.js');
const CLIENT = join(REPO, 'index.html');

// --- the exact strings the fixes introduced (mutants are their inverse) -------
const SERVER_GITHUB =
  '[/\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\\b|\\bgithub_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}\\b/g';
const SERVER_BEARER = '[/\\bBearer\\s+[A-Za-z0-9._~+/-]+=*/gi';
// The fixed URL rule redacts the WHOLE user-info component (username, password,
// or both; either side may be empty and the colon may be absent).
const SERVER_URL = '[/([a-z][a-z0-9+.-]*:\\/\\/)[^\\s/@]+@/gi';
const SERVER_ORDER =
  '  // Secret patterns run before the quote split: an apostrophe inside URL\n' +
  "  // user-info (RFC 3986 allows it) would otherwise truncate the text before the\n" +
  "  // '@' is redacted, leaving the password prefix in the note.\n" +
  '  for (const [pattern, replacement] of SECRET_SHAPES) text = text.replace(pattern, replacement);\n' +
  '  text = text.split(QUOTE)[0];';

// Each mutant: the fixed text -> the deliberately broken text.
const SERVER_MUTANTS = [
  {
    name: 'server: fine-grained github_pat_ pattern removed',
    from: SERVER_GITHUB,
    to: '[/\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\\b/g'
  },
  {
    name: 'server: Bearer alphabet restricted again (+ / ~ and = rejected)',
    from: SERVER_BEARER,
    to: '[/\\bBearer\\s+[A-Za-z0-9._-]{12,}/gi'
  },
  {
    name: 'server: URL user-info requires a colon and a non-empty password again',
    from: SERVER_URL,
    to: '[/([a-z][a-z0-9+.-]*:\\/\\/)[^\\s/@]*:[^\\s/@]+@/gi'
  },
  {
    name: 'server: URL user-info drops the colon from the credential again (user:pass leaks)',
    from: SERVER_URL,
    to: '[/([a-z][a-z0-9+.-]*:\\/\\/)[^\\s/@:]+@/gi'
  },
  {
    name: 'server: quote split moved back before the secret loop',
    from: SERVER_ORDER,
    to: '  text = text.split(QUOTE)[0];\n  for (const [pattern, replacement] of SECRET_SHAPES) text = text.replace(pattern, replacement);'
  }
];

const CLIENT_GITHUB =
  '[/\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\\b|\\bgithub_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59}\\b/g';
const CLIENT_BEARER = '[/\\bBearer\\s+[A-Za-z0-9._~+/-]+=*/gi';
// Same rule as the server (kept in sync): the whole user-info component.
const CLIENT_URL = '[/([a-z][a-z0-9+.-]*:\\/\\/)[^\\s/@]+@/gi';
const CLIENT_ORDER =
  '  // Secret patterns run before the quote split: an apostrophe inside URL\n' +
  "  // user-info (RFC 3986 allows it) would otherwise truncate the text before the\n" +
  "  // '@' is redacted, leaving the password prefix in the note.\n" +
  '  for (const [pattern, replacement] of TELEMETRY_SECRET_SHAPES) text = text.replace(pattern, replacement);\n' +
  '  text = text.split(TELEMETRY_QUOTE)[0];';

const CLIENT_MUTANTS = [
  {
    name: 'client: fine-grained github_pat_ pattern removed',
    from: CLIENT_GITHUB,
    to: '[/\\b(?:ghp|gho|ghu|ghs|ghr)_[A-Za-z0-9]{16,}\\b/g'
  },
  {
    name: 'client: Bearer alphabet restricted again (+ / ~ and = rejected)',
    from: CLIENT_BEARER,
    to: '[/\\bBearer\\s+[A-Za-z0-9._-]{12,}/gi'
  },
  {
    name: 'client: URL user-info requires a colon and a non-empty password again',
    from: CLIENT_URL,
    to: '[/([a-z][a-z0-9+.-]*:\\/\\/)[^\\s/@]*:[^\\s/@]+@/gi'
  },
  {
    name: 'client: URL user-info drops the colon from the credential again (user:pass leaks)',
    from: CLIENT_URL,
    to: '[/([a-z][a-z0-9+.-]*:\\/\\/)[^\\s/@:]+@/gi'
  },
  {
    name: 'client: quote split moved back before the secret loop',
    from: CLIENT_ORDER,
    to: '  text = text.split(TELEMETRY_QUOTE)[0];\n  for (const [pattern, replacement] of TELEMETRY_SECRET_SHAPES) text = text.replace(pattern, replacement);'
  }
];

// The result of one mutant run: 'pass' (mutant survived), 'failed' (the
// regression suite completed and detected it), 'syntax' (the mutant broke the
// file so hard it no longer loads — the regression logic never ran, so this is
// NOT a detection and must not count as a kill), or 'infra' (timeout, signal
// termination or spawn error — not evidence either way). For execFileSync a
// completed non-zero exit has `error.status` as a number and no signal;
// timeouts arrive with `killed`/`signal`; spawn errors carry a string `code`.
const LOAD_FAILURE = /SyntaxError|ERR_INVALID|ERR_MODULE_NOT_FOUND|ERR_REQUIRE|ReferenceError|TypeError: (?:Invalid|Cannot)/;
function runTest(file, namePattern) {
  try {
    execFileSync('node', ['--test', `--test-name-pattern=${namePattern}`, file], {
      cwd: REPO,
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 300000,
      maxBuffer: 64 * 1024 * 1024
    });
    return 'pass'; // suite passed -> mutant survived
  } catch (error) {
    const completedFailure = typeof error.status === 'number' && error.status !== 0
      && error.killed !== true && !error.signal;
    if (!completedFailure) return 'infra';
    const output = `${error.stdout || ''}${error.stderr || ''}`;
    // A mutant that prevents the suite from loading has not been detected by
    // the regression assertions; only a real assertion failure is a kill.
    return LOAD_FAILURE.test(output) ? 'syntax' : 'failed';
  }
}

function applyAndRun(file, mutant, testFile, namePattern) {
  const original = readFileSync(file, 'utf8');
  if (!original.includes(mutant.from)) {
    console.error(`FIXTURE MISSING in ${file}: the fixed text for "${mutant.name}" was not found.`);
    console.error('The mutant script must mirror the production source exactly.');
    process.exit(2);
  }
  const broken = original.replace(mutant.from, mutant.to);
  try {
    writeFileSync(file, broken);
    return runTest(testFile, namePattern);
  } finally {
    writeFileSync(file, original);
  }
}

const SERVER_TEST = 'tests/telemetry-api.test.js';
const CLIENT_TEST = 'tests/static-app.test.js';
const SERVER_PATTERN = 'fine-grained GitHub tokens, the full Bearer alphabet';
const CLIENT_PATTERN = 'rc5 round 2';

// Sanity first: the unmuted suites must PASS, or a mutant "kill" means nothing.
const serverClean = runTest(SERVER_TEST, SERVER_PATTERN);
const clientClean = runTest(CLIENT_TEST, CLIENT_PATTERN);
if (serverClean === 'infra' || clientClean === 'infra') {
  console.error('An infrastructure failure (timeout/signal/spawn error) occurred on the clean tree; cannot run mutation controls.');
  process.exit(2);
}
if (serverClean !== 'pass' || clientClean !== 'pass') {
  console.error('The regression tests do not pass on the unmutated tree; cannot run mutation controls.');
  process.exit(2);
}
console.log('clean tree: both regression tests pass');

let survived = [];
let infraFailures = 0;
for (const mutant of SERVER_MUTANTS) {
  const outcome = applyAndRun(SERVER, mutant, SERVER_TEST, SERVER_PATTERN);
  if (outcome === 'infra') {
    infraFailures += 1;
    console.log(`INFRA-FAILURE: ${mutant.name} (timeout/signal/spawn error — not counted as killed)`);
    continue;
  }
  if (outcome === 'syntax') {
    infraFailures += 1;
    console.log(`LOAD-FAILURE: ${mutant.name} (the mutant broke the file; the regression logic never ran — not counted as killed)`);
    continue;
  }
  console.log(`${outcome === 'pass' ? 'SURVIVED' : 'killed'}: ${mutant.name}`);
  if (outcome === 'pass') survived.push(mutant.name);
}
for (const mutant of CLIENT_MUTANTS) {
  const outcome = applyAndRun(CLIENT, mutant, CLIENT_TEST, CLIENT_PATTERN);
  if (outcome === 'infra') {
    infraFailures += 1;
    console.log(`INFRA-FAILURE: ${mutant.name} (timeout/signal/spawn error — not counted as killed)`);
    continue;
  }
  if (outcome === 'syntax') {
    infraFailures += 1;
    console.log(`LOAD-FAILURE: ${mutant.name} (the mutant broke the file; the regression logic never ran — not counted as killed)`);
    continue;
  }
  console.log(`${outcome === 'pass' ? 'SURVIVED' : 'killed'}: ${mutant.name}`);
  if (outcome === 'pass') survived.push(mutant.name);
}

if (survived.length) {
  console.error(`\n${survived.length} mutant(s) survived — the regression tests do not guard these fixes:`);
  for (const name of survived) console.error(` - ${name}`);
  process.exit(1);
}
if (infraFailures) {
  console.error(`\n${infraFailures} mutant run(s) failed for infrastructure or load reasons; results are inconclusive.`);
  process.exit(2);
}
console.log(`\nall ${SERVER_MUTANTS.length + CLIENT_MUTANTS.length} mutants killed: the regression tests genuinely guard every review-round fix`);
