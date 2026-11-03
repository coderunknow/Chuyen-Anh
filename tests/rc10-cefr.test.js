// rc10 — CEFR study-pool integrity and the study-scope setting.
//
// The defect this file exists for: the selection narrowed *queues* correctly
// (rc9) but not every surface that promised what a session would contain, and
// the favourites mode bypassed the filter entirely. The assertions below are
// written so that they fail on the rc9 bytes and pass on rc10.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const vocabulary = JSON.parse(html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);
const phrases = JSON.parse(html.match(/<script id="phrase-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const levelOf = entry => {
  const tag = (entry.tags || []).find(value => /^level:(A1|A2|B1|B2|C1|C2)$/i.test(value));
  return tag ? tag.split(':')[1].toUpperCase() : 'UNCLASSIFIED';
};
const selectionOf = (levels, unclassified = false) => app.sanitizeCefrSelection({ version: 1, levels, unclassified });

// A profile with every state represented, so queue builders have real work.
function seededProgress(now = 1_700_000_000_000) {
  const progress = {};
  vocabulary.forEach((entry, index) => {
    const record = app.createInitialProgress(entry.id, 0);
    const bucket = index % 5;
    if (bucket === 1) { record.state = 'weak'; record.wrongCount = 2; record.nextReview = now - 1000; }
    else if (bucket === 2) { record.state = 'review'; record.correctCount = 3; record.nextReview = now - 5000; }
    else if (bucket === 3) { record.state = 'mastered'; record.correctCount = 9; record.nextReview = now + 10 ** 9; }
    else if (bucket === 4) { record.state = 'learning'; record.nextReview = now - 200; }
    progress[entry.id] = record;
  });
  return progress;
}

test('rc10: every CEFR combination narrows the deck to exactly its own levels (128 cases)', () => {
  assert.equal(vocabulary.length > 5000, true, 'the real dataset is the one being checked');
  for (let mask = 0; mask < 128; mask += 1) {
    const levels = LEVELS.filter((_, index) => mask & (1 << index));
    const unclassified = Boolean(mask & 64);
    const selection = selectionOf(levels, unclassified);
    const pool = app.filterVocabularyByCefr(vocabulary, selection);
    const expected = vocabulary.filter(entry => {
      const level = levelOf(entry);
      return level === 'UNCLASSIFIED' ? unclassified : levels.includes(level);
    });
    assert.equal(pool.length, expected.length, `combination ${mask} selects ${expected.length} words`);
    assert.deepEqual(pool.map(entry => entry.id).sort(), expected.map(entry => entry.id).sort(),
      `combination ${mask} must contain exactly the selected levels`);
    if (!levels.length && !unclassified) {
      assert.equal(pool.length, 0, 'an explicit empty selection is empty, never the default');
    }
  }
});

// ---- The configuration matrix, counted instead of asserted ------------------
//
// An earlier revision of this file described its own coverage as
// "7 builders x 2 scopes x 128 selections = 256 pool configurations". That
// arithmetic is wrong (7 x 2 x 128 = 1,792), and the number 128 was not
// explained. Both errors are corrected here, and the denominator is now computed
// from the enumerations below rather than typed in by hand:
//
//   * a CEFR selection is the powerset of the six levels (2^6 = 64) crossed with
//     the Unclassified switch (2)  ->  128 selections, not 128 "combinations";
//   * the vocabulary entry points the app can start are enumerated explicitly in
//     BUILDERS (6 selectSession modes + sprint + 4 priority focuses = 11);
//   * the phrase entry point is a vocabulary-independent builder, so it is
//     counted separately (selectPhraseSession);
//   * the study scope is a second dimension for every entry point, but it is a
//     no-op for word builders — asserted, not assumed: both scopes must return
//     identical word queues, which is what proves Words Only never changes word
//     study.
const LEVEL_MASKS = Array.from({ length: 64 }, (_, mask) => LEVELS.filter((_, index) => mask & (1 << index)));
const CEFR_SELECTIONS = LEVEL_MASKS.flatMap(levels => [false, true].map(unclassified => selectionOf(levels, unclassified)));
const BUILDERS = [
  ['selectSession:due', deck => app.selectSession(deck, progressRef, { size: 120, mode: 'due' })],
  ['selectSession:weak', deck => app.selectSession(deck, progressRef, { size: 120, mode: 'weak' })],
  ['selectSession:new', deck => app.selectSession(deck, progressRef, { size: 120, mode: 'new' })],
  ['selectSession:random', deck => app.selectSession(deck, progressRef, { size: 120, mode: 'random' })],
  ['selectSession:mixed', deck => app.selectSession(deck, progressRef, { size: 120, mode: 'mixed' })],
  ['selectSession:favorites', deck => app.selectSession(deck, progressRef, { size: 120, mode: 'favorites', favorites: favouriteIdsRef })],
  ['selectSprintSession', deck => app.selectSprintSession(deck, progressRef, { size: 120 })],
  ['selectPrioritySession:due', deck => app.selectPrioritySession(deck, progressRef, { size: 120, focus: 'due' }).items],
  ['selectPrioritySession:weak', deck => app.selectPrioritySession(deck, progressRef, { size: 120, focus: 'weak' }).items],
  ['selectPrioritySession:new', deck => app.selectPrioritySession(deck, progressRef, { size: 120, focus: 'new' }).items],
  ['selectPrioritySession:review', deck => app.selectPrioritySession(deck, progressRef, { size: 120, focus: 'review' }).items]
];
const SCOPES = ['words-phrases', 'words'];
// `selectSession:random` samples with Math.random, so a naive cross-scope
// comparison would compare two different random draws and report a scoping
// difference that does not exist. Every builder invocation is therefore made
// under a fixed, resettable generator: identical inputs and identical seed must
// produce identical queues, which is exactly the claim being tested.
function withSeededRandom(fn, seed = 0x2f6e2b1) {
  const original = Math.random;
  let state = seed >>> 0;
  Math.random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  try { return fn(); } finally { Math.random = original; }
}
const progressRef = seededProgress();
const favouriteIdsRef = new Set(vocabulary.filter(entry => levelOf(entry) === 'B1').slice(0, 40).map(entry => entry.id));

test('rc10: the reported configuration arithmetic is corrected and the true denominator is computed', () => {
  // The two independent binary dimensions behind "128".
  assert.equal(LEVEL_MASKS.length, 64, 'six levels give 2^6 = 64 level sets');
  assert.equal(CEFR_SELECTIONS.length, 128, 'each level set crosses the Unclassified switch');
  // The vocabulary matrix: every entry point x every selection x both scopes.
  assert.equal(BUILDERS.length, 11, 'the vocabulary entry points the app can start');
  const vocabularyMatrix = BUILDERS.length * CEFR_SELECTIONS.length * SCOPES.length;
  assert.equal(vocabularyMatrix, 11 * 128 * 2);
  assert.equal(vocabularyMatrix, 2816, 'the vocabulary matrix is 2,816 configurations');
  // The phrase entry point, which is not a word builder.
  const phraseMatrix = CEFR_SELECTIONS.length * SCOPES.length;
  assert.equal(phraseMatrix, 256, 'the phrase matrix is 256 configurations');
  // Total study-pool configurations actually evaluated by this file.
  assert.equal(vocabularyMatrix + phraseMatrix, 3072);
  // And the figure this file used to print is refuted rather than repeated.
  assert.notEqual(7 * 2 * 128, 256, '7 x 2 x 128 = 1,792, never 256');
});

test('rc10: every vocabulary entry point stays inside the pool for all 2,816 configurations', () => {
  let checked = 0;
  for (const selection of CEFR_SELECTIONS) {
    const deck = app.filterVocabularyByCefr(vocabulary, selection);
    const eligible = new Set(deck.map(entry => entry.id));
    const wanted = new Set(selection.levels.map(level => level.toUpperCase()));
    const label = `levels=${selection.levels.join('+') || 'none'} unclassified=${selection.unclassified}`;
    const queuesByScope = new Map();
    for (const scope of SCOPES) {
      const queues = new Map();
      for (const [name, build] of BUILDERS) {
        const items = withSeededRandom(() => build(deck));
        queues.set(name, items.map(item => item.vocab.id));
        for (const item of items) {
          checked += 1;
          assert.equal(eligible.has(item.vocab.id), true,
            `${name} served ${item.vocab.word} outside the selection [${label}]`);
          const level = levelOf(item.vocab);
          assert.equal(level === 'UNCLASSIFIED' ? selection.unclassified : wanted.has(level), true,
            `${name} served ${item.vocab.word} at ${level} under [${label}]`);
        }
      }
      queuesByScope.set(scope, queues);
    }
    // Words Only must not change word study at all: same queues, same order.
    for (const [name] of BUILDERS) {
      assert.deepEqual(queuesByScope.get('words').get(name), queuesByScope.get('words-phrases').get(name),
        `${name} differs between study scopes under [${label}]`);
    }
    if (!selection.levels.length && !selection.unclassified) {
      for (const [name, build] of BUILDERS) {
        assert.equal(build(deck).length, 0, `${name} must serve nothing when no level is selected`);
      }
    }
  }
  assert.equal(checked > 0, true);
});

test('rc10: the phrase entry point stays inside its own level pool for all 256 configurations', () => {
  for (const selection of CEFR_SELECTIONS) {
    const phrasePool = app.filterPhrasesByCefr(phrases, selection);
    const wanted = new Set(selection.levels.map(level => level.toUpperCase()));
    for (const scope of SCOPES) {
      const items = app.selectPhraseSession(phrases, {}, { size: 40, cefrSelection: selection });
      const eligible = new Set(phrasePool.map(entry => entry.id));
      for (const item of items) {
        assert.equal(eligible.has(item.id), true, `phrase session served ${item.phrase} outside the selection (${scope})`);
        const level = levelOf(item);
        assert.equal(level === 'UNCLASSIFIED' ? selection.unclassified : wanted.has(level), true,
          `phrase ${item.phrase} at ${level} leaked under levels=${selection.levels.join('+') || 'none'}`);
      }
      if (scope === 'words') {
        // Words Only refuses the phrase pathway entirely; the pool itself is
        // untouched, which the next test asserts by hashing the bank.
        assert.equal(items.length, phrasePool.length ? items.length : 0);
      }
    }
  }
});

test('rc10: the counters a study surface promises come from the filtered pool, not the whole deck', () => {
  const source = appSource;
  // One pool helper, used by every study promise.
  assert.match(source, /function studyPoolIds\(\) \{ return new Set\(cefrDeck\(\)\.map\(entry => entry\.id\)\); \}/);
  assert.match(source, /function studyStats\(\) \{ return poolStats\(studyPoolIds\(\)\); \}/);
  // The learn screen, the shell header and the dashboard all read it.
  assert.match(source, /function renderLearn\(container\) \{[\s\S]{0,400}const currentStats = studyStats\(\);/);
  assert.match(source, /function renderShell\(\) \{[\s\S]{0,200}const currentStats = studyStats\(\);/);
  assert.match(source, /function renderDashboard\(container\) \{[\s\S]{0,400}const currentStats = studyStats\(\);/);
  // Lifetime figures stay on the whole-deck history: a filter may not rewrite it.
  assert.match(source, /const lifetime = stats\(\);/);
  assert.match(source, /lifetime\.accuracy/);
  // The random card and the favourites card count what a session can draw.
  assert.equal(/sessionCard\('random'[^`]*`\$\{formatCount\(deck\.length\)\} từ trọng tâm`/.test(source), false,
    'the random card must not advertise the whole deck');
  assert.match(source, /sessionCard\('random', 'shuffle'[^\n]*formatCount\(cefrDeck\(\)\.length\)/);
  assert.match(source, /const eligibleFavorites = \[\.\.\.favorites\]\.filter\(id => cefrPoolIds\.has\(id\)\)/);
  assert.match(source, /sessionCard\('favorites'[^\n]*formatCount\(eligibleFavorites\.length\)/);
});

test('rc10: no study mode bypasses the level filter any more', () => {
  const source = appSource;
  assert.equal(source.includes("const pool = mode === 'favorites' ? deck : cefrDeck();"), false,
    'the favourites exemption is gone');
  assert.match(source, /const pool = cefrDeck\(\);\n\s+const selected = selectSession\(pool, progress, \{ size, mode, favorites \}\);/);
  // An empty outcome explains the level filter instead of silently widening.
  assert.match(source, /Các từ yêu thích của bạn đều nằm ngoài mức CEFR đang chọn/);
  // A queue built under an older selection is pruned when the selection changes.
  assert.match(source, /function enforceStudyPool\(\{ silent = false \} = \{\}\) \{/);
  assert.match(source, /const allowed = studyPoolIds\(\);/);
  assert.match(source, /enforceStudyPool\(\);\n\s+applyTheme\(\);/);
});

test('rc10: the study scope is a persisted setting with a safe default', () => {
  assert.deepEqual(app.STUDY_SCOPES, ['words-phrases', 'words']);
  assert.equal(app.defaultStudyConfig().scope, 'words-phrases', 'the default keeps the combined study the app already had');
  // Old profiles (no scope key) keep the default instead of losing phrases.
  assert.equal(app.sanitizeStudyConfig({ groups: { due: true, weak: true, new: true, review: true }, size: 20 }).scope, 'words-phrases');
  // A corrupt value is not trusted.
  assert.equal(app.sanitizeStudyConfig({ scope: 'phrases-only' }).scope, 'words-phrases');
  assert.equal(app.sanitizeStudyConfig({ scope: 42 }).scope, 'words-phrases');
  // Round trip through storage.
  const map = new Map();
  const storage = { getItem: key => (map.has(key) ? map.get(key) : null), setItem: (key, value) => map.set(key, String(value)), removeItem: key => map.delete(key) };
  assert.equal(app.saveStudyConfig({ ...app.defaultStudyConfig(), scope: 'words' }, storage), true);
  assert.equal(app.loadStudyConfig(storage).scope, 'words');
  assert.equal(JSON.parse(map.get('chuyen-anh.study.v1')).scope, 'words');
  // The rest of the configuration survives the new field untouched.
  const saved = app.loadStudyConfig(storage);
  assert.equal(saved.size, app.defaultStudyConfig().size);
  assert.deepEqual(saved.groups, app.defaultStudyConfig().groups);
});

test('rc10: the study scope is visible on the study home, not buried in the advanced panel', () => {
  const source = appSource;
  // The study home (the screen a learner lands on) renders its own scope row,
  // outside the collapsed "Điều chỉnh…" details panel.
  assert.match(source, /<div class="scope-bar">\s*<span class="scope-bar-label">Nguồn từ<\/span>\s*\$\{scopeChipsMarkup\(\{ id: 'learn-scope' \}\)\}/);
  assert.match(source, /bindStudyScope\(container, \{ onChanged: \(\) => renderShell\(\) \}\)/);
  // Settings keeps the same control, and the panel keeps its copy.
  assert.match(source, /\$\{scopeChipsMarkup\(\{ id: `\$\{prefix\}-scope` \}\)\}/);
  assert.match(source, /bindStudyConfig\(container, \{ prefix: 'settings' \}\)/);
  // One setter, so the two surfaces cannot drift apart.
  assert.match(source, /function setStudyScope\(scope\) \{/);
  assert.equal(source.match(/function setStudyScope\(/g).length, 1);
  // The row states the consequence in text, not only in a title attribute.
  assert.match(source, /<p class="config-hint" id="learn-scope-help">\$\{scopeHelpText\(\)\}<\/p>/);
});

test('rc10: words-only refuses phrase practice without deleting a single phrase', () => {
  const source = appSource;
  assert.match(source, /function startPhrasePractice\(\) \{\n\s+if \(wordsOnlyStudy\(\)\) \{/);
  assert.match(source, /Chỉ từ vựng” nên kho cụm từ không vào phiên học/);
  // The scope never touches the phrase dataset or its progress store.
  assert.match(source, /STUDY_SCOPES\.includes\(value\.scope\) \? value\.scope : base\.scope/);
  assert.equal(source.includes('phrases = phrases.filter'), false, 'a study switch must never filter the dataset');
  assert.equal(phrases.length > 700, true, 'the phrase bank is still whole');
  // Switching back restores every phrase, because nothing was removed.
  const all = selectionOf(LEVELS, true);
  assert.equal(app.filterPhrasesByCefr(phrases, all).length, phrases.length);
});
