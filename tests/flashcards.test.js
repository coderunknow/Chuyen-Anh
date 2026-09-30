/**
 * Kiểm thử không phụ thuộc thư viện cho ứng dụng flashcard một file.
 *
 * Bộ test nạp đúng `src/flashcards/app.js` (mã được nhúng vào flashcards.html)
 * với một DOM tối thiểu, rồi lấy dữ liệu thật từ chính flashcards.html, nên một
 * bản build lỗi thời hoặc hỏng dữ liệu sẽ trượt ở đây.
 *
 *   node --test tests/flashcards.test.js
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const artifactPath = join(root, 'flashcards.html');
const appPath = join(root, 'src/flashcards/app.js');

assert.ok(existsSync(artifactPath), 'thiếu flashcards.html - chạy: python scripts/build_flashcards.py');
const html = readFileSync(artifactPath, 'utf8');
const payloadMatch = html.match(/<script type="application\/json" id="ca-data">([\s\S]*?)<\/script>/);
assert.ok(payloadMatch, 'flashcards.html phải nhúng dữ liệu JSON');
const PAYLOAD_TEXT = payloadMatch[1];
const PAYLOAD = JSON.parse(PAYLOAD_TEXT);

/** localStorage giả để kiểm tra lưu trữ và "tải lại trang". */
function fakeStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => { map.set(key, String(value)); },
    removeItem: (key) => { map.delete(key); },
    get length() { return map.size; },
    key: (index) => [...map.keys()][index],
    dump: () => new Map(map)
  };
}

/** Nạp app.js với DOM tối thiểu; mỗi lần gọi cho một "phiên bản trình duyệt" mới. */
function loadApp(storage) {
  delete require.cache[appPath];
  global.window = {
    localStorage: storage || null,
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (id) => clearTimeout(id),
    matchMedia: null,
    addEventListener() {},
    location: { hash: '' }
  };
  global.document = {
    getElementById: (id) => (id === 'ca-data' ? { textContent: PAYLOAD_TEXT } : null),
    addEventListener() {},
    querySelectorAll: () => [],
    readyState: 'complete'
  };
  global.setTimeout = setTimeout;
  return require(appPath);
}

const api = loadApp(fakeStorage());
const { core, store, SRS } = { core: api.core, store: api.store, SRS: api.core.SRS };
const DAY = 86400000;

function entryWith(predicate) { return api.entries.find(predicate); }

/* ------------------------------------------------------------------ dữ liệu */

test('dữ liệu trong file khớp danh sách 913 từ đã học', () => {
  assert.equal(api.meta.total, 913);
  assert.equal(api.entries.length, 913);
  assert.equal(new Set(api.entries.map((e) => e.id)).size, 913);
  assert.equal(new Set(api.entries.map((e) => e.word)).size, 913);
  assert.deepEqual(Object.keys(api.meta.levelCounts).sort(), ['1', '2', '3', '4', '5']);
  for (const entry of api.entries) {
    assert.ok(entry.word.trim().length > 0, `từ trống: ${entry.id}`);
    assert.ok(entry.meaning.trim().length > 0, `nghĩa trống: ${entry.word}`);
    assert.ok(entry.level >= 1 && entry.level <= 5, `mức sai: ${entry.word}`);
    assert.ok(entry.tier >= 1 && entry.tier <= 3, `bậc sai: ${entry.word}`);
    assert.ok(entry.syllables >= 1, `âm tiết sai: ${entry.word}`);
    assert.equal(entry.ipa === '' || entry.ipa.startsWith('/'), true, `phiên âm sai: ${entry.word}`);
  }
});

test('300 từ có ngữ cảnh đề đều kèm họ từ, phân biệt và nguồn', () => {
  const documented = api.entries.filter((entry) => entry.documented);
  assert.equal(documented.length, 300);
  for (const entry of documented) {
    assert.ok(entry.family.length > 10, `thiếu họ từ: ${entry.word}`);
    assert.ok(entry.distinction.length > 20, `thiếu phân biệt: ${entry.word}`);
    if (entry.example) {
      assert.ok(entry.example.length > 20, `câu ví dụ quá ngắn: ${entry.word}`);
      assert.ok(!/\|\s*[A-D]\./.test(entry.example), `câu ví dụ là lưới đáp án: ${entry.word}`);
    }
    assert.match(entry.ref.url, /^https:\/\/github\.com\/coderunknow\/Chuyen-Anh\/blob\/[0-9a-f]{7,40}\//);
    assert.match(entry.ref.path, /^De-chuyen-Anh-vao-10\//);
    assert.ok(entry.ref.line > 0);
    assert.ok(entry.corpusFiles >= 1, `không thấy trong đề: ${entry.word}`);
  }
  const withCloze = api.entries.filter((entry) => entry.cloze);
  assert.ok(withCloze.length >= 200, `quá ít câu điền từ: ${withCloze.length}`);
  for (const entry of withCloze) {
    assert.ok(entry.cloze.text.includes('_____'), `thiếu chỗ trống: ${entry.word}`);
    assert.equal(entry.cloze.text.split('_____').length - 1, 1, `nhiều hơn một chỗ trống: ${entry.word}`);
    assert.ok(!/_{3,}/.test(entry.cloze.text.replace('_____', '')), `còn chỗ trống của đề: ${entry.word}`);
    assert.equal(entry.cloze.answer.toLowerCase(), entry.cloze.form.toLowerCase());
    assert.ok(!entry.cloze.answer.includes('_'));
    assert.ok(!/\|\s*[A-D]\./.test(entry.cloze.text), `lưới đáp án lọt vào câu điền: ${entry.word}`);
  }
});

test('phiên âm và độ phủ đề dùng dữ liệu thật của repo', () => {
  assert.ok(api.meta.withIpa >= 700, `quá ít phiên âm: ${api.meta.withIpa}`);
  assert.equal(api.meta.corpusFiles, 106);
  assert.ok(api.meta.grounded >= 500, `quá ít từ thấy trong đề: ${api.meta.grounded}`);
  assert.ok(api.meta.notes.level.includes('không phải chuẩn CEFR'));
  assert.ok(api.meta.notes.corpus.includes('không phải tần suất'));
  assert.ok(api.meta.notes.ipa.includes('CMU'));
  assert.match(api.meta.fingerprint, /^[0-9a-f]{64}$/);
  const subtle = entryWith((entry) => entry.word === 'Subtle');
  assert.equal(subtle.ipa, '/ˈsʌtəl/');
  assert.equal(subtle.syllables, 2);
});

/* --------------------------------------------------------- lõi thuật toán */

test('charDiff chỉ ra chữ thiếu, chữ thừa và độ giống nhau', () => {
  const missing = core.charDiff('meticulous', 'meticulus');
  assert.equal(missing.marks.filter((mark) => mark.ok).length, 9);
  assert.deepEqual(missing.marks.filter((mark) => mark.missing).map((mark) => mark.ch), ['o']);
  assert.ok(missing.similarity > 0.8 && missing.similarity < 1);

  const extra = core.charDiff('thrive', 'thrivee');
  assert.equal(extra.marks.filter((mark) => mark.extra).length, 1);

  const wrong = core.charDiff('allocate', 'alocate');
  assert.equal(wrong.marks.filter((mark) => mark.ok).length, 7);
  assert.ok(wrong.marks.some((mark) => !mark.ok));

  const exact = core.charDiff('  Thrive ', 'thrive');
  assert.ok(exact.marks.every((mark) => mark.ok));
  assert.equal(exact.distance, 0);
});

test('scheduler đi từ mới → đang học → cần ôn → đã thuộc và hạ nhịp khi quên', () => {
  const now = Date.parse('2026-09-30T08:00:00Z');
  let record = SRS.emptyRecord();
  assert.equal(SRS.stateOf(record, now), 'new');

  record = SRS.schedule(record, 2, now);
  assert.equal(record.n, 1);
  assert.equal(record.c, 1);
  assert.equal(record.ivl, 1);
  assert.equal(record.due, now + DAY);
  assert.equal(SRS.stateOf(record, now), 'learning');

  record = SRS.schedule(record, 2, now + DAY);
  assert.ok(record.ivl > 1 && record.ivl < 3.5, String(record.ivl));
  assert.equal(record.streak, 2);

  record = SRS.schedule(record, 2, now + 2 * DAY);
  assert.equal(SRS.stateOf(record, now + 2 * DAY), 'review');
  assert.ok(record.ivl >= 2.5);

  // Đủ nhịp dài và chuỗi đúng để thành "đã thuộc".
  let strong = SRS.emptyRecord();
  for (let i = 0; i < 6; i += 1) strong = SRS.schedule(strong, 3, now + i * DAY);
  assert.ok(strong.ivl >= 21, String(strong.ivl));
  assert.equal(SRS.stateOf(strong, now + 6 * DAY), 'mastered');

  // Quên: nhịp về 0, hẹn lại trong phiên, hệ số dễ giảm.
  const before = { n: 4, c: 4, w: 0, streak: 3, ef: 2.3, ivl: 21, due: now + DAY, last: now, g: 2 };
  const lapsed = SRS.schedule(before, 0, now);
  assert.equal(lapsed.ivl, 0);
  assert.equal(lapsed.streak, 0);
  assert.equal(lapsed.w, 1);
  assert.ok(lapsed.due > now && lapsed.due <= now + 5 * 60000);
  assert.ok(lapsed.ef < before.ef);
  assert.equal(SRS.stateOf(lapsed, now), 'weak');

  // Nhịp không vượt 365 ngày và hệ số dễ nằm trong 1.3-2.9.
  let capped = { n: 40, c: 40, w: 0, streak: 20, ef: 2.9, ivl: 300, due: now, last: now, g: 3 };
  capped = SRS.schedule(capped, 3, now);
  assert.ok(capped.ivl <= 365, String(capped.ivl));
  assert.ok(capped.ef <= 2.9);
  assert.equal(SRS.schedule({ ...strong, ef: 1.3 }, 0, now).ef, 1.3);
});

test('selectIds tôn trọng bộ lọc, không lặp từ và ưu tiên từ đến hạn', () => {
  const now = Date.parse('2026-09-30T08:00:00Z');
  const fresh = core.createStore(fakeStorage());
  const ids = core.selectIds({ size: 12, now, rng: core.createRng(1) });
  assert.equal(ids.length, 12);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every((id) => !!api.byId[id]));

  const level3 = core.selectIds({ size: 20, now, level: '3', rng: core.createRng(2) });
  assert.ok(level3.length === 20 && level3.every((id) => api.byId[id].level === 3));

  const tier1 = core.selectIds({ size: 30, now, tier: '1', rng: core.createRng(3) });
  assert.ok(tier1.every((id) => api.byId[id].tier === 1));

  const unseen = core.selectIds({ size: 5, now, state: 'new', rng: core.createRng(4) });
  assert.ok(unseen.every((id) => SRS.stateOf(store.recordOf(id), now) === 'new'));

  // Một từ đến hạn phải đứng đầu danh sách chọn.
  const dueId = api.entries[7].id;
  store.setRecord(dueId, { n: 3, c: 2, w: 1, streak: 0, ef: 2.2, ivl: 4, due: now - DAY, last: now - 5 * DAY, g: 1 });
  const picked = core.selectIds({ size: 3, now, rng: core.createRng(5) });
  assert.equal(picked[0], dueId);
  assert.ok(!core.selectIds({ size: 3, now, state: 'new', rng: core.createRng(6) }).includes(dueId));
  fresh.setRecord(dueId, SRS.emptyRecord());
  assert.equal(fresh.recordOf(dueId).n, 0);
});

test('mỗi chế độ tạo câu hỏi hợp lệ và chấm được', () => {
  const enVi = core.makeQuestion(api.entries[0], 'en-vi', 11);
  assert.equal(enVi.input, 'options');
  assert.equal(enVi.options.length, 4);
  assert.equal(enVi.options.filter((option) => option.correct).length, 1);
  assert.equal(new Set(enVi.options.map((option) => option.text)).size, 4);
  assert.equal(enVi.prompt, api.entries[0].word);
  assert.equal(enVi.options.find((option) => option.correct).text, api.entries[0].meaning);

  const viEn = core.makeQuestion(api.entries[1], 'vi-en', 12);
  assert.equal(viEn.prompt, api.entries[1].meaning);
  assert.equal(viEn.options.find((option) => option.correct).text, api.entries[1].word);

  const spell = core.makeQuestion(api.entries[2], 'spell', 13);
  assert.equal(spell.input, 'typing');
  assert.equal(spell.answer, api.entries[2].word);
  assert.match(spell.hint, /chữ cái/);

  const clozeEntry = entryWith((entry) => entry.cloze);
  const cloze = core.makeQuestion(clozeEntry, 'cloze', 14);
  assert.equal(cloze.input, 'typing');
  assert.ok(cloze.prompt.includes('_____'));
  assert.ok(cloze.accept.includes(clozeEntry.word));

  const flip = core.makeQuestion(api.entries[3], 'flip', 15);
  assert.equal(flip.input, 'flip');
  assert.equal(flip.answer, api.entries[3].meaning);

  // Không có Web Speech API thì chế độ nghe lùi về Anh → Việt.
  assert.equal(api.tts, null);
  const listen = core.makeQuestion(api.entries[4], 'listen', 16);
  assert.equal(listen.kind, 'en-vi');

  // Chế độ trộn chọn dạng câu theo trạng thái từng từ.
  assert.ok(['en-vi', 'listen', 'spell', 'cloze', 'vi-en'].includes(core.smartKind(api.entries[0], null, Date.now())));
});

test('chấm câu trả lời tự luận: đúng, gần đúng, có gợi ý và theo thời gian', () => {
  const question = { answer: 'Meticulous', accept: ['Meticulous'] };
  assert.equal(core.gradeTyped(question, 'meticulous', 3000, false).correct, true);
  assert.equal(core.gradeTyped(question, '  Meticulous ', 3000, false).correct, true);
  assert.equal(core.gradeTyped(question, 'meticulus', 3000, false).correct, false);
  assert.equal(core.gradeTyped(question, 'meticulus', 3000, false).near, true);
  assert.equal(core.gradeTyped(question, 'met', 3000, false).near, false);
  assert.equal(core.gradeTyped(question, 'meticulous', 2000, false).grade, 3);
  assert.equal(core.gradeTyped(question, 'meticulous', 9000, false).grade, 2);
  assert.equal(core.gradeTyped(question, 'meticulous', 40000, false).grade, 1);
  assert.ok(core.gradeTyped(question, 'meticulous', 2000, true).grade <= 1);
  assert.equal(core.gradeTyped({ answer: 'allocate', accept: ['allocating', 'allocate'] }, 'allocating', 2000, false).correct, true);
  assert.equal(core.autoGrade(1000), 3);
  assert.equal(core.autoGrade(10000), 2);
  assert.equal(core.autoGrade(30000), 1);
});

/* -------------------------------------------------------------- lưu trữ */

test('lưu trữ ghi tiến độ, đánh dấu, cài đặt và khôi phục sau khi tải lại', () => {
  const storage = fakeStorage();
  const first = loadApp(storage);
  assert.equal(first.store.hasStorage, true);
  const now = Date.now();
  first.store.setRecord('42', first.core.SRS.schedule(first.core.SRS.emptyRecord(), 2, now));
  first.store.toggleFavorite('42');
  first.store.updatePrefs({ theme: 'light', sessionSize: 10 });
  first.store.countAnswer(now, true);
  first.store.recordSession({ at: now, label: 'Phiên thử', answered: 3, correct: 2, accuracy: 2 / 3, durationMs: 1000, wrongIds: [] });
  first.store.setSession({ ids: ['42'], mode: 'en-vi', label: 'Phiên thử', seed: 1, queue: ['42'], index: 0, round: 0, answers: [], correct: 0, wrong: 0, startedAt: now });
  first.store.flush();
  assert.ok(storage.getItem('chuyen-anh.study.v1.progress').includes('"42"'));
  assert.ok(storage.getItem('chuyen-anh.study.v1.prefs').includes('light'));
  assert.equal(storage.getItem('chuyen-anh.study.v1.session').includes('Phiên thử'), true);

  const second = loadApp(storage);
  assert.equal(second.store.recordOf('42').n, 1);
  assert.equal(second.store.isFavorite('42'), true);
  assert.equal(second.store.prefs().theme, 'light');
  assert.equal(second.store.prefs().sessionSize, 10);
  assert.equal(second.store.history().length, 1);
  assert.equal(second.store.streak().current, 1);
  assert.equal(second.store.getSession().label, 'Phiên thử');

  // Dữ liệu hỏng không làm sập ứng dụng.
  storage.setItem('chuyen-anh.study.v1.progress', '{không phải json');
  const third = loadApp(storage);
  assert.deepEqual(third.store.progress(), {});
  assert.equal(third.store.hasStorage, true);

  // Không có localStorage vẫn học được (chế độ bộ nhớ tạm).
  const memory = loadApp(null);
  memory.store.setRecord('1', memory.core.SRS.emptyRecord());
  memory.store.flush();
  assert.equal(memory.store.hasStorage, false);
  assert.ok(memory.store.recordOf('1'));
});

test('xuất/nhập dữ liệu kiểm tra hợp lệ và bỏ qua từ lạ', () => {
  const local = loadApp(fakeStorage());
  const now = Date.now();
  local.store.setRecord('10', { n: 2, c: 1, w: 1, streak: 0, ef: 2.3, ivl: 0, due: now, last: now, g: 0 });
  local.store.toggleFavorite('10');
  const bundle = local.store.exportBundle(now);
  assert.equal(bundle.app, 'chuyen-anh-flashcards');
  assert.equal(bundle.v, 1);
  assert.equal(local.store.validateBundle(bundle), null);
  assert.equal(typeof local.store.validateBundle({ app: 'other', v: 1, data: {} }), 'string');
  assert.equal(typeof local.store.validateBundle({ app: 'chuyen-anh-flashcards', v: 2, data: {} }), 'string');
  assert.equal(typeof local.store.validateBundle({ app: 'chuyen-anh-flashcards', v: 1 }), 'string');
  assert.equal(typeof local.store.validateBundle({ app: 'chuyen-anh-flashcards', v: 1, data: { favorites: 3 } }), 'string');

  const target = loadApp(fakeStorage());
  const dirty = JSON.parse(JSON.stringify(bundle));
  dirty.data.progress['999999'] = { n: 9 };
  dirty.data.favorites.push('999999');
  const accepted = target.store.applyBundle(dirty, 'merge');
  assert.equal(accepted, 1);
  assert.equal(target.store.recordOf('10').w, 1);
  assert.equal(target.store.recordOf('999999'), null);
  assert.deepEqual(target.store.favorites(), ['10']);

  target.store.setRecord('11', target.core.SRS.emptyRecord());
  target.store.applyBundle(bundle, 'replace');
  assert.equal(target.store.recordOf('11'), null);
  assert.ok(target.store.recordOf('10'));
});

test('thống kê, chuỗi ngày và CSV phản ánh đúng tiến độ', () => {
  const local = loadApp(fakeStorage());
  const now = Date.now();
  local.store.setRecord('1', { n: 5, c: 5, w: 0, streak: 5, ef: 2.5, ivl: 25, due: now + DAY, last: now, g: 3 });
  local.store.setRecord('2', { n: 2, c: 0, w: 2, streak: 0, ef: 1.8, ivl: 0, due: now + 1000, last: now, g: 0 });
  local.store.setRecord('3', { n: 1, c: 1, w: 0, streak: 1, ef: 2.5, ivl: 1, due: now - 1000, last: now, g: 2 });
  local.store.toggleFavorite('1');
  const stats = local.store.summarize(now);
  assert.equal(stats.seen, 3);
  assert.equal(stats.total - stats.seen, stats.fresh);
  assert.equal(stats.counts.mastered, 1);
  assert.equal(stats.counts.weak, 1);
  assert.equal(stats.counts.learning, 1);
  assert.equal(stats.due, 1);
  assert.equal(stats.reviews, 8);
  assert.equal(stats.correct, 6);
  assert.equal(stats.favorite, 1);
  assert.equal(stats.levels[1] > 0, true);

  local.store.countAnswer(now, true);
  local.store.countAnswer(now, false);
  local.store.recordSession({ at: now, label: 'Phiên A', answered: 10, correct: 9, accuracy: 0.9, durationMs: 1000, wrongIds: ['2'] });
  const after = local.store.summarize(now);
  assert.equal(after.today.answered, 2);
  assert.equal(after.today.correct, 1);
  assert.equal(after.today.sessions, 1);
  assert.equal(after.streak.current, 1);

  const rows = local.core.csvRows(now);
  assert.deepEqual(rows[0], ['id', 'word', 'pos', 'level', 'tier', 'state', 'seen', 'correct', 'wrong', 'interval_days', 'due', 'favorite', 'meaning']);
  assert.equal(rows.length, 4);
  const row = rows.find((line) => line[0] === '2');
  assert.equal(row[4], api.byId['2'].tier);
  assert.equal(row[5], 'weak');
  assert.equal(row[7], 0);
  assert.equal(row[8], 2);
  assert.equal(local.core.csvCell('kỹ lưỡng, tỉ mỉ'), '"kỹ lưỡng, tỉ mỉ"');
  assert.equal(local.core.csvCell('nói "khác"'), '"nói ""khác"""');
  assert.equal(local.core.csvCell('bình thường'), 'bình thường');
});

test('xoá tiến độ giữ đánh dấu, xoá tất cả trả về mặc định', () => {
  const local = loadApp(fakeStorage());
  local.store.setRecord('1', local.core.SRS.emptyRecord());
  local.store.toggleFavorite('1');
  local.store.updatePrefs({ theme: 'light' });
  local.store.resetProgress();
  assert.deepEqual(local.store.progress(), {});
  assert.deepEqual(local.store.history(), []);
  assert.equal(local.store.streak().current, 0);
  assert.deepEqual(local.store.favorites(), ['1']);
  assert.equal(local.store.prefs().theme, 'light');
  local.store.resetAll();
  assert.deepEqual(local.store.favorites(), []);
  assert.equal(local.store.prefs().theme, local.core.DEFAULT_PREFS.theme);
});

/* ------------------------------------------------------------- phiên học */

test('phiên học chạy trọn vẹn, hỏi lại từ sai và lưu tổng kết', () => {
  const local = loadApp(fakeStorage());
  local.store.updatePrefs({ sessionSize: 4 });
  const engine = local.engine;
  const now = Date.now();
  const ids = local.core.selectIds({ size: 4, now, rng: local.core.createRng(42) });
  engine.start({ ids, mode: 'en-vi', label: 'Kiểm thử', seed: 99, startedAt: now });
  assert.equal(engine.hasSession(), true);
  assert.equal(engine.progress().total, 4);

  // Trả lời sai thẻ đầu để kiểm tra việc hỏi lại.
  const first = engine.current();
  const wrongOption = first.question.options.findIndex((option) => !option.correct);
  engine.answerOption(wrongOption);
  assert.equal(engine.current().phase, 'answered');
  assert.equal(engine.current().result.correct, false);
  assert.equal(local.core.SRS.stateOf(local.store.recordOf(first.id), Date.now()), 'weak');

  let againId = first.id;
  let progress = null;
  let guard = 0;
  while (engine.hasSession() && guard < 30) {
    guard += 1;
    const card = engine.current();
    if (!card) break;
    if (card.phase === 'prompt') {
      if (card.question.input === 'options') engine.answerOption(card.question.options.findIndex((option) => option.correct));
      else if (card.question.input === 'typing') engine.answerText(card.question.answer);
      else engine.reveal();
      continue;
    }
    if (card.phase === 'revealed') { engine.gradeSelf(2); continue; }
    if (!engine.advance()) {
      progress = engine.progress();
      local.app.summary = engine.finish();
    }
  }
  assert.equal(engine.hasSession(), false);
  assert.equal(progress.answered, 5, '4 từ + 1 lượt hỏi lại');
  assert.equal(progress.correct, 4);
  assert.equal(progress.wrong, 1);
  const record = local.store.recordOf(againId);
  assert.equal(record.w, 1, 'từ sai phải được hỏi lại và trả lời đúng lần hai');
  assert.equal(record.c, 1);
  assert.equal(record.n, 2);
  const summary = local.app.summary;
  assert.ok(summary, 'phiên phải có tổng kết');
  assert.equal(summary.answered, 5);
  assert.equal(summary.correct, 4);
  assert.deepEqual(summary.wrongIds, [ids[0]]);
  assert.equal(typeof summary.durationMs, 'number');
  assert.equal(summary.size, 4);
  assert.equal(local.store.getSession(), null);
  assert.equal(local.store.history().length, 1);
  assert.equal(local.store.history()[0].label, 'Kiểm thử');
  assert.equal(Object.keys(local.store.progress()).length, 4);
});

test('phiên học lưu bản nháp và khôi phục đúng câu hỏi', () => {
  const storage = fakeStorage();
  const first = loadApp(storage);
  const engine = first.engine;
  engine.start({ ids: first.entries.slice(10, 15).map((entry) => entry.id), mode: 'spell', label: 'Khôi phục', seed: 7, startedAt: Date.now() });
  const card = engine.current();
  engine.answerText(card.question.answer);
  const snapshot = first.store.getSession();
  assert.equal(snapshot.mode, 'spell');
  assert.equal(snapshot.answers.length, 1);
  assert.equal(snapshot.index, 0);
  first.store.flush();

  const second = loadApp(storage);
  const restored = second.engine.restore();
  assert.ok(restored, 'phải khôi phục được phiên');
  assert.equal(second.engine.getState().answers.length, 1);
  assert.equal(second.engine.current().id, card.id);
  assert.equal(second.engine.current().phase, 'answered');
  assert.equal(second.engine.current().question.answer, card.question.answer);
  assert.equal(second.engine.current().question.prompt, card.question.prompt);

  // Bỏ qua không tính là đã trả lời.
  const before = second.engine.getState().answers.length;
  second.engine.advance();
  const skipped = second.engine.current().id;
  second.engine.skip();
  assert.equal(second.engine.getState().answers.length, before);
  assert.notEqual(second.engine.current().id, skipped);
  second.engine.cancel();
  assert.equal(second.store.getSession(), null);
  assert.equal(second.engine.hasSession(), false);
});

/* -------------------------------------------------- kiểm tra file thành phẩm */

test('flashcards.html là một file duy nhất, không phụ thuộc mạng', () => {
  const bytes = Buffer.byteLength(html, 'utf8');
  assert.ok(bytes < 2_000_000, `file quá lớn: ${bytes}`);
  assert.match(html, /^<!doctype html>/);
  assert.ok(!/\{\{[A-Z_]+\}\}/.test(html), 'còn placeholder chưa thay');
  assert.ok(!/(src|href)\s*=\s*["']https?:\/\/(?!github\.com\/coderunknow)/.test(html), 'còn tài nguyên ngoài');
  assert.ok(!html.includes('fetch('));
  assert.ok(!html.includes('XMLHttpRequest'));
  assert.ok(html.includes('<script type="application/json" id="ca-data">'));
  assert.ok(html.includes('chuyen-anh.study.v1'), 'thiếu tiền tố lưu trữ');
  assert.ok(html.includes('prefers-reduced-motion'));
  assert.ok(html.includes('aria-live="polite"'));
  assert.ok(html.includes('lang="vi"'));
  assert.ok(html.includes('class="skip-link"'));
  assert.ok(html.includes('.dialog'));
  assert.ok(html.includes('ChuyenAnhFlashcards'), 'thiếu API công khai cho kiểm thử');
  assert.ok(html.includes(api.meta.fingerprint), 'artifact không khớp payload đang kiểm thử');
  for (const mode of ['smart', 'en-vi', 'vi-en', 'spell', 'cloze', 'listen', 'flip']) {
    assert.ok(html.includes("'" + mode + "'"), `thiếu chế độ ${mode}`);
  }
});
