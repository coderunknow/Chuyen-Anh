// Optional real-browser checks for the offline exam archive and its safety gates.
// npm install --no-save --package-lock=false playwright-core @sparticuz/chromium@133.0.0
// node tests/browser-exams.cjs
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
  const screenshotDir = process.env.BROWSER_SCREENSHOT_DIR;
  if (screenshotDir) fs.mkdirSync(screenshotDir, { recursive: true });
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
    const externalRequests = [];
    const localOrigin = `http://127.0.0.1:${server.address().port}`;
    page.on('pageerror', error => errors.push(error.message));
    page.on('request', request => {
      if (!request.url().startsWith(localOrigin)) externalRequests.push(request.url());
    });
    await page.goto(localOrigin);
    await page.locator('[data-view="exams"]').click();
    await page.locator('#exam-results-count').filter({ hasText: '106 bản chép' }).waitFor();
    if (screenshotDir) await page.screenshot({ path: path.join(screenshotDir, 'catalogue-desktop.png'), fullPage: true });

    assert.equal(await page.locator('#exam-list .exam-card').count(), 24, 'the catalogue paginates instead of rendering all records at once');
    assert.equal(await page.getByRole('searchbox', { name: 'Tìm địa phương, trường hoặc năm' }).count(), 1);
    for (const name of ['Năm thi', 'Tỉnh/thành', 'Dạng nguồn', 'Đơn vị']) {
      assert.equal(await page.getByRole('combobox', { name }).count(), 1, `${name} filter has an accessible name`);
    }
    assert.equal(await page.getByRole('heading', { name: 'Kho đề Chuyên Anh', level: 1 }).count(), 1);
    assert.match(await page.locator('.exam-warning').innerText(), /22 bản HTML\/OCR vẫn cần soát.*chỉ đọc/i);
    assert.match(await page.locator('.exam-warning').innerText(), /mục trích xuất chưa xác minh/i);
    assert.match(await page.locator('.exam-warning').innerText(), /audio nghe không được nhúng/i);
    assert.equal(await page.locator('[role="timer"]').count(), 0, 'the unreviewed archive exposes no exam clock');
    assert.equal(await page.locator('.exam-outline').count(), 0, 'raw headings are not promoted into a generated outline');

    await page.locator('#exam-search').fill('vinh long');
    assert.equal(await page.locator('#exam-list .exam-card').count(), 1, 'accent-insensitive search finds Vĩnh Long');
    await page.locator('#exam-year').selectOption('2026');
    await page.locator('#exam-province').selectOption('Vĩnh Long');
    assert.equal(await page.locator('#exam-list .exam-card').count(), 1, 'year and location filters combine');
    await page.locator('#exam-search').fill('');
    await page.locator('#exam-year').selectOption('all');
    await page.locator('#exam-province').selectOption('all');
    await page.locator('#exam-format').selectOption('needs-review');
    assert.equal(await page.locator('#exam-results-count').innerText().then(text => Number(text.match(/^\d+/)[0])), 22, 'the quality filter reports the 22 HTML/OCR records needing review');
    assert.equal(await page.locator('#exam-list .exam-card').count(), 22);
    await page.locator('#exam-format').selectOption('all');
    await page.locator('#exam-search').fill('vinh long');
    await page.locator('[data-exam-open="2026/vinh-long/so"]').click();
    await page.locator('#exam-practice-start').waitFor();
    assert.match(await page.locator('.exam-practice-note').innerText(), /trích xuất tự động, chưa xác minh/i);
    assert.match(await page.locator('.exam-practice-note').innerText(), /mất khi tải lại hoặc đóng trang/i);
    assert.equal(await page.locator('[role="timer"]').count(), 0, 'transcript practice has no timer');
    assert.equal(await page.locator('.exam-outline').count(), 0, 'raw headings are not promoted into a generated outline');
    assert.equal(await page.locator('#exam-practice-start').count(), 1);
    assert.equal(await page.locator('.exam-document h2, .exam-document h3, .exam-document h4').count() > 0, true, 'the preserved transcription headings remain readable in the source body');
    assert.match(await page.locator('.exam-source-metadata').innerText(), /SHA-256/);
    assert.match(await page.locator('.exam-source-metadata').innerText(), /không được dùng để chấm tự động/);
    const sourceLink = page.locator('.exam-source-metadata a');
    assert.equal(await sourceLink.getAttribute('target'), '_blank');
    assert.match(await sourceLink.getAttribute('rel'), /noopener/);
    assert.equal(await page.locator('.exam-document script, .exam-document img, .exam-document iframe, .exam-document [onerror], .exam-document [onload]').count(), 0, 'raw transcription text cannot introduce executable markup');

    await page.locator('#exam-practice-start').click();
    await page.locator('#exam-current-question-heading').waitFor();
    assert.equal(await page.locator('[data-question-index]').count(), 49, 'only explicitly parsed items are included in question navigation');
    assert.equal(await page.locator('.exam-practice-option').count(), 3, 'the first question uses the three choices stored in the transcription');
    // dev3 regression: one double-click on the step buttons must advance exactly one item.
    const readPracticeIndex = async () => Number(((await page.locator('.exam-question-meta').innerText())
      .replace(/\s+/g, ' ').match(/Mục trích xuất (\d+)/) || [])[1]);
    assert.equal(await readPracticeIndex(), 1);
    await page.locator('#exam-question-next').dblclick();
    assert.equal(await readPracticeIndex(), 2, 'a double-click on "Câu sau" advances exactly one extracted item');
    await page.locator('#exam-question-prev').dblclick();
    assert.equal(await readPracticeIndex(), 1, 'a double-click on "Câu trước" steps back exactly one extracted item');
    await page.locator('[data-question-index="0"]').click();
    assert.equal(await readPracticeIndex(), 1);
    const firstChoiceText = (await page.locator('.exam-practice-option').nth(1).innerText()).replace(/^B\.\s*/, '').trim();
    await page.locator('.exam-practice-option').nth(0).click();
    assert.equal(await page.locator('.exam-practice-option').nth(0).getAttribute('aria-pressed'), 'true');
    await page.locator('.exam-practice-option').nth(1).click();
    assert.equal(await page.locator('.exam-practice-option').nth(0).getAttribute('aria-pressed'), 'false', 'a selected choice can be changed before submission');
    assert.equal(await page.locator('.exam-practice-option').nth(1).getAttribute('aria-pressed'), 'true');
    await page.locator('[data-question-index="35"]').click();
    const textAnswer = 'A learner-entered response kept only in this browser session.';
    await page.locator('#exam-practice-response').fill(textAnswer);
    assert.equal(await page.locator('[data-question-index="35"]').evaluate(element => element.classList.contains('is-answered')), true, 'typing updates the answered indicator immediately');
    assert.equal(await page.locator('#exam-practice-answered-count').innerText(), '2');
    await page.locator('#exam-review-answers').click();
    assert.equal(await page.locator('.exam-practice-review-item').count(), 49, 'the review list covers all extracted items');
    assert.equal((await page.locator('[data-review-question="0"] .exam-question-source').innerText()).trim(), `B. ${firstChoiceText}`);
    assert.equal((await page.locator('[data-review-question="35"] .exam-question-source').innerText()).trim(), textAnswer);
    await page.locator('[data-review-question="0"]').click();
    const changedChoiceText = (await page.locator('.exam-practice-option').nth(2).innerText()).replace(/^C\.\s*/, '').trim();
    await page.locator('.exam-practice-option').nth(2).click();
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `interactive question navigation fits ${viewport.width}px without horizontal overflow`);
      assert.equal(await page.locator('#exam-submit').isVisible(), true, `Submit Exam remains visible at ${viewport.width}px`);
      assert.equal(await page.locator('[data-question-index]').count(), 49, `question status navigation remains available at ${viewport.width}px`);
      if (screenshotDir && [320, 375, 768, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `practice-${viewport.width}.png`), fullPage: true });
      }
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('#exam-submit').click();
    await page.locator('#exam-submission-summary').waitFor();
    assert.equal(await page.locator('#exam-practice-answered-count').innerText(), '2');
    assert.equal(await page.locator('#exam-practice-unanswered-count').innerText(), '47');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.exam-history.v1')), null, 'transcript submissions do not create persisted exam history');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.history.v1')), null, 'transcript submissions do not enter flashcard study history');
    assert.equal(await page.locator('#exam-score').count(), 0, 'the submission has no score');
    assert.equal(await page.getByRole('button', { name: 'Xem lại câu trả lời đã nộp' }).count(), 1);
    await page.locator('#exam-review-submitted').click();
    assert.equal((await page.locator('[data-review-question="0"] .exam-question-source').innerText()).trim(), `C. ${changedChoiceText}`, 'submitted choice remains available for review');
    assert.equal((await page.locator('[data-review-question="35"] .exam-question-source').innerText()).trim(), textAnswer, 'submitted text response remains available for review');
    await page.locator('#exam-practice-back').click();
    await page.locator('#exam-submission-summary').waitFor();
    // dev3 regression: a submitted question view leads straight back to the submission summary.
    await page.locator('#exam-review-submitted').click();
    await page.locator('[data-review-question="0"]').click();
    await page.locator('#exam-current-question-heading').waitFor();
    assert.match(await page.locator('.exam-practice-actions').innerText(), /Về tóm tắt bài nộp/);
    await page.locator('#exam-practice-back').click();
    await page.locator('#exam-submission-summary').waitFor();
    const originalPaperLabel = await page.locator('.exam-page-header .eyebrow').innerText();
    await page.locator('#exam-paper-previous').click();
    await page.locator('.exam-practice').waitFor();
    assert.notEqual(await page.locator('.exam-page-header .eyebrow').innerText(), originalPaperLabel, 'paper navigation opens the previous archive record');
    await page.locator('#exam-paper-next').click();
    await page.locator('#exam-submission-summary').waitFor();
    assert.equal(await page.locator('#exam-practice-answered-count').innerText(), '2', 'submitted responses survive paper navigation for this open session');

    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `the transcription fits ${viewport.width}px without horizontal page overflow`);
      assert.equal(await page.locator('#exam-detail-back').isVisible(), true, `the back-to-library control remains visible at ${viewport.width}px`);
      if (screenshotDir && [375, 768, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `detail-${viewport.width}.png`), fullPage: true });
      }
    }

    await page.locator('#exam-detail-back').click();
    await page.locator('#exam-results-count').filter({ hasText: '106 bản chép' }).waitFor();
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `the archive catalogue fits ${viewport.width}px without horizontal page overflow`);
      assert.equal(await page.locator('#exam-search').isVisible(), true, `archive search remains visible at ${viewport.width}px`);
      if (screenshotDir && [375, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `catalogue-${viewport.width}.png`), fullPage: true });
      }
    }

    await page.locator('[data-view="settings"]').click();
    await page.locator('#language-setting').selectOption('en');
    await page.getByRole('heading', { name: 'Settings & data' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    assert.equal(await page.evaluate(() => localStorage.getItem('chuyen-anh.language.v1')), 'en');
    assert.equal(await page.getByRole('combobox', { name: 'Interface language' }).inputValue(), 'en');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'language-setting', 'keyboard focus remains on the language selector after switching locales');
    assert.match(await page.locator('.data-info').innerText(), /Vocabulary, 106 exam transcriptions/);
    assert.equal(await page.getByRole('button', { name: 'Exam archive' }).count(), 1, 'navigation is translated after changing the locale');
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `English settings fit ${viewport.width}px without horizontal overflow`);
      assert.equal(await page.locator('#language-setting').isVisible(), true, `English language selector is visible at ${viewport.width}px`);
      if (screenshotDir && [320, 375, 768, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `settings-en-${viewport.width}.png`), fullPage: true });
      }
    }
    await page.evaluate(() => localStorage.setItem('chuyen-anh.history.v1', JSON.stringify([{
      date: '2026-10-13T12:00:00.000Z', total: 4, correct: 3, wrong: 1, accuracy: 75, mode: 'due', durationSec: 60
    }])));
    await page.reload();
    await page.locator('[data-view="dashboard"]').click();
    await page.getByRole('heading', { name: 'Overview' }).waitFor();
    assert.match(await page.locator('.history-row').innerText(), /Due review/);
    assert.match(await page.locator('.history-row').innerText(), /4 cards/);
    assert.match(await page.locator('.history-row').innerText(), /13\/10\/2026/);
    await page.locator('[data-view="learn"]').click();
    await page.getByRole('heading', { name: 'Study advanced English vocabulary' }).waitFor();
    await page.locator('.recommendation-copy [data-session="quick10"]').click();
    await page.locator('#start-quiz').waitFor();
    assert.match(await page.locator('#content').innerText(), /Quick session · 10 words queued · 10 turns left/);
    assert.match(await page.locator('#content').innerText(), /1 \/ 10 turns · 10 left/);
    assert.match(await page.locator('#content').innerText(), /Difficulty 0%/);
    await page.locator('#start-quiz').click();
    await page.locator('.flashcard-head').waitFor();
    assert.match(await page.locator('.flashcard-head').innerText(), /1 \/ 10 turns · 10 left/);
    assert.match(await page.locator('.flashcard-head').innerText(), /New/);
    await page.locator('#exit-session').click();

    await page.locator('[data-view="exams"]').click();
    await page.getByRole('heading', { name: 'Specialized English exam archive', level: 1 }).waitFor();
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `the English catalogue fits ${viewport.width}px without horizontal overflow`);
      assert.equal(await page.getByRole('searchbox', { name: 'Search by location, school, or year' }).isVisible(), true, `English archive search remains visible at ${viewport.width}px`);
      if (screenshotDir && [375, 768, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `catalogue-en-${viewport.width}.png`), fullPage: true });
      }
    }
    assert.match(await page.locator('.exam-warning').innerText(), /The 22 HTML\/OCR records still need review and remain read-only for practice/i);
    assert.match(await page.locator('.exam-warning').innerText(), /Other records may expose unverified extracted items/i);
    assert.match(await page.locator('.exam-warning').innerText(), /listening audio is not embedded/i);
    assert.equal(await page.getByRole('searchbox', { name: 'Search by location, school, or year' }).count(), 1);
    for (const name of ['Exam year', 'Province/city', 'Source format', 'Exam provider']) {
      assert.equal(await page.getByRole('combobox', { name }).count(), 1, `${name} filter is translated and accessible`);
    }
    await page.locator('#exam-search').fill('an giang');
    await page.locator('#exam-year').selectOption('2026');
    await page.locator('[data-exam-open="2026/an-giang/so"]').click();
    await page.locator('#exam-practice-start').waitFor();
    assert.match(await page.locator('.exam-warning').innerText(), /transcript.*incomplete/i, 'the known source transcript truncation is identified in the detail warning');
    const sourceBody = await page.locator('.exam-document').innerText();
    assert.match(sourceBody, /What are Parkour athletes expected to do\?/);
    assert.match(sourceBody.trimEnd(), /Right, so I’d like to go ahead and…$/, 'the reader renders the literal final source text instead of cropping the page');
    await page.locator('#exam-practice-start').click();
    assert.equal(await page.locator('[data-question-index]').count(), 48, 'an explicitly incomplete transcript remains available with a visible completeness warning');
    assert.equal(await page.getByRole('heading', { name: 'Transcript-based practice · ungraded' }).count(), 1, 'the practice panel is localized');
    assert.match(await page.locator('.exam-practice-note').innerText(), /Only text already present.*unverified/i);
    assert.equal(await page.getByRole('button', { name: 'Submit Exam' }).count(), 1, 'the English UI exposes the working Submit Exam control');
    assert.equal(await page.locator('[role="timer"]').count(), 0);
    assert.equal(await page.locator('#exam-score').count(), 0);
    await page.locator('.exam-practice-option').first().click();
    await page.locator('#exam-submit').click();
    await page.locator('#exam-submission-summary').waitFor();
    assert.equal(await page.locator('#exam-practice-answered-count').innerText(), '1');
    assert.match(await page.locator('#exam-submission-summary').innerText(), /does not check correctness or produce a score/i);
    for (const viewport of [
      { width: 320, height: 720 },
      { width: 375, height: 812 },
      { width: 768, height: 900 },
      { width: 1440, height: 1000 }
    ]) {
      await page.setViewportSize(viewport);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `the English practice and transcription fit ${viewport.width}px without horizontal overflow`);
      assert.equal(await page.locator('#exam-detail-back').isVisible(), true, `English back-to-archive remains visible at ${viewport.width}px`);
      if (screenshotDir && [375, 768, 1440].includes(viewport.width)) {
        await page.screenshot({ path: path.join(screenshotDir, `detail-en-${viewport.width}.png`), fullPage: true });
      }
    }

    await page.reload();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en', 'the selected locale survives a reload');
    await page.locator('[data-view="exams"]').click();
    await page.locator('#exam-search').fill('an giang');
    await page.locator('#exam-year').selectOption('2026');
    await page.locator('[data-exam-open="2026/an-giang/so"]').click();
    await page.locator('#exam-practice-start').waitFor();
    assert.equal(await page.locator('#exam-submission-summary').count(), 0, 'transcript responses are not restored after reload');
    assert.equal(await page.locator('[data-question-index]').count(), 0, 'the submitted session is memory-only and has ended on reload');
    await page.locator('#exam-detail-back').click();
    await page.locator('#exam-search').fill('binh phuoc');
    await page.locator('[data-exam-open="2022/binh-phuoc/so"]').click();
    await page.locator('.exam-practice-readonly').waitFor();
    assert.equal(await page.locator('#exam-practice-start').count(), 0, 'HTML/OCR records needing review do not expose guessed interactive groupings');
    assert.match(await page.locator('.exam-practice-readonly').innerText(), /HTML\/OCR.*manual review/i);
    await page.locator('#exam-detail-back').click();
    await page.locator('[data-view="settings"]').click();
    await page.locator('#language-setting').selectOption('vi');
    await page.getByRole('heading', { name: 'Cài đặt & dữ liệu' }).waitFor();
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'vi');

    assert.deepEqual(externalRequests, [], 'offline catalogue and transcription browsing make no network requests');
    assert.deepEqual(errors, [], 'no browser exceptions');
    console.log(`PASS: Chromium ${browser.version()} — 106-record offline catalogue; accent-insensitive search; year/location/quality filters; source hashes and limitations; raw transcription rendering; no timers, question outlines or grading for unreviewed papers; ungraded practice selection/review/submit with single-step double-click navigation and a direct path back to the submission summary; safe markup; no network requests; 320/375/768/1440px archive and detail layouts; no page errors.`);
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
