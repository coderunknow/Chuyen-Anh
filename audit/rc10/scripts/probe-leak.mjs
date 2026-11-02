// Queue-level CEFR leak probe (module exports, real dataset).
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../../../index.html', import.meta.url), 'utf8');
const src = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(src).toString('base64')}`);
const vocab = JSON.parse(html.match(/<script id="vocabulary-data" type="application\/json">([\s\S]*?)<\/script>/)[1]);

const levelOf = v => {
  const t = (v.tags || []).find(x => /^level:(A1|A2|B1|B2|C1|C2)$/i.test(x));
  return t ? t.split(':')[1].toUpperCase() : 'UNCLASSIFIED';
};
const sel = (levels, unclassified = false) => app.sanitizeCefrSelection({ version: 1, levels, unclassified });
const pool = selection => app.filterVocabularyByCefr(vocab, selection);

// A profile with history: every state represented, some due, some mastered.
const progress = {};
const now = 1_700_000_000_000;
for (const [index, v] of vocab.entries()) {
  const p = app.createInitialProgress(v.id, 0);
  const bucket = index % 5;
  if (bucket === 1) { p.state = 'weak'; p.wrongCount = 2; p.nextReview = now - 1000; }
  else if (bucket === 2) { p.state = 'review'; p.correctCount = 3; p.nextReview = now - 5000; }
  else if (bucket === 3) { p.state = 'mastered'; p.correctCount = 9; p.nextReview = now + 10 ** 9; }
  else if (bucket === 4) { p.state = 'learning'; p.nextReview = now - 200; }
  progress[v.id] = p;
}
const cases = {
  'C1 only': sel(['C1']),
  'A1 only': sel(['A1']),
  'B2+C1 (default)': sel(['B2', 'C1']),
  'everything off': sel([]),
  'Unclassified only': sel([], true)
};
const favSet = new Set(vocab.filter(v => levelOf(v) === 'B1').slice(0, 5).map(v => v.id));

const failures = [];
const rows = [];
for (const [name, selection] of Object.entries(cases)) {
  const deck = pool(selection);
  const eligible = new Set(deck.map(v => v.id));
  const expect = (queue, label) => {
    const out = queue.map(item => item.vocab || item).filter(v => v && !eligible.has(v.id));
    if (out.length) failures.push({ case: name, queue: label, leaked: out.slice(0, 5).map(v => `${v.word}(${levelOf(v)})`) });
    return out.length;
  };
  const leaks = {};
  for (const mode of ['due', 'weak', 'new', 'random', 'mixed', 'favorites']) {
    // Mirror the app's own pool rule: favourites currently read the whole deck.
    const modePool = mode === 'favorites' ? vocab : deck;
    leaks[mode] = expect(app.selectSession(modePool, progress, { size: 200, mode, favorites: favSet, now }), `selectSession:${mode}`);
  }
  leaks.sprint = expect(app.selectSprintSession(deck, progress, { size: 200, now }), 'sprint');
  for (const focus of ['due', 'weak', 'new', 'review']) {
    leaks[`priority:${focus}`] = expect(app.selectPrioritySession(deck, progress, { size: 200, focus, now }).items, `priority:${focus}`);
  }
  rows.push({ case: name, deck: deck.length, leaks });
}
console.log(JSON.stringify(rows, null, 1));
console.log('QUEUE-LEVEL FAILURES:', failures.length);
console.log(JSON.stringify(failures.slice(0, 8), null, 1));
