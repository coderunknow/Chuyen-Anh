import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { LAYOUT, buildShard, verifyPartition } from '../scripts/shard_browser_suite.mjs';

const suiteLines = fs.readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), 'browser-learning.cjs'), 'utf8'
).split('\n');

function completeLayout() {
  return {
    moduleHeadEnd: 1,
    mainOpen: 2,
    prologueStart: 3,
    prologueEnd: 4,
    leading: { start: 5, end: 6 },
    helpersStart: 7,
    helpersEnd: 10,
    shards: [
      { name: '1', start: 11, end: 77 },
      { name: '2', start: 79, end: 194 },
      { name: '3', start: 196, end: 199 }
    ],
    mainCloseStart: 200
  };
}

test('the complete partition assigns every source line exactly once', () => {
  const result = verifyPartition(200, completeLayout());
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.duplicates, []);
  assert.deepEqual(result.invalid, []);
  assert.equal(result.scenarioLines, 187);
});

test('a missing source region is rejected by a negative-control mutation', () => {
  const layout = completeLayout();
  layout.shards[1].end = 193;
  const result = verifyPartition(200, layout);
  assert.deepEqual(result.missing, [194]);
  assert.deepEqual(result.duplicates, []);
});

test('overlapping source regions are rejected by a negative-control mutation', () => {
  const layout = completeLayout();
  layout.shards[0].end = 78;
  const result = verifyPartition(200, layout);
  assert.deepEqual(result.missing, []);
  assert.deepEqual(result.duplicates, [{ line: 78, assignments: 2 }]);
});

test('every shard asserts its collected page errors before reporting PASS', () => {
  for (const shard of LAYOUT.shards) {
    const text = buildShard(suiteLines, shard, 0);
    const assertion = 'assert.deepEqual(errors, []);';
    const occurrences = text.split(assertion).length - 1;
    assert.equal(occurrences, 1,
      `shard ${shard.name} must carry exactly one page-errors assertion (the original or the emitted one)`);
    const passAt = text.indexOf(`SHARD ${shard.name}/${LAYOUT.shards.length} PASS`);
    assert.ok(passAt > 0, `shard ${shard.name} must report its PASS line`);
    assert.ok(text.indexOf(assertion) < passAt,
      `shard ${shard.name} must assert its collected errors before it reports PASS`);
  }
});

test('a non-blank separator line is rejected by the partition check', () => {
  const lines = [...suiteLines];
  const clean = verifyPartition(lines.length, LAYOUT, lines);
  assert.deepEqual(clean.invalid, [], 'the real suite keeps both separators blank');
  const separator = LAYOUT.separators[0].line;
  lines[separator - 1] = 'const silently_dropped = true;';
  const mutated = verifyPartition(lines.length, LAYOUT, lines);
  assert.ok(mutated.invalid.some(message => message.includes(`line ${separator}`)),
    `a non-blank line 78 must be rejected, got: ${mutated.invalid.join('; ')}`);
});
