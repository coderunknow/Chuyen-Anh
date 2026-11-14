#!/usr/bin/env node
// Split `browser-learning.cjs` into independently runnable parts, without
// reimplementing any of it.
//
// Why this exists (Round 9 Actions work):
//   The learning suite is one `main()` of ~3,400 lines. Its critical path is the
//   browser job, and WebKit's duration swing (740 s - 1249 s across ten runs on
//   identical work) is larger than the 600 s acceptance target, so the only
//   robust way to get under it is to stop asking one runner to do all of it.
//
// How it works, and why it is safe:
//   * The module's own prologue (failure capture, phase timings, `main()`'s
//     opening) is kept verbatim.
//   * Inside `main()`, a *prologue* region (browser + page + `errors` listener),
//     a *helpers* region (seed/read/answer/next/...), and N *scenario* regions
//     are located by line, and a shard is emitted as
//         <prologue> + <helpers> + <scenario region> + <teardown>
//   * Each generated shard executes its assigned original scenario lines, in
//     order, with the same helpers. No assertions or scenarios are removed or
//     relaxed; CI runs every shard on every engine, with exams once in part 5.
//   * Shard boundaries are explicit, checked against the source, and validated
//     as an exact-once line partition by `--check`. Scenario behavior is then
//     exercised by running each generated shard in each required browser engine.
//
// Usage:
//   node scripts/shard_browser_suite.mjs --check          verify the split only
//   node scripts/shard_browser_suite.mjs --list           print shard inventory
//   node scripts/shard_browser_suite.mjs --write <dir>    write shard files
//   PART=<n> tests/run-browser-suites.sh                  generate and run one shard
//   With PART unset, the untouched learning + exam suites run end to end.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const SUITE = path.join(root, 'tests/browser-learning.cjs');

// Line ranges are 1-based and inclusive, and are asserted below against the
// source text so a future edit fails loudly instead of silently mis-slicing.
export const LAYOUT = {
  moduleHeadEnd: 88,      // everything before `async function main() {`
  mainOpen: 90,           // `async function main() {`
  prologueStart: 91,
  // Line 89 is the blank line closing `main() {`'s indentation block; it is kept
  // as part of the prologue so nothing between the opener and scenario 1 is lost.
  // The prologue also carries the first navigation and the "all CEFR levels"
  // init script (lines 109-124). Every shard needs both: a page that has loaded
  // the app, and a device profile whose study filter does not hide the legacy
  // ids the suite drives. They are setup, not scenarios, so they run per shard.
  prologueEnd: 124,
  // Lines 125-205 are the homepage + timed-practice scenarios, which happen to
  // sit before the helper block; 206 is the blank separator line. The helper
  // declarations themselves are 207-291. Those leading scenarios belong to
  // shard 1, and crucially they still run *first*, because a shard is emitted as
  // prologue -> leading scenarios -> helpers -> its own scenarios. Scenario order
  // inside a shard is therefore the same order as the full suite.
  helpersStart: 207,
  helpersEnd: 291,        // key/read/seed/next/.../startQuizFromIntroduction
  // The five scenario ranges include each phase marker with the scenario it
  // names: search/favorite (960-961), blank spelling (1554-1555), RC2
  // remediation (2348-2349), and the WCAG axe block (2926-2927). The leading
  // homepage/timed-practice scenarios
  // remain first in shard 1, before the shared helper declarations.
  // Boundaries are scenario banners. They are chosen for *balance*, because the
  // largest shard sets the job's duration and WebKit has historically run up to
  // 2.5x slower than Chromium on this suite. Measured Chromium costs per region
  // (Round 9 phase timings) guided the split:
  //   125-959   2.1 + 63.2 + 69.6  ≈ 135s  (the timed-practice scenario waits a
  //                                       real minute by design; it cannot be cut)
  //   960-1553                      ≈  62s
  //   1554-2347                     ≈  78s
  //   2348-2925 9.4 + 44.6 + 35.6   ≈ 101s before the capture-helper refactor
  //   2926-3414 75.8 + 34.7         ≈ 121s before the capture-helper refactor
  shards: [
    { name: '1', start: 292, end: 959 },
    { name: '2', start: 960, end: 1553 },
    { name: '3', start: 1554, end: 2347 },
    { name: '4', start: 2348, end: 2925 },
    { name: '5', start: 2926, end: 3414 }
  ],
  // Scenarios that run before the helper declarations and need no helpers.
  leading: { start: 125, end: 205 },
  // Blank structural separators: counted by the partition, never emitted.
  separators: [
    { name: 'main/prologue separator', line: 89 },
    { name: 'helper separator', line: 206 }
  ],
  // Fixture wiring established in earlier scenarios is restored by the prelude
  // in later shards, so they do not depend on another shard's execution.
  dialogPolicyLine: 1008,   // page.on('dialog', …accept()) installed by the reset scenario
  backupExport: { download: 1022, bytes: 1024 },  // activeBackup = the app's own export
  phaseReportLine: 3412,  // full-suite diagnostics call; generated shards report their own phase timings
  errorAssertLine: 3411,  // full-suite `assert.deepEqual(errors, [])`; shards not covering it must emit their own
  mainCloseStart: 3415    // `} catch (error) {` ... end of file
};

function readSuite() {
  const lines = fs.readFileSync(SUITE, 'utf8').split('\n');
  return lines;
}

// Assert the layout still points at the constructs it claims to.
function assertLayout(lines) {
  const at = n => (lines[n - 1] ?? '');
  const problems = [];
  if (!/^async function main\(\) \{$/.test(at(LAYOUT.mainOpen))) problems.push(`line ${LAYOUT.mainOpen}: expected main() opener`);
  if (!/console\.log\(`PASS: \$\{engineLabel\}/.test(at(LAYOUT.shards.at(-1).end))) problems.push(`line ${LAYOUT.shards.at(-1).end}: expected the PASS log line`);
  if (!/^\s*\} catch \(error\) \{$/.test(at(LAYOUT.mainCloseStart))) problems.push(`line ${LAYOUT.mainCloseStart}: expected the catch block`);
  if (!/^\s*reportPhaseTimings\(engineLabel\);$/.test(at(LAYOUT.phaseReportLine))) problems.push(`line ${LAYOUT.phaseReportLine}: expected the phase timing report`);
  if (!/assert\.deepEqual\(errors, \[\]\)/.test(at(LAYOUT.errorAssertLine))) problems.push(`line ${LAYOUT.errorAssertLine}: expected the page-errors assertion`);
  for (const [index, shard] of LAYOUT.shards.entries()) {
    if (!/^\s*markPhase\(/.test(at(shard.start))) {
      problems.push(`shard ${shard.name} must start with its scenario's phase marker at line ${shard.start}`);
    }
    if (index < LAYOUT.shards.length - 1 && !/^\s*markPhase\(/.test(at(shard.end + 1))) {
      problems.push(`shard ${shard.name} must end immediately before the next phase marker at line ${shard.end + 1}`);
    }
  }
  if (problems.length) {
    throw new Error(`the shard layout no longer matches tests/browser-learning.cjs:\n  ${problems.join('\n  ')}\nUpdate LAYOUT (and re-verify) before using shards.`);
  }
}

function slice(lines, from, to) { return lines.slice(from - 1, to); }

// A shard that re-uses fixture wiring installed by an earlier shard must rebuild
// it, or the split would make a scenario depend on an accident of ordering.
function buildPrelude(shardBody) {
  const text = shardBody.join('\n');
  const out = [];
  // `#reset-setting` opens a confirm() dialog. The full suite registers the
  // accept policy once, in the scenario at line {dialogPolicyLine}; a shard that
  // reaches a reset without that scenario must register the same policy.
  // Only emit wiring the shard does *not* establish itself.
  if (/page\.locator\('#reset-setting'\)/.test(text) && !/page\.on\('dialog'/.test(text)) {
    out.push(
      `    // Fixture wiring re-established for this shard: the full suite registers`,
      `    // this dialog policy in an earlier scenario, and a shard that resets the`,
      `    // profile without it would stall on confirm().`,
      `    page.on('dialog', dialog => dialog.accept());`
    );
  }
  // `activeBackup` is the bytes of a bundle the app itself exported. The
  // failed-write scenario imports it to prove a rejected import is reported
  // rather than silently dropped, so it must be a real app-produced bundle and
  // not a hand-built fixture.
  if (/\bactiveBackup\b/.test(text) && !/const activeBackup\b/.test(text)) {
    out.push(
      '',
      `    // Fixture wiring re-established for this shard: reproduce the full suite's`,
      `    // real app export on the main page. Do not close a temporary page here:`,
      `    // some single-process Chromium builds close the owning browser with it.`,
      `    await seed(['298', '2']);`,
      `    await page.locator('#start-quiz').click();`,
      `    await page.locator('[data-view="settings"]').click();`,
      `    const pendingBackup = page.waitForEvent('download');`,
      `    await page.locator('#export-setting').click();`,
      `    const activeBackup = fs.readFileSync(await (await pendingBackup).path());`
    );
  }
  return out;
}

// A shard is: module head, main() up to and including the prologue, the shared
// helpers, its own scenarios, then the suite's own teardown.
export function buildShard(lines, shard, depth) {
  // The suite resolves `../index.html` and `playwright-core` relative to its own
  // directory, so a shard written one level deeper must be corrected by exactly
  // one `../`. `depth` is how many directories below tests/ the shard will land.
  const up = '../'.repeat(depth);
  const head = slice(lines, 1, LAYOUT.moduleHeadEnd)
    .map(line => line);
  const mainOpen = slice(lines, LAYOUT.mainOpen, LAYOUT.mainOpen);
  const prologue = slice(lines, LAYOUT.prologueStart, LAYOUT.prologueEnd);
  const helpers = slice(lines, LAYOUT.helpersStart, LAYOUT.helpersEnd);
  // The leading scenarios are not shared: they run once, in shard 1, in place.
  const leading = shard.name === '1' ? slice(lines, LAYOUT.leading.start, LAYOUT.leading.end) : [];
  const body = slice(lines, shard.start, shard.end);
  const prelude = buildPrelude(body);
  const teardown = slice(lines, LAYOUT.mainCloseStart, lines.length);
  const banner = [
    `// ---- SHARD ${shard.name} of ${LAYOUT.shards.length} --------------`,
    `// Generated from tests/browser-learning.cjs lines ${shard.start}..${shard.end}`,
    `// by scripts/shard_browser_suite.mjs. Do not edit: edit the suite.`,
    `// This shard runs the same statements, helpers and assertions as that range`,
    `// of the full suite. It is a partition, not a subset.`
  ];
  const phaseReport = shard.start <= LAYOUT.phaseReportLine && shard.end >= LAYOUT.phaseReportLine
    ? []
    : ['    reportPhaseTimings(engineLabel);'];
  // Every shard must check the page errors it collected before it reports
  // PASS. The full suite asserts this at its end (line 3400, inside shard 5's
  // range), but shards 1-4 collect the same `errors` array without ever
  // checking it, so an async page error could pass silently (CodeRabbit, PR
  // #86). Shard 5 already carries the original assertion: do not duplicate it.
  const coversErrorAssert = shard.start <= LAYOUT.errorAssertLine && shard.end >= LAYOUT.errorAssertLine;
  const summary = [
    ...phaseReport,
    ...(coversErrorAssert ? [] : ['    assert.deepEqual(errors, []);']),
    `    // A shard reports its own result: the full suite's PASS line lives in the`,
    `    // last shard, so each shard states that it reached its end with no failure.`,
    `    console.log(\`SHARD ${shard.name}/${LAYOUT.shards.length} PASS: \${engineLabel} \${browser.version()}\`);`
  ];
  const text = [...head, ...mainOpen, ...prologue, ...banner, ...leading, '', ...helpers, ...prelude, '', ...body, ...summary, ...teardown].join('\n');
  if (depth === 0) return text;
  // Only the asset path is relative to the suite's own directory; nothing else
  // in the file depends on where it sits, so this single rewrite is sufficient.
  return text
    .replace(/path\.join\(__dirname, '\.\.\/index\.html'\)/g, `path.join(__dirname, '${up}../index.html')`)
    .replace(/path\.join\(__dirname, 'helpers\/fresh_world\.cjs'\)/g, `path.join(__dirname, '${up}helpers/fresh_world.cjs')`);
}

export function verifyPartition(lineCount, layout, lines = null) {
  const counts = new Uint32Array(lineCount + 1);
  const invalid = [];
  const scenarioLines = { value: 0 };
  const add = (name, start, end, scenario = false) => {
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < start || end > lineCount) {
      invalid.push(`${name}: invalid range ${start}-${end} for ${lineCount} lines`);
      return;
    }
    for (let line = start; line <= end; line += 1) {
      counts[line] += 1;
      if (scenario) scenarioLines.value += 1;
    }
  };

  add('module head', 1, layout.moduleHeadEnd);
  add('main opener', layout.mainOpen, layout.mainOpen);
  add('prologue', layout.prologueStart, layout.prologueEnd);
  add('leading scenarios', layout.leading.start, layout.leading.end);
  add('helpers', layout.helpersStart, layout.helpersEnd);
  for (const shard of layout.shards) add(`shard ${shard.name}`, shard.start, shard.end, true);
  // These two blank lines are structural separators between the named regions.
  // The real layout names their (re-based) lines; the default keeps the
  // fixture layouts in tests/shard-browser-suite.test.mjs working unchanged.
  const separators = layout.separators ?? [
    { name: 'main/prologue separator', line: 78 },
    { name: 'helper separator', line: 195 },
  ];
  for (const separator of separators) add(separator.name, separator.line, separator.line);
  add('teardown', layout.mainCloseStart, lineCount);
  // buildShard never emits these separators: they are counted as assigned so
  // the partition stays complete, but a non-blank replacement there would be
  // dropped from every generated shard while --check still passed. When the
  // source text is supplied (--check / --write), require them blank
  // (CodeRabbit, PR #86).
  if (lines) {
    for (const separator of separators) {
      const text = lines[separator.line - 1] ?? '';
      if (text.trim() !== '') {
        invalid.push(`${separator.name} (line ${separator.line}) must stay blank: it is counted as assigned but ` +
                     'never emitted by buildShard, so a replacement here would vanish from every shard');
      }
    }
  }

  const missing = [];
  const duplicates = [];
  for (let line = 1; line <= lineCount; line += 1) {
    if (counts[line] === 0) missing.push(line);
    else if (counts[line] > 1) duplicates.push({ line, assignments: counts[line] });
  }
  return { missing, duplicates, invalid, scenarioLines: scenarioLines.value };
}

function verifyReconstruction(lines) {
  return verifyPartition(lines.length, LAYOUT, lines);
}

function printInventory(lines) {
  const result = verifyReconstruction(lines);
  console.log(`suite: ${lines.length} lines`);
  console.log(`prologue: ${LAYOUT.prologueStart}-${LAYOUT.prologueEnd}, helpers: ${LAYOUT.helpersStart}-${LAYOUT.helpersEnd}`);
  for (const shard of LAYOUT.shards) {
    const body = slice(lines, shard.start, shard.end);
    console.log(`shard ${shard.name}: lines ${shard.start}-${shard.end} (${body.length} lines)`);
  }
  console.log(`scenario lines across shards: ${result.scenarioLines}`);
  if (result.invalid.length || result.missing.length || result.duplicates.length) {
    if (result.invalid.length) console.error(`INVALID ranges: ${result.invalid.join('; ')}`);
    if (result.missing.length) {
      console.error(`UNASSIGNED lines (would be dropped by sharding): ${result.missing.slice(0, 20).join(', ')}${result.missing.length > 20 ? ' …' : ''}`);
    }
    if (result.duplicates.length) {
      const sample = result.duplicates.slice(0, 20).map(item => `${item.line} (${item.assignments} owners)`);
      console.error(`DUPLICATE lines (would execute more than once): ${sample.join(', ')}${result.duplicates.length > 20 ? ' …' : ''}`);
    }
    throw new Error('the shard layout must assign every source line exactly once');
  }
  console.log('every source line is assigned to exactly one region: OK');
}

function cli(args = process.argv.slice(2)) {
  const lines = readSuite();
  assertLayout(lines);
  if (args.includes('--list') || args.includes('--check')) printInventory(lines);

  if (args.includes('--write')) {
    const dir = args[args.indexOf('--write') + 1];
    if (!dir) throw new Error('--write needs a directory');
    // Generation is never allowed to bypass the exact-once guard, even when
    // --check was not also supplied.
    printInventory(lines);
    const abs = path.resolve(root, dir);
    // Depth below tests/ decides how the relative asset path must be rewritten.
    const depth = path.relative(path.join(root, 'tests'), abs).split(path.sep).filter(part => part && part !== '.').length;
    fs.mkdirSync(abs, { recursive: true });
    for (const shard of LAYOUT.shards) {
      const file = path.join(abs, `browser-learning.part${shard.name}.cjs`);
      fs.writeFileSync(file, buildShard(lines, shard, depth));
      console.log(`wrote ${path.relative(root, file)}`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    cli();
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
