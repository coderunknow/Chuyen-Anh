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
    assert.match(await page.locator('.session-grid--focus [data-session="due"]').innerText(), /0 từ/);
    assert.equal(await page.locator('.study-recommendation [data-session]').getAttribute('data-session'), 'quick10',
      'a fresh profile is offered a short mixed session instead of an empty due queue');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('#content')).outlineWidth), '0px',
      'programmatic focus does not draw a frame around the whole page');
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#f4f7f5', 'the browser chrome starts in the light theme');
    await page.setViewportSize({ width: 375, height: 812 });
    const homeMobile = await page.evaluate(() => {
      const rect = selector => { const { top, bottom, width } = document.querySelector(selector).getBoundingClientRect(); return { top, bottom, width }; };
      return { main: rect('#content'), action: rect('.study-recommendation button'), nav: rect('.sidebar'), support: rect('.support-sidebar'), scrollWidth: document.documentElement.scrollWidth };
    });
    assert.equal(homeMobile.main.top < 220, true, 'the main study choice follows compact mobile navigation');
    assert.equal(homeMobile.action.bottom < 812, true, 'the recommended study action is in the first 375×812 viewport');
    assert.equal(homeMobile.support.top > homeMobile.main.top, true, 'secondary progress/help follows the study entry point on mobile');
    assert.equal(homeMobile.scrollWidth <= 375, true, 'the homepage does not overflow horizontally');
    assert.equal(await page.locator('.session-card .icon').count() > 0, true, 'session icons are self-contained SVGs');
    assert.equal(await page.locator('.session-card').first().evaluate(el => getComputedStyle(el).transitionDuration), '0s', 'reduced motion removes nonessential card transitions');
    await page.setViewportSize({ width: 320, height: 720 });
    const homeNarrow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      mainTop: document.querySelector('#content').getBoundingClientRect().top,
      actionBottom: document.querySelector('.study-recommendation button').getBoundingClientRect().bottom
    }));
    assert.equal(homeNarrow.width <= 320, true, 'the minimum supported 320px viewport has no horizontal overflow');
    assert.equal(homeNarrow.mainTop < 220, true, 'the primary study content stays near the top at 320px');
    assert.equal(homeNarrow.actionBottom < 720, true, 'the recommended action fits the first 320×720 viewport');
    await page.setViewportSize({ width: 768, height: 900 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'the tablet breakpoint does not introduce horizontal overflow');
    await page.setViewportSize({ width: 1280, height: 900 });

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
    assert.equal(await page.locator('meta[name="theme-color"]').getAttribute('content'), '#101a18', 'the browser chrome follows the dark theme');
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    assert.equal(await page.locator('.prompt').evaluate(el => getComputedStyle(el).color), 'rgb(232, 242, 237)');
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
    assert.match(await page.locator('.session-grid--focus [data-session="due"]').innerText(), /1 từ/);

    // A genuinely due review becomes the recommended action; it is not filled with future cards.
    await page.evaluate(() => {
      localStorage.clear();
      localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
        '1': { id: '1', state: 'review', correctCount: 2, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 }
      }));
    });
    await page.reload();
    await page.locator('.study-recommendation [data-session="due"]').waitFor();
    assert.match(await page.locator('.study-recommendation').innerText(), /1 từ đang đến hạn/);
    await page.locator('.study-recommendation [data-session="due"]').click();
    assert.match(await page.locator('.page-header').innerText(), /Ôn đến hạn · 1 lượt còn lại/);
    assert.equal(await page.locator('.first-look').count(), 0, 'the due review does not introduce a previously studied card');
    await page.locator('#exit-session').click();

    // Export and valid/invalid import preserve the post-session backup.
    await page.locator('[data-view="settings"]').click();
    assert.equal(await page.getByRole('checkbox', { name: 'Giao diện tối' }).count(), 1, 'the theme switch has a learner-facing accessible name');
    assert.equal(await page.getByRole('checkbox', { name: 'Phím tắt bàn phím' }).count(), 1, 'the shortcut switch has a learner-facing accessible name');
    assert.equal(await page.getByRole('combobox', { name: 'Ngôn ngữ giao diện' }).count(), 1, 'the interface-language select has a name');
    assert.equal(await page.getByRole('combobox', { name: 'Số thẻ mặc định mỗi phiên' }).count(), 1, 'the session-size select has a name');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'language-setting', 'keyboard navigation reaches the interface-language selector first');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'dark-setting', 'keyboard navigation reaches the named theme switch');
    const switchFocus = await page.locator('#dark-setting').evaluate(input => ({
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
    assert.equal(await page.locator('.state-pill').innerText(), 'Ôn tập');
    assert.equal((await read('progress'))['1'].correctCount, 3);
    await page.locator('[data-option="1"]').click();
    const continued = (await read('progress'))['1'];
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
    assert.match(searchMetaBefore, /2 kết quả · trang 1\/1/, 'the query matches its two records');
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
    await seed(['1', '2']);
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
    assert.equal((await read('progress'))['1'].correctCount, 0);

    await seed(['1', '2']);
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
    await seed(['1', '2']);
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

    // ---- A backup file round-trips: export → wipe → import → export preserves data.
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await seed(['1']);
    await answer('1', true);
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
    assert.deepEqual(roundTripBundle.favorites, ['1']);
    assert.equal(roundTripBundle.progress['1'].correctCount, 1);
    assert.equal(roundTripBundle.progress['1'].state, 'learning');
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
      localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['1']));
      localStorage.setItem('chuyen-anh.history.v1', JSON.stringify(entries));
    }, seededHistory);
    await page.reload();
    await page.locator('[data-session="favorites"]').click();
    await answer('1', true);
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

    // ---- A blank spelling submission is not a graded attempt. (dev3 regression)
    async function seedSpellingCard() {
      await page.evaluate(() => {
        localStorage.clear();
        localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(['1']));
        localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify({
          '1': { id: '1', state: 'learning', correctCount: 2, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 }
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
    const beforeBlank = (await read('progress'))['1'];
    await page.locator('#submit-answer').click();
    await page.locator('.toast').filter({ hasText: 'Hãy nhập câu trả lời trước khi xác nhận.' }).waitFor();
    assert.equal(await page.locator('#feedback-area').innerText(), '', 'a blank submission produces no graded feedback');
    assert.equal(await page.locator('#next-card').count(), 0, 'a blank submission does not advance the session');
    await page.locator('#spelling-input').fill('   ');
    await page.locator('#spelling-input').press('Enter');
    assert.deepEqual((await read('progress'))['1'], beforeBlank,
      'blank and whitespace-only submissions change no progress');
    await typeAnswer('Adversity');
    assert.equal((await read('progress'))['1'].correctCount, beforeBlank.correctCount + 1,
      'a real submission still grades exactly once');
    await next();

    // ---- Self-assessment grades exactly once, even when activated twice. (dev3 regression)
    await seedSpellingCard();
    await revealFromKeyboard();
    await page.locator('#reveal-correct').waitFor();
    const beforeSelfGrade = (await read('progress'))['1'];
    await page.locator('#reveal-correct').evaluate(element => { element.click(); element.click(); });
    await page.waitForTimeout(50);
    const afterSelfGrade = (await read('progress'))['1'];
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
    assert.deepEqual((await read('progress'))['1'],
      { id: '1', state: 'learning', correctCount: 2, wrongCount: 0, streak: 2, lastReviewed: 0, nextReview: 0, interval: 1, ease: 2.5, difficulty: 0 },
      'revealing and locking writes nothing to progress');

    // ---- A failed device write is reported, never replaced by a success message.
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
    console.log(`PASS: Chromium ${browser.version()} — first-look introduction for new words, same-part-of-speech distractors, cloze options absent from the sentence, revealed answers locked to self-assessment, corrective retrieval, bounded retries, R, skips, first-pass history, existing progress preserved, persistence, import/export, keyboard focus, light/dark, 320/375/768px responsive layout, reduced-motion setting, search state across a favorite toggle, session clearing on reset/import, the ID 448 historical label, named option groups, shortcuts limited to the visible card, failed writes reported truthfully, JSON backup round-trips that keep every retained session, blank spelling submissions ignored, single-graded self-assessment, and skip locked after a reveal; no page errors.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
