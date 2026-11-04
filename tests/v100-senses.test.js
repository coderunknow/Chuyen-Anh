// v1.0.0 — sense-level CEFR behavioral matrix.
//
// Covers the acceptance matrix for the sense model: every entry's senses are
// well-formed and classified; every one of the 128 CEFR selections (2^6 level
// sets x the Unclassified switch) narrows the learning view to exactly the
// in-scope senses; multi-sense headwords show each sense with its own badge and
// never merge or duplicate; excluded senses cannot leak into prompts, options
// or distractor pools; headword and sense counts are distinguished; lookup
// shows all senses by default and can be narrowed on request; and the legacy
// headword-tag fallback keeps old data working.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const vocabulary = JSON.parse(html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const selectionOf = (levels, unclassified = false) => app.sanitizeCefrSelection({ version: 1, levels, unclassified });
const LEVEL_MASKS = Array.from({ length: 64 }, (_, mask) => LEVELS.filter((_, index) => mask & (1 << index)));
const SELECTIONS = LEVEL_MASKS.flatMap(levels => [false, true].map(unclassified => selectionOf(levels, unclassified)));
const VALID_EVIDENCE = new Set(['source_supported', 'cross_validated', 'disputed', 'editorial_estimate', 'unresolved']);

test('v1.0.0: every shipped entry carries well-formed, classified senses', () => {
  assert.ok(vocabulary.length > 7000);
  let senseTotal = 0;
  const multi = [];
  for (const entry of vocabulary) {
    const senses = app.entrySenses(entry);
    assert.ok(senses.length >= 1, `entry ${entry.id} has no senses`);
    const ids = new Set();
    for (const sense of senses) {
      senseTotal += 1;
      assert.match(sense.senseId, new RegExp(`^${entry.id}-s[1-9][0-9]*$`), `senseId ${sense.senseId} of ${entry.id}`);
      assert.ok(!ids.has(sense.senseId), `duplicate senseId ${sense.senseId}`);
      ids.add(sense.senseId);
      assert.ok(LEVELS.includes(sense.cefr), `sense ${sense.senseId} has invalid cefr ${sense.cefr}`);
      assert.ok(VALID_EVIDENCE.has(sense.evidence), `sense ${sense.senseId} has invalid evidence ${sense.evidence}`);
      assert.ok(['HIGH', 'MEDIUM', 'LOW', 'VERY_LOW'].includes(sense.confidence));
      assert.ok(sense.meaning.length > 0, `sense ${sense.senseId} has no meaning`);
    }
    if (senses.length > 1) multi.push(entry);
  }
  assert.equal(senseTotal, 8860, 'total senses');
  assert.ok(multi.length >= 2, `expected the evidence-backed multi-sense headwords, got ${multi.length}`);
  // no unresolved senses anywhere
  const unresolved = vocabulary.flatMap(e => app.entrySenses(e)).filter(s => s.cefr === 'UNCLASSIFIED');
  assert.equal(unresolved.length, 0, 'no sense may be left Unclassified');
});

test('v1.0.0: all 128 selections narrow every entry to exactly its in-scope senses', () => {
  for (const selection of SELECTIONS) {
    const wanted = new Set(selection.levels.map(l => l.toUpperCase()));
    if (selection.unclassified) wanted.add('UNCLASSIFIED');
    for (const entry of vocabulary) {
      const senses = app.sensesMatchingCefr(entry, selection);
      const expected = app.entrySenses(entry).filter(s => wanted.has(s.cefr));
      assert.deepEqual(senses.map(s => s.senseId), expected.map(s => s.senseId),
        `${entry.word} under [${[...wanted].join('+')}]`);
      assert.equal(app.entryMatchesCefr(entry, selection), expected.length > 0,
        `${entry.word} membership under [${[...wanted].join('+')}]`);
      const view = app.senseViewEntry(entry, selection);
      assert.deepEqual(view.senses.map(s => s.senseId), expected.map(s => s.senseId));
      if (expected.length) {
        // the learning gloss is rebuilt only from in-scope senses
        for (const sense of app.entrySenses(entry)) {
          if (!wanted.has(sense.cefr) && sense.meaning && view.meaning.includes(sense.meaning) && expected.every(s => s.meaning !== sense.meaning)) {
            assert.fail(`excluded sense ${sense.senseId} of ${entry.word} leaked into the learning gloss`);
          }
        }
      }
    }
  }
});

test('v1.0.0: multi-sense headwords keep senses separate with their own labels and badges', () => {
  // `rest` is split by the Oxford wordlists into two noun senses, each with its
  // own senseId, annotation label and CEFR level.
  const rest = vocabulary.find(e => e.word.toLowerCase() === 'rest' && e.pos === 'n');
  assert.ok(rest, 'the fixture headword rest exists');
  const senses = app.entrySenses(rest);
  assert.equal(senses.length, 2, 'rest is split into two senses');
  assert.notEqual(senses[0].senseId, senses[1].senseId);
  assert.notEqual(senses[0].label, senses[1].label, 'each sense keeps its Oxford annotation label');
  // A2 selected: both senses are in scope, each with its own badge.
  const viewBoth = app.senseViewEntry(rest, selectionOf(['A2']));
  assert.deepEqual(viewBoth.senses.map(s => s.senseId), senses.map(s => s.senseId));
  const badges = app.entryCefrBadgesHtml(rest, selectionOf(['A2']));
  assert.equal((badges.match(/cefr-badge-A2/g) || []).length, 2, 'each sense gets its own badge');
  // B1 selected: rest has no B1 sense, so it leaves the pool entirely.
  assert.equal(app.entryMatchesCefr(rest, selectionOf(['B1'])), false);
  assert.equal(app.senseViewEntry(rest, selectionOf(['B1'])).senses.length, 0);
  // A synthetic multi-level headword proves the filtering contract: with C1
  // selected only the C1 sense is exposed; with C1+C2 both are, separately.
  const word = { id: 'x', word: 'scope', pos: 'n', meaning: 'phạm vi; cơ hội', tags: [], senses: [
    { senseId: 'x-s1', label: '(range)', meaning: 'phạm vi', pos: 'n', cefr: 'C1', evidence: 'disputed', confidence: 'MEDIUM' },
    { senseId: 'x-s2', label: '(opportunity)', meaning: 'cơ hội', pos: 'n', cefr: 'C2', evidence: 'editorial_estimate', confidence: 'MEDIUM', needsIndependentValidation: true }
  ] };
  const viewC1 = app.senseViewEntry(word, selectionOf(['C1']));
  assert.deepEqual(viewC1.senses.map(s => s.cefr), ['C1']);
  assert.equal(viewC1.meaning, 'phạm vi', 'the C2 sense must not leak into a C1-only view');
  assert.match(app.entryCefrBadgesHtml(word, selectionOf(['C1'])), /cefr-badge-C1/);
  assert.doesNotMatch(app.entryCefrBadgesHtml(word, selectionOf(['C1'])), /cefr-badge-C2/);
  const viewBoth2 = app.senseViewEntry(word, selectionOf(['C1', 'C2']));
  assert.deepEqual(viewBoth2.senses.map(s => s.cefr), ['C1', 'C2']);
  assert.equal(viewBoth2.meaning, 'phạm vi; cơ hội', 'both senses are shown, clearly separated');
  const badgesBoth = app.entryCefrBadgesHtml(word, selectionOf(['C1', 'C2']));
  assert.match(badgesBoth, /cefr-badge-C1/);
  assert.match(badgesBoth, /cefr-badge-C2/);
  // lookup (no selection) shows all senses with their labels
  assert.equal((app.entryCefrBadgesHtml(word).match(/cefr-badge-/g) || []).length, 2);
});

test('v1.0.0: the scope example is classified from evidence, not inherited', () => {
  const scope = vocabulary.find(e => e.word.toLowerCase() === 'scope');
  assert.ok(scope, 'scope exists');
  const senses = app.entrySenses(scope);
  assert.equal(senses.length >= 1, true);
  // CEFR-J lists scope noun at B1, the Oxford 5000 list prints C1: the engine
  // records the disagreement (disputed) and resolves by the documented
  // hierarchy to C1; both published votes stay in the record.
  const raw = scope.senses[0];
  const s = senses[0];
  assert.equal(s.cefr, 'C1');
  assert.equal(s.evidence, 'disputed');
  const refs = raw.sources || [];
  assert.ok(refs.some(x => (x.ref || '').includes('cefrj')), 'CEFR-J vote recorded');
  assert.ok(refs.some(x => (x.ref || '').includes('oxford')), 'Oxford vote recorded');
  assert.match(raw.rationale, /disagree/, 'the disagreement is recorded in the rationale');
  assert.equal(app.entryMatchesCefr(scope, selectionOf(['C1'])), true, 'C1 selection shows the C1 sense');
  assert.equal(app.entryMatchesCefr(scope, selectionOf(['B1'])), false, 'the B1 vote alone must not put it in a B1-only pool');
});

test('v1.0.0: excluded senses cannot appear as distractors, prompts or answers', () => {
  // A controlled multi-level headword inside a small pool: the contract is that
  // under a C1-only selection the C2 sense never reaches the prompt, the
  // answer, or any distractor option text.
  const word = {
    id: 'x1', word: 'scope', pos: 'n', meaning: 'phạm vi; cơ hội hiếm có', tags: ['level:C1'],
    senses: [
      { senseId: 'x1-s1', label: '(range)', meaning: 'phạm vi', pos: 'n', cefr: 'C1', evidence: 'disputed', confidence: 'MEDIUM' },
      { senseId: 'x1-s2', label: '(chance)', meaning: 'cơ hội hiếm có', pos: 'n', cefr: 'C2', evidence: 'editorial_estimate', confidence: 'MEDIUM', needsIndependentValidation: true }
    ]
  };
  const fillers = ['alpha', 'beta', 'gamma', 'delta', 'omega', 'sigma'].map((w, i) => ({
    id: `f${i}`, word: w, pos: 'n', meaning: `nghĩa của ${w}`, tags: ['level:C1'],
    senses: [{ senseId: `f${i}-s1`, label: '', meaning: `nghĩa của ${w}`, pos: 'n', cefr: 'C1', evidence: 'source_supported', confidence: 'HIGH' }]
  }));
  const raw = [word, ...fillers];
  for (const levels of [['C1'], ['C2'], ['C1', 'C2'], ['B2', 'C1']]) {
    const selection = selectionOf(levels);
    const pool = app.filterVocabularySensesByCefr(raw, selection);
    for (const mode of ['recognition', 'recall', 'flashcard', 'fill_vi']) {
      const item = { vocab: pool.find(e => e.id === 'x1'), progress: app.createInitialProgress('x1', 0) };
      if (!item.vocab) continue;
      const q = app.generateQuestion(item, pool, mode);
      if (!q || q.unavailable) continue;
      const text = JSON.stringify({ prompt: q.prompt, answer: q.answer, options: q.options });
      if (!levels.includes('C2')) {
        assert.ok(!text.includes('cơ hội hiếm có'), `mode ${mode} under ${levels} leaked the C2 sense into prompt/answer/options`);
      }
      if (levels.includes('C1') && !levels.includes('C2')) {
        assert.ok(text.includes('phạm vi') || mode === 'recall' || mode === 'spelling', 'the C1 sense is the studied one');
      }
    }
  }
  // Real dataset: the two evidence-backed multi-sense headwords (rest, ring)
  // never expose a sense outside the selection in the sense view.
  const multi = vocabulary.filter(e => app.entrySenses(e).length > 1);
  assert.ok(multi.length >= 2);
  for (const selection of SELECTIONS) {
    for (const entry of multi) {
      const view = app.senseViewEntry(entry, selection);
      for (const sense of view.senses) {
        assert.ok(app.senseMatchesCefr(sense, selection), `sense ${sense.senseId} of ${entry.word} is out of scope but present in the view`);
      }
    }
  }
});

test('v1.0.0: headword counts and sense counts are distinguished', () => {
  const headwords = vocabulary.filter(e => !e.familyHead);
  const deck = headwords.filter(e => !app.isArchivedEntry(e));
  const byHeadword = app.countVocabularyByCefr(deck);
  const bySense = app.countSensesByCefr(deck);
  let headwordTotal = 0;
  let senseTotal = 0;
  for (const level of [...LEVELS, 'UNCLASSIFIED']) {
    senseTotal += bySense[level] || 0;
    headwordTotal += byHeadword[level] || 0;
  }
  // Six deck headwords are evidence-backed multi-sense entries (bank, lie, race,
  // rock, tear, used), so the deck carries 6 extra senses beyond one per headword.
  assert.equal(senseTotal, deck.length + 6, 'senses over the deck headwords');
  const allSenses = Object.values(app.countSensesByCefr(vocabulary)).reduce((a, b) => a + b, 0);
  assert.equal(allSenses, 8860, 'all 8,852 rows carry senses (8,120 on headwords + 740 on merged family rows)');
  assert.ok(headwordTotal >= deck.length, 'a multi-sense headword counts once per level it has');
  assert.equal(headwords.length, 8112);
  // default B2+C1 selection: eligible headwords counted via the one pipeline
  const eligible = app.filterVocabularyByCefr(deck, app.defaultCefrSelection()).length;
  const eligibleSenses = ['B2', 'C1'].reduce((t, l) => t + (bySense[l] || 0), 0);
  assert.equal(eligible, 3724);
  assert.equal(eligibleSenses, 3725, 'B2+C1 senses over the deck (tear carries two B2 senses, so senses exceed headwords by 1)');
  // A2 is where headword and sense counts genuinely diverge: rest, ring and rock
  // each carry two A2 senses, so the sense count is higher than the headword count.
  const a2Headwords = app.filterVocabularyByCefr(headwords, selectionOf(['A2'])).length;
  const a2Senses = app.countSensesByCefr(headwords).A2 || 0;
  assert.ok(a2Senses > a2Headwords, `sense count (${a2Senses}) must be distinguishable from headword count (${a2Headwords})`);
});

test('v1.0.0: the CEFR badge is present in the learning card markup and hides no answer', () => {
  assert.match(appSource, /card-cefr/, 'the flashcard head renders the sense badges');
  assert.match(appSource, /entryCefrBadgesHtml\(deck\.find\(entry => entry\.id === item\.vocab\.id\) \|\| item\.vocab, cefrSelection\)/,
    'badges are computed live from the raw entry and the current selection');
  const badge = app.cefrBadgeHtml({ cefr: 'C1', label: '(range)', meaning: 'phạm vi', evidence: 'disputed', confidence: 'MEDIUM' });
  assert.ok(!badge.includes('phạm vi'), 'the badge never contains the definition');
  assert.match(badge, /cefr-badge-C1/);
  assert.match(badge, />C1</);
});
