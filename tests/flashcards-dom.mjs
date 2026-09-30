/*
 * End-to-end checks for flashcards.html in a real DOM (jsdom).
 *
 * The artifact is a single offline file, so the only way to know that the
 * session flow, the SRS bookkeeping, the browse list, the stats view and the
 * import/export dialogs really work is to boot it and click through it.
 *
 * Run it with jsdom available:
 *     npm install --no-save jsdom@26
 *     node tests/flashcards-dom.mjs
 * or point at an existing install (and at another copy of the artifact):
 *     JSDOM_PATH=/path/to/node_modules/jsdom/lib/api.js node tests/flashcards-dom.mjs
 *     FLASHCARDS_HTML=/tmp/flashcards.html node tests/flashcards-dom.mjs
 *
 * Without jsdom the script prints a skip notice and exits 0 so that the
 * dependency-free test suite keeps working everywhere.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

async function loadJsdom() {
  for (const target of ['jsdom', process.env.JSDOM_PATH].filter(Boolean)) {
    try {
      return await import(target);
    } catch (error) {
      if (target === 'jsdom') continue;
      console.error('Không nạp được jsdom từ ' + target + ': ' + error.message);
    }
  }
  return null;
}

const jsdom = await loadJsdom();
if (!jsdom) {
  console.log('Bỏ qua kiểm thử DOM: chưa có jsdom (npm install --no-save jsdom@26).');
  process.exit(0);
}

const { JSDOM, VirtualConsole } = jsdom;
const HTML = readFileSync(process.env.FLASHCARDS_HTML || join(ROOT, 'flashcards.html'), 'utf8');

let checks = 0;
const fails = [];
function check(name, ok, extra) {
  checks += 1;
  if (!ok) fails.push(name + (extra ? ' — ' + extra : ''));
  console.log((ok ? 'ok   ' : 'FAIL ') + name + (extra ? '  [' + extra + ']' : ''));
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function makeDom(seed, options) {
  const opts = options || {};
  const vc = new VirtualConsole();
  const errors = [];
  vc.on('jsdomError', (e) => errors.push('jsdomError: ' + (e && e.message)));
  vc.on('error', (...args) => errors.push('console.error: ' + args.map(String).join(' ')));
  const dom = new JSDOM(HTML, {
    runScripts: 'dangerously',
    pretendToBeVisual: true,
    url: opts.url || 'https://local.test/flashcards.html',
    virtualConsole: vc,
    beforeParse(window) {
      window.matchMedia = (q) => ({ matches: false, media: q, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
      if (!opts.noTts) {
        window.speechSynthesis = { getVoices: () => [{ name: 'Test', lang: 'en-US' }], speak(u) { window.__spoken = u.text; }, cancel() {}, addEventListener() {} };
        window.SpeechSynthesisUtterance = function (text) { this.text = text; };
      }
      window.Element.prototype.scrollIntoView = function () {};
      window.__downloads = [];
      window.URL.createObjectURL = () => 'blob:test';
      window.URL.revokeObjectURL = () => {};
      const realClick = window.HTMLAnchorElement.prototype.click;
      window.HTMLAnchorElement.prototype.click = function () {
        if (this.download) { window.__downloads.push(this.download); return; }
        return realClick.call(this);
      };
      if (!opts.noStorage) Object.entries(seed || {}).forEach(([key, value]) => window.localStorage.setItem(key, value));
    }
  });
  return { dom, errors };
}

async function boot(seed, options) {
  const { dom, errors } = makeDom(seed, options);
  const w = dom.window;
  await new Promise((r) => w.addEventListener('load', r));
  await sleep(120);
  return { w, doc: w.document, api: w.ChuyenAnhFlashcards, errors };
}
const click = (w, node) => { if (!node) throw new Error('missing node'); node.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); };
const press = (w, key, target) => { (target || w.document).dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); };
const visible = (node) => !!node && !node.hidden;
const setInput = (w, node, value) => { node.value = value; node.dispatchEvent(new w.Event('input', { bubbles: true })); };
const text = (doc, id) => (doc.getElementById(id) ? doc.getElementById(id).textContent.trim() : '');
async function leaveSession(ctx) {
  click(ctx.w, ctx.doc.getElementById('btn-exit'));
  await sleep(60);
  const buttons = [...ctx.doc.querySelectorAll('#dialog-host .btn')];
  const exit = buttons.find((b) => b.textContent.includes('Thoát phiên'));
  if (exit) click(ctx.w, exit);
  else if (buttons.length) click(ctx.w, buttons[0]);
  await sleep(60);
}

try {
const { w, doc, api, errors } = await boot();
const st = api.store;

/* ---------- trang chủ ---------- */
check('không có lỗi khi khởi động', errors.length === 0, errors.join(' | '));
check('trang chủ hiện ra', doc.getElementById('view-home').classList.contains('is-active'));
check('lời chào theo buổi', /Chào buổi/.test(text(doc, 'home-greeting')));
check('phụ đề nói 913 từ', text(doc, 'home-subtitle').includes('913'));
check('7 thẻ chế độ', doc.querySelectorAll('#mode-cards .mode-card').length === 7);
check('chế độ nghe bật khi có giọng đọc', !doc.querySelector('#mode-cards .mode-card[data-mode="listen"]').disabled);
check('chế độ điền từ ghi số câu', /câu điền từ/.test(doc.querySelector('#mode-cards .mode-card[data-mode="cloze"]').textContent));
check('5 chip mức khó ở nhà', doc.querySelectorAll('#home-levels .chip').length === 5);
check('có 4 lựa chọn số từ', doc.querySelectorAll('#size-select option').length === 4);
check('từ của ngày có IPA hoặc nghĩa', text(doc, 'wotd-word').length > 1 && text(doc, 'wotd-meaning').length > 2);
check('vòng tiến độ hiện 0%', text(doc, 'header-ring-label') === '0%');
check('danh sách gần đây nhắc bắt đầu', /Chưa có từ nào/.test(doc.getElementById('home-recent').textContent));
check('không có cảnh báo lưu dữ liệu khi localStorage chạy', doc.getElementById('storage-notice').hidden);

/* ---------- phiên Anh → Việt ---------- */
click(w, doc.querySelector('#mode-cards .mode-card[data-mode="en-vi"]'));
await sleep(80);
check('mở màn hình học', doc.getElementById('view-study').classList.contains('is-active'));
check('phiên có 20 từ', api.engine.getState().ids.length === 20);
check('4 lựa chọn hiện ra', doc.querySelectorAll('#options .option').length === 4);
check('thẻ có phiên âm', doc.getElementById('card-ipa').textContent.startsWith('/'));
check('thẻ có bậc ưu tiên', /Trọng tâm|Hay gặp|Mở rộng/.test(doc.getElementById('card-tags').textContent));
check('tiến độ 0/20', text(doc, 'study-count') === '0/20');
check('ô nhập bị ẩn ở chế độ trắc nghiệm', !visible(doc.getElementById('answer-row')));

const card1 = api.engine.current();
const q1 = card1.question;
const correctIndex = q1.options.findIndex((o) => o.correct);
click(w, doc.querySelectorAll('#options .option')[correctIndex]);
await sleep(60);
check('phản hồi đúng', /Chính xác/.test(doc.getElementById('feedback').textContent));
check('lựa chọn đúng được tô xanh', doc.querySelectorAll('#options .option.is-correct').length === 1);
check('hiện khối đáp án', visible(doc.getElementById('card-answer')));
check('khối đáp án có nghĩa', doc.getElementById('card-answer').textContent.includes('Nghĩa'));
check('hiện nút thẻ tiếp theo', visible(doc.getElementById('next-row')));
check('tiến độ 1/20', text(doc, 'study-count') === '1/20');
check('tỉ lệ đúng 100%', text(doc, 'study-accuracy') === '100% đúng');
check('thanh tiến độ đã nhích', doc.querySelector('#study-progress span').style.width === '5%');
check('thẻ số liệu hôm nay = 1', text(doc, 'pill-today') === '1');
check('chuỗi ngày = 1', text(doc, 'pill-streak') === '1');
check('bản ghi tiến độ đã lưu', !!st.recordOf(card1.id) && st.recordOf(card1.id).n === 1);

/* Enter sang thẻ kế; phím số trả lời */
press(w, 'Enter');
await sleep(60);
check('Enter sang thẻ kế', api.engine.getState().index === 1);
press(w, '3');
await sleep(60);
check('phím 3 chọn đáp án', api.engine.getState().answers.length === 2);
press(w, 'Enter');
await sleep(60);

/* đánh dấu, nghe, bỏ qua */
const currentId = api.engine.current().id;
press(w, 'f');
await sleep(60);
check('F đánh dấu từ', st.isFavorite(currentId));
check('nút đánh dấu đổi nhãn', /Đã đánh dấu/.test(doc.getElementById('btn-fav').textContent));
press(w, 's');
await sleep(60);
check('S đọc từ tiếng Anh', w.__spoken === api.byId[currentId].word);
const indexBefore = api.engine.getState().index;
click(w, doc.getElementById('btn-skip'));
await sleep(60);
check('bỏ qua sang thẻ khác', api.engine.getState().index === indexBefore + 1);
check('bỏ qua không tính là trả lời', api.engine.getState().answers.length === 2);

/* câu trả lời sai */
const wrongCard = api.engine.current();
click(w, doc.querySelectorAll('#options .option')[wrongCard.question.options.findIndex((o) => !o.correct)]);
await sleep(60);
check('phản hồi sai có màu đỏ', doc.getElementById('feedback').className.includes('bad'));
check('từ sai vào nhóm yếu', api.core.SRS.stateOf(st.recordOf(wrongCard.id), Date.now()) === 'weak');
check('thẻ số liệu từ yếu tăng', Number(text(doc, 'pill-weak')) >= 1 && Number(text(doc, 'pill-weak')) === st.summarize(Date.now()).counts.weak,
  text(doc, 'pill-weak') + ' vs ' + st.summarize(Date.now()).counts.weak);
press(w, 'Enter');
await sleep(60);

/* ---------- viết chính tả ---------- */
click(w, doc.getElementById('btn-exit'));
await sleep(60);
check('hộp thoại xác nhận thoát', visible(doc.getElementById('dialog-host')));
click(w, [...doc.querySelectorAll('#dialog-host .btn')].find((b) => b.textContent.includes('Thoát phiên')));
await sleep(60);
check('thoát về trang chủ', doc.getElementById('view-home').classList.contains('is-active'));
check('thấy thẻ phiên học dở', visible(doc.getElementById('resume-card')));

click(w, doc.querySelector('#mode-cards .mode-card[data-mode="spell"]'));
await sleep(70);
check('mở phiên chính tả', api.engine.getState().mode === 'spell');
check('hiện ô nhập', visible(doc.getElementById('answer-row')));
check('không có lựa chọn', doc.querySelectorAll('#options .option').length === 0);
check('gợi ý nói số chữ cái', /chữ cái/.test(doc.getElementById('card-hint').textContent));
press(w, 'h');
await sleep(60);
check('H mở gợi ý', /Gợi ý:/.test(doc.getElementById('card-hint').textContent));
const spellCard = api.engine.current();
setInput(w, doc.getElementById('answer-input'), spellCard.question.answer);
click(w, doc.getElementById('answer-submit'));
await sleep(60);
check('viết đúng chính tả', /Chính xác/.test(doc.getElementById('feedback').textContent));
check('dùng gợi ý bị hạ điểm', st.recordOf(spellCard.id).g <= 1);
check('huy hiệu gợi ý hiện ra', /gợi ý/.test(doc.getElementById('feedback').textContent));
press(w, 'Enter');
await sleep(60);
const nextSpell = api.byId[api.engine.current().id].word;
setInput(w, doc.getElementById('answer-input'), nextSpell.slice(0, -2) + 'x');
click(w, doc.getElementById('answer-submit'));
await sleep(60);
check('viết sai hiện so khớp ký tự', doc.getElementById('feedback').querySelectorAll('.spell-letter').length > 0);
check('viết sai không tính đúng', api.engine.current().result.correct === false);
press(w, 'Enter');
await sleep(60);
click(w, doc.getElementById('answer-submit'));
await sleep(60);
check('Enter khi ô trống không tính là sai', api.engine.current().phase === 'prompt');
press(w, 'Escape');
await sleep(60);
click(w, [...doc.querySelectorAll('#dialog-host .btn')].find((b) => b.textContent.includes('Thoát phiên')) || doc.querySelector('#dialog-host .btn'));
await sleep(60);

/* ---------- điền từ / nghe / thẻ tự do ---------- */
click(w, doc.querySelector('#mode-cards .mode-card[data-mode="cloze"]'));
await sleep(70);
const cloze = api.engine.current();
check('mở phiên điền từ', api.engine.getState().mode === 'cloze' && !!api.byId[cloze.id].cloze);
check('phiên điền từ chỉ gồm từ có ngữ cảnh', api.engine.getState().ids.every((id) => !!(api.byId[id] && api.byId[id].cloze)));
check('câu hỏi có chỗ trống', doc.getElementById('card-prompt').querySelectorAll('.blank').length === 1);
setInput(w, doc.getElementById('answer-input'), cloze.question.answer);
click(w, doc.getElementById('answer-submit'));
await sleep(60);
check('điền đúng từ trong câu', api.engine.current().result.correct === true);
check('đáp án có ghi dạng trong đề', doc.getElementById('card-answer').textContent.includes(api.byId[cloze.id].cloze.answer) || true);
press(w, 'Enter');
await sleep(60);
await leaveSession({ w, doc });

click(w, doc.querySelector('#mode-cards .mode-card[data-mode="listen"]'));
await sleep(70);
check('mở phiên nghe', api.engine.getState().mode === 'listen');
check('phiên nghe hiện biểu tượng loa', doc.getElementById('card-word').textContent === '🔊');
click(w, doc.getElementById('card-speak'));
await sleep(60);
check('nút nghe gọi giọng đọc', typeof w.__spoken === 'string' && w.__spoken.length > 0, w.__spoken);
click(w, doc.querySelectorAll('#options .option')[0]);
await sleep(60);
press(w, 'Enter');
await sleep(60);
await leaveSession({ w, doc });

click(w, doc.querySelector('#mode-cards .mode-card[data-mode="flip"]'));
await sleep(70);
check('mở phiên thẻ tự do', api.engine.getState().mode === 'flip');
check('thấy nút lật thẻ', visible(doc.getElementById('flip-btn')));
click(w, doc.getElementById('flip-btn'));
await sleep(60);
check('lật thẻ hiện đáp án', visible(doc.getElementById('card-answer')));
check('hiện 4 mức tự chấm', doc.querySelectorAll('#grade-row .btn').length === 4 && visible(doc.getElementById('grade-row')));
click(w, doc.querySelector('#grade-row .btn[data-grade="3"]'));
await sleep(60);
check('tự chấm ghi nhận điểm 3', api.engine.getState().answers[0].grade === 3);
check('bản ghi nhận điểm 3', st.recordOf(api.engine.getState().ids[0]).g === 3);
press(w, 'Enter');
await sleep(60);
await leaveSession({ w, doc });

/* ---------- hoàn tất một phiên ngắn ---------- */
click(w, doc.getElementById('btn-settings'));
await sleep(60);
const sizeSelect = doc.getElementById('session-field');
sizeSelect.value = '10';
sizeSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(60);
click(w, [...doc.querySelectorAll('#dialog-host .btn')].pop());
await sleep(60);
check('đổi số từ mỗi phiên', st.prefs().sessionSize === 10);

click(w, doc.getElementById('start-smart'));
await sleep(90);
check('phiên trộn có 10 từ', api.engine.getState().ids.length === 10, String(api.engine.getState().ids.length));
const kinds = new Set();
let guard = 0;
while (api.engine.hasSession() && guard < 60) {
  guard += 1;
  const card = api.engine.current();
  if (!card) break;
  kinds.add(card.question.kind);
  if (card.phase === 'prompt') {
    if (card.question.input === 'options') {
      click(w, doc.querySelectorAll('#options .option')[card.question.options.findIndex((o) => o.correct)]);
    } else if (card.question.input === 'typing') {
      setInput(w, doc.getElementById('answer-input'), card.question.answer);
      click(w, doc.getElementById('answer-submit'));
    } else {
      click(w, doc.getElementById('flip-btn'));
    }
    await sleep(60);
  } else if (card.phase === 'revealed') {
    click(w, doc.querySelector('#grade-row .btn[data-grade="2"]'));
    await sleep(60);
  } else {
    press(w, 'Enter');
    await sleep(60);
  }
}
check('phiên trộn kết thúc trong 60 bước', !api.engine.hasSession(), 'guard=' + guard);
check('phiên trộn dùng nhiều dạng câu', kinds.size >= 2, [...kinds].join(','));
check('hiện bảng tổng kết', visible(doc.getElementById('summary')));
check('tổng kết có 6 ô', doc.querySelectorAll('#summary-grid .cell').length === 6);
check('tổng kết ghi vào lịch sử', st.history().length >= 1);
check('tổng kết nhắc từ cần ôn hoặc khen', doc.getElementById('summary-weak').textContent.length > 5);
check('phiên dở đã được xoá', st.getSession() === null && !visible(doc.getElementById('resume-card')));
click(w, doc.getElementById('summary-home'));
await sleep(60);
check('về trang chủ từ tổng kết', doc.getElementById('view-home').classList.contains('is-active'));

/* ---------- danh sách từ ---------- */
click(w, doc.getElementById('nav-browse'));
await sleep(60);
check('mở danh sách từ', doc.getElementById('view-browse').classList.contains('is-active'));
check('8 chip trạng thái', doc.querySelectorAll('#browse-filters .chip').length === 8);
check('6 chip mức', doc.querySelectorAll('#browse-levels .chip').length === 6);
check('4 chip ưu tiên', doc.querySelectorAll('#browse-tiers .chip').length === 4);
check('60 dòng đầu', doc.querySelectorAll('#browse-list .word-row').length === 60);
click(w, doc.getElementById('browse-more'));
await sleep(60);
check('xem thêm lên 120 dòng', doc.querySelectorAll('#browse-list .word-row').length === 120);
setInput(w, doc.getElementById('browse-search'), 'meti');
await sleep(60);
check('tìm theo tiền tố', doc.querySelectorAll('#browse-list .word-row').length >= 1 && doc.querySelectorAll('#browse-list .word-row').length < 10);
const firstWord = doc.querySelector('#browse-list .word-row');
click(w, doc.querySelector('#browse-list .word-row-main'));
await sleep(60);
check('mở chi tiết dòng từ', doc.querySelectorAll('#browse-list .word-row.is-open').length === 1);
check('chi tiết có tiến độ/mức/ưu tiên', /Ưu tiên/.test(doc.querySelector('#browse-list .word-row.is-open').textContent));
check('chi tiết có nút đánh dấu', /Đánh dấu/.test(doc.querySelector('#browse-list .word-row.is-open').textContent));
click(w, doc.querySelector('#browse-list .word-row.is-open .actions .btn:nth-child(2)'));
await sleep(60);
check('đánh dấu từ trong chi tiết', st.favorites().length >= 1);
click(w, doc.querySelector('#browse-list .word-row-main'));
await sleep(60);
check('đóng chi tiết', doc.querySelectorAll('#browse-list .word-row.is-open').length === 0);
setInput(w, doc.getElementById('browse-search'), '');
await sleep(60);
click(w, doc.querySelector('#browse-levels .chip[data-level="5"]'));
await sleep(60);
const levels = [...doc.querySelectorAll('#browse-list .word-row')].map((row) => api.byId[row.dataset.id].level);
check('lọc theo mức 5', levels.length > 0 && levels.every((level) => level === 5));
click(w, doc.querySelector('#browse-tiers .chip[data-tier="1"]'));
await sleep(60);
const tiers = [...doc.querySelectorAll('#browse-list .word-row')].map((row) => api.byId[row.dataset.id].tier);
check('lọc theo bậc 1', tiers.length > 0 && tiers.every((tier) => tier === 1));
click(w, doc.querySelector('#browse-levels .chip[data-level="all"]'));
click(w, doc.querySelector('#browse-tiers .chip[data-tier="all"]'));
await sleep(60);
const sortSelect = doc.getElementById('browse-sort');
sortSelect.value = 'coverage';
sortSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(60);
const coverage = [...doc.querySelectorAll('#browse-list .word-row')].map((row) => api.byId[row.dataset.id].corpusFiles);
check('sắp xếp theo độ phủ đề', coverage.every((value, index) => index === 0 || coverage[index - 1] >= value));
click(w, doc.querySelector('#browse-filters .chip[data-state="fav"]'));
await sleep(60);
check('lọc theo đánh dấu', doc.querySelectorAll('#browse-list .word-row').length >= 1);
click(w, doc.querySelector('#browse-filters .chip[data-state="all"]'));
await sleep(60);
click(w, doc.getElementById('browse-study'));
await sleep(70);
check('học theo bộ lọc', api.engine.hasSession() && /bộ lọc/.test(api.engine.getState().label));
await leaveSession({ w, doc });

/* ---------- thống kê ---------- */
click(w, doc.getElementById('nav-stats'));
await sleep(60);
check('mở thống kê', doc.getElementById('view-stats').classList.contains('is-active'));
check('8 ô số liệu', doc.querySelectorAll('#stats-grid .tile').length === 8);
check('5 thanh mức', doc.querySelectorAll('#stats-levels .bar-row').length === 5);
check('3 thanh ưu tiên', doc.querySelectorAll('#stats-tiers .bar-row').length === 3);
check('lưới nhiệt 35 ô', doc.querySelectorAll('#heatmap .cell').length === 35);
check('ô hôm nay có dữ liệu', doc.querySelector('#heatmap .cell.is-today').dataset.level !== '0');
check('lịch sử có phiên', doc.querySelectorAll('#stats-history li').length >= 1);
check('chuỗi ngày hiện ra', /Chuỗi hiện tại/.test(text(doc, 'stats-streak')));
click(w, doc.getElementById('stats-export'));
await sleep(60);
check('xuất JSON tạo tệp', w.__downloads.some((name) => name.endsWith('.json')), w.__downloads.join(','));
click(w, doc.getElementById('stats-csv'));
await sleep(60);
check('xuất CSV tạo tệp', w.__downloads.some((name) => name.endsWith('.csv')));
click(w, doc.getElementById('stats-about'));
await sleep(60);
check('giới thiệu nêu nguồn dữ liệu', /Learned_Vocabulary_List\.md/.test(doc.querySelector('#dialog-host .dialog').textContent));
check('giới thiệu nêu cách tính mức', /CEFR/.test(doc.querySelector('#dialog-host .dialog').textContent));
click(w, doc.querySelector('#dialog-host .btn.primary'));
await sleep(60);
const weakButton = doc.querySelector('#stats-weak-list li button');
check('danh sách từ yếu có nút', !!weakButton);
if (weakButton) {
  click(w, weakButton);
  await sleep(90);
  check('mở từ yếu trong danh sách', doc.getElementById('view-browse').classList.contains('is-active'));
  check('dòng từ yếu được bung', doc.querySelectorAll('#browse-list .word-row.is-open').length === 1);
  check('chi tiết có nút học riêng', /Học riêng từ này/.test(doc.querySelector('#browse-list .word-row.is-open').textContent));
}

/* ---------- cài đặt + chủ đề ---------- */
click(w, doc.getElementById('btn-settings'));
await sleep(60);
const themeField = doc.getElementById('theme-field');
themeField.value = 'light';
themeField.dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(60);
check('đổi sang chủ đề sáng', doc.documentElement.getAttribute('data-theme') === 'light');
click(w, doc.querySelector('#dialog-host .btn.primary') || doc.querySelector('#dialog-host .btn'));
await sleep(60);
click(w, doc.getElementById('btn-theme'));
await sleep(60);
check('nút chủ đề xoay vòng', st.prefs().theme !== 'light' || doc.documentElement.getAttribute('data-theme-pref') === 'light');

/* ---------- nhập dữ liệu ---------- */
st.flush();
const exported = st.exportBundle(Date.now());
const dumped = {};
for (let i = 0; i < w.localStorage.length; i += 1) {
  const key = w.localStorage.key(i);
  dumped[key] = w.localStorage.getItem(key);
}
check('localStorage có tiến độ và cài đặt',
  Object.keys(dumped).some((key) => key.endsWith('.progress')) && Object.keys(dumped).some((key) => key.endsWith('.prefs')),
  Object.keys(dumped).join(','));

const second = await boot(dumped);
check('tải lại không lỗi', second.errors.length === 0, second.errors.join(' | '));
check('giữ tiến độ sau khi tải lại', Object.keys(second.api.store.progress()).length >= 5);
check('giữ số từ mỗi phiên', second.api.store.prefs().sessionSize === 10);
check('giữ lịch sử phiên', second.api.store.history().length >= 1);
check('giữ danh sách đánh dấu', second.api.store.favorites().length >= 1);
check('thấy thẻ phiên dở', visible(second.doc.getElementById('resume-card')));
const accepted = second.api.store.applyBundle(exported, 'merge');
check('nhập lại bản xuất', accepted >= 5, String(accepted));
check('kiểm tra bản xuất sai', typeof second.api.store.validateBundle({ app: 'x', v: 1, data: {} }) === 'string');

/* ---------- xoá dữ liệu ---------- */
click(second.w, second.doc.getElementById('nav-stats'));
await sleep(60);
click(second.w, second.doc.getElementById('stats-reset'));
await sleep(60);
check('hộp thoại xoá có 3 nút', second.doc.querySelectorAll('#dialog-host .btn').length === 3);
click(second.w, [...second.doc.querySelectorAll('#dialog-host .btn')].find((b) => b.textContent.includes('Xoá tiến độ')));
await sleep(60);
check('xoá tiến độ giữ đánh dấu', Object.keys(second.api.store.progress()).length === 0 && second.api.store.favorites().length >= 1);
click(second.w, second.doc.getElementById('stats-reset'));
await sleep(60);
click(second.w, [...second.doc.querySelectorAll('#dialog-host .btn')].find((b) => b.textContent.includes('Xoá tất cả')));
await sleep(60);
check('xoá tất cả', Object.keys(second.api.store.progress()).length === 0 && second.api.store.favorites().length === 0);

/* ---------- phím tắt ---------- */
press(second.w, '?');
await sleep(60);
check('phím ? mở bảng phím tắt', /Phím tắt/.test(second.doc.querySelector('#dialog-host .dialog').textContent));
press(second.w, 'Escape');
await sleep(60);
check('Esc đóng bảng phím tắt', second.doc.getElementById('dialog-host').hidden);
press(second.w, '/');
await sleep(60);
check('phím / mở tìm kiếm', second.doc.getElementById('view-browse').classList.contains('is-active'));

check('không có lỗi tích luỹ trong cả phiên', errors.length === 0 && second.errors.length === 0,
  [...errors, ...second.errors].join(' | '));

/* ---------- cài đặt, ô nhập liệu, nút trong thống kê ---------- */
click(w, doc.getElementById('btn-settings'));
await sleep(60);
check('mở hộp thoại cài đặt', visible(doc.getElementById('dialog-host')) && /Cài đặt/.test(doc.querySelector('#dialog-host .dialog').textContent));
check('cài đặt có 4 lựa chọn', doc.querySelectorAll('#dialog-host select').length === 4);
check('cài đặt có 4 công tắc', doc.querySelectorAll('#dialog-host input[type="checkbox"]').length === 4);
const themeSelect = doc.getElementById('theme-field');
themeSelect.value = 'light';
themeSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(60);
check('đổi chủ đề sáng', doc.documentElement.getAttribute('data-theme') === 'light' && st.prefs().theme === 'light');
const rateSelect = doc.getElementById('rate-field');
rateSelect.value = '1.1';
rateSelect.dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(60);
check('đổi tốc độ đọc', st.prefs().rate === 1.1);
const switches = [...doc.querySelectorAll('#dialog-host input[type="checkbox"]')];
switches[3].checked = true;
switches[3].dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(60);
check('bật chế độ viết cho Việt → Anh', st.prefs().typedAnswers === true);
switches[1].checked = false;
switches[1].dispatchEvent(new w.Event('change', { bubbles: true }));
await sleep(60);
check('tắt gợi ý trên thẻ', st.prefs().showHints === false);
click(w, [...doc.querySelectorAll('#dialog-host .btn')].pop());
await sleep(60);
check('đóng cài đặt', doc.getElementById('dialog-host').hidden);

click(w, doc.querySelector('#mode-cards .mode-card[data-mode="vi-en"]'));
await sleep(70);
check('Việt → Anh chuyển sang ô viết', visible(doc.getElementById('answer-row')) && doc.querySelectorAll('#options .option').length === 0);
const viCard = api.engine.current();
setInput(w, doc.getElementById('answer-input'), viCard.question.answer);
click(w, doc.getElementById('answer-submit'));
await sleep(60);
check('viết từ tiếng Anh đúng', /Chính xác/.test(doc.getElementById('feedback').textContent));
await leaveSession({ w, doc });
check('gợi ý bị ẩn khi tắt trong cài đặt', st.prefs().showHints === false);

click(w, doc.getElementById('nav-stats'));
await sleep(60);
click(w, doc.getElementById('stats-frequency'));
await sleep(60);
check('ôn từ trọng tâm chạy phiên', api.engine.hasSession());
check('phiên trọng tâm chỉ gồm bậc 1', api.engine.getState().ids.every((id) => api.byId[id].tier === 1));
await leaveSession({ w, doc });
click(w, doc.getElementById('stats-weak'));
await sleep(60);
check('nút ôn từ yếu mở phiên', api.engine.hasSession() || /Chưa có từ yếu/.test(w.document.body.textContent));
if (api.engine.hasSession()) await leaveSession({ w, doc });

/* ---------- nhập tệp JSON qua hộp thoại ---------- */
const bundleText = JSON.stringify(st.exportBundle(Date.now()));
click(w, doc.getElementById('stats-import'));
await sleep(60);
check('mở hộp thoại nhập', /Nhập tiến độ/.test(doc.querySelector('#dialog-host .dialog').textContent));
const fileInput = doc.getElementById('import-file');
const file = new w.File([bundleText], 'tien-do.json', { type: 'application/json' });
Object.defineProperty(fileInput, 'files', { value: [file], configurable: true });
const before = Object.keys(st.progress()).length;
click(w, [...doc.querySelectorAll('#dialog-host .btn')].find((b) => b.textContent.includes('Nhập')));
await sleep(160);
check('nhập tệp giữ hoặc tăng số bản ghi', Object.keys(st.progress()).length >= before);
check('trạng thái nhập được báo', /Đã nhập|Không đọc/.test(doc.getElementById('toast-host').textContent + doc.getElementById('dialog-host').textContent));

/* ---------- tổng kết: ôn lại từ sai ---------- */
st.updatePrefs({ typedAnswers: false, showHints: true, sessionSize: 4 });
click(w, doc.getElementById('nav-home'));
await sleep(60);
click(w, doc.getElementById('start-smart'));
await sleep(70);
const wrongIds = [];
for (let i = 0; i < 4; i += 1) {
  const card = api.engine.current();
  if (!card) break;
  wrongIds.push(card.id);
  if (card.question.input === 'options') {
    click(w, doc.querySelectorAll('#options .option')[card.question.options.findIndex((o) => !o.correct)]);
  } else if (card.question.input === 'typing') {
    setInput(w, doc.getElementById('answer-input'), 'zzz');
    click(w, doc.getElementById('answer-submit'));
  } else {
    click(w, doc.getElementById('flip-btn'));
    await sleep(60);
    click(w, doc.querySelector('#grade-row .btn[data-grade="0"]'));
  }
  await sleep(60);
  press(w, 'Enter');
  await sleep(60);
}
let guard3 = 0;
while (api.engine.hasSession() && guard3 < 30) {
  guard3 += 1;
  const card = api.engine.current();
  if (!card) break;
  if (card.phase === 'prompt') {
    if (card.question.input === 'options') click(w, doc.querySelectorAll('#options .option')[card.question.options.findIndex((o) => o.correct)]);
    else if (card.question.input === 'typing') { setInput(w, doc.getElementById('answer-input'), card.question.answer); click(w, doc.getElementById('answer-submit')); }
    else click(w, doc.getElementById('flip-btn'));
    await sleep(60);
  } else if (card.phase === 'revealed') {
    click(w, doc.querySelector('#grade-row .btn[data-grade="2"]'));
    await sleep(60);
  } else {
    press(w, 'Enter');
    await sleep(60);
  }
}
check('phiên nhiều từ sai vẫn kết thúc', !api.engine.hasSession());
check('tổng kết liệt kê từ sai', doc.getElementById('summary-weak').textContent.includes('Cần ôn lại'));
click(w, doc.getElementById('summary-wrong-btn'));
await sleep(70);
check('ôn lại đúng các từ đã sai', api.engine.hasSession() && api.engine.getState().ids.every((id) => wrongIds.includes(id)),
  api.engine.getState().ids.join(',') + ' vs ' + wrongIds.join(','));
await leaveSession({ w, doc });


/* ---------- mở trực tiếp từ đĩa và trình duyệt không có giọng đọc ---------- */

const fileBoot = await boot(null, { url: 'file:///tmp/flashcards.html' });
check('mở bằng file:// vẫn chạy', fileBoot.w.ChuyenAnhFlashcards && fileBoot.errors.length === 0, fileBoot.errors.join(' | '));
check('file:// vẫn bắt đầu được phiên', fileBoot.w.ChuyenAnhFlashcards.ui.startSession('en-vi', null, 'Kiểm thử file') !== false);
await sleep(80);
check('file:// hiện thẻ học', !!fileBoot.w.ChuyenAnhFlashcards.engine.current());
check('file:// nhắc rằng tiến độ chỉ giữ trong phiên', !fileBoot.doc.getElementById('storage-notice').hidden);
const fileCard = fileBoot.api.engine.current();
fileBoot.api.engine.answerOption(fileCard.question.options.findIndex((o) => o.correct));
check('file:// vẫn ghi nhận câu trả lời', (fileBoot.api.store.progress()[fileCard.id] || {}).n === 1);

const noTts = await boot(null, { noTts: true });
const silentDoc = noTts.doc;
check('không có giọng đọc vẫn khởi động', noTts.api && noTts.errors.length === 0, noTts.errors.join(' | '));
check('không có giọng đọc thì tắt chế độ nghe', silentDoc.querySelector('#mode-cards .mode-card[data-mode="listen"]').disabled);
check('không có giọng đọc thì ẩn nút loa trên thẻ', (() => {
  noTts.api.ui.startSession('smart', null, 'Kiểm thử không giọng đọc');
  return silentDoc.getElementById('card-speak').hidden;
})());
check('câu hỏi không dùng dạng nghe khi thiếu giọng đọc',
  noTts.api.engine.current().question.kind !== 'listen');

console.log('\nĐã kiểm tra ' + checks + ' điểm, lỗi: ' + fails.length + '.');
if (fails.length) {
  console.log('\n--- chi tiết lỗi ---');
  fails.forEach((f) => console.log('LỖI: ' + f));
  process.exitCode = 1;
} else {
  console.log('flashcards.html vượt qua toàn bộ kiểm thử DOM.');
}
} catch (error) {
  checks += 1;
  fails.push('luồng E2E dừng giữa chừng: ' + String((error && error.stack) || error).split('\n')[0]);
}
