// Optional real-browser regression suite. No production or CI dependency is added.
// npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
// node tests/browser-learning.cjs
// Alternatively provide BROWSER_EXECUTABLE with playwright-core installed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { chromium } = require('playwright-core');

async function main() {
  let executablePath = process.env.BROWSER_EXECUTABLE;
  let args = ['--no-sandbox'];
  if (!executablePath) {
    const bundled = require('@sparticuz/chromium');
    const lambdaFs = require('@sparticuz/chromium/build/lambdafs').default;
    executablePath = await bundled.executablePath();
    // This minimal Linux sandbox lacks NSS; the optional package includes it.
    await lambdaFs.inflate(path.join(path.dirname(require.resolve('@sparticuz/chromium')), '../bin/al2023.tar.br'));
    process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
    args = bundled.args;
  }
  const html = fs.readFileSync(path.join(__dirname, '../index.html'));
  const server = http.createServer((_req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
  let browser;
  try {
    browser = await chromium.launch({ executablePath, args, headless: true });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-session="new"]').waitFor();
    assert.match(await page.locator('.session-grid--focus [data-session="due"]').innerText(), /0 từ/);
    assert.equal(await page.locator('.study-recommendation [data-session]').getAttribute('data-session'), 'quick10',
      'a fresh profile is offered a short mixed session instead of an empty due queue');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#content')).outlineWidth), '0px',
      'programmatic focus does not draw a frame around the whole page');
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#f5f7fb', 'the browser chrome starts in the light theme');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.themeChoice), 'system',
      'a fresh profile follows prefers-color-scheme until the learner chooses a theme');
    await page.setViewportSize({ width: 375, height: 812 });
    const homeMobile = await page.evaluate(() => {
      const rect = selector => { const { top, bottom, width } = document.querySelector(selector).getBoundingClientRect(); return { top, bottom, width }; };
      return { main: rect('#content'), action: rect('[data-session="priority"]'), nav: rect('.sidebar'), support: rect('.support-sidebar'), scrollWidth: document.documentElement.scrollWidth };
    });
    assert.equal(homeMobile.main.top < 220, true, 'the main study choice follows compact mobile navigation');
    assert.equal(homeMobile.action.bottom < 812, true, 'the primary study action is in the first 375×812 viewport');
    assert.equal(homeMobile.support.top > homeMobile.main.top, true, 'secondary progress/help follows the study entry point on mobile');
    assert.equal(homeMobile.scrollWidth <= 375, true, 'the homepage does not overflow horizontally');
    assert.equal(await page.locator('.session-card .icon').count() > 0, true, 'session icons are self-contained SVGs');
    assert.equal(await page.locator('.session-card').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s', 'reduced motion removes nonessential card transitions');
    await page.setViewportSize({ width: 320, height: 720 });
    const homeNarrow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      mainTop: document.querySelector('#content').getBoundingClientRect().top,
      actionBottom: document.querySelector('[data-session="priority"]').getBoundingClientRect().bottom
    }));
    assert.equal(homeNarrow.width <= 320, true, 'the minimum supported 320px viewport has no horizontal overflow');
    assert.equal(homeNarrow.mainTop < 220, true, 'the primary study content stays near the top at 320px');
    assert.equal(homeNarrow.actionBottom < 720, true, 'the recommended action fits the first 320×720 viewport');
    await page.setViewportSize({ width: 768, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the tablet breakpoint does not introduce horizontal overflow');
    await page.setViewportSize({ width: 1280, height: 900 });

    // ---- Timed practice: a real clock, unanswered questions are blank, not wrong.
    // This runs on the real clock before the date is frozen for the date-sensitive
    // scenarios below; the minimum selectable limit is one minute, so the wait is
    // a real minute rather than a simulated one.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['298', '2', '3']));
      localStorage.setItem('chuyen-anh.study.v1', JSON.stringify({
        groups: { due: true, weak: true, new: true, review: true },
        focus: 'due',
        exercises: { mc_en_vi: true, mc_vi_en: false, fill_vi: false, fill_en: false, cloze: false, match: false, flashcard: false },
        size: 10, timed: true, timerMinutes: 1
      }));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    assert.equal(await page.locator('#session-timer').count(), 1, 'a timed session shows its remaining time');
    assert.equal(await page.locator('#session-timer').innerText(), '01:00');
    assert.equal(await page.locator('#session-timer').getAttribute('role'), 'timer');
    const progressBeforeTimeout = await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1'));
    const historyBeforeTimeout = await page.evaluate(() => localStorage.getItem('chuyen-anh.history.v1'));
    await page.locator('#session-timer').filter({ hasText: /^00:4\d$/ }).waitFor({ timeout: 40000 });
    assert.equal(await page.locator('#session-timer').count(), 1, 're-rendering a card never duplicates the timer');
    await page.locator('.summary').waitFor({ timeout: 60000 });
    assert.equal(await page.locator('#session-timer').count(), 0, 'the timer stops when it reaches zero');
    const timeoutSummary = await page.locator('.summary').innerText();
    assert.match(timeoutSummary, /Hết giờ/, 'an expired session lands on its results');
    assert.match(timeoutSummary, /3\s*\n?\s*Bỏ trống/, 'unanswered questions are reported as blank');
    assert.match(timeoutSummary, /XP nhận trong phiên\s*\n?\s*\+0/, 'a session with no graded answer earns no XP');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.history.v1')), historyBeforeTimeout,
      'an unanswered session does not enter the accuracy history');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1')), progressBeforeTimeout,
      'an unanswered session writes no scheduling state');
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));

    const key = name => `chuyen-anh.${name}.v1`;
    const read = name => page.evaluate(k => JSON.parse(localStorage.getItem(k)), key(name));
    async function seed(ids) {
      await page.evaluate(ids => {
        localStorage.clear();
        localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(ids));
        localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: true, darkMode: false }));
      }, ids);
      await page.reload();
      await page.locator('[data-session="favorites"]').click();
    }
    async function next() {
      assert.equal(await page.evaluate(() => document.activeElement.id), 'next-card');
      await page.keyboard.press('Enter');
    }
    async function answer(id, correct) {
      await startQuizFromIntroduction();
      await page.locator(correct ? `[data-option="${id}"]` : `[data-option]:not([data-option="${id}"])`).first().click();
    }
    async function typeAnswer(value) {
      await startQuizFromIntroduction();
      await page.locator('#spelling-input').fill(value);
      await page.locator('#spelling-input').press('Enter');
    }
    async function history(expected) {
      const entries = await read('history');
      assert.equal(entries.length, 1);
      for (const [field, value] of Object.entries(expected)) assert.equal(entries[0][field], value, field);
    }
    async function entryFor(word) {
      return page.evaluate(w => JSON.parse(document.getElementById('vocabulary-data').textContent)
        .find(item => item.word.toLowerCase() === w.toLowerCase()), word);
    }
    // A recognition card prompts with the English word, a recall/spelling card with
    // the meaning, so the card on screen is resolved from its own prompt instead of
    // assuming which of the seeded favourites comes first. A favourites session
    // follows vocabulary order, which is data rather than a fixture constant.
    async function currentEntry(ids) {
      const prompt = (await page.locator('.prompt').innerText()).trim().toLowerCase();
      const matches = await page.evaluate(({ prompt, ids }) => {
        const wanted = new Set(ids);
        return JSON.parse(document.getElementById('vocabulary-data').textContent)
          .filter(item => wanted.has(item.id)
            && (item.word.trim().toLowerCase() === prompt || item.meaning.trim().toLowerCase() === prompt))
          .map(item => ({ id: item.id, word: item.word, meaning: item.meaning }));
      }, { prompt, ids });
      assert.equal(matches.length, 1, `the prompt identifies exactly one seeded card: ${prompt}`);
      return matches[0];
    }
    // A never-studied card opens on its introduction; the quiz starts from there.
    async function startQuizFromIntroduction() {
      if (await page.locator('#start-quiz').count()) await page.locator('#start-quiz').click();
    }

    // ---- "Học cấp tốc" is a learning method, not only a faster hand-off. Every
    // configured word is asked at the retrieval level its record has earned and is
    // then checked once more after other cards. This drives the real app for ten
    // words: ten first passes, ten delayed consolidations and one typed retry.
    // Reuse the open tab: the sandbox browser cannot reliably open a third page
    // after the storage-failure scenario has closed its own tab.
    const sprint = page;
    const sprintErrors = [];
    sprint.on('pageerror', error => sprintErrors.push(error.message));
    await sprint.setViewportSize({ width: 1280, height: 900 });
    await sprint.goto(`http://127.0.0.1:${server.address().port}`);
    await sprint.locator('[data-session="new"]').waitFor();

    // Ten eligible words is already more than the retired seven-card cap.
    const sprintPlan = await sprint.evaluate(() => {
      const now = Date.now();
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 10);
      const progress = {};
      data.forEach((entry, index) => {
        const wrongCount = 40 - index * 2; // distinct, so the priority order is deterministic
        progress[entry.id] = {
          id: entry.id, state: 'weak', correctCount: 0, wrongCount, streak: 0,
          lastReviewed: now - 86400000, nextReview: now - 3600000,
          interval: 0, ease: 2.3, difficulty: 0.5
        };
      });
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: true, darkMode: false }));
      return data.map((entry, index) => ({ id: entry.id, word: entry.word, meaning: entry.meaning, wrongCount: 40 - index * 2 }));
    });
    await sprint.reload();
    await sprint.locator('[data-session="sprint"]').waitFor();

    // The banner reports the real pool, the real queue and the chosen target.
    assert.match(await sprint.locator('#sprint-title').innerText(), /Học cấp tốc · 10 từ \/ phiên/);
    assert.match(await sprint.locator('#sprint-pool').innerText(),
      /5112 từ đủ điều kiện · xếp 10 · 10 đến hạn · 10 từ yếu/,
      'the banner counts the whole eligible pool and the real queue');
    assert.equal(await sprint.locator('.sprint-banner .recommendation-mark strong').innerText(), '10',
      'the banner shows the configured session size, not a fixed 7');

    await sprint.locator('[data-session="sprint"]').click();
    assert.match(await sprint.locator('.page-header p').innerText(), /Học cấp tốc · 10 từ đã xếp · 10 lượt còn lại/,
      'starting the sprint queues all ten requested words');
    assert.match(await sprint.locator('.flashcard-head').innerText(), /1 \/ 10 lượt · 10 còn lại/);

    // The ten queued words are asked in priority order; the wrong answer is
    // deliberately the third first pass so later cards still exercise the flow.
    const ordered = [...sprintPlan].sort((a, b) => b.wrongCount - a.wrongCount);
    const byWord = new Map(ordered.map(entry => [entry.word, entry]));
    const byMeaning = new Map(ordered.map(entry => [entry.meaning, entry]));
    assert.equal(byMeaning.size, ordered.length, 'the seeded meanings identify exactly one queued word');
    const missed = ordered[2];

    const turns = [];
    let practiceTurns = 0;
    let firstPassTurns = 0;
    let guard = 0;
    while (await sprint.locator('.summary').count() === 0) {
      guard += 1;
      assert.ok(guard <= 30, 'the sprint must finish inside its three-turn-per-word budget');
      const label = (await sprint.locator('.mode-label').innerText()).toLowerCase();
      const consolidation = label.includes('củng cố');
      const practice = label.includes('luyện lại');
      const mode = label.includes('nhận diện') ? 'recognition'
        : label.includes('gợi nhớ ngược') ? 'recall'
          : label.includes('chính tả') ? 'spelling' : null;
      assert.ok(mode, `every sprint turn uses a known retrieval format: ${label}`);
      const prompt = (await sprint.locator('.prompt').innerText()).trim();
      // Recognition shows the English word; recall and spelling show the meaning.
      const entry = mode === 'recognition' ? byWord.get(prompt) : byMeaning.get(prompt);
      assert.ok(entry, `the turn can be traced to one of the queued words: ${prompt}`);
      assert.equal(await sprint.locator('#skip-card').isDisabled(), consolidation,
        'a consolidation turn cannot be skipped while a first-pass card can');

      const wrong = !consolidation && !practice && entry.id === missed.id;
      if (mode === 'spelling') {
        assert.equal(prompt, entry.meaning, `spelling prompt for ${entry.word}`);
        await sprint.locator('#spelling-input').fill(wrong ? 'definitely not the word' : entry.word);
        await sprint.locator('#spelling-input').press('Enter');
      } else {
        // Recognition asks for the meaning, recall and cloze ask for the word.
        const correctText = mode === 'recognition' ? entry.meaning : entry.word;
        const options = sprint.locator('[data-option]');
        const count = await options.count();
        let chosen = false;
        for (let index = 0; index < count; index += 1) {
          const text = (await options.nth(index).innerText()).replace(/^\d+\s*/, '').trim();
          if ((text === correctText) !== wrong) { await options.nth(index).click(); chosen = true; break; }
        }
        assert.equal(chosen, true, `an answerable option exists for ${entry.word}`);
      }

      turns.push({ kind: consolidation ? 'consolidation' : practice ? 'practice' : 'first-pass', mode, id: entry.id, word: entry.word });
      if (practice) practiceTurns += 1;
      if (!consolidation && !practice) firstPassTurns += 1;

      if (wrong) {
        const feedback = await sprint.locator('#feedback-area').innerText();
        assert.match(feedback, /Chưa đúng · Đáp án:/, 'a missed sprint word shows the answer');
        assert.match(feedback, /Đã xếp một lượt gõ lại/, 'the sprint queues a real corrective retry');
        assert.equal(await sprint.locator('#next-card').count(), 1);
        assert.equal(await sprint.locator('.handoff-strip').count(), 0,
          'a wrong answer is not carried away as a strip');
        const head = await sprint.locator('.flashcard-head').innerText();
        await sprint.waitForTimeout(2300);
        assert.equal(await sprint.locator('.flashcard-head').innerText(), head,
          'a wrong answer never advances itself');
        await sprint.locator('#next-card').click();
      } else if (consolidation || practice) {
        const feedback = await sprint.locator('#feedback-area').innerText();
        if (consolidation) {
          assert.match(feedback, /Củng cố đạt/,
            'the delayed check reports its own result instead of pretending to be a first pass');
        } else {
          assert.match(feedback, /Lượt luyện đã hoàn tất/);
        }
        assert.equal(await sprint.locator('#next-card').count(), 1,
          'a consolidation and a retry keep an explicit continue');
        await sprint.waitForTimeout(400);
        assert.equal(await sprint.locator('.summary').count(), 0,
          'practice and consolidation never hand off on their own');
        await sprint.locator('#next-card').click();
      } else {
        // Correct first-pass answer: the next card replaces it immediately and the
        // graded answer survives as a strip. No dwell timer, no extra click.
        const started = Date.now();
        const strip = sprint.locator('.handoff-strip');
        await strip.waitFor({ timeout: 2000 });
        assert.equal(Date.now() - started < 800, true,
          'the hand-off is immediate rather than a fixed dwell');
        assert.match(await strip.innerText(), /Đã trả lời đúng/);
        assert.equal(await sprint.locator('#next-card').count(), 0,
          'a correct sprint answer needs no continue control');
        assert.match(await sprint.locator('.page-header p').innerText(), /Học cấp tốc/);
      }
    }

    const firstPass = turns.filter(turn => turn.kind === 'first-pass');
    const consolidations = turns.filter(turn => turn.kind === 'consolidation');
    const practices = turns.filter(turn => turn.kind === 'practice');
    assert.equal(firstPassTurns, 10, 'the sprint graded all ten requested words, not seven');
    assert.deepEqual(firstPass.map(turn => turn.word), ordered.map(entry => entry.word),
      'all ten words receive their first graded retrieval in priority order');
    assert.equal(practiceTurns, 1, 'exactly one corrective retry was queued');
    assert.equal(practices[0].id, missed.id);
    assert.equal(consolidations.length, 10,
      'every word whose first pass was only recognition is checked again after other cards');
    assert.deepEqual([...new Set(consolidations.map(turn => turn.id))].sort(), ordered.map(entry => entry.id).sort(),
      'one consolidation per word, no duplicates and no invented word');
    assert.ok(consolidations.every(turn => turn.mode === 'recall'),
      'a recognised word is checked by recall, one level above the first pass');
    assert.equal(turns.length, 21, 'ten first passes, ten consolidations and one retry — no silently dropped turn');
    ordered.forEach((entry, index) => {
      const first = turns.findIndex(turn => turn.kind === 'first-pass' && turn.id === entry.id);
      const check = turns.findIndex(turn => turn.kind === 'consolidation' && turn.id === entry.id);
      assert.ok(check > first, `the consolidation of ${entry.word} comes after its own first pass`);
      // The last two checks fall near the end of the queue, where the full gap no
      // longer exists; the exact insertion distance is unit-tested on
      // queueConsolidation, and every check still waits behind the retry-queue tail.
      const requiredGap = index < ordered.length - 2 ? 3 : 1;
      assert.ok(check - first - 1 >= requiredGap,
        `the consolidation of ${entry.word} waits behind other cards`);
    });

    const sprintSummary = await sprint.locator('.summary').innerText();
    assert.match(sprintSummary, /10 từ/);
    assert.match(sprintSummary, /90%/);
    assert.match(sprintSummary, /Luyện lại: 1 đúng · 0 chưa đúng \/ 1 lượt/,
      'the correction is reported separately from first-pass accuracy');
    assert.match(sprintSummary, /Củng cố: 10 đúng · 0 chưa đúng \/ 10 lượt/,
      'the delayed retrieval is reported as its own evidence, never as first-pass accuracy');
    const sprintHistory = await sprint.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.history.v1')));
    assert.equal(sprintHistory.length, 1);
    assert.deepEqual(
      { total: sprintHistory[0].total, correct: sprintHistory[0].correct, wrong: sprintHistory[0].wrong, accuracy: sprintHistory[0].accuracy, mode: sprintHistory[0].mode },
      { total: 10, correct: 9, wrong: 1, accuracy: 90, mode: 'sprint' });
    const sprintProgress = await sprint.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.progress.v1')));
    for (const entry of ordered) {
      if (entry.id === missed.id) {
        assert.equal(sprintProgress[entry.id].wrongCount, entry.wrongCount + 1, 'the missed word was graded wrong once');
        assert.equal(sprintProgress[entry.id].correctCount, 0,
          'neither the corrective retry nor the consolidation adds a correct first pass');
        assert.equal(sprintProgress[entry.id].state, 'weak');
      } else {
        assert.equal(sprintProgress[entry.id].correctCount, 1, `${entry.word} was graded correct once`);
        assert.equal(sprintProgress[entry.id].wrongCount, entry.wrongCount,
          `${entry.word} kept its wrong count through the consolidation`);
        assert.equal(sprintProgress[entry.id].state, 'learning',
          'the consolidation does not advance the stored state on its own');
      }
    }
    const sprintSnapshot = await sprint.evaluate(() => ({ ...localStorage }));
    await sprint.reload();
    await sprint.locator('[data-session="sprint"]').waitFor();
    assert.deepEqual(await sprint.evaluate(() => ({ ...localStorage })), sprintSnapshot,
      'the sprint progress survives a reload unchanged');

    // Navigating away mid-sprint must not shift the queue, fabricate a finished
    // session or lose a graded answer, and the queued consolidation must still be
    // there when the learner returns.
    await sprint.evaluate(() => {
      const now = Date.now();
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 10);
      const progress = {};
      data.forEach((entry, index) => {
        progress[entry.id] = {
          id: entry.id, state: 'weak', correctCount: 0, wrongCount: 40 - index * 2, streak: 0,
          lastReviewed: now - 86400000, nextReview: now - 3600000,
          interval: 0, ease: 2.3, difficulty: 0.5
        };
      });
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: true, darkMode: false }));
    });
    await sprint.reload();
    await sprint.locator('[data-session="sprint"]').waitFor();
    await sprint.locator('[data-session="sprint"]').click();
    const navPlan = await sprint.evaluate(() => {
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 10);
      return data.map(entry => ({ id: entry.id, word: entry.word, meaning: entry.meaning }));
    });

    const gradeCard = async (entry, correct) => {
      const label = (await sprint.locator('.mode-label').innerText()).toLowerCase();
      if (label.includes('chính tả')) {
        await sprint.locator('#spelling-input').fill(correct ? entry.word : 'definitely not the word');
        await sprint.locator('#spelling-input').press('Enter');
        return;
      }
      const wantMeaning = label.includes('nhận diện');
      const options = sprint.locator('[data-option]');
      const count = await options.count();
      for (let index = 0; index < count; index += 1) {
        const text = (await options.nth(index).innerText()).replace(/^\d+\s*/, '').trim();
        const matched = navPlan.find(item => (wantMeaning ? item.meaning : item.word) === text);
        const isCorrect = Boolean(matched) && matched.id === entry.id;
        if (isCorrect === correct) { await options.nth(index).click(); return; }
      }
      throw new Error('no matching option for the navigation scenario');
    };

    // First card: answered correctly, so the sprint hands off instantly and the
    // delayed check for this word joins the queue.
    await gradeCard(navPlan[0], true);
    await sprint.locator('.handoff-strip').waitFor();
    assert.match(await sprint.locator('.handoff-strip').innerText(), new RegExp(navPlan[0].word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'the graded word is carried onto the next card');
    assert.match(await sprint.locator('.page-header p').innerText(), /10 lượt còn lại/,
      'the queued consolidation is counted as a remaining turn');

    await sprint.locator('[data-view="dashboard"]').click();
    await sprint.waitForTimeout(600);
    assert.equal(await sprint.locator('.flashcard').count(), 0, 'the study card is no longer on screen');
    assert.equal(await sprint.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.history.v1') || '[]').length), 0,
      'navigating away does not finish or record the session');
    await sprint.locator('[data-view="learn"]').click();
    const navHeader = await sprint.locator('.page-header p').innerText();
    assert.match(navHeader, /Học cấp tốc · 10 từ đã xếp · 10 lượt còn lại/,
      'the queue advanced exactly once and is still the same session');
    assert.match(await sprint.locator('.handoff-strip').innerText(), /Đã trả lời đúng/,
      'the carried answer survives navigation inside the session');

    // Second card: answered wrong. Nothing may advance, and the panel must survive
    // a trip to another screen and back.
    const remainingBeforeMiss = Number((await sprint.locator('.page-header p').innerText()).match(/(\d+) lượt còn lại/)[1]);
    await gradeCard(navPlan[1], false);
    assert.match(await sprint.locator('#feedback-area').innerText(), /Chưa đúng/);
    const remainingAfterMiss = Number((await sprint.locator('.page-header p').innerText()).match(/(\d+) lượt còn lại/)[1]);
    assert.equal(remainingAfterMiss, remainingBeforeMiss + 2,
      'a miss adds exactly its corrective retry and its delayed check to the queue');
    const wrongPrompt = (await sprint.locator('.prompt').innerText()).trim();
    await sprint.locator('[data-view="search"]').click();
    await sprint.waitForTimeout(300);
    await sprint.locator('[data-view="learn"]').click();
    assert.equal((await sprint.locator('.prompt').innerText()).trim(), wrongPrompt,
      'an unanswered correction keeps its card');
    assert.match(await sprint.locator('#feedback-area').innerText(), /Chưa đúng/,
      'the graded answer was not lost while another screen was open');
    await sprint.locator('#next-card').click();
    const afterContinue = Number((await sprint.locator('.page-header p').innerText()).match(/(\d+) lượt còn lại/)[1]);
    assert.equal(afterContinue, remainingAfterMiss - 1,
      'the continue advances exactly one card and keeps the queued retry and check');
    await sprint.locator('#exit-session').click();
    assert.equal(await sprint.locator('.flashcard').count(), 0, 'exiting the sprint leaves no active card');

    // A skip rotates the queue, so the answer carried by the strip no longer
    // describes the card that came before the visible one. Regression: the strip
    // survived the rotation and labelled an unrelated word with an old verdict.
    await sprint.evaluate(() => {
      const now = Date.now();
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 10);
      const progress = {};
      data.forEach((entry, index) => {
        progress[entry.id] = {
          id: entry.id, state: 'weak', correctCount: 0, wrongCount: 40 - index * 2, streak: 0,
          lastReviewed: now - 86400000, nextReview: now - 3600000,
          interval: 0, ease: 2.3, difficulty: 0.5
        };
      });
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: true, darkMode: false }));
    });
    await sprint.reload();
    await sprint.locator('[data-session="sprint"]').waitFor();
    await sprint.locator('[data-session="sprint"]').click();
    await gradeCard(navPlan[0], true);
    await sprint.locator('.handoff-strip').waitFor();
    const carriedBeforeSkip = (await sprint.locator('.handoff-strip').innerText()).replace(/\s+/g, ' ').trim();
    assert.match(carriedBeforeSkip, new RegExp(navPlan[0].word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')),
      'the strip carries the word graded on the previous card');
    const promptBeforeSkip = (await sprint.locator('.prompt').innerText()).trim();
    await sprint.locator('#skip-card').click();
    assert.equal(await sprint.locator('.handoff-strip').count(), 0,
      'the carried answer is dropped when a skip breaks its adjacency');
    const promptAfterSkip = (await sprint.locator('.prompt').innerText()).trim();
    assert.notEqual(promptAfterSkip, promptBeforeSkip, 'skip moves the session to a different card');
    assert.equal(await sprint.locator('#feedback-area .feedback').count(), 0,
      'a skipped card shows no leftover feedback from the previous answer');
    assert.match(await sprint.locator('.page-header p').innerText(), /10 lượt còn lại/,
      'a skip rotates the queue without consuming a graded turn');
    await sprint.locator('#exit-session').click();

    // The shipped build identifies itself.
    await sprint.locator('[data-view="settings"]').click();
    assert.equal(await sprint.locator('#app-version').innerText(), 'v1.0.0-rc1');
    assert.deepEqual(sprintErrors, []);

    // Error -> intervening word -> typed corrective retrieval -> truthful summary.
    // A favourites session follows vocabulary order, so the card order is data, not
    // a constant: read the word on screen instead of assuming which id comes first
    // (an earlier version assumed 298 preceded 2 and silently graded the wrong word).
    await seed(['298', '2']);
    await startQuizFromIntroduction();
    const firstWord = (await page.locator('.prompt').innerText()).trim();
    const firstEntry = await entryFor(firstWord);
    assert.ok(firstEntry && ['2', '298'].includes(firstEntry.id), `unexpected first favourites card: ${firstWord}`);
    await page.locator(`[data-option]:not([data-option="${firstEntry.id}"])`).first().click();
    const failedProgress = (await read('progress'))[firstEntry.id];
    assert.equal(failedProgress.state, 'weak');
    assert.match(await page.locator('#feedback-area').innerText(), /Đã xếp một lượt gõ lại/);
    await next();
    const secondWord = (await page.locator('.prompt').innerText()).trim();
    assert.notEqual(secondWord, firstWord, 'the second card is the other favourite');
    await answer((await entryFor(secondWord)).id, true);
    await next();
    assert.match(await page.locator('.mode-label').innerText(), /Luyện lại.*Chính tả/i);
    assert.equal(await page.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '67');

    // Native Space on a focused favorite button must not reveal the answer.
    await page.locator('#favorite-card').focus();
    await page.keyboard.press('Space');
    assert.equal(await page.locator('.reveal').count(), 0);
    await page.locator('#favorite-card').click(); // Restore favorite.
    await page.locator('#theme-button').click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#0d1526', 'the browser chrome follows the dark theme');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.prompt').evaluate(el => getComputedStyle(el).color), 'rgb(238, 242, 250)');
    if (process.env.BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#spelling-input').isVisible(), true);
    await typeAnswer(firstWord);
    assert.deepEqual((await read('progress'))[firstEntry.id], failedProgress);
    await next();
    assert.match(await page.locator('.summary').innerText(), /50%/);
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 1 đúng · 0 chưa đúng \/ 1 lượt/);
    await history({ total: 2, correct: 1, wrong: 1, accuracy: 50 });
    await page.locator('#summary-dashboard').click();
    assert.match(await page.locator('.history').innerText(), /50%/);
    await page.reload();
    assert.deepEqual((await read('progress'))[firstEntry.id], failedProgress);
    assert.equal((await read('prefs')).darkMode, true);
    assert.deepEqual((await read('favorites')).sort(), ['2', '298']);
    assert.match(await page.locator('.session-grid--focus [data-session="due"]').innerText(), /1 từ/);

    // A genuinely due review becomes the recommended action; it is not filled with future cards.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '298': { id: '298', state: 'review', correctCount: 2, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 }
      }));
    });
    await page.reload();
    await page.locator('.study-recommendation [data-session="due"]').waitFor();
    assert.match(await page.locator('.study-recommendation').innerText(), /1 từ đang đến hạn/);
    await page.locator('.study-recommendation [data-session="due"]').click();
    assert.match(await page.locator('.page-header').innerText(), /Ôn đến hạn · 1 từ đã xếp · 1 lượt còn lại/,
      'the session header reports the queued word count and the remaining turns');
    assert.equal(await page.locator('.first-look').count(), 0, 'the due review does not introduce a previously studied card');
    await page.locator('#exit-session').click();

    // Export and valid/invalid import preserve the post-session backup.
    await page.locator('[data-view="settings"]').click();
    assert.equal(await page.getByRole('combobox', { name: 'Giao diện', exact: true }).count(), 1, 'the theme choice has a learner-facing accessible name');
    assert.equal(await page.locator('#theme-setting option').count(), 3, 'system, light and dark are all selectable');
    assert.equal(await page.getByRole('checkbox', { name: 'Phím tắt bàn phím' }).count(), 1, 'the shortcut switch has a learner-facing accessible name');
    assert.equal(await page.getByRole('combobox', { name: 'Ngôn ngữ giao diện' }).count(), 1, 'the interface-language select has a name');
    assert.equal(await page.getByRole('combobox', { name: 'Số thẻ mặc định mỗi phiên' }).count(), 1, 'the session-size select has a name');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'language-setting', 'keyboard navigation reaches the interface-language selector first');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'theme-setting', 'keyboard navigation reaches the named theme selector');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'keys-setting', 'keyboard navigation reaches the named shortcut switch');
    const switchFocus = await page.locator('#keys-setting').evaluate(input => ({
      visible: input.matches(':focus-visible'),
      outlineStyle: getComputedStyle(input.nextElementSibling).outlineStyle,
      outlineWidth: getComputedStyle(input.nextElementSibling).outlineWidth
    }));
    assert.deepEqual(switchFocus, { visible: true, outlineStyle: 'solid', outlineWidth: '3px' }, 'the hidden checkbox gives its visible switch a focus ring');
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-setting').click();
    const download = await downloadPromise;
    const backup = fs.readFileSync(await download.path());
    await page.locator('#import-setting').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await page.locator('.toast').filter({ hasText: 'Đã khôi phục tiến độ' }).waitFor();
    const beforeBadImport = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('#import-setting').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"wrong"}') });
    await page.locator('.toast').filter({ hasText: 'Import thất bại' }).waitFor();
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), beforeBadImport);

    // Last-card failure gets exactly one retry; another failure cannot loop.
    await seed(['298']);
    await answer('298', false);
    const lastFailed = (await read('progress'))['298'];
    await page.keyboard.press('r'); // Already auto-queued: no duplicate.
    await typeAnswer('wrong');
    assert.deepEqual((await read('progress'))['298'], lastFailed);
    await next();
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 0 đúng · 1 chưa đúng \/ 1 lượt/);
    await history({ total: 1, correct: 0, wrong: 1, accuracy: 0 });

    // An all-correct session ends without adding practice.
    await seed(['298']);
    await answer('298', true);
    await next();
    assert.doesNotMatch(await page.locator('.summary').innerText(), /Luyện lại:/);
    await history({ total: 1, correct: 1, wrong: 0, accuracy: 100 });

    // Optional R after a correct answer also stays practice-only.
    await seed(['298']);
    await answer('298', true);
    const correctProgress = (await read('progress'))['298'];
    await page.keyboard.press('r');
    await typeAnswer('wrong');
    assert.deepEqual((await read('progress'))['298'], correctProgress);
    await next();
    await history({ total: 1, correct: 1, wrong: 0, accuracy: 100 });

    // Multiple errors queue one practice turn each in the order they were missed;
    // skipping a practice card defers it behind the next pending one instead of
    // adding another turn.
    await seed(['298', '2']);
    const missedCards = [];
    for (let index = 0; index < 2; index += 1) {
      await startQuizFromIntroduction();
      const card = await currentEntry(['298', '2']);
      assert.equal(missedCards.some(missed => missed.id === card.id), false, 'each card is missed once');
      missedCards.push(card);
      await page.locator(`[data-option]:not([data-option="${card.id}"])`).first().click();
      await next();
    }
    const practiceHead = await page.locator('.flashcard-head').innerText();
    assert.equal((await currentEntry(['298', '2'])).id, missedCards[0].id,
      'the first practice turn belongs to the first missed word');
    await page.locator('#skip-card').click();
    assert.equal((await currentEntry(['298', '2'])).id, missedCards[1].id,
      'skipping a practice card shows the other pending word instead of repeating the same card');
    assert.equal((await page.locator('.flashcard-head').innerText()).replace(/\s+/g, ' ').trim(),
      practiceHead.replace(/\s+/g, ' ').trim(), 'a skip rotates the practice card without adding a turn');
    await typeAnswer(missedCards[1].word);
    await next();
    assert.equal((await currentEntry(['298', '2'])).id, missedCards[0].id,
      'the skipped word still gets exactly one practice turn of its own');
    await typeAnswer(missedCards[0].word);
    await next();
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 2 đúng · 0 chưa đúng \/ 2 lượt/);
    await history({ total: 2, correct: 0, wrong: 2, accuracy: 0 });

    // A never-studied word is introduced first, and the introduction is not an answer.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-session="new"]').click();
    assert.equal(await page.locator('#start-quiz').count(), 1, 'a new word opens on its introduction');
    assert.equal(await page.locator('[data-option]').count(), 0, 'the introduction must not offer an answer');
    assert.equal(await page.locator('.first-look').count(), 1);
    const introWord = (await page.locator('.prompt').innerText()).trim();
    const introEntry = await entryFor(introWord);
    assert.equal(await page.locator('.first-look-meaning strong').innerText(), introEntry.meaning);
    assert.match(await page.locator('.mode-label').innerText(), /Từ mới/i);
    await page.waitForFunction(() => document.activeElement.id === 'start-quiz', null, { timeout: 4000 });
    assert.equal(await page.evaluate(() => document.activeElement.id), 'start-quiz', 'the introduction is keyboard-ready');
    assert.equal(await page.locator('[role="progressbar"]').getAttribute('aria-valuenow'), '0');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1')), null, 'reading an introduction writes no progress');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.streak.v1')), null, 'reading an introduction must not extend the streak');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.history.v1')), null);

    // The introduction is readable and operable on a small screen.
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the introduction fits a 375px viewport');
    assert.equal(await page.locator('#start-quiz').isVisible(), true);
    assert.equal(await page.locator('.first-look-meaning strong').isVisible(), true);
    await page.setViewportSize({ width: 1280, height: 900 });

    // The document-level Space shortcut starts the quiz from the introduction.
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press(' ');
    assert.equal(await page.locator('#start-quiz').count(), 0);
    assert.equal(await page.locator('[data-option]').count(), 4);
    assert.equal(await page.locator('.first-look').count(), 0);

    // The four options are plausible: distinct texts sharing the headword's part of speech.
    const options = await page.evaluate(id => {
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent);
      const tokens = value => String(value ?? '').toLowerCase().split(/[^a-z]+/).filter(Boolean);
      const shares = (a, b) => { const right = new Set(tokens(b.pos)); return tokens(a.pos).some(token => right.has(token)); };
      const buttons = [...document.querySelectorAll('[data-option]')];
      const answer = data.find(item => item.id === id);
      return {
        ids: buttons.map(button => button.dataset.option),
        texts: buttons.map(button => button.querySelector('span:last-child').textContent.trim()),
        answerPos: answer.pos,
        peers: new Set(data.filter(item => item.id !== id
          && item.meaning.trim().toLowerCase() !== answer.meaning.trim().toLowerCase())
          .filter(item => shares(item, answer)).map(item => item.meaning.trim().toLowerCase())).size,
        distractors: buttons.map(button => button.dataset.option).filter(optionId => optionId !== id)
          .map(optionId => ({ pos: data.find(item => item.id === optionId).pos, shares: shares(data.find(item => item.id === optionId), answer) }))
      };
    }, introEntry.id);
    assert.equal(new Set(options.texts.map(text => text.toLowerCase())).size, 4, 'no option text is repeated');
    assert.equal(options.ids.filter(optionId => optionId === introEntry.id).length, 1, 'the answer appears exactly once');
    if (options.peers >= 3) {
      assert.equal(options.distractors.filter(distractor => distractor.shares).length, 3,
        `${introEntry.word} (${options.answerPos}): all three distractors share its part of speech`);
    }
    await page.locator(`[data-option="${introEntry.id}"]`).click();
    const introGraded = (await read('progress'))[introEntry.id];
    assert.equal(introGraded.state, 'learning');
    assert.equal(introGraded.correctCount, 1, 'the quiz after the introduction is the graded attempt');

    // Revealing an answer locks the options; only self-assessment may grade the card.
    await next();
    assert.equal(await page.locator('#start-quiz').count(), 1, 'the next never-studied word is introduced too');
    await page.locator('#start-quiz').click();
    const revealWord = (await page.locator('.prompt').innerText()).trim();
    const revealEntry = await entryFor(revealWord);
    assert.equal(await page.locator(`[data-option="${revealEntry.id}"]`).isEnabled(), true);
    const beforeReveal = structuredClone((await read('progress'))[revealEntry.id]);
    await page.keyboard.press(' ');
    assert.equal(await page.locator('.reveal').count(), 1);
    assert.equal(await page.locator('[data-option]:enabled').count(), 0, 'revealed options are locked');
    assert.equal(await page.locator('.option.locked').count(), 4, 'locked options are visually marked as inactive');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'reveal-correct', 'self-assessment takes focus after a reveal');
    assert.equal(await page.locator('#feedback-area').innerText(), '', 'nothing is graded by revealing');
    // Neither a click nor the 1–4 shortcut may answer a revealed card.
    await page.evaluate(id => document.querySelector(`[data-option="${id}"]`).click(), revealEntry.id);
    await page.keyboard.press('1');
    assert.equal(await page.locator('.reveal').count(), 1, 'the card is still waiting for self-assessment');
    assert.equal(await page.locator('#next-card').count(), 0);
    assert.deepEqual((await read('progress'))[revealEntry.id], beforeReveal, 'a revealed answer cannot be graded by selection');
    assert.equal(beforeReveal.state, 'new', 'the card was never studied before the reveal');
    await page.locator('#reveal-correct').click();
    assert.match(await page.locator('#feedback-area').innerText(), /tự đánh giá/);
    assert.equal((await read('progress'))[revealEntry.id].correctCount, 1, 'self-assessment grades the card');
    await next();

    // An introduced word is not introduced again when it returns in the same session.
    await seed(['298', '2', '3']);
    assert.equal(await page.locator('#start-quiz').count(), 1);
    await page.locator('#start-quiz').click();
    const gradedFirst = await currentEntry(['298', '2', '3']);
    await page.locator(`[data-option="${gradedFirst.id}"]`).click();
    await next();
    assert.equal(await page.locator('#start-quiz').count(), 1, 'the second never-studied word is introduced');
    await page.locator('#start-quiz').click();
    const introduced = await currentEntry(['298', '2', '3']);
    await page.locator('#skip-card').click();
    const rotated = await currentEntry(['298', '2', '3']);
    assert.notEqual(rotated.id, introduced.id, 'a skip moves on to another pending word');
    await page.locator('#skip-card').click();
    assert.equal((await currentEntry(['298', '2', '3'])).id, introduced.id,
      'the skipped word comes back later in the same session');
    assert.equal(await page.locator('#start-quiz').count(), 0, 'an introduced word is not introduced again in the same session');
    assert.equal(await page.locator('.first-look').count(), 0);
    assert.equal(await page.locator('[data-option]').count(), 4);

    // A revealed typed card locks its input as well, and practice stays practice.
    await seed(['298']);
    await page.locator('#start-quiz').click();
    await page.locator('[data-option]:not([data-option="298"])').first().click();
    await next();
    assert.equal(await page.locator('#spelling-input').isEnabled(), true);
    // Space is a normal character while typing, so reveal from the card shortcut.
    await page.evaluate(() => document.activeElement.blur());
    await page.keyboard.press(' ');
    assert.equal(await page.locator('#spelling-input').isDisabled(), true, 'a revealed spelling card cannot be typed into');
    assert.equal(await page.locator('.reveal').count(), 1);
    await page.locator('#reveal-wrong').click();
    assert.match(await page.locator('#feedback-area').innerText(), /tự đánh giá/);
    await next();
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 0 đúng · 1 chưa đúng \/ 1 lượt/);
    await history({ total: 1, correct: 0, wrong: 1, accuracy: 0 });

    // The introduction is not persisted: a reload mid-session re-introduces the word.
    await seed(['298']);
    assert.equal(await page.locator('#start-quiz').count(), 1);
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    assert.equal(await page.locator('#start-quiz').count(), 1, 'an ungraded new word is introduced again after a reload');

    // The only record with an example sentence is asked as cloze, and no option is a
    // word that is already printed in that sentence (ID 448, 'Menial task').
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['448']));
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '448': { id: '448', state: 'learning', correctCount: 3, wrongCount: 0, streak: 3, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 }
      }));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    assert.match(await page.locator('.mode-label').innerText(), /ĐIỀN VÀO NGỮ CẢNH/i);
    assert.match(await page.locator('.prompt').innerText(), /_____/);
    const clozeOptions = await page.locator('[data-option] > span:last-child').allInnerTexts();
    const sentence = await page.evaluate(() => {
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent);
      return data.find(item => item.id === '448').examples[0].en;
    });
    const printed = new Set(sentence.toLowerCase().split(/[^a-z']+/).filter(Boolean));
    for (const option of clozeOptions) {
      assert.equal(printed.has(option.trim().toLowerCase()), false,
        `"${option}" is already printed in the cloze sentence`);
    }

    // Existing saved progress is untouched: a scheduled card is never introduced.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['298']));
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '298': { id: '298', state: 'review', correctCount: 3, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 5, ease: 2.4, difficulty: 0.2 }
      }));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    assert.equal(await page.locator('#start-quiz').count(), 0, 'a card with existing progress is not reintroduced');
    assert.equal(await page.locator('[data-option]').count(), 4);
    assert.equal(await page.locator('.state-pill').innerText(), 'Ôn tập');
    assert.equal((await read('progress'))['298'].correctCount, 3);
    await page.locator('[data-option="298"]').click();
    const continued = (await read('progress'))['298'];
    assert.equal(continued.correctCount, 4, 'the stored counters keep growing from their old value');
    assert.equal(continued.wrongCount, 0);

    // ---- Searching "advers" and favoriting a result must not reset the view.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-view="search"]').click();
    await page.locator('#search-field').fill('advers');
    await page.locator('#results .vocab-row').first().waitFor();
    const searchMetaBefore = await page.locator('#results .results-meta').innerText();
    const searchRowsBefore = await page.locator('#results .vocab-row').count();
    // Only headwords are separate records: a fixed-size expectation goes stale as
    // soon as a family member is merged into its headword (`Adversity` id 1 has been
    // folded into `Adverse` id 298 since beta7), so the expected count is derived.
    const searchMatches = await page.evaluate(() => JSON.parse(document.getElementById('vocabulary-data').textContent)
      .filter(entry => !entry.familyHead)
      .filter(entry => `${entry.word} ${entry.meaning}`.toLowerCase().includes('advers'))
      .map(entry => entry.word));
    assert.ok(searchMatches.length >= 1, 'the query matches at least one headword');
    assert.match(searchMetaBefore, new RegExp(`${searchMatches.length} kết quả · trang 1/1`),
      `the query matches its ${searchMatches.length} headword record(s)`);
    assert.equal(searchRowsBefore, searchMatches.length, 'the visible rows are the matching headwords');
    await page.locator('#sort-filter').selectOption('za');
    const targetWord = (await page.locator('#results .vocab-row .vocab-word').first().innerText()).trim();
    const targetEntry = await entryFor(targetWord);
    const targetRow = () => page.locator('#results .vocab-row').filter({ hasText: targetWord }).first();
    assert.equal(await targetRow().locator('.fav.active').count(), 0);

    await targetRow().locator('.fav').click();
    assert.equal(await page.locator('#search-field').inputValue(), 'advers', 'the active query survives a favorite toggle');
    assert.equal(await page.locator('#sort-filter').inputValue(), 'za', 'the sort order survives a favorite toggle');
    assert.equal(await page.locator('#state-filter').inputValue(), 'all', 'the state filter survives a favorite toggle');
    assert.equal(await page.locator('#pos-filter').inputValue(), 'all');
    assert.equal(await page.locator('#results .results-meta').innerText(), searchMetaBefore, 'the result count and page survive a favorite toggle');
    assert.equal(await page.locator('#results .vocab-row').count(), searchRowsBefore, 'the visible result set survives a favorite toggle');
    assert.equal(await targetRow().locator('.fav.active').count(), 1, 'the star shows the new favorite state');
    assert.deepEqual(await read('favorites'), [targetEntry.id], 'the favorite is persisted');

    await targetRow().locator('.fav').click();
    assert.equal(await page.locator('#search-field').inputValue(), 'advers', 'un-favoriting also keeps the query');
    assert.equal(await page.locator('#results .vocab-row').count(), searchRowsBefore);
    assert.deepEqual(await read('favorites'), []);
    await page.locator('#clear-search').click();

    // ---- Reset and import end the running session instead of resurrecting it.
    await seed(['298', '2']);
    await page.locator('#start-quiz').click();
    assert.equal(await page.locator('.flashcard').count(), 1);
    await page.locator('[data-view="settings"]').click();
    page.on('dialog', dialog => dialog.accept());
    await page.locator('#reset-setting').click();
    await page.locator('.toast').filter({ hasText: 'Đã xóa dữ liệu học' }).waitFor();
    await page.locator('[data-view="learn"]').click();
    assert.equal(await page.locator('.session-grid--focus').count(), 1, 'reset returns to the session chooser');
    assert.equal(await page.locator('.flashcard').count(), 0, 'a reset session is not resurrected');
    assert.equal(await page.locator('#exit-session').count(), 0);
    assert.equal(await page.locator('.prompt').count(), 0);
    assert.equal((await read('progress'))['298'].correctCount, 0);

    await seed(['298', '2']);
    await page.locator('#start-quiz').click();
    const importPrompt = (await page.locator('.prompt').innerText()).trim();
    await page.locator('[data-view="settings"]').click();
    const activeDownload = page.waitForEvent('download');
    await page.locator('#export-setting').click();
    const activeBackup = fs.readFileSync(await (await activeDownload).path());
    await page.locator('#import-setting').setInputFiles({ name: 'active.json', mimeType: 'application/json', buffer: activeBackup });
    await page.locator('.toast').filter({ hasText: 'Đã khôi phục tiến độ' }).waitFor();
    await page.locator('[data-view="learn"]').click();
    assert.equal(await page.locator('.session-grid--focus').count(), 1, 'import returns to the session chooser');
    assert.equal(await page.locator('.flashcard').count(), 0, 'an imported bundle does not continue the previous session');
    assert.equal(importPrompt.length > 0, true);

    // ---- ID 448 shows its canonical meaning and labels the retained old wording.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['448']));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    const menial = await entryFor('Menial task');
    assert.equal(menial.meaning, 'công việc tay chân tầm thường, ít được coi trọng', 'the canonical meaning is unchanged');
    assert.equal(menial.notes, 'Previous app definition (data/vocabulary.json): công việc lao dịch, tay chân vất vả, ít được coi trọng');
    const introduction = await page.locator('.first-look').innerText();
    assert.ok(introduction.includes(menial.meaning), 'the introduction shows the canonical meaning');
    assert.match(introduction, /Nghĩa của phiên bản ứng dụng trước/);
    assert.match(introduction, /chỉ tham chiếu lịch sử; không phải nghĩa hiện tại/);
    assert.equal(/Previous app definition/.test(introduction), false, 'the internal marker is not learner-facing');
    assert.equal(/Ghi chú \/ phân biệt \/ nguồn/.test(introduction), false, 'the historical gloss is not filed as an ordinary note');
    await page.locator('#start-quiz').click();
    assert.equal(await page.getByRole('group', { name: 'Chọn nghĩa tiếng Việt' }).count(), 1);
    await page.locator('[data-option="448"]').click();
    await page.locator('#next-card').waitFor();
    const menialFeedback = await page.locator('#feedback-area').innerText();
    assert.ok(menialFeedback.includes(menial.meaning), 'the answer shows the canonical meaning');
    assert.match(menialFeedback, /Nghĩa của phiên bản ứng dụng trước/);
    assert.equal(/Previous app definition/.test(menialFeedback), false);
    assert.equal(/data\/vocabulary\.json/.test(menialFeedback), false);
    // The same label appears on the graded cloze card of an already-studied record.
    await page.evaluate(() => {
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '448': { id: '448', state: 'learning', correctCount: 3, wrongCount: 0, streak: 3, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 }
      }));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    assert.match(await page.locator('.mode-label').innerText(), /ĐIỀN VÀO NGỮ CẢNH/i);
    assert.equal(await page.getByRole('group', { name: 'Chọn từ tiếng Anh' }).count(), 1, 'cloze choices are a named English-word button group');
    assert.equal(await page.locator('.options').getAttribute('aria-label'), 'Chọn từ tiếng Anh');
    await page.locator('[data-option="448"]').click();
    await page.locator('#next-card').waitFor();
    const clozeFeedback = await page.locator('#feedback-area').innerText();
    assert.ok(clozeFeedback.includes(menial.meaning));
    assert.match(clozeFeedback, /Nghĩa của phiên bản ứng dụng trước \(chỉ tham chiếu lịch sử; không phải nghĩa hiện tại\)/);

    // ---- The answer choices are a named button group, not a radio group.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-session="new"]').click();
    await page.locator('#start-quiz').click();
    assert.equal(await page.locator('[role="radiogroup"]').count(), 0, 'no radio-group role is used');
    assert.equal(await page.locator('input[type="radio"]').count(), 0);
    const optionGroup = page.getByRole('group', { name: 'Chọn nghĩa tiếng Việt' });
    assert.equal(await optionGroup.count(), 1, 'the choice group is named for what it contains');
    assert.equal(await page.locator('.options').getAttribute('role'), 'group');
    assert.equal(await optionGroup.getByRole('button').count(), 4);
    for (const label of await optionGroup.getByRole('button').allInnerTexts()) {
      assert.ok(label.trim().length > 0, 'every option button has an accessible name');
    }

    // ---- Shortcuts belong to the visible card, not to a hidden session.
    await seed(['298', '2']);
    await page.locator('#start-quiz').click();
    const hiddenPrompt = (await page.locator('.prompt').innerText()).trim();
    await page.locator('[data-view="search"]').click();
    await page.locator('#search-field').fill('advers');
    assert.equal(await page.locator('#results .vocab-row').count(), searchRowsBefore);
    await page.evaluate(() => document.activeElement.blur());
    const storageBeforeShortcuts = await page.evaluate(() => ({ ...localStorage }));
    for (const key of ['Space', '1', 'r', 'Enter']) await page.keyboard.press(key);
    assert.equal(await page.locator('#search-field').count(), 1, 'another view is not replaced by the hidden session');
    assert.equal(await page.locator('.flashcard').count(), 0);
    assert.equal(await page.locator('.reveal').count(), 0);
    assert.equal(await page.locator('#results .vocab-row').count(), searchRowsBefore, 'the typed query is untouched');
    await page.locator('[data-view="learn"]').click();
    assert.equal((await page.locator('.prompt').innerText()).trim(), hiddenPrompt, 'the hidden card was neither answered nor skipped');
    assert.equal(await page.locator('.reveal').count(), 0);
    assert.equal(await page.locator('#next-card').count(), 0);
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), storageBeforeShortcuts, 'the hidden card was not graded or rescheduled');

    // ---- A chord belongs to the browser, never to the card (review round 2).
    // This drives the *registered* document keydown handler with real key presses,
    // so a regression that stops calling acceptsShortcutKey() fails here even if the
    // helper itself still returns the right answer. Ctrl+F used to add the current
    // word to the hard-word list, Ctrl+R queued a retry, and Shift+F / Shift+Space
    // did the same through a capital letter and a scroll-up chord.
    await seed(['298']);
    await startQuizFromIntroduction();
    const chordPrompt = (await page.locator('.prompt').innerText()).trim();
    const beforeChords = await page.evaluate(() => ({ ...localStorage }));
    const chords = [
      ['Control+F', 'find in page'], ['Control+R', 'reload'], ['Control+1', 'switch tab'],
      ['Control+Space', 'input method'], ['Alt+1', 'menu accelerator'],
      ['Shift+F', 'capital F'], ['Shift+R', 'capital R'], ['Shift+Space', 'scroll up'],
      ['Shift+Enter', 'modified submit'], ['Control+Shift+F', 'combined chord']
    ];
    for (const [chord, reason] of chords) {
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press(chord);
      await page.waitForTimeout(60);
      assert.equal(await page.locator('.reveal').count(), 0, `${chord} (${reason}) must not reveal the answer`);
      assert.equal(await page.locator('#next-card').count(), 0, `${chord} (${reason}) must not grade the card`);
      assert.equal(await page.locator('#feedback-area').innerText(), '', `${chord} (${reason}) must not answer the card`);
      assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), beforeChords,
        `${chord} (${reason}) must leave learner storage untouched`);
    }
    // IME composition is the one guard the helper test cannot protect: a composing
    // keydown carries no modifier, so only the handler's use of acceptsShortcutKey()
    // decides whether it reaches the card. Dispatch it on the document the handler is
    // registered on, exactly as a real IME would.
    await page.evaluate(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'f', isComposing: true, bubbles: true }));
      document.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', isComposing: true, bubbles: true }));
    });
    await page.waitForTimeout(60);
    assert.equal(await page.locator('.reveal').count(), 0, 'a composing key must not reveal the answer');
    assert.equal(await page.locator('#next-card').count(), 0, 'a composing key must not grade the card');
    assert.equal(await page.locator('#feedback-area').innerText(), '', 'a composing key must not answer the card');
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), beforeChords,
      'a composing key must leave learner storage untouched');
    assert.equal((await page.locator('.prompt').innerText()).trim(), chordPrompt, 'the card was neither answered nor skipped');
    // The plain keys the app documents still work on the same card.
    await page.keyboard.press('f');
    assert.deepEqual(await read('flagged'), ['298'], 'the unmodified f shortcut still flags the word');
    await page.keyboard.press('f');
    assert.deepEqual(await read('flagged'), []);
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press(' ');
    assert.equal(await page.locator('.reveal').count(), 1, 'the unmodified Space shortcut still reveals');
    await page.locator('#reveal-correct').click();
    await next();

    // ---- A backup file round-trips: export → wipe → import → export preserves data.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await seed(['298']);
    await answer('298', true);
    await next();
    await page.locator('.summary').waitFor();
    const stateAfterSession = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('[data-view="settings"]').click();
    const roundTripDownload = page.waitForEvent('download');
    await page.locator('#export-setting').click();
    const roundTripFile = await roundTripDownload;
    assert.match(await roundTripFile.suggestedFilename(), /^chuyen-anh-progress-\d{4}-\d{2}-\d{2}\.json$/);
    const roundTripPath = await roundTripFile.path();
    const roundTripBundle = JSON.parse(fs.readFileSync(roundTripPath, 'utf8'));
    assert.equal(roundTripBundle.app, 'chuyen-anh-flashcard');
    assert.equal(roundTripBundle.version, 1);
    assert.equal(roundTripBundle.history.length, 1);
    assert.equal(roundTripBundle.history[0].total, 1);
    assert.equal(roundTripBundle.history[0].correct, 1);
    assert.deepEqual(roundTripBundle.favorites, ['298']);
    assert.equal(roundTripBundle.progress['298'].correctCount, 1);
    assert.equal(roundTripBundle.progress['298'].state, 'learning');
    assert.equal(typeof roundTripBundle.exportedAt, 'string');

    // Wipe the device, then restore from the file: the state must come back.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    await page.locator('[data-view="settings"]').click();
    await page.locator('#import-setting').setInputFiles({ name: 'roundTripBundle.json', mimeType: 'application/json', buffer: fs.readFileSync(roundTripPath) });
    await page.locator('.toast').filter({ hasText: 'Đã khôi phục tiến độ' }).waitFor();
    await page.reload();
    const restored = await page.evaluate(() => ({ ...localStorage }));
    assert.deepEqual(restored, stateAfterSession, 'the restored device state must match the exported one');

    // Exporting the restored state again reproduces the same logical bundle.
    await page.locator('[data-view="settings"]').click();
    const secondDownload = page.waitForEvent('download');
    await page.locator('#export-setting').click();
    const secondBundle = JSON.parse(fs.readFileSync(await (await secondDownload).path(), 'utf8'));
    const stripVolatile = ({ exportedAt, ...rest }) => rest;
    assert.deepEqual(stripVolatile(secondBundle), stripVolatile(roundTripBundle), 'a repeated import/export must not mutate the bundle');

    // A roundTripBundle from a different application or version is refused without touching data.
    const beforeWrongVersion = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('#import-setting').setInputFiles({ name: 'v2.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ ...roundTripBundle, version: 2 })) });
    await page.locator('.toast').filter({ hasText: 'Import thất bại' }).waitFor();
    assert.match(await page.locator('.toast').innerText(), /không đúng phiên bản/);
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), beforeWrongVersion, 'a refused import changes nothing');

    // ---- History keeps one retention window, so a roundTripBundle cannot drop sessions.
    const seededHistory = Array.from({ length: 50 }, (_, index) => ({
      date: new Date(Date.UTC(2026, 8, 1, 0, index)).toISOString(),
      total: 1, correct: 1, wrong: 0, accuracy: 100, mode: 'due', durationSec: 10
    }));
    await page.evaluate(entries => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['298']));
      localStorage.setItem('chuyen-anh.history.v1', JSON.stringify(entries));
    }, seededHistory);
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    await answer('298', true);
    await next();
    await page.locator('.summary').waitFor();
    const retained = await read('history');
    assert.equal(retained.length, 50, 'the newest session enters the window and the oldest leaves it');
    assert.equal(retained[retained.length - 1].mode, 'favorites', 'the session just finished is kept');
    assert.equal(retained[0].date, seededHistory[1].date, 'only the oldest entry is dropped');
    await page.locator('[data-view="settings"]').click();
    const retentionDownload = page.waitForEvent('download');
    await page.locator('#export-setting').click();
    const retentionBundle = JSON.parse(fs.readFileSync(await (await retentionDownload).path(), 'utf8'));
    assert.equal(retentionBundle.history.length, 50, 'the export contains exactly the retained window');
    // Restoring that roundTripBundle keeps every session it contains.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-view="settings"]').click();
    await page.locator('#import-setting').setInputFiles({ name: 'retention.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(retentionBundle)) });
    await page.locator('.toast').filter({ hasText: 'Đã khôi phục tiến độ' }).waitFor();
    await page.reload();
    const restoredHistory = await read('history');
    assert.equal(restoredHistory.length, 50, 'no session is lost when the roundTripBundle is restored');
    assert.deepEqual(restoredHistory, retentionBundle.history);


    // ---- English interface: the note that explains a turn is interface copy and
    // must be translated. Regression: it was rendered inside `.sub-prompt`, which
    // the localizer protects because it also carries prompt content, so an English
    // learner read a Vietnamese sentence. Ten weak words keep the queue at exactly
    // ten, so the first word's delayed check arrives after four turns.
    const englishPlan = await page.evaluate(() => {
      const now = Date.now();
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 10);
      const progress = {};
      data.forEach((entry, index) => {
        progress[entry.id] = {
          id: entry.id, state: 'weak', correctCount: 0, wrongCount: 40 - index, streak: 0,
          lastReviewed: now - 86400000, nextReview: now - 3600000,
          interval: 0, ease: 2.3, difficulty: 0.5
        };
      });
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: false, darkMode: false }));
      localStorage.setItem('chuyen-anh.language.v1', 'en');
      return data.map(entry => ({ word: entry.word, meaning: entry.meaning }));
    });
    await page.reload();
    await page.locator('[data-session="sprint"]').waitFor();
    await page.locator('[data-session="sprint"]').click();
    assert.match(await page.locator('.mode-label').innerText(), /RECOGNITION/i,
      'an English sprint card shows an English retrieval label');
    let englishCheck = null;
    for (let turn = 0; turn < 6 && !englishCheck; turn += 1) {
      const label = await page.locator('.mode-label').innerText();
      if (/CONSOLIDATION/i.test(label)) {
        // Read the explanatory paragraph through either class so a regression is
        // reported as untranslated copy instead of a locator timeout.
        const noteHolder = await page.locator('.turn-note').count() ? page.locator('.turn-note') : page.locator('.sub-prompt').last();
        const note = (await noteHolder.innerText()).trim();
        englishCheck = {
          note,
          translated: /^Consolidation turn: this word returns after a few other cards/.test(note),
          vietnamese: /[àáảãạăâđêôơư]/i.test(note.replace(/[·→]/g, '')),
          nested: await page.locator('.sub-prompt.turn-note').count()
        };
        break;
      }
      const prompt = (await page.locator('.prompt').innerText()).trim();
      const entry = englishPlan.find(item => item.word === prompt || item.meaning === prompt);
      assert.ok(entry, `the English card is one of the queued words: ${prompt}`);
      const options = page.locator('[data-option]');
      const wantMeaning = /RECOGNITION/i.test(label);
      let chosen = false;
      for (let index = 0; index < await options.count(); index += 1) {
        const text = (await options.nth(index).innerText()).replace(/^\d+\s*/, '').trim();
        if (text === (wantMeaning ? entry.meaning : entry.word)) { await options.nth(index).click(); chosen = true; break; }
      }
      assert.equal(chosen, true, `an answerable option exists for ${entry.word} in the English interface`);
      await page.locator('.handoff-strip').waitFor({ timeout: 2000 });
    }
    assert.ok(englishCheck, 'the delayed check of the first word appeared inside six turns');
    assert.equal(englishCheck.translated, true,
      `the consolidation note is translated in the English interface: ${englishCheck.note}`);
    assert.equal(englishCheck.vietnamese, false,
      `the translated note keeps no Vietnamese copy: ${englishCheck.note}`);
    assert.equal(englishCheck.nested, 0,
      'interface copy is not rendered inside the protected prompt class');
    // Leave the device in the default interface language for the scenarios below.
    await page.evaluate(() => localStorage.removeItem('chuyen-anh.language.v1'));
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();

    // ---- Scope A (beta4 follow-up): the card-footer keyboard hints are interface
    // copy, asserted as rendered behaviour on every turn kind. The static suite
    // checks the dictionary entries; this pins what the learner actually sees on
    // first-pass, hand-off, consolidation and first-look cards in English.
    const footerText = async () => (await page.locator('.card-footer span').last().innerText()).replace(/\s+/g, ' ').trim();
    await page.evaluate(() => {
      const now = Date.now();
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 10);
      const progress = {};
      data.forEach((entry, index) => {
        progress[entry.id] = {
          id: entry.id, state: 'weak', correctCount: 0, wrongCount: 40 - index, streak: 0,
          lastReviewed: now - 86400000, nextReview: now - 3600000,
          interval: 0, ease: 2.3, difficulty: 0.5
        };
      });
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: false, darkMode: false }));
      localStorage.setItem('chuyen-anh.language.v1', 'en');
    });
    await page.reload();
    await page.locator('[data-session="sprint"]').waitFor();
    await page.locator('[data-session="sprint"]').click();
    const footerPlan = await page.evaluate(() => JSON.parse(document.getElementById('vocabulary-data').textContent)
      .filter(entry => !entry.familyHead)
      .slice(0, 10).map(entry => ({ word: entry.word, meaning: entry.meaning })));
    assert.equal(await footerText(), 'Space reveal · Enter next',
      `the English first-pass footer is complete: "${await footerText()}"`);
    let footerSawConsolidation = null;
    for (let turn = 0; turn < 8 && !footerSawConsolidation; turn += 1) {
      const label = await page.locator('.mode-label').innerText();
      if (/CONSOLIDATION/i.test(label)) {
        footerSawConsolidation = await footerText();
        break;
      }
      const prompt = (await page.locator('.prompt').innerText()).trim();
      const entry = footerPlan.find(item => item.word === prompt || item.meaning === prompt);
      const options = page.locator('[data-option]');
      // Recognition shows the English word, so the options are the meanings.
      const wantMeaning = footerPlan.some(item => item.word === prompt);
      for (let index = 0; index < await options.count(); index += 1) {
        const text = (await options.nth(index).innerText()).replace(/^\d+\s*/, '').trim();
        if (text === (wantMeaning ? entry.meaning : entry.word)) { await options.nth(index).click(); break; }
      }
      await page.locator('.handoff-strip').waitFor({ timeout: 2000 });
      const nextLabel = await page.locator('.mode-label').innerText();
      if (!/CONSOLIDATION/i.test(nextLabel)) {
        assert.equal(await footerText(), 'Space reveal · Enter next',
          'the hand-off card keeps the complete English hint');
      }
    }
    assert.equal(footerSawConsolidation, 'Consolidation turn · Space reveal',
      `the consolidation footer is fully English: "${footerSawConsolidation}"`);
    await page.locator('#exit-session').click();
    // The first-look footer.
    await page.evaluate(() => {
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['3']));
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '3': { id: '3', state: 'new', correctCount: 0, wrongCount: 0, streak: 0, lastReviewed: null, nextReview: Date.now(), interval: 0, ease: 2.5, difficulty: 0 }
      }));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').waitFor();
    await page.locator('[data-session="favorites"]').click();
    assert.match(await page.locator('.mode-label').innerText(), /NEW/i,
      'a never-studied favorite opens on its introduction');
    assert.equal(await footerText(), 'Enter start quiz',
      `the first-look footer is fully English: "${await footerText()}"`);
    await page.locator('#start-quiz').click();
    assert.equal(await footerText(), 'Space reveal · Enter next',
      'after the introduction the footer returns to the graded-card hint');
    await page.locator('#exit-session').click();
    await page.evaluate(() => localStorage.removeItem('chuyen-anh.language.v1'));

    // ---- Scope B (beta4 follow-up): the daily streak is written by first-pass
    // turns only, and a first-look introduction writes nothing. The static suite
    // pins the code shape; this scenario makes the contract observable at runtime
    // by moving the clock across midnight so the first turn answered on the new
    // day is a consolidation. Only streak writes that change the stored value are
    // counted: the generic persist() rewrites an unchanged streak alongside
    // progress, and only updateStreak() can alter the value itself.
    const streakDateKey = () => page.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    const readStreak = () => page.evaluate(() => ({
      writes: window.__streakWrites,
      streak: JSON.parse(localStorage.getItem('chuyen-anh.streak.v1') || 'null')
    }));
    await page.addInitScript(() => {
      window.__streakWrites = 0;
      const nativeSetItem = Storage.prototype.setItem;
      Storage.prototype.setItem = function (key, value) {
        if (key === 'chuyen-anh.streak.v1' && this.getItem(key) !== value) window.__streakWrites += 1;
        return nativeSetItem.call(this, key, value);
      };
    });
    await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));
    await page.evaluate(() => {
      const now = Date.now();
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 4);
      const progress = {};
      data.forEach((entry, index) => {
        progress[entry.id] = {
          id: entry.id, state: 'weak', correctCount: 0, wrongCount: 40 - index, streak: 0,
          lastReviewed: now - 86400000, nextReview: now - 3600000,
          interval: 0, ease: 2.3, difficulty: 0.5
        };
      });
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: false, darkMode: false }));
      localStorage.setItem('chuyen-anh.streak.v1', JSON.stringify({ current: 2, longest: 5, lastDate: '2026-10-19' }));
    });
    await page.reload();
    await page.locator('[data-session="sprint"]').waitFor();
    await page.locator('[data-session="sprint"]').click();
    const streakPlan = await page.evaluate(() => JSON.parse(document.getElementById('vocabulary-data').textContent)
      .filter(entry => !entry.familyHead)
      .slice(0, 4).map(entry => ({ id: entry.id, word: entry.word, meaning: entry.meaning })));
    const streakAnswer = async plan => {
      const prompt = (await page.locator('.prompt').innerText()).trim();
      const entry = plan.find(item => item.word === prompt || item.meaning === prompt);
      assert.ok(entry, `the streak scenario card is a seeded word: ${prompt}`);
      const options = page.locator('[data-option]');
      const wantMeaning = plan.some(item => item.word === prompt);
      for (let index = 0; index < await options.count(); index += 1) {
        const text = (await options.nth(index).innerText()).replace(/^\d+\s*/, '').trim();
        if (text === (wantMeaning ? entry.meaning : entry.word)) { await options.nth(index).click(); return; }
      }
      throw new Error('no option matched in the streak scenario');
    };
    // Day one (2026-10-20): four correct first passes. Exactly one write.
    for (let index = 0; index < 4; index += 1) {
      await streakAnswer(streakPlan);
      await page.locator('.handoff-strip').waitFor({ timeout: 3000 });
    }
    let streakState = await readStreak();
    assert.equal(streakState.writes, 1, 'the first graded turn of the day writes the streak once');
    assert.equal(streakState.streak.current, 3, 'the streak continues from the seeded value');
    assert.equal(streakState.streak.lastDate, '2026-10-20');
    // Day two begins without a reload. The first turn answered on the new day is
    // word 1's delayed consolidation.
    await page.clock.setFixedTime(new Date('2026-10-21T12:00:00Z'));
    assert.equal(await streakDateKey(), '2026-10-21', 'the shifted clock really crossed midnight');
    for (let index = 0; index < 4; index += 1) {
      assert.match((await page.locator('.mode-label').innerText()).toLowerCase(), /củng cố/,
        'the new day opens with the delayed checks');
      await streakAnswer(streakPlan);
      await page.locator('#next-card').click();
      if (index === 0) {
        streakState = await readStreak();
        assert.equal(streakState.writes, 1,
          'a consolidation turn must not write the daily streak, even across midnight');
      }
    }
    streakState = await readStreak();
    assert.equal(streakState.writes, 1, 'an all-consolidation day leaves the streak untouched');
    assert.equal(streakState.streak.lastDate, '2026-10-20', 'the recorded day is still the previous day');
    assert.equal(streakState.streak.current, 3, 'the consolidation did not extend the streak');
    // Day three: the first graded turn is a wrong first pass (a favourites
    // session on an already-studied word is a first-pass turn, not a practice
    // turn), and it does record the day.
    await page.clock.setFixedTime(new Date('2026-10-22T12:00:00Z'));
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '298': { id: '298', state: 'learning', correctCount: 2, wrongCount: 0, streak: 2, lastReviewed: now, nextReview: now + 3600000, interval: 1, ease: 2.5, difficulty: 0 }
      }));
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['298']));
    });
    await page.reload(); // the write counter restarts with the document
    await page.locator('[data-session="favorites"]').waitFor();
    await page.locator('[data-session="favorites"]').click();
    await page.locator('#spelling-input').fill('wrong on purpose');
    await page.locator('#submit-answer').click();
    assert.match(await page.locator('#feedback-area').innerText(), /Chưa đúng/);
    streakState = await readStreak();
    assert.equal(streakState.writes, 1, 'the wrong first pass records the day');
    assert.equal(streakState.streak.lastDate, '2026-10-22', 'the graded answer marked the new day');
    await page.locator('#exit-session').click();
    // Day five: a first-look introduction is not a graded turn and records
    // nothing; the first real answer of the day does.
    await page.clock.setFixedTime(new Date('2026-10-24T12:00:00Z'));
    await page.evaluate(() => {
      const now = Date.now();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '2': { id: '2', state: 'new', correctCount: 0, wrongCount: 0, streak: 0, lastReviewed: null, nextReview: now, interval: 0, ease: 2.5, difficulty: 0 }
      }));
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['2']));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').waitFor();
    await page.locator('[data-session="favorites"]').click();
    assert.ok(await page.locator('#start-quiz').count(), 'the new word opens on its introduction');
    const progressBeforeIntro = await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1'));
    assert.equal((await readStreak()).writes, 0, 'rendering an introduction writes no streak');
    await page.locator('#start-quiz').click();
    assert.equal((await readStreak()).writes, 0, 'starting the quiz is still not an answer');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1')), progressBeforeIntro,
      'the introduction records no progress');
    const introCard = await page.evaluate(() => {
      const entry = JSON.parse(document.getElementById('vocabulary-data').textContent).find(item => item.id === '2');
      return { word: entry.word, meaning: entry.meaning };
    });
    await streakAnswer([introCard]);
    streakState = await readStreak();
    assert.equal(streakState.writes, 1, 'the first real answer of the day records the day');
    assert.equal(streakState.streak.current, 1, 'a skipped day resets the run before this answer');


    // ---- A blank spelling submission is not a graded attempt. (dev3 regression)
    async function seedSpellingCard() {
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['298']));
        localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
          '298': { id: '298', state: 'learning', correctCount: 2, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 }
        }));
      });
      await page.reload();
      await page.locator('[data-session="favorites"]').click();
      assert.match(await page.locator('.mode-label').innerText(), /Chính tả/i,
        'the seeded counters lead the only card to a spelling question');
    }
    async function revealFromKeyboard() {
      await page.locator('#spelling-input').focus();
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.waitForTimeout(30);
      await page.evaluate(() => document.activeElement && document.activeElement.blur());
      await page.keyboard.press(' ');
    }
    await seedSpellingCard();
    const beforeBlank = (await read('progress'))['298'];
    await page.locator('#submit-answer').click();
    await page.locator('.toast').filter({ hasText: 'Hãy nhập câu trả lời trước khi xác nhận.' }).waitFor();
    assert.equal(await page.locator('#feedback-area').innerText(), '', 'a blank submission produces no graded feedback');
    assert.equal(await page.locator('#next-card').count(), 0, 'a blank submission does not advance the session');
    await page.locator('#spelling-input').fill('   ');
    await page.locator('#spelling-input').press('Enter');
    assert.deepEqual((await read('progress'))['298'], beforeBlank,
      'blank and whitespace-only submissions change no progress');
    await typeAnswer('Adverse');
    assert.equal((await read('progress'))['298'].correctCount, beforeBlank.correctCount + 1,
      'a real submission still grades exactly once');
    await next();

    // ---- Self-assessment grades exactly once, even when activated twice. (dev3 regression)
    await seedSpellingCard();
    await revealFromKeyboard();
    await page.locator('#reveal-correct').waitFor();
    const beforeSelfGrade = (await read('progress'))['298'];
    await page.locator('#reveal-correct').evaluate(element => { element.click(); element.click(); });
    await page.waitForTimeout(50);
    const afterSelfGrade = (await read('progress'))['298'];
    assert.equal(afterSelfGrade.correctCount, beforeSelfGrade.correctCount + 1,
      'double-activating self-assessment cannot grade the same turn twice');
    assert.equal(afterSelfGrade.streak, beforeSelfGrade.streak + 1, 'the streak advances once per graded turn');
    assert.equal(await page.locator('#next-card').count(), 1, 'one turn produces one feedback panel');

    // ---- A revealed card cannot be skipped past its self-assessment. (dev3 regression)
    await seedSpellingCard();
    await revealFromKeyboard();
    await page.locator('#reveal-correct').waitFor();
    assert.equal(await page.locator('#skip-card').isDisabled(), true,
      'the self-assessment lock also disables skipping the revealed card');
    assert.equal(await page.locator('#exit-session').isEnabled(), true, 'leaving the session stays possible');
    assert.deepEqual((await read('progress'))['298'],
      { id: '298', state: 'learning', correctCount: 2, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 },
      'revealing and locking writes nothing to progress');

    // ---- beta4 regressions (Scopes A, B, E, F) on live Chromium page before quota-failure scenario
    {
      const netRequests = [];
      const onNetReq = req => {
        if (!req.url().startsWith(`http://127.0.0.1:${server.address().port}`) && !req.url().startsWith('blob:') && !req.url().startsWith('data:')) {
          netRequests.push(req.url());
        }
      };
      page.on('request', onNetReq);
      await page.setViewportSize({ width: 1280, height: 900 });
      await page.clock.setFixedTime(new Date('2026-10-20T12:00:00Z'));
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('chuyen-anh.language.v1', 'en');
        localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['298', '2']));
      });
      await page.reload();
      await page.locator('[data-session="favorites"]').waitFor();

      // Scope E: unstudied favorite in English mode opens on First-Look with zero progress/streak storage writes
      await page.locator('[data-session="favorites"]').click();
      await page.locator('#start-quiz').waitFor();
      assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1')), null,
        'opening first-look in favorites mode writes zero progress to localStorage');
      assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.streak.v1')), null,
        'opening first-look writes zero streak to localStorage');

      // Scope A: Search view in English mode never corrupts real Vietnamese meanings containing UI tokens (Assimilate = "tiếp thu, đồng hóa")
      await page.locator('#exit-session').click();
      await page.locator('[data-view="search"]').click();
      await page.locator('#search-field').fill('Assimilate');
      await page.locator('#results .vocab-row').first().waitFor();
      assert.match(await page.locator('#results .vocab-row .vocab-meaning').first().innerText(), /tiếp thu, đồng hóa/,
        'English UI never corrupts Vietnamese vocabulary meanings containing "tiếp"');

      // Scope B.1 + B.2 + Scope A shortcut check in a real 5-word English Sprint session
      await page.evaluate(() => {
        const vocabData = JSON.parse(document.getElementById('vocabulary-data').textContent);
        const keep = vocabData.filter(entry => !entry.familyHead).slice(0, 5);
        const assim = vocabData.find(v => v.word === 'Assimilate');
        if (assim && !keep.some(v => v.id === assim.id)) keep[0] = assim;
        localStorage.clear();
        localStorage.setItem('chuyen-anh.language.v1', 'en');
        localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, darkMode: false, keyboardShortcuts: true }));
        document.getElementById('vocabulary-data').textContent = JSON.stringify(keep);
      });
      await page.evaluate(async () => {
        const mod = await import(URL.createObjectURL(new Blob([document.getElementById('app-script').textContent], { type: 'text/javascript' })));
        document.getElementById('app').innerHTML = '';
        await mod.createApp(document.getElementById('app'));
      });
      await page.locator('[data-session="sprint"]').click();
      const sprintTurnSeq = [];
      for (let guard = 0; guard < 25; guard += 1) {
        if (await page.locator('.summary').count()) break;
        if (await page.locator('#start-quiz').count()) {
          const flText = await page.locator('.first-look').innerText();
          assert.doesNotMatch(flText, /\bnext thu\b/i, 'First-look never mangles "tiếp thu" into "next thu"');
          await page.locator('#start-quiz').click();
        }
        const modeTxt = await page.locator('.mode-label').innerText();
        const promptTxt = (await page.locator('.prompt').innerText()).trim();
        const isConsol = /Consolidation/i.test(modeTxt);
        const footerTxt = await page.locator('.card-footer').innerText();
        assert.doesNotMatch(footerTxt, /\blật\b|\btiếp\b|\bLượt củng cố\b/i,
          `English card footer leaked Vietnamese UI text: ${footerTxt}`);
        sprintTurnSeq.push({ promptTxt, isConsol });
        if (isConsol) {
          const progBefore = await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1'));
          await page.evaluate(() => localStorage.setItem('chuyen-anh.streak.v1', JSON.stringify({ current: 4, longest: 4, lastDate: '2026-10-19' })));
          if (await page.locator('#spelling-input').count()) {
            await page.locator('#spelling-input').fill('wrong_answer');
            await page.locator('#submit-answer').click();
          } else {
            await page.locator('[data-option]').first().click();
          }
          await page.locator('#next-card').waitFor();
          const streakAfterConsol = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.streak.v1')));
          const progAfter = await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1'));
          assert.deepEqual(streakAfterConsol, { current: 4, longest: 4, lastDate: '2026-10-19' },
            'Answering a consolidation turn must never update streak');
          assert.equal(progAfter, progBefore, 'Answering a consolidation turn must never mutate stored progress');
          await page.locator('#next-card').click();
        } else {
          const rightId = await page.evaluate(() => {
            const p = document.querySelector('.prompt').innerText.trim();
            const vocabData = JSON.parse(document.getElementById('vocabulary-data').textContent);
            const match = vocabData.find(v => v.word === p || v.meaning === p);
            return match?.id;
          });
          await page.locator(`[data-option="${rightId}"]`).click();
        }
      }
      assert.equal(sprintTurnSeq.length, 10, '5-word consolidated sprint executes all 10 turns');
      const turnWords = await page.evaluate((seq) => {
        const vocabData = JSON.parse(document.getElementById('vocabulary-data').textContent);
        return seq.map(item => vocabData.find(v => v.word === item.promptTxt || v.meaning === item.promptTxt)?.id);
      }, sprintTurnSeq);
      for (const id of new Set(turnWords)) {
        const firstIdx = turnWords.indexOf(id);
        const consolIdx = turnWords.lastIndexOf(id);
        assert.ok(consolIdx - firstIdx - 1 >= 3, `5-word browser sprint achieved gap ${consolIdx - firstIdx - 1} (< 3) for word ${id}`);
      }
      assert.deepEqual(netRequests, [], 'Standalone app made zero external network requests');
      page.off('request', onNetReq);
    }


    // ---- beta5: the priority configuration, all seven exercise types, skipped
    // questions, hard words, XP/badges and the v1 backup contract are exercised
    // through the interface, in the learner's own workflow.
    const beta5Seed = await page.evaluate(() => {
      const now = Date.now();
      const data = JSON.parse(document.getElementById('vocabulary-data').textContent).filter(entry => !entry.familyHead).slice(0, 12);
      const progress = {};
      data.forEach((entry, index) => {
        progress[entry.id] = {
          id: entry.id,
          state: ['weak', 'learning', 'review', 'new'][index % 4],
          correctCount: index % 3,
          wrongCount: index % 4,
          streak: 1,
          lastReviewed: now - 86400000,
          nextReview: index % 2 ? now - 3600000 : now + 86400000 * 4,
          interval: 2,
          ease: 2.4,
          difficulty: 0.3
        };
      });
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      return data.map(entry => ({ id: entry.id, word: entry.word, meaning: entry.meaning }));
    });
    await page.reload();
    await page.locator('[data-session="priority"]').waitFor();
    // The detailed controls live in a collapsed <details>; open it like a learner would.
    const openPriorityDetails = () => page.evaluate(() => document.querySelector('#priority-details')?.setAttribute('open', ''));
    await openPriorityDetails();
    assert.match(await page.locator('#priority-summary').innerText(), /\d+ từ đủ điều kiện/,
      'the priority panel reports the eligible pool before a session starts');
    assert.match(await page.locator('#priority-effective').innerText(), /Trọng tâm: /);
    // Disabling a group removes its words from the promised pool and is persisted.
    const beforeGroupOff = Number((await page.locator('#priority-summary').innerText()).match(/(\d+) từ đủ điều kiện/)[1]);
    await page.locator('#priority-config [data-group="review"]').click();
    const afterGroupOff = Number((await page.locator('#priority-summary').innerText()).match(/(\d+) từ đủ điều kiện/)[1]);
    assert.equal(afterGroupOff < beforeGroupOff, true, 'switching a group off shrinks the reported eligible count');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.study.v1')))).groups.review, false,
      'the group choice is stored');
    await page.reload();
    await page.locator('[data-session="priority"]').waitFor();
    await openPriorityDetails();
    assert.equal(await page.locator('#priority-config [data-group="review"]').getAttribute('aria-pressed'), 'false',
      'the group choice survives a reload');
    await page.locator('#priority-config [data-group="review"]').click();
    // Focus visibly changes the allocation.
    await page.locator('#priority-config [data-focus="weak"]').click();
    assert.match(await page.locator('#priority-effective').innerText(), /Trọng tâm: Từ yếu hoặc thường sai/);
    // All seven exercise types, including the two that are off by default.
    for (const type of ['cloze', 'match', 'flashcard']) {
      const chip = page.locator(`#priority-config [data-exercise="${type}"]`);
      if (await chip.getAttribute('aria-pressed') === 'false') await chip.click();
    }
    const storedConfig = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.study.v1')));
    assert.equal(Object.values(storedConfig.exercises).filter(Boolean).length, 7, 'every exercise type can be enabled');
    assert.equal(storedConfig.focus, 'weak');
    await page.locator('#priority-config #priority-size').selectOption('10');
    assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.study.v1')))).size, 10);

    await page.locator('[data-session="priority"]').click();
    await page.locator('.flashcard').waitFor();
    assert.match(await page.locator('.page-header').innerText(), /Phiên ưu tiên/);
    const seenExercises = new Set();
    const turnLog = [];
    let lastTurnSeq = null;
    let handled = 0;
    let skipChecked = false;
    let flagChecked = false;
    while (await page.locator('.summary').count() === 0) {
      handled += 1;
      assert.ok(handled < 60, 'the priority session terminates');
      const exercise = await page.locator('.flashcard').getAttribute('data-exercise');
      // A matching board re-renders after every pair, so the turn log records one
      // entry per turn (turnSeq) rather than one per paint.
      const turnSeq = await page.locator('.flashcard').getAttribute('data-turn-seq');
      if (turnSeq !== lastTurnSeq) {
        seenExercises.add(exercise);
        turnLog.push(exercise);
        lastTurnSeq = turnSeq;
      }
      if (await page.locator('#start-quiz').count()) {
        await page.locator('#start-quiz').click();
        continue;
      }
      if (!flagChecked) {
        await page.locator('#flag-card').click();
        flagChecked = true;
        assert.equal((await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.flagged.v1') || '[]'))).length, 1,
          'marking a hard word writes only the separate hard-word list');
        continue;
      }
      if (!skipChecked && await page.locator('#skip-card:enabled').count()) {
        const skippedWord = (await page.locator('.prompt').innerText()).trim();
        await page.locator('#skip-card').click();
        skipChecked = true;
        assert.match(await page.locator('.pending-row').innerText(), /Đã bỏ qua \(1\)/,
          'a skipped question is listed as pending');
        await page.locator('[data-return-id]').first().click();
        assert.equal((await page.locator('.prompt').innerText()).trim(), skippedWord,
          'a pending question can be reopened at the front of the queue');
        continue;
      }
      if (await page.locator('.match-board').count()) {
        // Keyboard parity: tiles are buttons, so Tab + Enter selects them.
        const target = await page.evaluate(() => {
          const vocab = JSON.parse(document.getElementById('vocabulary-data').textContent);
          const word = document.querySelector('[data-match-word]:not([disabled])');
          const entry = vocab.find(item => item.id === word.dataset.matchWord);
          const meaning = [...document.querySelectorAll('[data-match-meaning]:not([disabled])')]
            .find(node => node.textContent.trim() === entry.meaning.trim());
          return { word: word.dataset.matchWord, meaning: meaning?.dataset.matchMeaning };
        });
        assert.ok(target.meaning, 'each word tile has a matching meaning tile');
        await page.locator(`[data-match-word="${target.word}"]`).focus();
        await page.keyboard.press('Enter');
        await page.locator(`[data-match-meaning="${target.meaning}"]`).focus();
        await page.keyboard.press('Enter');
        await page.waitForTimeout(80);
        if (await page.locator('#next-card').count()) await page.locator('#next-card').click();
        continue;
      }
      if (await page.locator('#flip-card').count()) {
        await page.locator('#flip-card').click();
        assert.equal(await page.locator('.reveal').count(), 1, 'a flashcard reveals its own answer');
        assert.equal(await page.locator('[data-option]').count(), 0);
        await page.locator('#reveal-correct').click();
        continue;
      }
      if (await page.locator('#ambiguous-correct').count()) {
        await page.locator('#ambiguous-correct').click();
        continue;
      }
      if (await page.locator('#spelling-input').count()) {
        const label = await page.locator('.mode-label').innerText();
        const prompt = (await page.locator('.prompt').innerText()).trim();
        const entry = beta5Seed.find(item => item.word === prompt || item.meaning === prompt);
        const vi = /GÕ NGHĨA|Gõ nghĩa/.test(label);
        // Vietnamese diacritics are required: a folded spelling is not correct.
        if (vi) await page.locator('#spelling-input').fill('nghich canh');
        else await page.locator('#spelling-input').fill(entry ? entry.word : 'wrong');
        await page.locator('#submit-answer').click();
        if (vi) {
          const progress = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.progress.v1')));
          const wrongIds = Object.values(progress).filter(record => record.wrongCount > 0).map(record => record.id);
          assert.ok(wrongIds.length >= 1, 'a diacritic-free Vietnamese answer is graded, not ignored');
        }
        if (await page.locator('#next-card').count()) await page.locator('#next-card').click();
        continue;
      }
      if (await page.locator('[data-option]:enabled').count()) {
        await page.locator('[data-option]:enabled').first().click();
        if (await page.locator('#next-card').count()) await page.locator('#next-card').click();
        continue;
      }
      if (await page.locator('#next-card').count()) {
        await page.locator('#next-card').click();
        continue;
      }
    }
    assert.equal(seenExercises.size >= 4, true, `the mixed session uses several exercise types: ${[...seenExercises].join(',')}`);
    assert.equal(seenExercises.has('match'), true, 'the matching board appears in a mixed session');
    for (let index = 1; index < turnLog.length; index += 1) {
      assert.equal(turnLog[index] === 'match' && turnLog[index - 1] === 'match', false, 'two matching boards never sit together');
    }
    const summaryText = await page.locator('.summary').innerText();
    assert.match(summaryText, /XP nhận trong phiên/);
    assert.match(summaryText, /Huy hiệu/);
    assert.match(summaryText, /Dạng bài trong phiên/);
    const xpAfterSession = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.badges.v1') || '[]'));
    assert.ok(Array.isArray(xpAfterSession));
    // The hard word is listed in Settings and starts its own session.
    await page.locator('[data-view="settings"]').click();
    assert.equal(await page.locator('.flagged-row').count(), 1, 'the marked hard word is listed in the manage view');
    await page.locator('.flagged-row [data-unflag]').click();
    assert.equal(await page.locator('.flagged-row').count(), 0);
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.flagged.v1'))), []);

    // ---- A v1 file from an older build keeps this device's hard words and config.
    await page.evaluate(() => {
      localStorage.setItem('chuyen-anh.flagged.v1', JSON.stringify(['3']));
    });
    await page.reload();
    await page.locator('[data-session="priority"]').waitFor();
    const studyBeforeV1 = await page.evaluate(() => localStorage.getItem('chuyen-anh.study.v1'));
    await page.locator('[data-view="settings"]').click();
    const v1Bundle = {
      app: 'chuyen-anh-flashcard',
      version: 1,
      exportedAt: '2026-09-01T00:00:00.000Z',
      progress: {},
      prefs: { sessionSize: 20, keyboardShortcuts: true, darkMode: false },
      favorites: [],
      history: [],
      streak: { current: 0, longest: 0, lastDate: null }
    };
    await page.locator('#import-setting').setInputFiles({ name: 'v1.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(v1Bundle)) });
    await page.locator('.toast').filter({ hasText: 'Đã khôi phục tiến độ' }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.flagged.v1'))), ['3'],
      'a v1 backup does not wipe the hard-word list');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.study.v1')), studyBeforeV1,
      'a v1 backup does not reset the study configuration');

    // ---- Every new interface string is translated in the English interface.
    await page.evaluate(() => { localStorage.setItem('chuyen-anh.language.v1', 'en'); });
    await page.reload();
    await page.locator('[data-session="priority"]').waitFor();
    const untranslated = async () => page.evaluate(() => {
      // The product name stays Vietnamese in both interfaces; everything else must translate.
      const protectedSelectors = '.exam-document, .exam-question-source, .vocab-word, .vocab-meaning, .vocab-pos, .vocabulary-metadata dd, .prompt, .option, .example em, .example span, .code, .brand-name, .brand-detail, .eyebrow--brand, script, style';
      const vietnamese = /[àáảãạăâđêôơưèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;
      const found = [];
      const walk = node => {
        if (node.nodeType === 3) {
          const text = node.nodeValue.trim();
          if (text && !node.parentElement?.closest(protectedSelectors) && vietnamese.test(text)) found.push(text.slice(0, 90));
          return;
        }
        if (node.nodeType !== 1) return;
        for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
          const value = node.getAttribute?.(name);
          if (value && vietnamese.test(value)) found.push(`${name}=${value.slice(0, 60)}`);
        }
        for (const child of node.childNodes) walk(child);
      };
      walk(document.getElementById('app'));
      return [...new Set(found)];
    });
    assert.deepEqual(await untranslated(), [], 'the study home has no untranslated beta5 copy');
    await page.locator('[data-view="settings"]').click();
    assert.deepEqual(await untranslated(), [], 'Settings has no untranslated beta5 copy');
    await page.locator('[data-view="dashboard"]').click();
    assert.deepEqual(await untranslated(), [], 'the dashboard has no untranslated beta5 copy');
    await page.evaluate(() => localStorage.removeItem('chuyen-anh.language.v1'));
    await page.reload();
    await page.locator('[data-session="priority"]').waitFor();

    // ---- beta6: a session always opens where the learner can see it, the XP a
    // summary reports is the XP that session earned, a typed answer survives the
    // star/flag toggles, sprints honour the timer, and a start that cannot run
    // explains itself instead of doing nothing.
    const answerEverything = async () => {
      for (let turn = 0; turn < 80; turn += 1) {
        if (await page.locator('.summary').count()) return;
        if (await page.locator('#next-card').count()) { await page.locator('#next-card').click(); await page.waitForTimeout(40); continue; }
        if (await page.locator('#start-quiz').count()) { await page.locator('#start-quiz').click(); await page.waitForTimeout(60); continue; }
        if (await page.locator('#flip-card').count()) { await page.locator('#flip-card').click(); await page.waitForTimeout(60); continue; }
        if (await page.locator('#reveal-correct').count()) { await page.locator('#reveal-correct').click(); await page.waitForTimeout(60); continue; }
        if (await page.locator('[data-option]:enabled').count()) { await page.locator('[data-option]:enabled').first().click(); await page.waitForTimeout(60); continue; }
        if (await page.locator('#spelling-input').count()) {
          await page.locator('#spelling-input').fill('not-the-answer');
          await page.locator('#submit-answer').click();
          await page.waitForTimeout(60);
          continue;
        }
        if (await page.locator('.match-board').count()) {
          for (let pair = 0; pair < 6; pair += 1) {
            const ids = await page.evaluate(() => [...document.querySelectorAll('[data-match-word]')]
              .filter(node => !node.disabled).map(node => node.dataset.matchWord));
            if (!ids.length) break;
            await page.locator(`[data-match-word="${ids[0]}"]`).click();
            await page.locator(`[data-match-meaning="${ids[0]}"]`).click();
            await page.waitForTimeout(50);
            if (await page.locator('#next-card').count()) break;
          }
          continue;
        }
        return;
      }
    };

    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    await page.locator('[data-view="settings"]').click();
    await page.locator('.setting-actions [data-session="priority"]').click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.flashcard').count(), 1,
      'starting a priority session from Settings opens the card instead of doing nothing');
    assert.match(await page.locator('.nav-button.active').innerText(), /Học/,
      'the study view becomes the active view');
    await page.locator('#exit-session').click();

    // The summary's "XP earned" must equal the increase in the total XP.
    await page.evaluate(() => {
      const progress = {};
      for (let index = 1; index <= 120; index += 1) {
        progress[String(index)] = {
          id: String(index), state: 'review', ease: 2.5, interval: 10,
          correctCount: 9, wrongCount: 0, streak: 9,
          lastReviewed: Date.now() - 86400000, nextReview: Date.now() + 9 * 86400000, lapses: 0
        };
      }
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(progress));
      localStorage.setItem('chuyen-anh.prefs.v1', JSON.stringify({ sessionSize: 10, keyboardShortcuts: true, darkMode: false }));
    });
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    const xpBeforeQuick = Number((await page.locator('.hero-metric strong').last().innerText()).replace(/\D/g, ''));
    assert.equal(xpBeforeQuick, 10800, 'the seeded profile really carries 10,800 XP');
    await page.locator('.session-card[data-session="quick10"]').click();
    await answerEverything();
    const quickSummary = await page.locator('.summary').innerText();
    const xpGainedShown = Number((quickSummary.match(/\+(\d+)/) || [])[1]);
    const xpTotalShown = Number((quickSummary.match(/Tổng (\d+) XP/) || [])[1]);
    assert.equal(xpTotalShown - xpBeforeQuick, xpGainedShown,
      `a classic session reports only its own XP (shown +${xpGainedShown} of ${xpTotalShown}, baseline ${xpBeforeQuick})`);
    assert.ok(xpGainedShown > 0 && xpGainedShown < 500, `the reported gain is session-sized, got ${xpGainedShown}`);
    await page.locator('#again').click();
    assert.equal(await page.locator('.flashcard').count(), 0, 'Học tiếp returns to the session picker');
    assert.equal(await page.locator('.hero-metric strong').first().innerText() !== null, true);

    // A typed answer is not thrown away by the star or flag button.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.study.v1', JSON.stringify({
        groups: { due: true, weak: true, new: true, review: true }, focus: 'new',
        exercises: { mc_en_vi: false, mc_vi_en: false, fill_vi: false, fill_en: true, cloze: false, match: false, flashcard: false },
        size: 10, timed: false, timerMinutes: 0
      }));
    });
    await page.reload();
    await page.locator('[data-session="priority"]').waitFor();
    await page.locator('.priority-head-actions [data-session="priority"]').click();
    await page.locator('#start-quiz').click();
    await page.locator('#spelling-input').waitFor();
    await page.locator('#spelling-input').fill('half-typed');
    await page.locator('#flag-card').click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#spelling-input').inputValue(), 'half-typed',
      'marking a hard word keeps the typed answer');
    assert.equal(await page.locator('#flag-card').getAttribute('aria-pressed'), 'true');
    await page.locator('#favorite-card').click();
    await page.waitForTimeout(120);
    assert.equal(await page.locator('#spelling-input').inputValue(), 'half-typed',
      'favouriting a word keeps the typed answer');
    await page.locator('#exit-session').click();
    await page.evaluate(() => { localStorage.removeItem('chuyen-anh.favorites.v1'); });

    // A sprint honours the timer the learner switched on.
    await page.evaluate(() => {
      localStorage.setItem('chuyen-anh.study.v1', JSON.stringify({
        groups: { due: true, weak: true, new: true, review: true }, focus: 'new',
        exercises: { mc_en_vi: true, mc_vi_en: true, fill_vi: true, fill_en: true, cloze: false, match: false, flashcard: true },
        size: 10, timed: true, timerMinutes: 1
      }));
    });
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    await page.locator('.sprint-banner [data-session="sprint"]').click();
    await page.locator('#session-timer').waitFor({ timeout: 5000 });
    assert.match(await page.locator('#session-timer').innerText(), /^0[01]:\d\d$/,
      'a timed sprint shows a real countdown');
    await page.locator('#exit-session').click();
    await page.locator('[data-view="settings"]');
    await page.evaluate(() => {
      localStorage.setItem('chuyen-anh.study.v1', JSON.stringify({
        groups: { due: false, weak: false, new: false, review: true }, focus: 'review',
        exercises: { mc_en_vi: true, mc_vi_en: false, fill_vi: false, fill_en: false, cloze: false, match: false, flashcard: false },
        size: 10, timed: false, timerMinutes: 0
      }));
    });
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();

    // A start that cannot run explains itself rather than swallowing the click.
    const blockedStart = page.locator('.priority-head-actions [data-session="priority"]');
    assert.equal(await blockedStart.getAttribute('data-blocked'), 'true', 'the blocked start is marked');
    assert.equal(await blockedStart.getAttribute('aria-describedby'), 'priority-summary', 'the reason is announced');
    assert.equal(await blockedStart.isDisabled(), false, 'the blocked start is still operable');
    await blockedStart.click();
    await page.locator('.toast').filter({ hasText: 'Không có từ nào thuộc nhóm đang bật' }).waitFor();
    assert.equal(await page.locator('.flashcard').count(), 0, 'a refused start opens no card');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.history.v1')), null,
      'a refused start writes no session');

    // A new session never inherits the previous one's skipped questions.
    await page.evaluate(() => {
      localStorage.setItem('chuyen-anh.study.v1', JSON.stringify({
        groups: { due: true, weak: true, new: true, review: true }, focus: 'new',
        exercises: { mc_en_vi: true, mc_vi_en: true, fill_vi: true, fill_en: true, cloze: false, match: false, flashcard: true },
        size: 10, timed: false, timerMinutes: 0
      }));
    });
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    await page.locator('.priority-head-actions [data-session="priority"]').click();
    await page.locator('#skip-card').click();
    assert.equal(await page.locator('.pending-row').count(), 1, 'a skipped question is listed');
    await page.locator('[data-view="settings"]').click();
    await page.locator('.setting-actions [data-session="priority"]').click();
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.pending-row').count(), 0,
      'a new session starts with no pending list from the previous one');
    await page.locator('#exit-session').click();

    // ---- A failed device write is reported, never replaced by a success message.
    // ---- beta7: the phrase bank browses, searches, filters and practises on its
    // own storage key; word progress must be untouched by any of it.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    await page.locator('[data-view="phrases"]').click();
    await page.locator('#phrase-results .vocab-row').first().waitFor();
    assert.match(await page.locator('.page-header p').innerText(), /780 cụm\b/, 'the header reports the real phrase count');
    assert.equal(await page.locator('#phrase-results .vocab-row').count(), 80, 'the list is capped for rendering');
    const wordProgressBeforePhrases = await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1'));

    await page.locator('#phrase-field').fill('take');
    const takeRows = await page.locator('#phrase-results .vocab-row').count();
    assert.ok(takeRows > 0 && takeRows < 80, `searching narrows the list (got ${takeRows})`);
    await page.locator('#phrase-field').fill('không tồn tại zzz');
    await page.locator('#phrase-results .empty').waitFor();
    assert.equal(await page.locator('#phrase-practice-start').isDisabled(), true, 'an empty result cannot start a session');
    await page.locator('#phrase-field').fill('');

    await page.locator('#phrase-type').selectOption('idiom');
    await page.locator('#phrase-results .vocab-row').first().waitFor();
    const typeLabels = await page.locator('#phrase-results .vocab-row .vocab-pos').allInnerTexts();
    assert.ok(typeLabels.every(text => text === 'Thành ngữ'), 'the type filter shows only idioms');
    await page.locator('#phrase-type').selectOption('all');
    await page.locator('#phrase-level').selectOption('C1');
    await page.locator('#phrase-results .vocab-row').first().waitFor();
    const c1Count = await page.locator('#phrase-results .vocab-row').count();
    assert.ok(c1Count > 0 && c1Count < 780, `the level filter narrows the list (${c1Count} C1 phrases)`);
    await page.locator('#phrase-level').selectOption('all');

    await page.locator('#phrase-practice-start').click();
    await page.locator('.flashcard').waitFor();
    let phraseTurns = 0;
    for (let turn = 0; turn < 60; turn += 1) {
      if (await page.locator('.summary').count()) break;
      if (await page.locator('#phrase-next').count()) { await page.locator('#phrase-next').click(); await page.waitForTimeout(30); continue; }
      if (await page.locator('[data-phrase-option]:enabled').count()) {
        await page.locator('[data-phrase-option]:enabled').first().click();
        phraseTurns += 1;
        await page.waitForTimeout(30);
        continue;
      }
      if (await page.locator('#phrase-answer').count()) {
        await page.locator('#phrase-answer').fill('một cụm từ sai');
        await page.locator('#phrase-submit').click();
        phraseTurns += 1;
        await page.waitForTimeout(30);
        continue;
      }
      await page.waitForTimeout(30);
    }
    await page.locator('.summary').waitFor();
    assert.ok(phraseTurns > 0, 'the phrase session asked questions');
    assert.match(await page.locator('.summary-hero').innerText(), /\d+\/10/);
    const phraseStore = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.phrases.v1') || 'null'));
    assert.ok(phraseStore && Object.keys(phraseStore).length === 10, 'ten phrases were recorded in the phrase store');
    for (const record of Object.values(phraseStore)) {
      assert.equal(record.attempts, 1, 'each phrase was graded once');
      assert.equal(record.correct + record.wrong, 1, 'every attempt is recorded as right or wrong');
      assert.ok(record.lastPracticed > 0, 'the attempt carries a timestamp');
    }
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1')), wordProgressBeforePhrases,
      'practising phrases never writes word progress');
    await page.locator('#phrase-back').click();
    await page.locator('#phrase-results .vocab-row').first().waitFor();

    // The list now reflects the practised phrases: their state is no longer "new".
    const practisedPills = await page.locator('#phrase-results .vocab-row .state-pill').allInnerTexts();
    assert.ok(practisedPills.some(text => text !== 'Từ mới'), 'a practised phrase leaves the new state');

    // The English interface translates the phrase screens without touching phrase text.
    await page.evaluate(() => localStorage.setItem('chuyen-anh.language.v1', 'en'));
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();
    await page.locator('[data-view="phrases"]').click();
    await page.locator('#phrase-results .vocab-row').first().waitFor();
    const phraseUntranslated = () => page.evaluate(() => {
      const protectedSelectors = '.vocab-word, .vocab-meaning, .vocab-pos, .vocabulary-metadata dd, .prompt, .option, .example em, .example span, .code, .brand-name, .brand-detail, script, style';
      const vietnamese = /[àáảãạăâđêôơưèéẻẽẹìíỉĩịòóỏõọùúủũụỳýỷỹỵ]/i;
      const found = [];
      const walk = node => {
        if (node.nodeType === 3) {
          const text = node.nodeValue.trim();
          if (text && !node.parentElement?.closest(protectedSelectors) && vietnamese.test(text)) found.push(text.slice(0, 90));
          return;
        }
        if (node.nodeType !== 1) return;
        for (const name of ['aria-label', 'placeholder', 'title', 'alt']) {
          const value = node.getAttribute?.(name);
          if (value && vietnamese.test(value)) found.push(`${name}=${value.slice(0, 60)}`);
        }
        for (const child of node.childNodes) walk(child);
      };
      walk(document.getElementById('app'));
      return [...new Set(found)];
    });
    assert.deepEqual(await phraseUntranslated(), [], 'the phrase list has no untranslated interface copy');
    assert.match(await page.locator('.page-header h1').innerText(), /Phrases/);
    await page.locator('#phrase-practice-start').click();
    await page.locator('.flashcard').waitFor();
    await page.waitForTimeout(80);
    assert.deepEqual(await phraseUntranslated(), [], 'the phrase practice screen has no untranslated interface copy');
    await page.evaluate(() => localStorage.removeItem('chuyen-anh.language.v1'));
    await page.reload();
    await page.locator('[data-session="new"]').waitFor();

    // Resetting the profile clears the phrase store as well as the word store.
    await page.locator('[data-view="settings"]').click();
    // The suite already accepts dialogs for this page (see the reset scenario above).
    await page.locator('#reset-setting').click();
    await page.locator('.toast').filter({ hasText: 'Đã xóa dữ liệu học' }).waitFor();
    assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.phrases.v1') || '{}')), {},
      'reset clears phrase progress');

    const failing = await browser.newPage({ viewport: { width: 1280, height: 900 }, reducedMotion: 'reduce' });
    const failingErrors = [];
    failing.on('pageerror', error => failingErrors.push(error.message));
    failing.on('dialog', dialog => dialog.accept());
    await failing.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
    await failing.addInitScript(() => {
      Storage.prototype.setItem = function () { throw new Error('quota exceeded'); };
    });
    await failing.goto(`http://127.0.0.1:${server.address().port}`);
    // This page inherits the origin's storage from the previous scenario, so start
    // from an empty device to make "nothing was stored" a real assertion.
    // Storage.prototype.clear is not overridden; only writes fail.
    await failing.evaluate(() => localStorage.clear());
    await failing.reload();
    await failing.locator('[data-session="new"]').waitFor();
    await failing.locator('[data-view="settings"]').click();
    await failing.locator('#reset-setting').click();
    await failing.locator('.toast').filter({ hasText: 'Không thể xóa dữ liệu' }).waitFor();
    assert.equal(await failing.locator('.toast').filter({ hasText: 'Đã xóa dữ liệu học' }).count(), 0, 'a failed wipe is not reported as success');
    await failing.locator('#import-setting').setInputFiles({ name: 'active.json', mimeType: 'application/json', buffer: activeBackup });
    await failing.locator('.toast').filter({ hasText: 'Không thể lưu dữ liệu vừa nhập' }).waitFor();
    assert.equal(await failing.locator('.toast').filter({ hasText: 'Đã khôi phục tiến độ' }).count(), 0, 'a failed import is not reported as success');
    assert.equal(await failing.evaluate(() => localStorage.getItem('chuyen-anh.progress.v1')), null, 'nothing was stored');
    const deviceAfterFailedWrites = await failing.evaluate(() => ({ ...localStorage }));
    await failing.locator('[data-view="search"]').click();
    await failing.locator('#search-field').fill('advers');
    await failing.locator('#results .vocab-row').first().waitFor();
    const failingRows = await failing.locator('#results .vocab-row').count();
    await failing.locator('#results .vocab-row .fav').first().click();
    await failing.locator('.toast').filter({ hasText: 'Không thể lưu danh sách yêu thích' }).waitFor();
    assert.equal(await failing.locator('#search-field').inputValue(), 'advers');
    assert.equal(await failing.locator('#results .vocab-row').count(), failingRows);
    await failing.locator('#theme-button').click();
    await failing.locator('.toast').filter({ hasText: 'Không thể lưu giao diện' }).waitFor();
    assert.deepEqual(await failing.evaluate(() => ({ ...localStorage })), deviceAfterFailedWrites, 'failed writes leave the device unchanged');
    assert.deepEqual(failingErrors, []);
    await failing.close();


    assert.deepEqual(errors, []);
    console.log(`PASS: Chromium ${browser.version()} — first-look introduction for new words, same-part-of-speech distractors, cloze options absent from the sentence, revealed answers locked to self-assessment, corrective retrieval, bounded retries, R, skips, first-pass history, existing progress preserved, persistence, import/export, keyboard focus, light/dark, 320/375/768px responsive layout, reduced-motion setting, search state across a favorite toggle, session clearing on reset/import, the ID 448 historical label, named option groups, shortcuts limited to the visible card, failed writes reported truthfully, JSON backup round-trips that keep every retained session, blank spelling submissions ignored, single-graded self-assessment, skip locked after a reveal, and 'Học cấp tốc' processing all ten requested words with a truthful single correction, automatic advance only after correct answers, accurate first-pass statistics, persisted progress, an immediate hand-off with the graded answer carried onto the next card, a queue that never shifts while another screen is open, and interface copy on a consolidation turn translated in the English interface; the beta5 priority configuration with all seven exercise types, a matching board driven from the keyboard, a skipped question reopened from the pending list, a hard word marked and unmarked, a real one-minute timed session that ends on its results with unanswered questions reported as blank, a v1 backup that keeps the device hard-word list, English rendering of every new screen, and the beta6 regressions: a priority session started from Settings opens where the learner can see it, a classic session reports only its own XP, a typed answer survives the star/flag toggles, a sprint honours the timer, a start that cannot run explains itself, a new session inherits no skipped questions, and the beta7 phrase bank: 780 phrases browsed, searched, filtered by type and level, practised for ten turns with typed and multiple-choice retrieval recorded in its own store while word progress stayed byte-identical, English rendering of the phrase screens, and a reset that clears phrase progress; no page errors.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
