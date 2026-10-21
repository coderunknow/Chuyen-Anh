// Optional real-browser speed benchmark. It measures how long the *same* learning
// work takes in two flows, so a change can be compared against the beta1 build.
//
// npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
//
//   APP=path/to/index.html FLOW=standard|sprint node tests/speed-benchmark.cjs
//
// Environment:
//   APP          path to the built index.html (default: repository index.html)
//   FLOW         "standard" = quick10 mixed session (control), "sprint" = Học cấp tốc
//   THINK_MS     simulated time the learner spends reading each question (default 600)
//   REACTION_MS  simulated time to reach and press the manual "Tiếp tục" control (default 450)
//   ROUNDS       repetitions; the median is reported (default 3)
//
// The scenario is fixed: ten words, six of them due and weak, two in learning and
// two never studied; the fourth graded card is answered wrong, which queues the
// single corrective retry. Both flows therefore perform exactly eleven
// interactions: ten first-pass retrievals plus one correction. No word is skipped
// and no turn is removed, so a faster result cannot come from doing less work.
//
// It prints one JSON object: wall-clock time, per-turn latency, the order of the
// words it actually saw, and counters taken from localStorage afterwards.
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

const APP = path.resolve(process.env.APP || path.join(__dirname, '../index.html'));
const FLOW = (process.env.FLOW || 'sprint').toLowerCase();
const THINK_MS = Number(process.env.THINK_MS || 600);
const REACTION_MS = Number(process.env.REACTION_MS || 450);
const ROUNDS = Math.max(1, Number(process.env.ROUNDS || 3));
const WORDS = 10;
const WRONG_POSITION = 3; // zero-based: the fourth graded card is missed

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
  }, null, { timeout, polling: 50 });
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
  }, null, { timeout, polling: 50 });
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
async function runRound(page, url) {
  const errors = [];
  const onError = error => errors.push(error.message);
  page.on('pageerror', onError);
  await page.goto(url);
  await page.locator('[data-session]').first().waitFor();
  const plan = await page.evaluate(seedScript());
  await page.reload();
  await page.locator('#sprint-title').waitFor();

  const selector = FLOW === 'standard' ? '[data-session="quick10"]' : '[data-session="sprint"]';
  const started = Date.now();
  await page.locator(selector).click();

  const order = [];
  const turnLatency = [];
  const advanceLatency = [];
  let practiceSeen = 0;
  let graded = 0;
  let wrongAt = -1;

  for (let guard = 0; guard < 40; guard += 1) {
    if (await page.locator('.summary').count()) break;
    let card = await readCard(page);

    // The introduction is part of the existing contract: a never-studied word is
    // shown first. Both flows pay this step; it is not removed by the benchmark.
    if (card.intro) {
      await sleep(THINK_MS);
      await page.locator('#start-quiz').click();
      card = await readCard(page);
    }

    if (process.env.BENCH_DEBUG) console.error(`[turn ${graded + practiceSeen + 1}] ${card.mode} | ${card.prompt.slice(0, 40)} | wrong=${!card.mode.includes('luyện lại') && graded === WRONG_POSITION}`);
    if (!card.mode.includes('luyện lại')) {
      order.push(card.prompt);
      graded += 1;
    } else {
      practiceSeen += 1;
    }

    const isWrong = !card.mode.includes('luyện lại') && graded - 1 === WRONG_POSITION;
    if (isWrong) wrongAt = graded - 1;

    // Simulated reading time, identical in both flows.
    await sleep(THINK_MS);
    const before = await page.locator('.flashcard-head').innerText().catch(() => null);
    const answeredAt = Date.now();
    await answerCard(page, card, plan, !isWrong);

    if (FLOW === 'sprint' && !isWrong && !card.mode.includes('luyện lại')) {
      // The sprint hands the learner on by itself. Measure whatever the build
      // actually does: beta1 waits on a fixed dwell timer, beta2 replaces the card
      // immediately and carries the answer as a strip. No click is simulated here,
      // so a dwell cannot be hidden by a fast synthetic learner.
      await waitForAnswerRegistered(page, 15000);
      const registeredAt = Date.now();
      await waitForAnswerable(page, 15000);
      turnLatency.push(registeredAt - answeredAt);
      advanceLatency.push(Date.now() - registeredAt);
    } else {
      // Every other turn keeps a feedback panel and needs the learner to continue.
      await page.locator('#feedback-area .feedback, .summary').first().waitFor({ timeout: 15000 });
      turnLatency.push(Date.now() - answeredAt);
      await sleep(REACTION_MS);
      const advancedAt = Date.now();
      await page.locator('#next-card').click();
      await page.waitForFunction(previous => {
        const node = document.querySelector('.flashcard-head');
        return !node || node.innerText !== previous;
      }, before, { timeout: 15000 }).catch(() => {});
      advanceLatency.push(Date.now() - advancedAt);
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

  return {
    flow: FLOW,
    thinkMs: THINK_MS,
    reactionMs: REACTION_MS,
    elapsedMs: elapsed,
    gradedTurns: graded,
    practiceTurns: practiceSeen,
    wordsCompleted: new Set(order).size,
    wordOrder: order,
    wrongAt,
    meanTurnLatencyMs: Math.round(turnLatency.reduce((a, b) => a + b, 0) / Math.max(1, turnLatency.length)),
    meanAdvanceLatencyMs: Math.round(advanceLatency.reduce((a, b) => a + b, 0) / Math.max(1, advanceLatency.length)),
    throughputPerMinute: Number((new Set(order).size / (elapsed / 60000)).toFixed(2)),
    summary: summary.replace(/\s+/g, ' ').trim(),
    history: stored.history,
    pageErrors: errors
  };
}

function median(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

async function main() {
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
  const html = fs.readFileSync(APP);
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  const url = `http://127.0.0.1:${server.address().port}`;
  let browser;
  try {
    browser = await chromium.launch({ executablePath, args, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const rounds = [];
    for (let round = 0; round < ROUNDS; round += 1) rounds.push(await runRound(page, url));
    const first = rounds[0];
    console.log(JSON.stringify({
      app: APP,
      flow: FLOW,
      thinkMs: THINK_MS,
      reactionMs: REACTION_MS,
      rounds: rounds.length,
      elapsedMs: median(rounds.map(round => round.elapsedMs)),
      elapsedMsAllRounds: rounds.map(round => round.elapsedMs),
      throughputPerMinute: Number((first.wordsCompleted / (median(rounds.map(round => round.elapsedMs)) / 60000)).toFixed(2)),
      gradedTurns: first.gradedTurns,
      practiceTurns: first.practiceTurns,
      wordsCompleted: first.wordsCompleted,
      wrongAt: first.wrongAt,
      wordOrder: first.wordOrder,
      meanTurnLatencyMs: median(rounds.map(round => round.meanTurnLatencyMs)),
      meanAdvanceLatencyMs: median(rounds.map(round => round.meanAdvanceLatencyMs)),
      summary: first.summary,
      history: first.history,
      pageErrors: first.pageErrors,
      browser: browser.version()
    }, null, 2));
  } finally {
    if (browser) await browser.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exit(1); });
