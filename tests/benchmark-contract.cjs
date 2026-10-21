// Invariants for tests/speed-benchmark.cjs, kept dependency-free so the CI test
// suite can exercise them without Playwright or a browser.
//
// The benchmark exists to show that two builds do the *same* learning work, so a
// faster time cannot come from a shorter session. These checks turn that promise
// into assertions: a run that graded fewer words, skipped the corrective retry,
// dropped a turn, saw a different word order, or logged a page error is invalid
// and must fail the whole benchmark instead of being reported as a result.
'use strict';

const EXPECTED = Object.freeze({
  gradedTurns: 10, // ten first-pass retrievals
  practiceTurns: 1, // exactly one corrective retry for the single miss
  wordsCompleted: 10,
  wrongAt: 3 // zero-based: the fourth graded card is the missed one
});

// The sprint hands off without a click on every correct first-pass answer, so it
// must show exactly nine hand-offs and no manual continue controls; the standard
// flow keeps a panel and a continue control on every one of its eleven turns.
const EXPECTED_HANDOFFS = Object.freeze({
  sprint: EXPECTED.gradedTurns - 1,
  standard: 0
});

class BenchmarkContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'BenchmarkContractError';
  }
}

function fail(message) {
  throw new BenchmarkContractError(message);
}

function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function validateResult(result, options = {}) {
  const { flow, thinkMs, reactionMs, rounds, expectedOrder, label = 'scenario', round = false } = options;
  if (!result || typeof result !== 'object') fail(`${label}: no result object was produced`);

  for (const [key, value] of Object.entries(EXPECTED)) {
    if (result[key] !== value) fail(`${label}: ${key} was ${result[key]}, expected ${value}`);
  }

  if (!Array.isArray(result.wordOrder)) fail(`${label}: wordOrder is missing`);
  if (result.wordOrder.length !== EXPECTED.wordsCompleted) {
    fail(`${label}: wordOrder has ${result.wordOrder.length} entries, expected ${EXPECTED.wordsCompleted}`);
  }
  if (new Set(result.wordOrder).size !== EXPECTED.wordsCompleted) {
    fail(`${label}: wordOrder repeats a word, so fewer than ${EXPECTED.wordsCompleted} distinct words were graded`);
  }

  if (!Array.isArray(result.pageErrors)) fail(`${label}: pageErrors is missing`);
  if (result.pageErrors.length) fail(`${label}: page error(s) occurred: ${result.pageErrors.join(' | ')}`);

  // Round-level results have no aggregate timing of their own, so these checks only
  // apply once the scenario has been summarized over its rounds.
  if (result.elapsedMs !== undefined && !round) {
    if (!Array.isArray(result.elapsedMsAllRounds)) fail(`${label}: elapsedMsAllRounds is missing`);
    if (rounds !== undefined && result.elapsedMsAllRounds.length !== rounds) {
      fail(`${label}: ${result.elapsedMsAllRounds.length} rounds were recorded, expected ${rounds}`);
    }
    if (!result.elapsedMsAllRounds.every(value => isFiniteNumber(value) && value > 0)) {
      fail(`${label}: a round finished with an invalid elapsed time`);
    }
    if (!isFiniteNumber(result.elapsedMs) || result.elapsedMs <= 0) fail(`${label}: elapsedMs is invalid`);
    if (result.elapsedMs !== median(result.elapsedMsAllRounds)) {
      fail(`${label}: elapsedMs is not the median of the recorded rounds`);
    }
  }

  for (const key of ['meanFeedbackLatencyMs', 'meanHandoffLatencyMs', 'meanContinueLatencyMs']) {
    const value = result[key];
    if (value !== null && (!isFiniteNumber(value) || value < 0)) fail(`${label}: ${key} is invalid (${value})`);
  }

  if (flow !== undefined && result.flow !== flow) fail(`${label}: flow was ${result.flow}, expected ${flow}`);
  for (const [key, expected] of [['thinkMs', thinkMs], ['reactionMs', reactionMs]]) {
    if (expected !== undefined && result[key] !== expected) {
      fail(`${label}: ${key} was ${result[key]}, expected ${expected}`);
    }
  }

  const expectedHandoffs = EXPECTED_HANDOFFS[result.flow];
  if (expectedHandoffs !== undefined && result.handoffSamples !== expectedHandoffs) {
    fail(`${label}: ${result.handoffSamples} hand-off(s) measured, expected ${expectedHandoffs}`);
  }
  if (result.handoffSamples > 0 && !isFiniteNumber(result.meanHandoffLatencyMs)) {
    fail(`${label}: hand-offs were measured without a latency`);
  }
  if (result.handoffSamples === 0 && result.meanHandoffLatencyMs !== null) {
    fail(`${label}: a hand-off latency was reported without any hand-off`);
  }

  if (expectedOrder) {
    const actual = result.wordOrder.join(' → ');
    if (actual !== expectedOrder.join(' → ')) {
      fail(`${label}: graded a different word order than the reference run (${actual})`);
    }
  }

  return result;
}

module.exports = {
  EXPECTED,
  EXPECTED_HANDOFFS,
  BenchmarkContractError,
  median,
  validateResult
};
