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

test('rc10: the same 128 combinations hold for every queue builder, in both study scopes', () => {
  const progress = seededProgress();
  const favouriteIds = new Set(vocabulary.filter(entry => levelOf(entry) === 'B1').slice(0, 40).map(entry => entry.id));
  for (const scope of ['words-phrases', 'words']) {
    for (let mask = 0; mask < 128; mask += 1) {
      const levels = LEVELS.filter((_, index) => mask & (1 << index));
      const selection = selectionOf(levels, Boolean(mask & 64));
      const deck = app.filterVocabularyByCefr(vocabulary, selection);
      const eligible = new Set(deck.map(entry => entry.id));
      const check = (items, label) => {
        for (const item of items) {
          assert.equal(eligible.has(item.vocab.id), true,
            `${scope} ${mask}: ${label} served ${item.vocab.word} (${levelOf(item.vocab)}) outside the selected levels`);
        }
      };
      for (const mode of ['due', 'weak', 'new', 'random', 'mixed', 'favorites']) {
        check(app.selectSession(deck, progress, { size: 120, mode, favorites: favouriteIds }), `selectSession:${mode}`);
      }
      check(app.selectSprintSession(deck, progress, { size: 120 }), 'sprint');
      for (const focus of ['due', 'weak', 'new', 'review']) {
        check(app.selectPrioritySession(deck, progress, { size: 120, focus }).items, `priority:${focus}`);
      }
      // The study scope never widens the word pool and never inherits a phrase
      // level: in words-only mode no phrase is eligible at all.
      const phrasePool = scope === 'words' ? [] : app.filterPhrasesByCefr(phrases, selection);
      for (const phrase of phrasePool) {
        const level = levelOf(phrase);
        assert.equal(level === 'UNCLASSIFIED' ? Boolean(mask & 64) : levels.includes(level), true,
          `${scope} ${mask}: phrase ${phrase.phrase} (${level}) is outside the selected levels`);
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
