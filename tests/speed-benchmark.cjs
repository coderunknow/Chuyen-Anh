// Optional real-browser speed benchmark. It measures how long the *same* learning
// work takes in two flows, so a change can be compared against the beta1 build.
//
// npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
//
//   APP=path/to/index.html FLOW=standard|sprint node tests/speed-benchmark.cjs
//   APP_BETA1=old.html APP_BETA2=new.html node tests/speed-benchmark.cjs --matrix
//
// Environment:
//   APP          path to the built index.html (default: repository index.html)
//   FLOW         "standard" = quick10 mixed session (control), "sprint" = Học cấp tốc
//   THINK_MS     simulated time the learner spends reading each question (default 600)
//   REACTION_MS  simulated time to reach and press the manual "Tiếp tục" control (default 450)
//   ROUNDS       repetitions; the median is reported (default 3)
//   APP_BETA1 / APP_BETA2   the two builds compared by --matrix
//
// The scenario is fixed: ten words, six of them due and weak, two in learning and
// two never studied; the fourth graded card is answered wrong, which queues the
// single corrective retry. Both flows therefore perform exactly eleven
// interactions: ten first-pass retrievals plus one correction. No word is skipped
// and no turn is removed, so a faster result cannot come from doing less work.
//
// Timing boundaries. Every latency is measured inside the page with
// performance.now(): a capture-phase listener stamps the answer (or the continue
// click) when the app receives it, and a MutationObserver stamps the moment the
// visible card actually changes. Measuring outside the page is what went wrong in
// the first version of this file: it stamped the answer before Playwright clicked
// and the card after the click promise resolved, which under-reported a fixed
// dwell by roughly the click overhead.
//
// Nothing here clicks on the automatic hand-off path. The sprint must move the
// card by itself, so a fixed dwell cannot be hidden by a fast synthetic learner.
// tests/benchmark-contract.cjs turns the workload invariants into assertions; a
// run that graded fewer words, lost the retry, changed the order or logged a page
// error fails the benchmark with a non-zero exit instead of printing a result.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');
const { EXPECTED, median, validateResult } = require('./benchmark-contract.cjs');

const WORDS = EXPECTED.gradedTurns;
const WRONG_POSITION = EXPECTED.wrongAt;
const MATRIX = process.argv.includes('--matrix');
// The three learner speeds the comparison is reported at. Reading time and the
// time to reach the manual continue control are varied independently so the result
// cannot hinge on one synthetic pace.
const MATRIX_SCENARIOS = Object.freeze([
  { thinkMs: 600, reactionMs: 450 },
  { thinkMs: 1200, reactionMs: 450 },
  { thinkMs: 600, reactionMs: 250 }
]);

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

function seedScript() {
  // Six weak cards that are due, ordered by nextReview; two in learning; two never
  // studied. Both selectSession('mixed') and selectSprintSession therefore produce
  // the same sequence: weak (oldest review first), then learning, then new.
  return `(() => {
    const now = Date.now();
    const data = JSON.parse(document.getElementById('vocabulary-data').textContent).slice(0, ${WORDS});
    const progress = {};
    data.forEach((entry, index) => {
      const base = {
        id: entry.id, correctCount: 0, wrongCount: 0, streak: 0,
        lastReviewed: now - 86400000, nextReview: now + 86400000,
        interval: 1, ease: 2.3, difficulty: 0.4
      };
      if (index < 6) {
        progress[entry.id] = { ...base, state: 'weak', wrongCount: 3 + index,
          lastReviewed: now - 3600000, nextReview: now - (6 - index) * 60000 };
      } else if (index < 8) {
        progress[entry.id] = { ...base, state: 'learning', nextReview: now + 3600000 + index };
      } else {
        progress[entry.id] = { ...base, state: 'new', nextReview: now };
      }
    });
    localStorage.clear();
    localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
    localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, darkMode: false, keyboardShortcuts: false }));
    return data.map(entry => ({ id: entry.id, word: entry.word, meaning: entry.meaning }));
  })()`;
}

// Installed once per page. Records, in the page's own clock: when the app received
// the answer, when it received the manual continue click, when feedback appeared
// and when the visible card actually changed.
async function installProbe(page) {
  await page.evaluate(() => {
    window.__bench = { baseline: '', answerAt: null, continueAt: null, changeAt: null, feedbackAt: null };
    const stampPrompt = () => (document.querySelector('.prompt')?.innerText ?? '');
    document.addEventListener('click', event => {
      const node = event.target instanceof Element ? event.target.closest('[data-option], #next-card, #submit-answer, #reveal-correct, #reveal-wrong') : null;
      if (!node) return;
      if (node.id === 'next-card') {
        if (window.__bench.continueAt === null) window.__bench.continueAt = performance.now();
        return;
      }
      if (window.__bench.answerAt === null) {
        window.__bench.answerAt = performance.now();
        window.__bench.baseline = stampPrompt();
      }
    }, true);
    document.addEventListener('keydown', event => {
      if (event.key !== 'Enter') return;
      if (event.target?.id !== 'spelling-input') return;
      if (window.__bench.answerAt !== null) return;
      window.__bench.answerAt = performance.now();
      window.__bench.baseline = stampPrompt();
    }, true);
    new MutationObserver(() => {
      if (window.__bench.feedbackAt === null && document.querySelector('#feedback-area .feedback, .handoff-strip')) {
        window.__bench.feedbackAt = performance.now();
      }
      if (window.__bench.changeAt === null && stampPrompt() !== window.__bench.baseline) {
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
    window.__bench.baseline = document.querySelector('.prompt')?.innerText ?? '';
  });
}

const readProbe = page => page.evaluate(() => ({ ...window.__bench }));

async function readCard(page) {
  if (await page.locator('#start-quiz').count()) return { intro: true };
  const mode = (await page.locator('.mode-label').innerText()).toLowerCase();
  const prompt = (await page.locator('.prompt').innerText()).trim();
  return { intro: false, mode, prompt };
}

// Two observational phases shared by both builds: the answer must register, then a
// fresh, answerable card (or the summary) must appear. beta1 disables the options
// during its fixed dwell, beta2 swaps the card at once; both satisfy the same pair.
function waitForAnswerRegistered(page, timeout) {
  return page.waitForFunction(() => {
    if (document.querySelector('.summary, .handoff-strip, #feedback-area .feedback')) return true;
    return [...document.querySelectorAll('[data-option]')].some(node => node.disabled);
  }, null, { timeout, polling: 25 });
}

// The card must actually be gone before the loop reads the next one. Without this
// the loop can re-read the card it just answered (the panel is still on screen for
// a frame), count a second turn and then grade the same card twice.
function waitForAdvance(page, previousPrompt, timeout) {
  return page.waitForFunction(previous => {
    if (document.querySelector('.summary')) return true;
    return (document.querySelector('.prompt')?.innerText ?? '') !== previous;
  }, previousPrompt, { timeout, polling: 25 });
}

// Only a card that can accept input counts. beta1 keeps its feedback panel (and its
// `#next-card`) visible during the dwell, so the presence of that button says
// nothing about whether a new card has arrived.
function waitForAnswerable(page, timeout) {
  return page.waitForFunction(() => {
    if (document.querySelector('.summary')) return true;
    if (document.querySelector('#spelling-input:not([disabled])')) return true;
    if (document.querySelector('[data-option]:not([disabled])')) return true;
    // A never-studied word opens on its first-look panel; the session continues
    // once the learner starts the check, so that panel is a valid next state too.
    return Boolean(document.querySelector('#start-quiz'));
  }, null, { timeout, polling: 25 });
}

async function answerCard(page, card, plan, correct) {
  if (card.mode.includes('chính tả')) {
    const entry = plan.find(item => item.meaning === card.prompt) || { word: 'unknown' };
    await page.locator('#spelling-input').fill(correct ? entry.word : 'definitely not the word');
    await page.locator('#spelling-input').press('Enter');
    return;
  }
  const target = card.mode.includes('nhận diện') ? plan.find(item => item.word === card.prompt) : null;
  const wantMeaning = card.mode.includes('nhận diện');
  const options = page.locator('[data-option]');
  const count = await options.count();
  for (let index = 0; index < count; index += 1) {
    const text = (await options.nth(index).innerText()).replace(/^\d+\s*/, '').trim();
    const entry = plan.find(item => (wantMeaning ? item.meaning : item.word) === text);
    const isCorrect = Boolean(entry) && (!wantMeaning || (target && entry.id === target.id));
    if (isCorrect === correct) {
      await options.nth(index).click();
      return;
    }
  }
  throw new Error(`no ${correct ? 'correct' : 'wrong'} option found for ${card.mode} / ${card.prompt}`);
}

// The headless shell in this sandbox supports a single page, so rounds reuse one
// page and reset storage instead of opening a fresh tab each time.
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
  const feedbackLatency = [];
  const handoffLatency = [];
  const continueLatency = [];
  let practiceSeen = 0;
  let graded = 0;
  let wrongAt = -1;

  for (let guard = 0; guard < 40; guard += 1) {
    if (await page.locator('.summary').count()) break;
    let card = await readCard(page);

    // The introduction is part of the existing contract: a never-studied word is
    // shown first. Both flows pay this step; it is not removed by the benchmark.
    if (card.intro) {
      await sleep(thinkMs);
      await page.locator('#start-quiz').click();
      card = await readCard(page);
    }
    await resetProbe(page);

    if (process.env.BENCH_DEBUG) {
      console.error(`[turn ${graded + practiceSeen + 1}] ${card.mode} | ${card.prompt.slice(0, 40)}`);
    }
    if (!card.mode.includes('luyện lại')) {
      order.push(card.prompt);
      graded += 1;
    } else {
      practiceSeen += 1;
    }

    const isWrong = !card.mode.includes('luyện lại') && graded - 1 === WRONG_POSITION;
    if (isWrong) wrongAt = graded - 1;

    // Simulated reading time, identical in both flows.
    await sleep(thinkMs);
    await answerCard(page, card, plan, !isWrong);

    const sprintHandoff = flow === 'sprint' && !isWrong && !card.mode.includes('luyện lại');
    await waitForAnswerRegistered(page, 15000);

    if (sprintHandoff) {
      // The sprint hands the learner on by itself. No click is simulated here, so a
      // fixed dwell cannot be hidden; the in-page observer stamps the real change.
      // Wait for the app itself to replace the card; a build that keeps the panel
      // waiting for a click fails here with a precise message instead of a timeout
      // somewhere later in the loop.
      const replaced = await page.waitForFunction(() => window.__bench.changeAt !== null, null, { timeout: 15000, polling: 25 })
        .then(() => true).catch(() => false);
      if (!replaced) throw new Error('the sprint did not replace the card after a correct answer');
      // The next card must also be genuinely answerable, not merely re-rendered.
      await waitForAnswerable(page, 15000);
      const afterAnswer = await readProbe(page);
      if (Number.isFinite(afterAnswer.feedbackAt) && Number.isFinite(afterAnswer.answerAt)) {
        feedbackLatency.push(Math.round(afterAnswer.feedbackAt - afterAnswer.answerAt));
      }
      if (!Number.isFinite(afterAnswer.changeAt) || !Number.isFinite(afterAnswer.answerAt)) {
        throw new Error('the sprint did not replace the card after a correct answer');
      }
      handoffLatency.push(Math.round(afterAnswer.changeAt - afterAnswer.answerAt));
    } else {
      // Every other turn keeps a feedback panel and needs the learner to continue.
      await page.locator('#feedback-area .feedback, .summary').first().waitFor({ timeout: 15000 });
      const afterAnswer = await readProbe(page);
      if (Number.isFinite(afterAnswer.feedbackAt) && Number.isFinite(afterAnswer.answerAt)) {
        feedbackLatency.push(Math.round(afterAnswer.feedbackAt - afterAnswer.answerAt));
      }
      if (await page.locator('.summary').count()) continue;
      await sleep(reactionMs);
      await resetProbe(page);
      const promptBeforeContinue = (await page.locator('.prompt').innerText()).trim();
      await page.locator('#next-card').click();
      await waitForAdvance(page, promptBeforeContinue, 15000);
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

  const mean = values => (values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null);
  return {
    flow,
    thinkMs,
    reactionMs,
    elapsedMs: elapsed,
    gradedTurns: graded,
    practiceTurns: practiceSeen,
    wordsCompleted: new Set(order).size,
    wordOrder: order,
    wrongAt,
    handoffSamples: handoffLatency.length,
    continueSamples: continueLatency.length,
    meanFeedbackLatencyMs: mean(feedbackLatency),
    meanHandoffLatencyMs: mean(handoffLatency),
    meanContinueLatencyMs: mean(continueLatency),
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
  const elapsedMs = median(rounds.map(round => round.elapsedMs));
  const result = {
    app,
    flow,
    thinkMs,
    reactionMs,
    rounds: rounds.length,
    elapsedMs,
    elapsedMsAllRounds: rounds.map(round => round.elapsedMs),
    throughputPerMinute: Number((first.wordsCompleted / (elapsedMs / 60000)).toFixed(2)),
    gradedTurns: first.gradedTurns,
    practiceTurns: first.practiceTurns,
    wordsCompleted: first.wordsCompleted,
    wrongAt: first.wrongAt,
    wordOrder: first.wordOrder,
    handoffSamples: first.handoffSamples,
    continueSamples: first.continueSamples,
    meanFeedbackLatencyMs: median(rounds.map(round => round.meanFeedbackLatencyMs).filter(value => value !== null)),
    meanHandoffLatencyMs: first.meanHandoffLatencyMs === null ? null : median(rounds.map(round => round.meanHandoffLatencyMs).filter(value => value !== null)),
    meanContinueLatencyMs: first.meanContinueLatencyMs === null ? null : median(rounds.map(round => round.meanContinueLatencyMs).filter(value => value !== null)),
    summary: first.summary,
    history: first.history,
    pageErrors: first.pageErrors,
    browser: browserVersion
  };
  return validateResult(result, { flow, thinkMs, reactionMs, rounds: rounds.length, expectedOrder });
}

async function openPage(url, html) {
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
  const rounds = Math.max(1, Number(process.env.ROUNDS || 3));
  const browser = await launch();
  try {
    if (MATRIX) {
      const beta1 = path.resolve(process.env.APP_BETA1 || '');
      const beta2 = path.resolve(process.env.APP_BETA2 || path.join(__dirname, '../index.html'));
      for (const app of [beta1, beta2]) {
        if (!fs.existsSync(app)) throw new Error(`missing build: ${app}`);
      }
      const scenarios = [];
      let reference = null;
      for (const { thinkMs, reactionMs } of MATRIX_SCENARIOS) {
        for (const [label, app] of [['beta1', beta1], ['beta2', beta2]]) {
          for (const flow of ['standard', 'sprint']) {
            const result = await runScenario(browser, { app, flow, thinkMs, reactionMs, rounds, expectedOrder: reference });
            if (!reference) reference = result.wordOrder;
            scenarios.push({ label, ...result });
          }
        }
      }
      // Every combination must exist exactly once; a missing scenario is a failed
      // benchmark, not a smaller table.
      if (scenarios.length !== MATRIX_SCENARIOS.length * 2 * 2) {
        throw new Error(`matrix produced ${scenarios.length} scenarios, expected ${MATRIX_SCENARIOS.length * 2 * 2}`);
      }
      for (const scenario of scenarios) {
        validateResult(scenario, { rounds, expectedOrder: reference, label: `${scenario.label}/${scenario.flow}/${scenario.thinkMs}` });
      }
      console.log(JSON.stringify({
        matrix: true,
        rounds,
        builds: { beta1, beta2 },
        referenceOrder: reference,
        scenarios
      }, null, 2));
    } else {
      const app = path.resolve(process.env.APP || path.join(__dirname, '../index.html'));
      const flow = (process.env.FLOW || 'sprint').toLowerCase();
      const thinkMs = Number(process.env.THINK_MS || 600);
      const reactionMs = Number(process.env.REACTION_MS || 450);
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
