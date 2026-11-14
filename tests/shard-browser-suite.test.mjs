import assert from 'node:assert/strict';
import test from 'node:test';
import { verifyPartition } from '../scripts/shard_browser_suite.mjs';

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
