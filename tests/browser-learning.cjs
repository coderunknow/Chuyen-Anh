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
    await page.clock.setFixedTime(new Date('2026-10-13T12:00:00Z'));
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.locator('[data-session="new"]').waitFor();
    assert.match(await page.locator('[data-session="due"]').innerText(), /0 từ/);

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
    // A never-studied card opens on its introduction; the quiz starts from there.
    async function startQuizFromIntroduction() {
      if (await page.locator('#start-quiz').count()) await page.locator('#start-quiz').click();
    }

    // Error -> intervening word -> typed corrective retrieval -> truthful summary.
    await seed(['1', '2']);
    await answer('1', false);
    const failedProgress = (await read('progress'))['1'];
    assert.equal(failedProgress.state, 'weak');
    assert.match(await page.locator('#feedback-area').innerText(), /Đã xếp một lượt gõ lại/);
    await next();
    assert.equal(await page.locator('.prompt').innerText(), 'Meticulous');
    await answer('2', true);
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
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.prompt').evaluate(el => getComputedStyle(el).color), 'rgb(228, 240, 237)');
    if (process.env.BROWSER_SCREENSHOT) await page.screenshot({ path: process.env.BROWSER_SCREENSHOT, fullPage: true });
    await page.setViewportSize({ width: 375, height: 812 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    assert.equal(await page.locator('#spelling-input').isVisible(), true);
    await typeAnswer('Adversity');
    assert.deepEqual((await read('progress'))['1'], failedProgress);
    await next();
    assert.match(await page.locator('.summary').innerText(), /50%/);
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 1 đúng · 0 chưa đúng \/ 1 lượt/);
    await history({ total: 2, correct: 1, wrong: 1, accuracy: 50 });
    await page.locator('#summary-dashboard').click();
    assert.match(await page.locator('.history').innerText(), /50%/);
    await page.reload();
    assert.deepEqual((await read('progress'))['1'], failedProgress);
    assert.equal((await read('prefs')).darkMode, true);
    assert.deepEqual((await read('favorites')).sort(), ['1', '2']);
    assert.match(await page.locator('[data-session="due"]').innerText(), /1 từ/);

    // Export and valid/invalid import preserve the post-session backup.
    await page.locator('[data-view="settings"]').click();
    const downloadPromise = page.waitForEvent('download');
    await page.locator('#export-setting').click();
    const download = await downloadPromise;
    const backup = fs.readFileSync(await download.path());
    await page.locator('#import-setting').setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
    await page.locator('.toast').filter({ hasText: 'Đã nhập' }).waitFor();
    const beforeBadImport = await page.evaluate(() => ({ ...localStorage }));
    await page.locator('#import-setting').setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"wrong"}') });
    await page.locator('.toast').filter({ hasText: 'Import thất bại' }).waitFor();
    assert.deepEqual(await page.evaluate(() => ({ ...localStorage })), beforeBadImport);

    // Last-card failure gets exactly one retry; another failure cannot loop.
    await seed(['1']);
    await answer('1', false);
    const lastFailed = (await read('progress'))['1'];
    await page.keyboard.press('r'); // Already auto-queued: no duplicate.
    await typeAnswer('wrong');
    assert.deepEqual((await read('progress'))['1'], lastFailed);
    await next();
    assert.match(await page.locator('.summary').innerText(), /Luyện lại: 0 đúng · 1 chưa đúng \/ 1 lượt/);
    await history({ total: 1, correct: 0, wrong: 1, accuracy: 0 });

    // An all-correct session ends without adding practice.
    await seed(['1']);
    await answer('1', true);
    await next();
    assert.doesNotMatch(await page.locator('.summary').innerText(), /Luyện lại:/);
    await history({ total: 1, correct: 1, wrong: 0, accuracy: 100 });

    // Optional R after a correct answer also stays practice-only.
    await seed(['1']);
    await answer('1', true);
    const correctProgress = (await read('progress'))['1'];
    await page.keyboard.press('r');
    await typeAnswer('wrong');
    assert.deepEqual((await read('progress'))['1'], correctProgress);
    await next();
    await history({ total: 1, correct: 1, wrong: 0, accuracy: 100 });

    // Multiple errors retain order; skipping practice does not add work.
    await seed(['1', '2']);
    await answer('1', false);
    await next();
    await answer('2', false);
    await next();
    await page.locator('#skip-card').click();
    assert.match(await page.locator('.prompt').innerText(), /tỉ mỉ/);
    await typeAnswer('Meticulous');
    await next();
    await typeAnswer('Adversity');
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
    await seed(['1', '2', '3']);
    assert.equal(await page.locator('#start-quiz').count(), 1);
    await page.locator('#start-quiz').click();
    await page.locator('[data-option="1"]').click();
    await next();
    assert.equal(await page.locator('#start-quiz').count(), 1, 'the second never-studied word is introduced');
    await page.locator('#start-quiz').click();
    await page.locator('#skip-card').click();
    assert.equal((await page.locator('.prompt').innerText()).trim(), 'Ambiguity');
    await page.locator('#skip-card').click();
    assert.equal((await page.locator('.prompt').innerText()).trim(), 'Meticulous');
    assert.equal(await page.locator('#start-quiz').count(), 0, 'an introduced word is not introduced again in the same session');
    assert.equal(await page.locator('[data-option]').count(), 4);

    // A revealed typed card locks its input as well, and practice stays practice.
    await seed(['1']);
    await page.locator('#start-quiz').click();
    await page.locator('[data-option]:not([data-option="1"])').first().click();
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
    await seed(['1']);
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
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['1']));
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '1': { id: '1', state: 'review', correctCount: 3, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 5, ease: 2.4, difficulty: 0.2 }
      }));
    });
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    assert.equal(await page.locator('#start-quiz').count(), 0, 'a card with existing progress is not reintroduced');
    assert.equal(await page.locator('[data-option]').count(), 4);
    assert.equal(await page.locator('.state-pill').innerText(), 'review');
    assert.equal((await read('progress'))['1'].correctCount, 3);
    await page.locator('[data-option="1"]').click();
    const continued = (await read('progress'))['1'];
    assert.equal(continued.correctCount, 4, 'the stored counters keep growing from their old value');
    assert.equal(continued.wrongCount, 0);
    assert.deepEqual(errors, []);
    console.log(`PASS: Chromium ${browser.version()} — first-look introduction for new words, same-part-of-speech distractors, cloze options absent from the sentence, revealed answers locked to self-assessment, corrective retrieval, bounded retries, R, skips, first-pass history, existing progress preserved, persistence, import/export, keyboard focus, light/dark, mobile layout, reduced-motion setting; no page errors.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
