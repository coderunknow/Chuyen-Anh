'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { withFreshWorldScenario } = require('./helpers/fresh_world.cjs');

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

async function observeLifecycle(run) {
  const events = [];
  const failure = new Error('scenario failure');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fresh-world-failure-'));
  const screenshotPath = path.join(dir, 'failure.png');
  let captureError = null;
  let screenshotWritten = false;
  let scenarioWorld = null;
  let receivedFailure = null;
  const page = {
    closed: false,
    async screenshot(options) {
      events.push('screenshot');
      if (page.closed) throw new Error('Target page, context or browser has been closed');
      fs.writeFileSync(options.path, PNG_SIGNATURE);
      screenshotWritten = true;
      return PNG_SIGNATURE;
    }
  };
  const world = {
    page,
    ownBrowser: {
      close: async () => {
        events.push('close');
        page.closed = true;
      }
    }
  };
  const createWorld = async () => world;
  const scenario = async currentWorld => {
    scenarioWorld = currentWorld;
    events.push('scenario');
    throw failure;
  };
  const capture = async error => {
    receivedFailure = error;
    events.push('capture');
    try {
      await page.screenshot({ path: screenshotPath, fullPage: true });
    } catch (error) {
      captureError = error;
      throw error;
    }
  };
  let reportedError = null;
  try {
    await run(createWorld, scenario, capture);
  } catch (error) {
    reportedError = error;
  }
  return {
    events, failure, dir, screenshotPath, captureError, screenshotWritten,
    scenarioWorld, world, receivedFailure, reportedError
  };
}

async function assertFailureOrder(run) {
  const result = await observeLifecycle(run);
  try {
    assert.equal(result.reportedError, result.failure, 'the scenario error remains the reported failure');
    assert.equal(result.scenarioWorld, result.world, 'the failing scenario owns the browser being captured');
    assert.equal(result.receivedFailure, result.failure, 'capture receives the original scenario error');
    assert.equal(result.captureError, null, 'failure capture must run while the scenario page remains open');
    assert.equal(result.screenshotWritten, true, 'the live page writes the failure screenshot');
    assert.deepEqual(fs.readFileSync(result.screenshotPath).subarray(0, PNG_SIGNATURE.length), PNG_SIGNATURE);
    assert.deepEqual(result.events, ['scenario', 'capture', 'screenshot', 'close']);
  } finally {
    fs.rmSync(result.dir, { recursive: true, force: true });
  }
}

test('each fresh-world scenario captures a screenshot before its browser closes', async () => {
  await assertFailureOrder(withFreshWorldScenario);
});

test('the ordering guard rejects a close-before-capture negative control', async () => {
  const unsafeMutation = async (createWorld, scenario, capture) => {
    const world = await createWorld();
    try {
      return await scenario(world);
    } catch (error) {
      await world.ownBrowser.close();
      try {
        await capture(error);
      } catch {
        // The real screenshot helper treats diagnostics as best-effort and keeps the scenario error.
      }
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
