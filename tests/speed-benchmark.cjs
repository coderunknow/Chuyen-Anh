// Measures the wall-clock duration and per-turn-class DOM transition latency of
// a fixed ten-word study session, and fails if the session did less work than
// expected or violated any queue/spacing contract. Run manually with:
//   npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
//   node tests/speed-benchmark.cjs
//   node tests/speed-benchmark.cjs --matrix
// Optional environment:
//   APP=path/to/index.html   build under test (default: ./index.html)
//   FLOW=sprint|standard     flow under test when --matrix is omitted (default: sprint)
//   THINK_MS=600             simulated reading/thinking time per turn (non-negative finite ms)
//   REACTION_MS=450          simulated delay before pressing manual Continue (non-negative finite ms)
//   ROUNDS=3                 independent runs; ALL rounds are retained and median + range reported
//   BROWSER_EXECUTABLE=...   local Chrome/Chromium instead of @sparticuz/chromium
//
// Scientific & engineering note:
// This benchmark measures software interaction & DOM rendering overhead under a
// fixed, deterministic 10-word workload (standard = 11 turns vs sprint = 21 turns).
// It does NOT measure human memory retention, recall durability, or real learning
// speed; see README.md and DESIGN_LOG.md for the empirical learner-study protocol.
'use strict';

const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const {
  EXPECTED,
  median,
  validateResult
} = require('./benchmark-contract.cjs');

const WORDS = EXPECTED.wordsCompleted;
const WRONG_POSITION = EXPECTED.wrongAt;
const MATRIX = process.argv.includes('--matrix');
// The three learner paces the matrix is reported at. Reading time and manual
// continue reaction time are varied independently so the comparison never rests
// on one synthetic pace.
const MATRIX_SCENARIOS = Object.freeze([
  { thinkMs: 600, reactionMs: 450 },
  { thinkMs: 1200, reactionMs: 450 },
  { thinkMs: 600, reactionMs: 250 }
]);

const SCIENTIFIC_LIMITATION_NOTE =
  'Software-only DOM & interaction benchmark: sprint performs 21 turns (10 first-pass + 10 delayed consolidations + 1 corrective retry) vs 11 turns in standard mode (10 first-pass + 1 corrective retry). Synthetic timings never establish human learning speed or retention.';

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function parsePositiveIntEnv(name, fallback) {
  if (process.env[name] === undefined || process.env[name] === '') return fallback;
  const parsed = Number(process.env[name]);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error(`${name} must be an integer >= 1 (received ${JSON.stringify(process.env[name])})`);
  }
  return parsed;
}

function parseNonNegativeMsEnv(name, fallback) {
  if (process.env[name] === undefined || process.env[name] === '') return fallback;
  const parsed = Number(process.env[name]);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${name} must be a finite number >= 0 (received ${JSON.stringify(process.env[name])})`);
  }
  return parsed;
}

function seedScript() {
  // Six due weak cards ordered deterministically by nextReview, two genuinely studied
  // learning cards (correctCount: 1, streak: 1), and two genuinely unstudied new cards
  // (canonical state: 'new', zero counts, null lastReviewed). Both selectSession('mixed')
  // and selectSprintSession therefore select the exact same 10-word sequence.
  return `(() => {
    const now = Date.now();
    const data = JSON.parse(document.getElementById('vocabulary-data').textContent).slice(0, ${WORDS});
    const progress = {};
    data.forEach((entry, index) => {
      if (index < 6) {
        progress[entry.id] = {
          id: entry.id, state: 'weak', correctCount: 0, wrongCount: 3 + index, streak: 0,
          lastReviewed: now - 3600000, nextReview: now - (6 - index) * 60000,
          interval: 0, ease: 2.3, difficulty: 0.4
        };
      } else if (index < 8) {
        progress[entry.id] = {
          id: entry.id, state: 'learning', correctCount: 1, wrongCount: 0, streak: 1,
          lastReviewed: now - 86400000, nextReview: now + 3600000 + index,
          interval: 1, ease: 2.5, difficulty: 0.1
        };
      } else {
        progress[entry.id] = {
          id: entry.id, state: 'new', correctCount: 0, wrongCount: 0, streak: 0,
          lastReviewed: null, nextReview: now,
          interval: 0, ease: 2.5, difficulty: 0
        };
      }
    });
    localStorage.clear();
    localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
    localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, darkMode: false, keyboardShortcuts: false }));
    return data.map(entry => ({ id: entry.id, word: entry.word, meaning: entry.meaning }));
  })()`;
}

// Installed once per page. Stamps all input and DOM transition timestamps strictly
// inside the page's own clock (`performance.now()`) via capture listeners + a single
// MutationObserver so outer Playwright RPC round-trip jitter never contaminates latency.
async function installProbe(page) {
  await page.evaluate(() => {
    const turnIdentity = () => {
      if (document.querySelector('.summary')) return 'summary';
      const card = document.querySelector('.flashcard');
      const seq = card?.dataset?.turnSeq;
      const head = document.querySelector('.flashcard-head b')?.innerText ?? '';
      const mode = document.querySelector('.mode-label')?.innerText ?? '';
      const prompt = document.querySelector('.prompt')?.innerText ?? '';
      return seq ? `seq:${seq}` : `${head}|${mode}|${prompt}`;
    };
    window.__bench = { baseline: '', answerAt: null, continueAt: null, changeAt: null, feedbackAt: null };
    window.__benchIdentity = turnIdentity;
    document.addEventListener('click', event => {
      const node = event.target instanceof Element
        ? event.target.closest('[data-option], #next-card, #submit-answer, #reveal-correct, #reveal-wrong')
        : null;
      if (!node) return;
      if (node.id === 'next-card') {
        if (window.__bench.continueAt === null) {
          window.__bench.baseline = turnIdentity();
          window.__bench.continueAt = performance.now();
        }
        return;
      }
      if (window.__bench.answerAt === null) {
        window.__bench.baseline = turnIdentity();
        window.__bench.answerAt = performance.now();
      }
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      if (event.target?.id !== 'spelling-input') return;
      if (window.__bench.answerAt !== null) return;
      window.__bench.baseline = turnIdentity();
      window.__bench.answerAt = performance.now();
    }, true);
    new MutationObserver(() => {
      if (window.__bench.feedbackAt === null && document.querySelector('#feedback-area .feedback, .handoff-strip')) {
        window.__bench.feedbackAt = performance.now();
      }
      if (window.__bench.changeAt === null && turnIdentity() !== window.__bench.baseline) {
        window.__bench.changeAt = performance.now();
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
  });
}

async function resetProbe(page) {
  await page.evaluate(() => {
    window.__bench.answerAt = null;
    window.__bench.continueAt = null;
    window.__bench.changeAt = null;
    window.__bench.feedbackAt = null;
    window.__bench.baseline = window.__benchIdentity();
  });
}

const readProbe = page => page.evaluate(() => ({ ...window.__bench }));

async function readCard(page) {
  if (await page.locator('#start-quiz').count()) return { intro: true };
  const mode = (await page.locator('.mode-label').innerText()).toLowerCase();
  const prompt = (await page.locator('.prompt').innerText()).trim();
  const identity = await page.evaluate(() => window.__benchIdentity());
  return {
    intro: false,
    mode,
    prompt,
    identity,
    consolidation: mode.includes('củng cố'),
    practice: mode.includes('luyện lại')
  };
}

function resolveEntry(card, plan) {
  return card.mode.includes('nhận diện')
    ? plan.find(item => item.word === card.prompt)
    : plan.find(item => item.meaning === card.prompt);
}

function waitForAnswerRegistered(page, timeout) {
  return page.waitForFunction(() => {
    if (document.querySelector('.summary, .handoff-strip, #feedback-area .feedback')) return true;
    return [...document.querySelectorAll('[data-option]')].some(node => node.disabled);
  }, null, { timeout, polling: 25 });
}

function waitForAdvance(page, previousIdentity, timeout) {
  return page.waitForFunction(previous => {
    if (document.querySelector('.summary')) return true;
    return window.__benchIdentity() !== previous;
  }, previousIdentity, { timeout, polling: 25 });
}

function waitForAnswerable(page, timeout) {
  return page.waitForFunction(() => {
    if (document.querySelector('.summary')) return true;
    if (document.querySelector('#spelling-input:not([disabled])')) return true;
    if (document.querySelector('[data-option]:not([disabled])')) return true;
    return Boolean(document.querySelector('#start-quiz'));
  }, null, { timeout, polling: 25 });
}

async function answerCard(page, card, plan, correct) {
  const target = resolveEntry(card, plan);
  if (!target) throw new Error(`the card could not be traced to a planned word: ${card.mode} / ${card.prompt}`);
  if (card.mode.includes('chính tả')) {
    await page.locator('#spelling-input').fill(correct ? target.word : 'definitely not the word');
    await page.locator('#spelling-input').press('Enter');
    return;
  }
  const wantMeaning = card.mode.includes('nhận diện');
  const options = page.locator('[data-option]');
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const text = (await options.nth(index).innerText()).replace(/^\d+\s*/, '').trim();
    const entry = plan.find(item => (wantMeaning ? item.meaning : item.word) === text);
    const isCorrect = Boolean(entry) && entry.id === target.id;
    if (isCorrect === correct) {
      await options.nth(index).click();
      return;
    }
  }
  throw new Error(`no ${correct ? 'correct' : 'wrong'} option found for ${card.mode} / ${card.prompt}`);
}

function summarizeBucket(samples) {
  if (!samples.length) return { samples: 0, medianMs: null, meanMs: null, minMs: null, maxMs: null };
  const meanVal = Number((samples.reduce((acc, v) => acc + v, 0) / samples.length).toFixed(2));
  return {
    samples: samples.length,
    medianMs: median(samples),
    meanMs: meanVal,
    minMs: Math.min(...samples),
    maxMs: Math.max(...samples)
  };
}

async function runRound(page, url, { flow, thinkMs, reactionMs }) {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.goto(url);
  await page.locator('[data-session]').first().waitFor();
  const plan = await page.evaluate(seedScript());
  await page.reload();
  await page.locator('#sprint-title').waitFor();
  await installProbe(page);

  const selector = flow === 'standard' ? '[data-session="quick10"]' : '[data-session="sprint"]';
  const started = Date.now();
  await page.locator(selector).click();

  const order = [];
  const consolidationOrder = [];
  const turnSequence = []; // every answered turn `{ word, kind }` in real execution order
  const feedbackLatency = [];
  const handoffLatency = [];
  const continueLatency = [];
  const classSamples = {
    firstPass: [],
    handOff: [],
    consolidation: [],
    retry: []
  };
  let practiceSeen = 0;
  let consolidationSeen = 0;
  let graded = 0;
  let wrongAt = -1;

  for (let guard = 0; guard < 60; guard += 1) {
    if (await page.locator('.summary').count()) break;
    let card = await readCard(page);

    if (card.intro) {
      await sleep(thinkMs);
      await page.locator('#start-quiz').click();
      card = await readCard(page);
    }
    await resetProbe(page);

    if (process.env.BENCH_DEBUG) {
      console.error(`[turn ${turnSequence.length + 1}] ${card.mode} | ${card.prompt.slice(0, 40)}`);
    }
    const firstPass = !card.practice && !card.consolidation;
    const resolved = resolveEntry(card, plan);
    if (!resolved) {
      throw new Error(`the turn could not be traced to a planned word: ${card.mode} / ${card.prompt}`);
    }
    const turnKind = firstPass ? 'firstPass' : (card.consolidation ? 'consolidation' : 'retry');
    turnSequence.push({ id: resolved.id, word: resolved.word, kind: turnKind });

    if (firstPass) {
      order.push(resolved.word);
      graded += 1;
    } else if (card.consolidation) {
      consolidationOrder.push(resolved.word);
      consolidationSeen += 1;
    } else {
      practiceSeen += 1;
    }

    const isWrong = firstPass && graded - 1 === WRONG_POSITION;
    if (isWrong) wrongAt = graded - 1;

    await sleep(thinkMs);
    await answerCard(page, card, plan, !isWrong);

    const sprintHandoff = flow === 'sprint' && firstPass && !isWrong;
    await waitForAnswerRegistered(page, 15000);

    if (sprintHandoff) {
      const replaced = await page.waitForFunction(() => window.__bench.changeAt !== null, null, { timeout: 15000, polling: 25 })
        .then(() => true).catch(() => false);
      if (!replaced) throw new Error('the sprint did not replace the card after a correct answer');
      await waitForAnswerable(page, 15000);
      const afterAnswer = await readProbe(page);
      if (Number.isFinite(afterAnswer.feedbackAt) && Number.isFinite(afterAnswer.answerAt)) {
        const fbMs = Math.round(afterAnswer.feedbackAt - afterAnswer.answerAt);
        feedbackLatency.push(fbMs);
        classSamples.firstPass.push(fbMs);
      }
      if (!Number.isFinite(afterAnswer.changeAt) || !Number.isFinite(afterAnswer.answerAt)) {
        throw new Error('the sprint did not replace the card after a correct answer');
      }
      const hoMs = Math.round(afterAnswer.changeAt - afterAnswer.answerAt);
      handoffLatency.push(hoMs);
      classSamples.handOff.push(hoMs);
    } else {
      await page.locator('#feedback-area .feedback, .summary').first().waitFor({ timeout: 15000 });
      const afterAnswer = await readProbe(page);
      if (Number.isFinite(afterAnswer.feedbackAt) && Number.isFinite(afterAnswer.answerAt)) {
        const fbMs = Math.round(afterAnswer.feedbackAt - afterAnswer.answerAt);
        feedbackLatency.push(fbMs);
        classSamples[turnKind].push(fbMs);
      }
      if (await page.locator('.summary').count()) continue;
      await sleep(reactionMs);
      await resetProbe(page);
      const identityBeforeContinue = await page.evaluate(() => window.__benchIdentity());
      await page.locator('#next-card').click();
      await waitForAdvance(page, identityBeforeContinue, 15000);
      await waitForAnswerable(page, 15000);
      const afterContinue = await readProbe(page);
      if (Number.isFinite(afterContinue.changeAt) && Number.isFinite(afterContinue.continueAt)) {
        continueLatency.push(Math.round(afterContinue.changeAt - afterContinue.continueAt));
      }
    }
  }

  await page.locator('.summary').waitFor({ timeout: 10000 });
  const elapsed = Date.now() - started;
  const summary = await page.locator('.summary').innerText();
  const stored = await page.evaluate(() => ({
    history: JSON.parse(localStorage.getItem('chuyen-anh.history.v1') || '[]'),
    progress: JSON.parse(localStorage.getItem('chuyen-anh.progress.v1') || '{}')
  }));
  page.off('pageerror', onError);

  const consolidationGaps = consolidationOrder.map(word => {
    const fIdx = turnSequence.findIndex(t => t.word === word && t.kind === 'firstPass');
    const cIdx = turnSequence.findIndex(t => t.word === word && t.kind === 'consolidation');
    return fIdx >= 0 && cIdx > fIdx ? cIdx - fIdx - 1 : -1;
  });

  const mean = values => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);
  return {
    flow,
    thinkMs,
    reactionMs,
    elapsedMs: elapsed,
    gradedTurns: graded,
    practiceTurns: practiceSeen,
    consolidationTurns: consolidationSeen,
    wordsCompleted: new Set(order).size,
    wordOrder: order,
    consolidationOrder,
    consolidationGaps,
    minConsolidationGap: consolidationGaps.length ? Math.min(...consolidationGaps) : null,
    wrongAt,
    handoffSamples: handoffLatency.length,
    continueSamples: continueLatency.length,
    meanFeedbackLatencyMs: mean(feedbackLatency),
    meanHandoffLatencyMs: mean(handoffLatency),
    meanContinueLatencyMs: mean(continueLatency),
    turnTimingsByClass: {
      firstPass: summarizeBucket(classSamples.firstPass),
      handOff: summarizeBucket(classSamples.handOff),
      consolidation: summarizeBucket(classSamples.consolidation),
      retry: summarizeBucket(classSamples.retry)
    },
    outliersDropped: 0,
    summary: summary.replace(/\s+/g, ' ').trim(),
    history: stored.history,
    pageErrors: errors
  };
}

function summarize(rounds, { app, flow, thinkMs, reactionMs }, browserVersion, expectedOrder) {
  const first = rounds[0];
  for (const [index, round] of rounds.entries()) {
    validateResult(round, { flow, thinkMs, reactionMs, expectedOrder, round: true, label: `${path.basename(app)} ${flow} think=${thinkMs} round ${index + 1}` });
  }
  const allElapsed = rounds.map(round => round.elapsedMs);
  const elapsedMs = median(allElapsed);
  const meanElapsedMs = Math.round(allElapsed.reduce((acc, v) => acc + v, 0) / allElapsed.length);
  const aggregateClass = bucketName => {
    const nonEmpty = rounds.map(r => r.turnTimingsByClass[bucketName]).filter(b => b.samples > 0);
    if (!nonEmpty.length) return { samples: 0, medianMs: null, meanMs: null };
    return {
      samples: first.turnTimingsByClass[bucketName].samples,
      medianMs: median(nonEmpty.map(b => b.medianMs)),
      meanMs: Number((nonEmpty.reduce((acc, b) => acc + b.meanMs, 0) / nonEmpty.length).toFixed(2))
    };
  };
  const result = {
    app,
    flow,
    thinkMs,
    reactionMs,
    rounds: rounds.length,
    aggregation: 'median',
    outlierPolicy: 'retain-all-rounds-report-median-mean-and-range',
    outliersDropped: 0,
    elapsedMs,
    meanElapsedMs,
    minElapsedMs: Math.min(...allElapsed),
    maxElapsedMs: Math.max(...allElapsed),
    elapsedMsAllRounds: allElapsed,
    throughputPerMinute: Number((first.wordsCompleted / (elapsedMs / 60000)).toFixed(2)),
    gradedTurns: first.gradedTurns,
    practiceTurns: first.practiceTurns,
    consolidationTurns: first.consolidationTurns,
    wordsCompleted: first.wordsCompleted,
    wrongAt: first.wrongAt,
    wordOrder: first.wordOrder,
    consolidationOrder: first.consolidationOrder,
    consolidationGaps: first.consolidationGaps,
    minConsolidationGap: first.minConsolidationGap,
    handoffSamples: first.handoffSamples,
    continueSamples: first.continueSamples,
    meanFeedbackLatencyMs: median(rounds.map(round => round.meanFeedbackLatencyMs).filter(value => value !== null)),
    meanHandoffLatencyMs: first.meanHandoffLatencyMs === null ? null : median(rounds.map(round => round.meanHandoffLatencyMs).filter(value => value !== null)),
    meanContinueLatencyMs: first.meanContinueLatencyMs === null ? null : median(rounds.map(round => round.meanContinueLatencyMs).filter(value => value !== null)),
    turnTimingsByClass: {
      firstPass: aggregateClass('firstPass'),
      handOff: aggregateClass('handOff'),
      consolidation: aggregateClass('consolidation'),
      retry: aggregateClass('retry')
    },
    limitations: SCIENTIFIC_LIMITATION_NOTE,
    summary: first.summary,
    history: first.history,
    pageErrors: first.pageErrors,
    browser: browserVersion
  };
  return validateResult(result, { flow, thinkMs, reactionMs, rounds: rounds.length, expectedOrder });
}

async function openPage(_url, html) {
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  return { server, url: `http://127.0.0.1:${server.address().port}` };
}

async function runScenario(browser, { app, flow, thinkMs, reactionMs, rounds, expectedOrder }) {
  const html = fs.readFileSync(app);
  const { server, url } = await openPage(null, html);
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const results = [];
    for (let round = 0; round < rounds; round += 1) {
      results.push(await runRound(page, url, { flow, thinkMs, reactionMs }));
    }
    return summarize(results, { app, flow, thinkMs, reactionMs }, browser.version(), expectedOrder);
  } finally {
    server.close();
  }
}

async function launch() {
  let executablePath = process.env.BROWSER_EXECUTABLE;
  let args = ['--no-sandbox'];
  if (!executablePath) {
    const bundled = require('@sparticuz/chromium');
    const lambdaFs = require('@sparticuz/chromium/build/lambdafs').default;
    executablePath = await bundled.executablePath();
    await lambdaFs.inflate(path.join(path.dirname(require.resolve('@sparticuz/chromium')), '../bin/al2023.tar.br'));
    process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
    args = bundled.args;
  }
  return chromium.launch({ executablePath, args, headless: true });
}

async function main() {
  const unknownFlags = process.argv.slice(2).filter(arg => arg !== '--matrix');
  if (unknownFlags.length) {
    throw new Error(`unknown flag(s): ${unknownFlags.join(', ')}`);
  }
  const rounds = parsePositiveIntEnv('ROUNDS', 3);
  const browser = await launch();
  try {
    if (MATRIX) {
      const app = path.resolve(process.env.APP || path.join(__dirname, '../index.html'));
      if (!fs.existsSync(app)) throw new Error(`missing build: ${app}`);
      const scenarios = [];
      let reference = null;
      for (const { thinkMs, reactionMs } of MATRIX_SCENARIOS) {
        for (const flow of ['standard', 'sprint']) {
          const result = await runScenario(browser, { app, flow, thinkMs, reactionMs, rounds, expectedOrder: reference });
          if (!reference) reference = result.wordOrder;
          scenarios.push({ flow, ...result });
        }
      }
      if (scenarios.length !== MATRIX_SCENARIOS.length * 2) {
        throw new Error(`matrix produced ${scenarios.length} scenarios, expected ${MATRIX_SCENARIOS.length * 2}`);
      }
      for (const scenario of scenarios) {
        validateResult(scenario, { rounds, expectedOrder: reference, label: `${scenario.flow}/${scenario.thinkMs}` });
      }
      console.log(JSON.stringify({
        matrix: true,
        rounds,
        aggregation: 'median',
        outlierPolicy: 'retain-all-rounds-report-median-mean-and-range',
        outliersDropped: 0,
        app,
        note: SCIENTIFIC_LIMITATION_NOTE,
        referenceOrder: reference,
        scenarios
      }, null, 2));
    } else {
      const app = path.resolve(process.env.APP || path.join(__dirname, '../index.html'));
      if (!fs.existsSync(app)) throw new Error(`missing build: ${app}`);
      const flow = (process.env.FLOW || 'sprint').toLowerCase();
      if (!['sprint', 'standard'].includes(flow)) {
        throw new Error(`FLOW must be 'sprint' or 'standard' (received ${JSON.stringify(process.env.FLOW)})`);
      }
      const thinkMs = parseNonNegativeMsEnv('THINK_MS', 600);
      const reactionMs = parseNonNegativeMsEnv('REACTION_MS', 450);
      const result = await runScenario(browser, { app, flow, thinkMs, reactionMs, rounds });
      console.log(JSON.stringify(result, null, 2));
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(`benchmark failed: ${error.message}`);
  process.exit(1);
});
