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
  assert.equal(senseTotal, 8928, 'total senses');
  assert.equal(multi.length, 75, `expected 75 evidence-backed multi-sense headwords, got ${multi.length}`);
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
        if (expected.length < app.entrySenses(entry).length) {
          assert.equal(view.meaning, expected.map(s => s.meaning).filter(Boolean).join('; '));
        }
        // the learning gloss is rebuilt only from in-scope senses
        for (const sense of app.entrySenses(entry)) {
          if (!wanted.has(sense.cefr) && sense.meaning && view.meaning.includes(sense.meaning) && expected.every(s => !s.meaning.includes(sense.meaning))) {
            assert.fail(`excluded sense ${sense.senseId} of ${entry.word} leaked into the learning gloss`);
          }
        }
      }
    }
  }
});

test('v1.0.0: multi-sense headwords keep senses separate with their own labels and badges', () => {
  // The original gloss covers sleep/relax, not the remaining-part homograph.
  const rest = vocabulary.find(e => e.word.toLowerCase() === 'rest' && e.pos === 'n');
  assert.ok(rest);
  const senses = app.entrySenses(rest);
  assert.equal(senses.length, 1);
  assert.equal(senses[0].label, '(sleep/relax)');
  assert.equal(senses[0].meaning, 'sự nghỉ ngơi');
  assert.equal(app.entryMatchesCefr(rest, selectionOf(['B1'])), false);
  assert.equal(app.senseViewEntry(rest, selectionOf(['B1'])).meaning, '', 'empty scope must not leak original meaning');
  const lie = vocabulary.find(e => e.word === 'lie' && e.pos === 'v');
  assert.equal(app.senseViewEntry(lie, selectionOf(['A1'])).meaning, 'nằm');
  assert.equal(app.senseViewEntry(lie, selectionOf(['B1'])).meaning, 'nói dối');
  const rock = vocabulary.find(e => e.word === 'rock' && e.pos === 'n');
  assert.deepEqual(Object.fromEntries(app.entrySenses(rock).map(s => [s.label, s.meaning])),
    {'(music)': 'thể loại nhạc phương Tây', '(stone)': 'đá'});
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
  // CEFR-J lists scope noun at B1, the Oxford 5000 list prints a word-level C1:
  // the engine records the disagreement (disputed) and resolves by the
  // documented hierarchy (Oxford sense-level > CEFR-J > Octanove > Oxford
  // word-level) to B1; both published votes stay in the record.
  const raw = scope.senses[0];
  const s = senses[0];
  assert.equal(s.cefr, 'B1');
  assert.equal(s.evidence, 'disputed');
  const refs = raw.sources || [];
  assert.ok(refs.some(x => (x.ref || '').includes('cefrj')), 'CEFR-J vote recorded');
  assert.ok(refs.some(x => (x.ref || '').includes('oxford')), 'Oxford vote recorded');
  assert.match(raw.rationale, /disagree/, 'the disagreement is recorded in the rationale');
  assert.equal(app.entryMatchesCefr(scope, selectionOf(['B1'])), true, 'B1 selection shows the B1 sense');
  assert.equal(app.entryMatchesCefr(scope, selectionOf(['C1'])), false, 'the overridden word-level C1 vote must not put it in a C1-only pool');
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
  // Deck multi-sense headwords (homographs + composite-POS splits) carry 72 extra senses across 6,841 deck headwords.
  assert.equal(senseTotal, deck.length + 72, 'senses over the deck headwords');
  const allSenses = Object.values(app.countSensesByCefr(vocabulary)).reduce((a, b) => a + b, 0);
  assert.equal(allSenses, 8928, 'all 8,852 rows carry at least one glossed sense');
  assert.ok(headwordTotal >= deck.length, 'a multi-sense headword counts once per level it has');
  assert.equal(headwords.length, 8112);
  // default B2+C1 selection: eligible headwords counted via the one pipeline
  const eligible = app.filterVocabularyByCefr(deck, app.defaultCefrSelection()).length;
  const eligibleSenses = ['B2', 'C1'].reduce((t, l) => t + (bySense[l] || 0), 0);
  assert.equal(eligible, 3020);
  assert.equal(eligibleSenses, 3043, 'B2+C1 glossed senses over the deck');
  // Both glossed rock senses are A2, so the sense and headword counts diverge.
  const a2Headwords = app.filterVocabularyByCefr(headwords, selectionOf(['A2'])).length;
  const a2Senses = app.countSensesByCefr(headwords).A2 || 0;
  assert.ok(a2Senses > a2Headwords, `sense count (${a2Senses}) must be distinguishable from headword count (${a2Headwords})`);
});

test('v1.0.0: composite-POS headwords split into atomic-POS senses and narrow POS + gloss cleanly', () => {
  const articulate = vocabulary.find(e => e.id === '98');
  assert.ok(articulate);
  const senses = app.entrySenses(articulate);
  assert.deepEqual(senses.map(s => [s.pos, s.cefr]), [['adj', 'C2'], ['v', 'B2']]);
  const c2View = app.senseViewEntry(articulate, selectionOf(['C2']));
  assert.equal(c2View.pos, 'adj');
  assert.equal(c2View.meaning, 'diễn đạt rõ ràng, ăn nói lưu loát');
  const b2View = app.senseViewEntry(articulate, selectionOf(['B2']));
  assert.equal(b2View.pos, 'v');
  assert.equal(b2View.meaning, 'diễn đạt rõ ràng');

  const march = vocabulary.find(e => e.id === '8174');
  assert.equal(march.word, 'March');
  assert.equal(app.entrySenses(march)[0].cefr, 'A1');

  const enBadge = app.cefrBadgeHtml({ cefr: 'C2', label: '(v)', meaning: 'diễn đạt rõ ràng', evidence: 'editorial_estimate', confidence: 'MEDIUM' }, 'en');
  assert.match(enBadge, /cefr-estimate/);
  assert.match(enBadge, /editorial estimate/);
  assert.ok(!enBadge.includes('diễn đạt'));
  const viBadge = app.cefrBadgeHtml({ cefr: 'C1', label: '(adj)', meaning: 'diễn đạt rõ ràng', evidence: 'cross_validated', confidence: 'HIGH' }, 'vi');
  assert.match(viBadge, /đối chiếu độc lập/);
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
