'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { withFreshWorldScenario } = require('./helpers/fresh_world.cjs');

async function observeLifecycle(run) {
  const events = [];
  const failure = new Error('scenario failure');
  const createWorld = async () => ({
    ownBrowser: {
      close: async () => { events.push('close'); }
    }
  });
  const scenario = async () => {
    events.push('scenario');
    throw failure;
  };
  const capture = async error => {
    assert.equal(error, failure);
    events.push('capture');
  };
  try {
    await run(createWorld, scenario, capture);
  } catch (error) {
    assert.equal(error, failure, 'the scenario error remains the reported failure');
  }
  return events;
}

async function assertFailureOrder(run) {
  assert.deepEqual(await observeLifecycle(run), ['scenario', 'capture', 'close']);
}

test('each fresh-world scenario captures its failure before its browser closes', async () => {
  await assertFailureOrder(withFreshWorldScenario);
});

test('the ordering guard rejects a close-before-capture negative control', async () => {
  const unsafeMutation = async (createWorld, scenario, capture) => {
    const world = await createWorld();
    try {
      return await scenario(world);
    } catch (error) {
      await world.ownBrowser.close();
      await capture(error);
      throw error;
    }
  };
  await assert.rejects(assertFailureOrder(unsafeMutation), assert.AssertionError);
});

test('successful fresh-world scenarios close once without capturing a failure', async () => {
  const events = [];
  const result = await withFreshWorldScenario(
    async () => ({ ownBrowser: { close: async () => { events.push('close'); } } }),
    async () => { events.push('scenario'); return 'ok'; },
    async () => { events.push('capture'); }
  );
  assert.equal(result, 'ok');
  assert.deepEqual(events, ['scenario', 'close']);
});

test('a diagnostic capture error cannot hide the scenario failure or skip cleanup', async () => {
  const events = [];
  const failure = new Error('scenario failure');
  await assert.rejects(
    withFreshWorldScenario(
      async () => ({ ownBrowser: { close: async () => { events.push('close'); } } }),
      async () => { events.push('scenario'); throw failure; },
      async () => { events.push('capture'); throw new Error('capture failure'); }
    ),
    error => error === failure
  );
  assert.deepEqual(events, ['scenario', 'capture', 'close']);
});
