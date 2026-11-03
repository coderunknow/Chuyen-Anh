// rc10 browser verification — CEFR study-pool integrity and the study scope, in
// the real UI, on the real 17 MB page.
//
// For each selection it (1) compares every number the study surfaces promise
// (brand, top bar, the five counting cards, dashboard note) with the pool a
// session can actually draw, (2) opens all nine session entries and maps every
// served word back to its own level tag, and (3) exercises the study-scope chip:
// persistence, restore after reload, the words-only gate on phrase practice, and
// the fact that neither the phrase bank nor phrase progress changes.
//
// Expectation sets are computed from the app's own module + the page's own
// datasets, restricted to the *active* deck (rows archived by family merging are
// kept for history but never studied), which is what `cefrDeck()` returns.
//
// Run: node audit/rc10/scripts/verify-rc10.mjs
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../..');
const require = createRequire(import.meta.url);
const playwright = require(path.join(root, 'node_modules/playwright-core'));

const html = fs.readFileSync(path.join(root, 'index.html'));
const text = html.toString();
const appSource = text.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const scratch = path.join(process.env.TMPDIR || '/tmp', 'rc10-verify-app.mjs');
fs.writeFileSync(scratch, appSource);
const app = await import(scratch);
const vocabulary = JSON.parse(text.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const phrases = JSON.parse(text.match(/<script id="phrase-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const NOW = Date.parse('2026-11-02T12:00:00Z');
const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const levelOf = entry => {
  const tag = (entry.tags || []).find(value => /^level:(A1|A2|B1|B2|C1|C2)$/i.test(value));
  return tag ? tag.split(':')[1].toUpperCase() : 'UNCLASSIFIED';
};
// The app's teaching deck: rows that belong to another headword's family and
// rows archived by curation are kept in the data for history but are never
// headwords a session can draw.
const archived = new Set(vocabulary.filter(entry => (entry.tags || []).includes(app.ARCHIVED_TAG)).map(entry => entry.id));
const active = vocabulary.filter(entry => !entry.familyHead && !archived.has(entry.id));
const levelByWord = new Map(active.map(entry => [entry.word.toLowerCase(), levelOf(entry)]));

// Deterministic profile so every queue has real work to do. Each bucket carries
// the graded evidence its state requires, so the app's own sanitiser keeps it
// instead of normalising it back to `new`.
const seeded = {};
vocabulary.forEach((entry, index) => {
  const record = app.createInitialProgress(entry.id, NOW - 10 ** 7);
  const bucket = index % 5;
  if (bucket === 1) { record.state = 'weak'; record.wrongCount = 2; record.lastReviewed = NOW - 1000; record.nextReview = NOW - 1000; }
  else if (bucket === 2) { record.state = 'review'; record.correctCount = 3; record.streak = 2; record.interval = 3; record.lastReviewed = NOW - 5000; record.nextReview = NOW - 5000; }
  else if (bucket === 3) { record.state = 'mastered'; record.correctCount = 9; record.streak = 4; record.interval = 30; record.lastReviewed = NOW - 3 * 86_400_000; record.nextReview = NOW + 10 ** 9; }
  else if (bucket === 4) { record.state = 'learning'; record.correctCount = 1; record.streak = 1; record.interval = 1; record.lastReviewed = NOW - 200; record.nextReview = NOW - 200; }
  seeded[entry.id] = record;
});
// The store holds the raw per-row records; the page sanitises and folds them
// once on load. The expectations must be computed along that same path, or a
// family row would be folded twice here and the counts would drift.
const mem = new Map();
const memStorage = { getItem: key => (mem.has(key) ? mem.get(key) : null), setItem: (key, value) => mem.set(key, String(value)), removeItem: key => mem.delete(key) };
mem.set('chuyen-anh.progress.v1', JSON.stringify(seeded));
const familyHeadOf = app.familyHeadMap(vocabulary);
const progress = app.ensureProgress(app.foldFamilyProgress(app.loadProgress(memStorage), familyHeadOf), vocabulary, NOW);
// Favourites sit in B1 on purpose: most selections exclude B1.
const favouriteIds = active.filter(entry => levelOf(entry) === 'B1').slice(0, 30).map(entry => entry.id);
const PHRASE_SEED = { P001: { correct: 2, wrong: 0, lastSeen: NOW - 86_400_000 }, P002: { correct: 1, wrong: 1, lastSeen: NOW - 172_800_000 } };

const configs = [
  { name: 'C1 only', levels: ['C1'], unclassified: false },
  { name: 'A1 only (empty)', levels: ['A1'], unclassified: false },
  { name: 'B2+C1 (default)', levels: ['B2', 'C1'], unclassified: false },
  { name: 'everything off (empty)', levels: [], unclassified: false },
  { name: 'Unclassified only', levels: [], unclassified: true },
  { name: 'all levels + Unclassified', levels: LEVELS, unclassified: true }
];

const CARDS = ['due', 'weak', 'new', 'favorites', 'random', 'quick10', 'quick20', 'quick30', 'sprint'];
const TURNS = 5;
const failures = [];
const fail = (config, label, detail) => { failures.push({ config, label, detail }); console.log(`FAIL [${config}] ${label}: ${detail}`); };

const poolFor = selection => {
  const wanted = new Set(selection.levels.map(level => level.toUpperCase()));
  const ids = active.filter(entry => {
    const level = levelOf(entry);
    return level === 'UNCLASSIFIED' ? selection.unclassified === true : wanted.has(level);
  }).map(entry => entry.id);
  return { ids, set: new Set(ids), wanted };
};

async function launch() {
  const bundled = require(path.join(root, 'node_modules/@sparticuz/chromium'));
  process.env.LD_LIBRARY_PATH = ['/tmp/al2023/lib', process.env.LD_LIBRARY_PATH].filter(Boolean).join(':');
  return playwright.chromium.launch({ executablePath: await bundled.executablePath(), args: bundled.args, headless: true });
}

const readCards = page => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('[data-session]')]
  .filter(node => node.classList.contains('session-card'))
  .map(node => [node.dataset.session, node.innerText.replace(/\s+/g, ' ').trim()])));

// Plays a session entry and reports what it served. `opened` separates "the
// entry refused to start (and said why)" from "a session ran but this probe did
// not recognise its card", which must not be confused.
async function playCard(page, type) {
  const served = [];
  const tokens = new Set();
  const toasts = [];
  let opened = false;
  await page.locator(`[data-session="${type}"]`).last().click();
  await page.waitForTimeout(150);
  for (let turn = 0; turn < TURNS; turn += 1) {
    const snap = await page.evaluate(() => {
      const toast = document.querySelector('.toast')?.textContent || '';
      // Only the question card is scanned. App chrome legitimately contains
      // English words that are also headwords ("kho đề offline", "Modern"), so a
      // whole-page scan would report the interface as a leak.
      // Only the nodes that actually carry a headword: the served word, an option
      // word, a match tile. Example sentences are excluded on purpose — an
      // example for a C1 word may legitimately contain another level's word
      // ("explain"), and that is prose, not a served card.
      const servedNodes = [...document.querySelectorAll('.prompt > .vocab-word, .first-look-word .vocab-word, .match-tile--word .vocab-word, [data-option] .vocab-word, .sub-prompt + .vocab-word')];
      const cardText = servedNodes.map(node => node.innerText).join(' ').toLowerCase();
      const rendered = cardText.match(/[a-z][a-z'-]*/g) || [];
      return {
        rendered,
        word: document.querySelector('.vocab-word')?.textContent?.trim() || null,
        start: !!document.querySelector('#start-quiz'),
        next: !!document.querySelector('#next-card'),
        done: !!document.querySelector('.summary'),
        options: document.querySelectorAll('[data-option]:not([disabled])').length,
        flip: !!document.querySelector('#flip-card'),
        spell: !!document.querySelector('#spelling-input'),
        card: !!document.querySelector('.flashcard, .match-board, .session-summary'),
        toast
      };
    });
    if (snap.toast && !toasts.includes(snap.toast)) toasts.push(snap.toast);
    for (const token of snap.rendered) tokens.add(token);
    if (snap.done) break;
    if (snap.word && !served.includes(snap.word)) served.push(snap.word);
    if (snap.start || snap.next || snap.options || snap.flip || snap.spell || snap.card) opened = true;
    if (snap.start) await page.locator('#start-quiz').click({ timeout: 4000 }).catch(() => {});
    else if (snap.next) await page.locator('#next-card').click({ timeout: 4000 }).catch(() => {});
    else if (snap.options) await page.locator('[data-option]:not([disabled])').first().click({ timeout: 4000 }).catch(() => {});
    else if (snap.flip) await page.locator('#flip-card').click({ timeout: 4000 }).catch(() => {});
    else if (snap.spell) {
      await page.locator('#spelling-input').fill('zzz').catch(() => {});
      await page.locator('#spelling-submit, #check-answer').first().click({ timeout: 4000 }).catch(() => {});
    } else break;
    await page.waitForTimeout(90);
  }
  return { served, tokens: [...tokens], toasts, opened };
}

const server = http.createServer((_request, response) => {
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
});
await new Promise(resolve => server.listen(0, '0.0.0.0', resolve));
const origin = `http://127.0.0.1:${server.address().port}`;
const browser = await launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(error.message));
page.setDefaultTimeout(8000);
await page.clock.setFixedTime(new Date(NOW));
const startClock = Date.now();
const step = label => console.log(`STEP ${label} · ${Math.round((Date.now() - startClock) / 1000)}s`);

const seed = async selection => {
  await page.goto(origin);
  await page.evaluate(({ selection, seeded, favouriteIds, PHRASE_SEED }) => {
    localStorage.clear();
    localStorage.setItem('chuyen-anh.cefr.v1', JSON.stringify(selection));
    localStorage.setItem('chuyen-anh.progress.v1', JSON.stringify(seeded));
    localStorage.setItem('chuyen-anh.favorites.v1', JSON.stringify(favouriteIds));
    localStorage.setItem('chuyen-anh.phrases.v1', JSON.stringify(PHRASE_SEED));
  }, { selection, seeded, favouriteIds, PHRASE_SEED });
  await page.reload();
  await page.locator('.session-card').first().waitFor();
};

try {
  const wanted = (process.env.RC10_CONFIGS || '').split('|').filter(Boolean);
  const selectedConfigs = process.env.RC10_ONLY === 'scope' ? [] : configs.filter(config => !wanted.length || wanted.includes(config.name));
  for (const config of selectedConfigs) {
    step(`config ${config.name}`);
    const selection = app.sanitizeCefrSelection({ version: 1, levels: config.levels, unclassified: config.unclassified });
    const pool = poolFor(selection);
    const expected = app.calculateStats(Object.fromEntries(pool.ids.map(id => [id, progress[id]])), NOW);
    await seed(selection);

    if (process.env.RC10_DUMP) {
      const storedAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.progress.v1') || '{}'));
      const diffs = [];
      for (const id of pool.ids) {
        const a = progress[id] || {};
        const b = storedAfter[id] || {};
        if (a.state !== b.state || a.nextReview !== b.nextReview || a.correctCount !== b.correctCount || a.wrongCount !== b.wrongCount) diffs.push([id, a.state, a.nextReview, a.correctCount, a.wrongCount, '|', b.state, b.nextReview, b.correctCount, b.wrongCount]);
      }
      console.log('DUMP_DIFFS', diffs.length, JSON.stringify(diffs.slice(0, 8)));
    }
    // 1. Promised numbers.
    const brand = await page.evaluate(() => document.querySelector('.brand-detail')?.textContent || '');
    if (!brand.includes(`${pool.ids.length.toLocaleString('vi-VN')} từ trọng tâm`)) {
      fail(config.name, 'brand', `brand says "${brand}" but the pool is ${pool.ids.length}`);
    }
    const topbar = await page.evaluate(() => document.querySelector('.top-meta')?.innerText.replace(/\s+/g, ' ') || '');
    if (!new RegExp(`(^|\\s)${expected.due} đến hạn`).test(topbar)) fail(config.name, 'topbar-due', `"${topbar}" is not the pool's ${expected.due} due`);
    const promised = await readCards(page);
    const wanted = {
      new: `${expected.new} từ`,
      due: `${expected.due} từ`,
      weak: `${expected.weak} từ`,
      random: `${pool.ids.length.toLocaleString('vi-VN')} từ đủ điều kiện`,
      favorites: `${favouriteIds.filter(id => pool.set.has(id)).length} từ`
    };
    for (const [type, want] of Object.entries(wanted)) {
      if (!(promised[type] || '').includes(want)) fail(config.name, `card:${type}`, `"${promised[type]}" does not state "${want}"`);
    }

    // 2. All nine entries serve pool words only.
    for (const type of CARDS) {
      step(`${config.name} :: ${type}`);
      await seed(selection);
      const { served, tokens, toasts, opened } = await playCard(page, type);
      // Anything the card rendered that is an active headword must belong to the
      // pool, whichever exercise the turn happened to be.
      for (const token of tokens) {
        const level = levelByWord.get(token);
        if (level === undefined) continue;
        const inside = level === 'UNCLASSIFIED' ? selection.unclassified === true : pool.wanted.has(level);
        if (!inside) fail(config.name, `render:${type}`, `rendered headword "${token}" (${level}) outside the pool`);
      }
      if (!served.length) {
        // A session that never opened must say why; a session that ran but whose
        // card this probe could not read is a probe limitation, reported as such.
        if (!opened && !toasts.length) fail(config.name, `entry:${type}`, 'opened nothing and explained nothing');
        else if (!opened) console.log(`NOTE [${config.name}] entry:${type}: refused with "${toasts[0].slice(0, 90)}"`);
        else console.log(`NOTE [${config.name}] entry:${type}: session ran but this probe read no word from it`);
        continue;
      }
      for (const word of served) {
        const level = levelByWord.get(word.toLowerCase());
        const inside = level !== undefined && (level === 'UNCLASSIFIED' ? selection.unclassified === true : pool.wanted.has(level));
        if (!inside) fail(config.name, `entry:${type}`, `served "${word}" (${level || 'not in the active deck'}) outside the pool`);
      }
    }
    console.log(`CONFIG-DONE ${config.name} · pool ${pool.ids.length} · due ${expected.due} · weak ${expected.weak} · new ${expected.new}`);
  }

  // 3. Study scope.
  for (const scope of ['words', 'words-phrases']) {
    step(`scope ${scope}`);
    await seed(app.sanitizeCefrSelection({ version: 1, levels: LEVELS, unclassified: true }));
    const visibleChip = page.locator(`#learn-scope [data-scope="${scope}"]`);
    if (!(await visibleChip.count())) { fail('scope', 'chip', `no visible chip for ${scope} on the study home`); continue; }
    if (!(await visibleChip.isVisible())) { fail('scope', 'chip', `${scope} chip exists on the study home but is not visible`); continue; }
    await visibleChip.click();
    await page.waitForTimeout(200);
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.study.v1') || '{}').scope);
    if (stored !== scope) fail('scope', 'persist', `clicked ${scope} but the store holds ${stored}`);
    await page.reload();
    await page.locator('.session-card').first().waitFor();
    if (!(await page.locator(`#learn-scope [data-scope="${scope}"][aria-pressed="true"]`).count())) fail('scope', 'restore', `${scope} was not restored after a reload`);
    await page.locator('[data-view="phrases"]').click();
    await page.waitForTimeout(200);
    const state = await page.evaluate(() => ({
      count: JSON.parse(document.getElementById('phrase-data').textContent).length,
      progress: JSON.parse(localStorage.getItem('chuyen-anh.phrases.v1') || '{}'),
      disabled: document.getElementById('phrase-practice-start')?.disabled ?? null
    }));
    if (state.count !== phrases.length) fail('scope', 'phrase-data', `phrase bank changed: ${state.count}/${phrases.length}`);
    if (state.progress.P001?.correct !== 2) fail('scope', 'phrase-progress', 'the scope switch rewrote phrase progress');
    if (scope === 'words') {
      if (state.disabled) fail('scope', 'gate', 'phrase button is disabled, so the reason is unreachable');
      await page.locator('#phrase-practice-start').click();
      await page.waitForTimeout(200);
      const toast = await page.evaluate(() => document.querySelector('.toast')?.textContent || '');
      if (!/Chỉ từ vựng/.test(toast)) fail('scope', 'gate', `words-only phrase practice was not refused: "${toast}"`);
      if (await page.evaluate(() => !!document.querySelector('.flashcard'))) fail('scope', 'gate', 'a phrase session opened in words-only mode');
    } else {
      await page.locator('#phrase-practice-start').click();
      await page.waitForTimeout(250);
      const opened = await page.evaluate(() => !!document.querySelector('.flashcard, [data-phrase-option], #phrase-again, #phrase-back'));
      if (!opened) fail('scope', 'allow', 'words+phrases could not open a phrase session');
      const progressAfter = await page.evaluate(() => JSON.parse(localStorage.getItem('chuyen-anh.phrases.v1') || '{}'));
      if (Object.keys(progressAfter).length < Object.keys(PHRASE_SEED).length) fail('scope', 'phrase-progress', 'a phrase session erased existing phrase progress');
    }
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`CONFIG_COUNT ${configs.length} · SCOPE_CHECKS 2 · PAGE_ERRORS ${pageErrors.length}${pageErrors.length ? ` ${JSON.stringify(pageErrors.slice(0, 3))}` : ''}`);
console.log(`FAILURES ${failures.length}`);
process.exit(failures.length || pageErrors.length ? 1 : 0);
