/* ============================================================================
   913 từ đã học - flashcard một file
   Không phụ thuộc mạng, không thư viện ngoài. Dữ liệu nằm ngay trong file ở
   thẻ <script type="application/json" id="ca-data">.

   Cấu trúc:
     1. Tiện ích            6. Sinh câu hỏi
     2. Dữ liệu + trạng thái 7. Phiên học (engine)
     3. Lưu trữ (localStorage) 8. Giao diện (4 màn hình)
     4. Lặp lại ngắt quãng  9. Hộp thoại + bàn phím
     5. Chọn từ cho phiên  10. Khởi động
   ========================================================================== */
(function () {
  'use strict';

  /* ======================= 1. Tiện ích ======================= */

  var DAY = 86400000;
  var MINUTE = 60000;

  function txt(s) { return s == null ? '' : String(s); }

  /** Bỏ dấu tiếng Việt + hạ chữ thường để tìm kiếm không cần gõ dấu. */
  function normalize(text) {
    return txt(text)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  function lettersOnly(text) { return txt(text).toLowerCase().replace(/[^a-z]/g, ''); }

  function clamp(value, min, max) { return value < min ? min : (value > max ? max : value); }

  function pad2(value) { return value < 10 ? '0' + value : String(value); }

  function dateKey(time) {
    var d = new Date(time);
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }

  function startOfDay(time) {
    var d = new Date(time);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function shiftDay(time, days) { return startOfDay(time + days * DAY); }

  function formatDuration(ms) {
    var total = Math.max(0, Math.round(ms / 1000));
    var minutes = Math.floor(total / 60);
    var seconds = total % 60;
    if (minutes >= 60) {
      var hours = Math.floor(minutes / 60);
      return hours + ' giờ ' + pad2(minutes % 60) + ' phút';
    }
    return minutes + ':' + pad2(seconds);
  }

  function formatWhen(time, now) {
    var diff = now - time;
    if (diff < MINUTE) return 'vừa xong';
    if (diff < 60 * MINUTE) return Math.floor(diff / MINUTE) + ' phút trước';
    if (diff < 12 * 60 * MINUTE) return Math.floor(diff / (60 * MINUTE)) + ' giờ trước';
    var days = Math.round((startOfDay(now) - startOfDay(time)) / DAY);
    if (days <= 0) return 'hôm nay';
    if (days === 1) return 'hôm qua';
    if (days < 7) return days + ' ngày trước';
    var d = new Date(time);
    return d.getDate() + '/' + (d.getMonth() + 1) + '/' + d.getFullYear();
  }

  function formatInterval(days) {
    if (!days) return 'trong phiên';
    if (days < 1) return Math.max(1, Math.round(days * 24)) + ' giờ';
    if (days < 30) return Math.round(days) + ' ngày';
    return (days / 30).toFixed(days < 60 ? 1 : 0) + ' tháng';
  }

  function escapeHtml(text) {
    return txt(text).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }

  /** Nguồn ngẫu nhiên có hạt giống để câu hỏi tái lập được sau khi tải lại. */
  function createRng(seed) {
    var state = (seed >>> 0) || 1;
    return function () {
      state += 0x6D2B79F5;
      var t = state;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashString(text) {
    var hash = 2166136261;
    for (var i = 0; i < text.length; i += 1) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function shuffled(list, rng) {
    var copy = list.slice();
    for (var i = copy.length - 1; i > 0; i -= 1) {
      var j = Math.floor(rng() * (i + 1));
      var tmp = copy[i]; copy[i] = copy[j]; copy[j] = tmp;
    }
    return copy;
  }

  function pick(list, rng) { return list[Math.floor(rng() * list.length)]; }

  /** So khớp từng ký tự để chỉ ra lỗi gõ cụ thể. */
  function charDiff(expected, typed) {
    var want = normalize(expected).replace(/\s/g, '');
    var got = normalize(typed).replace(/\s/g, '');
    var grid = [];
    for (var i = 0; i <= want.length; i += 1) {
      grid.push(new Array(got.length + 1).fill(0));
      grid[i][0] = i;
    }
    for (var j = 0; j <= got.length; j += 1) grid[0][j] = j;
    for (var a = 1; a <= want.length; a += 1) {
      for (var b = 1; b <= got.length; b += 1) {
        var cost = want[a - 1] === got[b - 1] ? 0 : 1;
        grid[a][b] = Math.min(grid[a - 1][b] + 1, grid[a][b - 1] + 1, grid[a - 1][b - 1] + cost);
      }
    }
    var marks = [];
    var i2 = want.length;
    var j2 = got.length;
    while (i2 > 0 || j2 > 0) {
      if (i2 > 0 && j2 > 0 && want[i2 - 1] === got[j2 - 1]) {
        marks.unshift({ ch: txt(expected).replace(/\s/g, '')[i2 - 1], ok: true });
        i2 -= 1; j2 -= 1;
      } else if (i2 > 0 && (j2 === 0 || grid[i2][j2] === grid[i2 - 1][j2] + 1)) {
        marks.unshift({ ch: txt(expected).replace(/\s/g, '')[i2 - 1], ok: false, missing: true });
        i2 -= 1;
      } else if (j2 > 0 && (i2 === 0 || grid[i2][j2] === grid[i2][j2 - 1] + 1)) {
        marks.unshift({ ch: got[j2 - 1], ok: false, extra: true });
        j2 -= 1;
      } else {
        marks.unshift({ ch: txt(expected).replace(/\s/g, '')[i2 - 1], ok: false });
        i2 -= 1; j2 -= 1;
      }
    }
    var distance = grid[want.length][got.length];
    var similarity = want.length ? clamp(1 - distance / Math.max(want.length, got.length), 0, 1) : 0;
    return { marks: marks, distance: distance, similarity: similarity };
  }

  function pronouncedWord(word) {
    var lower = txt(word).toLowerCase();
    return lower.endsWith('s') && !lower.endsWith('ss') ? lower.slice(0, -1) : lower;
  }

  /* ======================= 2. Dữ liệu ======================= */

  var dataEl = document.getElementById('ca-data');
  var DATA = JSON.parse(dataEl ? dataEl.textContent : '{"meta":{},"entries":[]}');
  var META = DATA.meta || {};
  var ENTRIES = DATA.entries || [];
  var byId = {};
  var ALL_IDS = [];
  ENTRIES.forEach(function (entry) {
    byId[entry.id] = entry;
    ALL_IDS.push(entry.id);
  });

  var POS_LABEL = {
    n: 'danh từ', v: 'động từ', adj: 'tính từ', adv: 'trạng từ', conj: 'liên từ',
    'n/v': 'danh từ / động từ', 'v/n': 'động từ / danh từ', 'adj/n': 'tính từ / danh từ',
    'n/adj': 'danh từ / tính từ', 'adj/v': 'tính từ / động từ', idiom: 'thành ngữ',
    grammar: 'cấu trúc', phrase: 'cụm từ'
  };

  var TIER_LABEL = { 1: 'Trọng tâm', 2: 'Hay gặp', 3: 'Mở rộng' };
  var TIER_HINT = {
    1: 'Có họ từ / phân biệt kèm nguồn đề, hoặc xuất hiện ở 8 đề trở lên',
    2: 'Xuất hiện ở 3-7 đề trong kho đề',
    3: 'Các từ còn lại trong danh sách đã học'
  };
  var STATE_LABEL = {
    new: 'Từ mới', learning: 'Đang học', review: 'Cần ôn', weak: 'Từ yếu', mastered: 'Đã thuộc'
  };

  /* ======================= 3. Lưu trữ ======================= */

  var PREFIX = 'chuyen-anh.study.v1';
  var KEYS = {
    progress: PREFIX + '.progress',
    prefs: PREFIX + '.prefs',
    favorites: PREFIX + '.favorites',
    history: PREFIX + '.history',
    daily: PREFIX + '.daily',
    streak: PREFIX + '.streak',
    session: PREFIX + '.session'
  };

  var DEFAULT_PREFS = {
    theme: 'auto',
    size: 'md',
    rate: 0.9,
    autoSpeak: true,
    showIpa: true,
    showHints: true,
    sessionSize: 20,
    typedAnswers: false
  };

  function pickStorage() {
    try {
      var storage = window.localStorage;
      if (!storage) return null;
      var probe = PREFIX + '.probe';
      storage.setItem(probe, '1');
      storage.removeItem(probe);
      return storage;
    } catch (error) {
      return null;
    }
  }

  function createStore(storage, options) {
    var opts = options || {};
    var memory = {};
    var pending = {};
    var timer = null;
    var state = {
      progress: {},
      prefs: Object.assign({}, DEFAULT_PREFS),
      favorites: [],
      history: [],
      daily: {},
      streak: { current: 0, best: 0, last: '', days: [] },
      session: null
    };

    function readRaw(key) {
      try {
        if (storage) return storage.getItem(key);
      } catch (error) { /* rơi về bộ nhớ tạm */ }
      return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
    }

    function writeRaw(key, value) {
      memory[key] = value;
      try {
        if (storage) storage.setItem(key, value);
      } catch (error) { /* bộ nhớ tạm đã giữ bản sao */ }
    }

    function readJson(key, fallback) {
      var raw = readRaw(key);
      if (!raw) return fallback;
      try {
        var value = JSON.parse(raw);
        return value == null ? fallback : value;
      } catch (error) {
        return fallback;
      }
    }

    function schedule(key, value) {
      pending[key] = value;
      if (timer) return;
      timer = window.setTimeout(function () {
        timer = null;
        flush();
      }, opts.debounceMs == null ? 250 : opts.debounceMs);
    }

    function flush() {
      Object.keys(pending).forEach(function (key) {
        writeRaw(key, pending[key]);
        delete pending[key];
      });
      if (timer) { window.clearTimeout(timer); timer = null; }
    }

    function load() {
      state.progress = readJson(KEYS.progress, {});
      state.prefs = Object.assign({}, DEFAULT_PREFS, readJson(KEYS.prefs, {}));
      state.favorites = readJson(KEYS.favorites, []);
      state.history = readJson(KEYS.history, []);
      state.daily = readJson(KEYS.daily, {});
      state.streak = Object.assign({ current: 0, best: 0, last: '', days: [] }, readJson(KEYS.streak, {}));
      state.session = readJson(KEYS.session, null);
      if (!Array.isArray(state.favorites)) state.favorites = [];
      if (!Array.isArray(state.history)) state.history = [];
      return state;
    }

    function saveProgress() { schedule(KEYS.progress, JSON.stringify(state.progress)); }
    function savePrefs() { schedule(KEYS.prefs, JSON.stringify(state.prefs)); }
    function saveFavorites() { schedule(KEYS.favorites, JSON.stringify(state.favorites)); }
    function saveHistory() { schedule(KEYS.history, JSON.stringify(state.history.slice(0, 80))); }
    function saveDaily() { schedule(KEYS.daily, JSON.stringify(state.daily)); }
    function saveStreak() { schedule(KEYS.streak, JSON.stringify(state.streak)); }
    function saveSession() { schedule(KEYS.session, state.session ? JSON.stringify(state.session) : ''); }

    function recordOf(id) { return state.progress[id] || null; }

    function setRecord(id, record) {
      state.progress[id] = record;
      saveProgress();
      return record;
    }

    function updatePrefs(patch) {
      Object.assign(state.prefs, patch);
      savePrefs();
      return state.prefs;
    }

    function isFavorite(id) { return state.favorites.indexOf(id) !== -1; }

    function toggleFavorite(id) {
      var index = state.favorites.indexOf(id);
      if (index === -1) state.favorites.push(id); else state.favorites.splice(index, 1);
      saveFavorites();
      return index === -1;
    }

    function setFavorites(ids) {
      state.favorites = ids.slice();
      saveFavorites();
    }

    /** Ghi nhận một câu trả lời: tiến độ + nhật ký ngày + chuỗi ngày học. */
    function countAnswer(now, correct) {
      var key = dateKey(now);
      var day = state.daily[key] || { answered: 0, correct: 0, minutes: 0, sessions: 0 };
      day.answered += 1;
      if (correct) day.correct += 1;
      state.daily[key] = day;
      saveDaily();
      var last = state.streak.last;
      if (last !== key) {
        var yesterday = dateKey(now - DAY);
        state.streak.current = last === yesterday ? state.streak.current + 1 : 1;
        state.streak.last = key;
        if (state.streak.days.indexOf(key) === -1) {
          state.streak.days.push(key);
          state.streak.days = state.streak.days.slice(-400);
        }
        state.streak.best = Math.max(state.streak.best, state.streak.current);
        saveStreak();
      }
    }

    function recordSession(summary) {
      state.history.unshift(summary);
      state.history = state.history.slice(0, 60);
      saveHistory();
      var key = dateKey(summary.at);
      var day = state.daily[key] || { answered: 0, correct: 0, minutes: 0, sessions: 0 };
      day.sessions += 1;
      state.daily[key] = day;
      saveDaily();
    }

    function setSession(snapshot) {
      state.session = snapshot;
      saveSession();
    }

    function clearSession() {
      state.session = null;
      try {
        if (storage) storage.removeItem(KEYS.session);
      } catch (error) { /* bỏ qua */ }
      delete memory[KEYS.session];
      delete pending[KEYS.session];
    }

    function resetProgress() {
      state.progress = {};
      state.history = [];
      state.daily = {};
      state.streak = { current: 0, best: 0, last: '', days: [] };
      state.session = null;
      saveProgress(); saveHistory(); saveDaily(); saveStreak(); clearSession();
    }

    function resetAll() {
      resetProgress();
      state.favorites = [];
      state.prefs = Object.assign({}, DEFAULT_PREFS);
      saveFavorites(); savePrefs();
    }

    function exportBundle(now) {
      return {
        app: 'chuyen-anh-flashcards',
        v: 1,
        exportedAt: new Date(now).toISOString(),
        data: {
          progress: state.progress,
          prefs: state.prefs,
          favorites: state.favorites,
          history: state.history,
          daily: state.daily,
          streak: state.streak
        }
      };
    }

    function validateBundle(bundle) {
      if (!bundle || typeof bundle !== 'object') return 'Tệp không phải JSON hợp lệ.';
      if (bundle.app !== 'chuyen-anh-flashcards') return 'Tệp này không phải bản sao của ứng dụng flashcard.';
      if (bundle.v !== 1) return 'Phiên bản dữ liệu không được hỗ trợ (v' + txt(bundle.v) + ').';
      var payload = bundle.data;
      if (!payload || typeof payload !== 'object') return 'Thiếu phần data.';
      if (payload.progress && typeof payload.progress !== 'object') return 'Trường progress không hợp lệ.';
      if (payload.favorites && !Array.isArray(payload.favorites)) return 'Trường favorites không hợp lệ.';
      return null;
    }

    /** Trả về số bản ghi đã nhập, chỉ nhận các id có trong danh sách từ. */
    function applyBundle(bundle, mode) {
      var payload = bundle.data || {};
      var incoming = payload.progress || {};
      var accepted = 0;
      var next = mode === 'replace' ? {} : Object.assign({}, state.progress);
      Object.keys(incoming).forEach(function (id) {
        if (!byId[id] || !incoming[id] || typeof incoming[id] !== 'object') return;
        next[id] = incoming[id];
        accepted += 1;
      });
      state.progress = next;
      if (Array.isArray(payload.favorites)) {
        state.favorites = payload.favorites.filter(function (id) { return !!byId[id]; });
      }
      if (payload.prefs && typeof payload.prefs === 'object') {
        state.prefs = Object.assign({}, DEFAULT_PREFS, payload.prefs);
      }
      if (Array.isArray(payload.history)) state.history = payload.history.slice(0, 60);
      if (payload.daily && typeof payload.daily === 'object') state.daily = payload.daily;
      if (payload.streak && typeof payload.streak === 'object') {
        state.streak = Object.assign({ current: 0, best: 0, last: '', days: [] }, payload.streak);
      }
      saveProgress(); saveFavorites(); savePrefs(); saveHistory(); saveDaily(); saveStreak();
      return accepted;
    }

    /** Bảng tổng hợp dùng cho màn hình thống kê. */
    function summarize(now) {
      var counts = { new: 0, learning: 0, review: 0, weak: 0, mastered: 0 };
      var levels = {};
      var tiers = { 1: 0, 2: 0, 3: 0 };
      var due = 0;
      var seen = 0;
      var reviews = 0;
      var correct = 0;
      for (var i = 1; i <= 5; i += 1) levels[i] = 0;
      ENTRIES.forEach(function (entry) {
        var record = state.progress[entry.id];
        var stateName = SRS.stateOf(record, now);
        counts[stateName] += 1;
        tiers[entry.tier] = (tiers[entry.tier] || 0) + 1;
        if (record && record.n) {
          seen += 1;
          reviews += record.n;
          correct += record.c;
          levels[entry.level] = (levels[entry.level] || 0) + 1;
          if (record.due <= now) due += 1;
        } else if (entry.level) {
          levels[entry.level] = (levels[entry.level] || 0) + 1;
        }
      });
      var today = state.daily[dateKey(now)] || { answered: 0, correct: 0, minutes: 0, sessions: 0 };
      var total = ENTRIES.length;
      return {
        total: total,
        seen: seen,
        fresh: total - seen,
        due: due,
        counts: counts,
        levels: levels,
        tiers: tiers,
        reviews: reviews,
        correct: correct,
        accuracy: reviews ? correct / reviews : 0,
        masteredShare: total ? counts.mastered / total : 0,
        favorite: state.favorites.length,
        today: today,
        streak: state.streak,
        history: state.history,
        daily: state.daily
      };
    }

    load();
    return {
      state: state,
      keys: KEYS,
      prefix: PREFIX,
      hasStorage: !!storage,
      recordOf: recordOf,
      setRecord: setRecord,
      prefs: function () { return state.prefs; },
      updatePrefs: updatePrefs,
      favorites: function () { return state.favorites.slice(); },
      isFavorite: isFavorite,
      toggleFavorite: toggleFavorite,
      setFavorites: setFavorites,
      countAnswer: countAnswer,
      recordSession: recordSession,
      getSession: function () { return state.session; },
      setSession: setSession,
      clearSession: clearSession,
      resetProgress: resetProgress,
      resetAll: resetAll,
      exportBundle: exportBundle,
      validateBundle: validateBundle,
      applyBundle: applyBundle,
      summarize: summarize,
      flush: flush,
      daily: function () { return state.daily; },
      history: function () { return state.history; },
      streak: function () { return state.streak; },
      progress: function () { return state.progress; }
    };
  }

  /* ======================= 4. Lặp lại ngắt quãng ======================= */

  var SRS = {
    DAY: DAY,
    emptyRecord: function () {
      return { n: 0, c: 0, w: 0, streak: 0, ef: 2.5, ivl: 0, due: 0, last: 0, g: -1 };
    },
    /** grade 0..3: 0 quên, 1 khó, 2 được, 3 dễ. Trả về bản ghi mới. */
    schedule: function (record, grade, now) {
      var next = Object.assign({}, record || SRS.emptyRecord());
      next.n += 1;
      if (grade > 0) next.c += 1; else next.w += 1;
      next.last = now;
      next.g = grade;
      var interval = next.ivl || 0;
      if (grade <= 0) {
        next.streak = 0;
        next.ivl = 0;
        next.ef = clamp(next.ef - 0.2, 1.3, 2.9);
        next.due = now + MINUTE;
      } else if (grade === 1) {
        next.streak = 0;
        next.ivl = interval ? Math.max(0.5, interval * 1.2) : 0.5;
        next.ef = clamp(next.ef - 0.15, 1.3, 2.9);
        next.due = now + next.ivl * DAY;
      } else if (grade === 2) {
        next.streak += 1;
        next.ivl = interval ? interval * next.ef : 1;
        next.due = now + next.ivl * DAY;
      } else {
        next.streak += 1;
        next.ivl = interval ? interval * next.ef * 1.3 : 2.5;
        next.ef = clamp(next.ef + 0.1, 1.3, 2.9);
        next.due = now + next.ivl * DAY;
      }
      next.ivl = clamp(next.ivl, 0, 365);
      return next;
    },
    stateOf: function (record, now) {
      if (!record || !record.n) return 'new';
      if (record.ivl >= 21 && record.streak >= 4 && record.w * 3 <= record.c) return 'mastered';
      if (record.streak === 0 && record.w > 0) return 'weak';
      // Chưa có hai lượt đúng liên tiếp thì vẫn đang ở giai đoạn học.
      if (record.streak < 2 || record.ivl < 1) return 'learning';
      return 'review';
    },
    isDue: function (record, now) { return !!record && record.n > 0 && record.due <= now; }
  };

  /* ======================= 5. Chọn từ cho phiên ======================= */

  var STATES = ['new', 'learning', 'weak', 'review', 'mastered'];

  function comparePriority(a, b) {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.level !== b.level) return a.level - b.level;
    if (a.corpusFiles !== b.corpusFiles) return b.corpusFiles - a.corpusFiles;
    return a.word.localeCompare(b.word);
  }

  /** Xếp hạng từ cho một phiên học: đến hạn → từ yếu → từ mới → đang học → cần ôn. */
  function selectIds(options) {
    var opts = options || {};
    var now = opts.now == null ? Date.now() : opts.now;
    var size = opts.size == null ? 20 : opts.size;
    var rng = typeof opts.rng === 'function' ? opts.rng : createRng(hashString('seed' + now));
    var source = (opts.ids && opts.ids.length ? opts.ids : ALL_IDS)
      .map(function (id) { return byId[id]; })
      .filter(Boolean);
    if (opts.level && opts.level !== 'all') source = source.filter(function (e) { return String(e.level) === String(opts.level); });
    if (opts.tier && opts.tier !== 'all') source = source.filter(function (e) { return String(e.tier) === String(opts.tier); });
    if (opts.state && opts.state !== 'all') {
      source = source.filter(function (e) { return SRS.stateOf(store.recordOf(e.id), now) === opts.state; });
    }
    if (typeof opts.predicate === 'function') source = source.filter(opts.predicate);
    var buckets = { due: [], weak: [], fresh: [], learning: [], review: [] };
    source.forEach(function (entry) {
      var record = store.recordOf(entry.id);
      var state = SRS.stateOf(record, now);
      if (SRS.isDue(record, now)) buckets.due.push(entry);
      else if (state === 'weak') buckets.weak.push(entry);
      else if (state === 'new') buckets.fresh.push(entry);
      else if (state === 'learning') buckets.learning.push(entry);
      else buckets.review.push(entry);
    });
    Object.keys(buckets).forEach(function (key) {
      buckets[key] = shuffled(buckets[key], rng).sort(comparePriority);
    });
    var ordered = opts.shuffleAll
      ? shuffled(source, rng)
      : buckets.due.concat(buckets.weak, buckets.fresh, buckets.learning, buckets.review);
    return ordered.slice(0, Math.max(1, size)).map(function (entry) { return entry.id; });
  }

  /** Trộn câu hỏi cho chế độ "Trộn thông minh" theo trạng thái từng từ. */
  function smartKind(entry, record, now) {
    var state = SRS.stateOf(record, now);
    var hasCloze = !!(entry.cloze && entry.cloze.text);
    if (state === 'new') return entry.ipa && speechApi() ? 'listen' : 'en-vi';
    if (state === 'weak') return hasCloze ? 'cloze' : 'spell';
    if (state === 'learning') return hasCloze ? 'cloze' : (entry.ipa ? 'spell' : 'vi-en');
    if (state === 'mastered') return hasCloze ? 'cloze' : 'vi-en';
    return hasCloze ? 'cloze' : 'spell';
  }

  /* ======================= 6. Sinh câu hỏi ======================= */

  function distractorPool(entry, count, rng) {
    var pool = ENTRIES.filter(function (candidate) {
      return candidate.id !== entry.id && candidate.pos === entry.pos;
    });
    if (pool.length < count) {
      pool = pool.concat(ENTRIES.filter(function (candidate) {
        return candidate.id !== entry.id && candidate.pos !== entry.pos;
      }));
    }
    return shuffled(pool, rng).slice(0, count);
  }

  function buildOptions(correctText, others, rng) {
    var options = [{ text: correctText, correct: true }];
    others.forEach(function (text) { options.push({ text: text, correct: false }); });
    return shuffled(options, rng);
  }

  /**
   * Tạo câu hỏi cho một từ. Trả về:
   * { mode, kind, input: 'options'|'typing'|'flip', prompt, promptLang, options, answer, hint }
   */
  function makeQuestion(entry, mode, seed) {
    var rng = createRng(seed);
    var kind = mode;
    if (mode === 'smart') kind = smartKind(entry, store.recordOf(entry.id), Date.now());
    if (kind === 'listen' && !speechApi()) kind = 'en-vi';
    if (kind === 'cloze' && !(entry.cloze && entry.cloze.text)) kind = 'vi-en';
    var meaning = entry.meaning;
    var posLabel = POS_LABEL[entry.pos] || entry.pos;

    if (kind === 'flip') {
      return {
        mode: mode, kind: 'flip', input: 'flip', word: entry.word,
        prompt: entry.word, promptLang: 'en', answer: meaning,
        hint: 'Tự đánh giá sau khi lật thẻ.'
      };
    }
    if (kind === 'en-vi') {
      return {
        mode: mode, kind: 'en-vi', input: 'options', word: entry.word,
        prompt: entry.word, promptLang: 'en',
        options: buildOptions(meaning, distractorPool(entry, 3, rng).map(function (e) { return e.meaning; }), rng),
        answer: meaning,
        hint: 'Chọn nghĩa đúng của từ.'
      };
    }
    if (kind === 'vi-en') {
      var typing = kind === 'vi-en' && store.prefs().typedAnswers;
      var others = distractorPool(entry, 3, rng);
      return {
        mode: mode, kind: 'vi-en', input: typing ? 'typing' : 'options', word: entry.word,
        prompt: meaning, promptLang: 'vi', posLabel: posLabel,
        options: typing ? null : buildOptions(entry.word, others.map(function (e) { return e.word; }), rng),
        answer: entry.word,
        hint: typing ? 'Viết từ tiếng Anh tương ứng.' : 'Chọn từ tiếng Anh đúng.'
      };
    }
    if (kind === 'spell') {
      return {
        mode: mode, kind: 'spell', input: 'typing', word: entry.word,
        prompt: meaning, promptLang: 'vi', posLabel: posLabel,
        answer: entry.word,
        hint: 'Viết chính tả từ tiếng Anh (' + entry.word.replace(/[^A-Za-z]/g, '').length + ' chữ cái).'
      };
    }
    if (kind === 'cloze') {
      return {
        mode: mode, kind: 'cloze', input: 'typing', word: entry.word,
        prompt: entry.cloze.text, promptLang: 'en', posLabel: posLabel,
        answer: entry.cloze.answer, answerForm: entry.cloze.form,
        accept: [entry.cloze.answer, entry.word],
        hint: 'Điền từ còn thiếu: ' + meaning + '.',
        source: entry.ref
      };
    }
    if (kind === 'listen') {
      return {
        mode: mode, kind: 'listen', input: 'options', word: entry.word,
        prompt: '🔊 Nghe và chọn nghĩa đúng', promptLang: 'en', hideWord: true,
        options: buildOptions(meaning, distractorPool(entry, 3, rng).map(function (e) { return e.meaning; }), rng),
        answer: meaning,
        hint: 'Bấm loa (hoặc phím S) để nghe lại.'
      };
    }
    return {
      mode: 'en-vi', kind: 'en-vi', input: 'options', word: entry.word,
      prompt: entry.word, promptLang: 'en',
      options: buildOptions(meaning, distractorPool(entry, 3, rng).map(function (e) { return e.meaning; }), rng),
      answer: meaning, hint: 'Chọn nghĩa đúng.'
    };
  }

  /** Chấm câu trả lời tự luận; trả về mức đúng + điểm gợi ý 0..3. */
  function gradeTyped(question, typed, elapsedMs, usedHint) {
    var accepted = question.accept && question.accept.length ? question.accept : [question.answer];
    var best = null;
    accepted.forEach(function (candidate) {
      var diff = charDiff(candidate, typed);
      var exact = normalize(candidate) === normalize(typed);
      var near = diff.similarity >= 0.75 && lettersOnly(typed).length >= lettersOnly(candidate).length - 3;
      var score = { expected: candidate, diff: diff, exact: exact, near: near, similarity: diff.similarity };
      if (!best || (score.exact && !best.exact) || (!best.exact && score.similarity > best.similarity)) best = score;
    });
    var correct = !!best && best.exact;
    var grade = 0;
    if (correct) {
      grade = elapsedMs < 6000 ? 3 : (elapsedMs < 25000 ? 2 : 1);
      if (usedHint) grade = Math.min(grade, 1);
    }
    return {
      correct: correct,
      near: !correct && !!best && best.near,
      expected: best ? best.expected : question.answer,
      diff: best ? best.diff : charDiff(question.answer, typed),
      grade: grade,
      acceptedForm: question.answerForm && best && best.expected !== question.answerForm ? best.expected : ''
    };
  }

  function autoGrade(elapsedMs) {
    if (elapsedMs < 6000) return 3;
    if (elapsedMs < 25000) return 2;
    return 1;
  }

  /* ======================= 7. Phiên học ======================= */

  function createEngine(deps) {
    var options = deps || {};
    var store = options.store;
    var now = options.now || function () { return Date.now(); };
    var state = null;

    function cardSeed(seed, index, id) { return hashString(seed + '|' + index + '|' + id); }

    function buildCard(id, index) {
      var entry = byId[id];
      var question = makeQuestion(entry, state.mode, cardSeed(state.seed, index, id));
      return { id: id, index: index, question: question, phase: 'prompt', elapsed: 0, chosen: null, result: null, usedHint: false };
    }

    function save() {
      if (!state) return;
      store.setSession({
        kind: 'session',
        mode: state.mode,
        label: state.label,
        seed: state.seed,
        ids: state.ids,
        queue: state.queue,
        index: state.index,
        round: state.round,
        answers: state.answers,
        correct: state.correct,
        wrong: state.wrong,
        startedAt: state.startedAt
      });
    }

    function start(config) {
      var ids = (config.ids || []).filter(function (id) { return !!byId[id]; });
      if (!ids.length) return null;
      state = {
        mode: config.mode || 'en-vi',
        label: config.label || 'Phiên học',
        seed: config.seed == null ? hashString('s' + now() + ids.join(',')) : config.seed,
        ids: ids,
        queue: ids.slice(),
        index: 0,
        round: 0,
        answers: [],
        correct: 0,
        wrong: 0,
        startedAt: config.startedAt || now(),
        card: null,
        lastAdvanceAt: 0
      };
      state.card = buildCard(state.queue[0], 0);
      save();
      return state;
    }

    function restore() {
      var snapshot = store.getSession();
      if (!snapshot || !snapshot.ids || !snapshot.ids.length) return null;
      state = {
        mode: snapshot.mode,
        label: snapshot.label,
        seed: snapshot.seed,
        ids: snapshot.ids.filter(function (id) { return !!byId[id]; }),
        queue: (snapshot.queue || snapshot.ids).filter(function (id) { return !!byId[id]; }),
        index: snapshot.index || 0,
        round: snapshot.round || 0,
        answers: snapshot.answers || [],
        correct: snapshot.correct || 0,
        wrong: snapshot.wrong || 0,
        startedAt: snapshot.startedAt || now(),
        card: null,
        lastAdvanceAt: 0
      };
      if (!state.queue.length) return finish();
      if (state.index >= state.queue.length) state.index = state.queue.length - 1;
      state.card = buildCard(state.queue[state.index], state.index + state.round * 1000);
      var last = state.answers[state.answers.length - 1];
      if (last && last.id === state.card.id && last.round === state.round) {
        state.card.phase = 'answered';
        state.card.result = {
          correct: !!last.correct, near: !!last.near, expected: state.card.question.answer,
          grade: last.grade, ms: last.ms, hinted: !!last.hinted, typed: last.typed
        };
      }
      return state;
    }

    function current() { return state && state.card; }
    function currentEntry() { return state && state.card ? byId[state.card.id] : null; }
    function hasSession() { return !!state; }
    function progressData() {
      if (!state) return { answered: 0, total: 0, correct: 0, wrong: 0, index: 0, round: 0 };
      return {
        answered: state.answers.length,
        total: state.ids.length,
        correct: state.correct,
        wrong: state.wrong,
        index: state.index,
        queue: state.queue.length,
        round: state.round
      };
    }

    function animate() {
      var node = document.getElementById('card-stage');
      if (!node) return;
      var card = document.getElementById('card');
      if (!card) return;
      card.classList.remove('is-flipping');
      void card.offsetWidth;
      card.classList.add('is-flipping');
    }

    /** Người học tự chấm (chế độ thẻ tự do). */
    function gradeSelf(grade) {
      if (!state || !state.card) return null;
      var card = state.card;
      if (card.phase === 'answered') return null;
      var snapshot = {
        id: card.id, correct: grade > 0, grade: grade, ms: now() - (card.startedAt || now()),
        at: now(), round: state.round, hinted: false
      };
      return commit(snapshot);
    }

    /** Trả lời câu hỏi trắc nghiệm: index của lựa chọn đã chọn. */
    function answerOption(optionIndex) {
      if (!state || !state.card || state.card.phase !== 'prompt') return null;
      var card = state.card;
      var question = card.question;
      if (!question.options || !question.options[optionIndex]) return null;
      var chosen = question.options[optionIndex];
      var elapsed = now() - card.startedAt;
      var snapshot = {
        id: card.id, correct: !!chosen.correct, grade: chosen.correct ? autoGrade(elapsed) : 0,
        ms: elapsed, at: now(), round: state.round, hinted: false, chosen: optionIndex
      };
      card.chosen = optionIndex;
      return commit(snapshot);
    }

    /** Trả lời câu hỏi tự luận. */
    function answerText(text) {
      if (!state || !state.card || state.card.phase !== 'prompt') return null;
      var card = state.card;
      if (card.question.input !== 'typing') return null;
      var elapsed = now() - card.startedAt;
      var result = gradeTyped(card.question, text, elapsed, card.usedHint);
      card.result = result;
      var snapshot = {
        id: card.id, correct: result.correct, grade: result.grade, ms: elapsed,
        at: now(), round: state.round, hinted: card.usedHint, typed: text,
        near: result.near, diff: result.diff, expected: result.expected
      };
      return commit(snapshot, result);
    }

    /** Lật thẻ / hiện đáp án mà không chấm điểm (chế độ thẻ tự do). */
    function reveal() {
      if (!state || !state.card) return null;
      if (state.card.phase === 'prompt') state.card.phase = 'revealed';
      animate();
      return state.card;
    }

    function markHint() {
      if (state && state.card) state.card.usedHint = true;
    }

    function commit(snapshot, result) {
      var card = state.card;
      var record = store.recordOf(card.id) || SRS.emptyRecord();
      store.setRecord(card.id, SRS.schedule(record, snapshot.grade, snapshot.at));
      store.countAnswer(snapshot.at, snapshot.correct);
      state.answers.push(snapshot);
      if (snapshot.correct) state.correct += 1; else state.wrong += 1;
      card.phase = 'answered';
      if (!card.result || card.result === result) {
        card.result = Object.assign({ correct: snapshot.correct, expected: card.question.answer }, result || {});
      }
      card.result.diff = snapshot.diff || card.result.diff;
      card.result.typed = snapshot.typed != null ? snapshot.typed : card.result.typed;
      card.result.near = snapshot.near || card.result.near;
      card.result.grade = snapshot.grade;
      card.result.ms = snapshot.ms;
      card.result.hinted = snapshot.hinted;
      card.result.correct = snapshot.correct;
      card.result.expected = card.result.expected || card.question.answer;
      card.result.near = !!card.result.near;
      save();
      return card.result;
    }

    /**
     * Sang thẻ kế tiếp. Trả về true nếu còn thẻ, false nếu đã hết thẻ -
     * lúc đó người gọi cần gọi finish() để lấy tổng kết và đóng phiên.
     */
    function advance() {
      if (!state || !state.card) return false;
      if (state.card.phase !== 'answered') return true;
      state.index += 1;
      if (state.index >= state.queue.length) {
        var requeue = state.answers
          .filter(function (answer) { return !answer.correct && !answer.requeued && answer.round === state.round; })
          .map(function (answer) { return answer.id; });
        if (requeue.length && state.round < 2) {
          requeue.forEach(function (id) {
            state.answers.forEach(function (answer) {
              if (answer.id === id && !answer.requeued) answer.requeued = true;
            });
          });
          state.round += 1;
          state.queue = shuffled(requeue, createRng(state.seed + state.round));
          state.index = 0;
        } else {
          return false;
        }
      }
      state.card = buildCard(state.queue[state.index], state.index + state.round * 1000);
      save();
      return true;
    }

    /** Bỏ qua thẻ hiện tại (không tính vào tiến độ). */
    /** Bỏ qua thẻ hiện tại: không tính là đã trả lời, từ vẫn giữ nguyên trạng thái. */
    function skip() {
      if (!state || !state.card) return false;
      state.index += 1;
      if (state.index >= state.queue.length) { state.index = state.queue.length; return false; }
      state.card = buildCard(state.queue[state.index], state.index + state.round * 1000);
      save();
      return true;
    }

    function summary() {
      if (!state) return null;
      var answered = state.answers.filter(function (answer) { return !answer.skipped; });
      var correct = answered.filter(function (answer) { return answer.correct; }).length;
      var wrongIds = answered.filter(function (answer) { return !answer.correct; })
        .map(function (answer) { return answer.id; })
        .filter(function (id, position, list) { return list.indexOf(id) === position; });
      return {
        kind: 'session',
        mode: state.mode,
        label: state.label,
        size: state.ids.length,
        answered: answered.length,
        correct: correct,
        wrong: answered.length - correct,
        skipped: state.ids.length - answered.length,
        accuracy: answered.length ? correct / answered.length : 0,
        durationMs: now() - state.startedAt,
        at: now(),
        wrongIds: wrongIds
      };
    }

    function finish() {
      var result = summary();
      if (result && result.answered) store.recordSession(result);
      state = null;
      store.clearSession();
      return result;
    }

    function cancel() {
      state = null;
      store.clearSession();
    }

    function snapshot() { return store.getSession(); }

    return {
      start: start, restore: restore, current: current, currentEntry: currentEntry,
      hasSession: hasSession, progress: progressData, reveal: reveal, markHint: markHint,
      gradeSelf: gradeSelf, answerOption: answerOption, answerText: answerText,
      advance: advance, skip: skip, summary: summary, finish: finish, cancel: cancel,
      snapshot: snapshot,
      getState: function () { return state; }
    };
  }

  /* ======================= 8. Giao diện ======================= */

  function speechApi() {
    if (!window.speechSynthesis || !window.SpeechSynthesisUtterance) return null;
    var cache = null;
    return {
      speak: function (text, rate) {
        try {
          window.speechSynthesis.cancel();
          var utterance = new window.SpeechSynthesisUtterance(text);
          utterance.lang = 'en-US';
          utterance.rate = rate || 0.9;
          window.speechSynthesis.speak(utterance);
          return true;
        } catch (error) {
          return false;
        }
      },
      available: function () {
        if (cache == null) {
          try {
            cache = typeof window.speechSynthesis.getVoices === 'function'
              ? window.speechSynthesis.getVoices().length >= 0 : true;
          } catch (error) {
            cache = true;
          }
        }
        return cache;
      }
    };
  }

  function $(selector, root) { return (root || document).querySelector(selector); }
  function $$(selector, root) { return Array.prototype.slice.call((root || document).querySelectorAll(selector)); }
  function on(node, type, handler, opts) { if (node) node.addEventListener(type, handler, opts); return node; }
  function make(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }
  function cloneTemplate(id) {
    var template = document.getElementById(id);
    if (!template) return null;
    return template.content.firstElementChild.cloneNode(true);
  }
  function setText(node, value) { if (node) node.textContent = txt(value); }
  function reveal(node, visible) { if (node) node.hidden = !visible; }

  var THEME_QUERY = window.matchMedia ? window.matchMedia('(prefers-color-scheme: light)') : null;
  var prefersReduce = function () {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  };

  var store = createStore(pickStorage(), { debounceMs: 200 });
  var tts = speechApi();
  var engine = createEngine({ store: store, now: function () { return Date.now(); } });

  var app = {
    view: 'home',
    focusId: null,
    expandedId: null,
    browse: { query: '', state: 'all', level: 'all', tier: 'all', sort: 'az', results: [], rendered: 0, ids: [] },
    typedFor: null,
    timer: null,
    modal: null,
    lastFocus: null,
    summary: null
  };

  function announce(message) {
    var live = document.getElementById('sr-live');
    if (!live) return;
    live.textContent = '';
    window.setTimeout(function () { live.textContent = message; }, 30);
  }

  function toast(message, kind) {
    var host = document.getElementById('toast-host');
    if (!host) return;
    var node = make('div', 'toast' + (kind ? ' ' + kind : ''), message);
    host.appendChild(node);
    window.setTimeout(function () {
      node.style.opacity = '0';
      window.setTimeout(function () { if (node.parentNode) node.parentNode.removeChild(node); }, 220);
    }, 2600);
  }

  /* ---------- chủ đề, cỡ chữ ---------- */

  function applyPrefs() {
    var prefs = store.prefs();
    var theme = prefs.theme;
    var resolved = theme;
    if (theme === 'auto') resolved = THEME_QUERY && THEME_QUERY.matches ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', resolved);
    document.documentElement.setAttribute('data-theme-pref', theme);
    document.documentElement.style.setProperty('--scale', prefs.size === 'sm' ? '0.92' : (prefs.size === 'lg' ? '1.12' : '1'));
    setText(document.getElementById('btn-theme-icon'), resolved === 'light' ? '🌙' : '☀️');
  }

  function toggleTheme() {
    var prefs = store.prefs();
    var next = prefs.theme === 'dark' ? 'light' : (prefs.theme === 'light' ? 'auto' : 'dark');
    store.updatePrefs({ theme: next });
    applyPrefs();
    toast(next === 'auto' ? 'Chủ đề: theo hệ thống' : (next === 'light' ? 'Chủ đề sáng' : 'Chủ đề tối'));
  }

  /* ---------- điều hướng ---------- */

  var VIEWS = ['home', 'study', 'browse', 'stats'];

  function showView(name, opts) {
    if (VIEWS.indexOf(name) === -1) name = 'home';
    app.view = name;
    VIEWS.forEach(function (view) {
      var node = document.getElementById('view-' + view);
      if (node) node.classList.toggle('is-active', view === name);
      var tab = document.getElementById('nav-' + view);
      if (tab) tab.setAttribute('aria-selected', view === name ? 'true' : 'false');
    });
    if (window.location.hash !== '#/' + name) {
      window.location.hash = '#/' + name;
    }
    var heading = document.getElementById('view-' + name + '-title');
    if (heading && opts && opts.focus) {
      heading.setAttribute('tabindex', '-1');
      heading.focus({ preventScroll: true });
    }
    announce((heading ? heading.textContent : name) + ' - đã mở');
  }

  function renderAll() {
    applyPrefs();
    renderChrome();
    renderHome();
    renderBrowse();
    renderStats();
    renderStudy();
  }

  /* ---------- thanh trên ---------- */

  function renderChrome() {
    var stats = store.summarize(Date.now());
    setText($('#pill-due'), stats.due);
    setText($('#pill-weak'), stats.counts.weak);
    setText($('#pill-streak'), stats.streak.current);
    setText($('#pill-today'), stats.today.answered);
    setText($('#pill-mastered'), stats.counts.mastered);
    var ring = $('#header-ring');
    if (ring) ring.style.setProperty('--pct', Math.round(stats.masteredShare * 100));
    setText($('#header-ring-label'), Math.round(stats.masteredShare * 100) + '%');
  }

  /* ---------- màn hình chủ ---------- */

  function greeting(now) {
    var hour = new Date(now).getHours();
    if (hour < 11) return 'Chào buổi sáng';
    if (hour < 14) return 'Chào buổi trưa';
    if (hour < 18) return 'Chào buổi chiều';
    return 'Chào buổi tối';
  }

  var MODES = [
    { id: 'smart', icon: '🧠', name: 'Trộn thông minh', desc: 'Trộn nhiều dạng câu theo trạng thái từng từ' },
    { id: 'en-vi', icon: '🇬🇧', name: 'Anh → Việt', desc: 'Nhìn từ, chọn nghĩa tiếng Việt' },
    { id: 'vi-en', icon: '🇻🇳', name: 'Việt → Anh', desc: 'Nhìn nghĩa, chọn từ tiếng Anh' },
    { id: 'spell', icon: '⌨️', name: 'Viết chính tả', desc: 'Tự viết lại từ tiếng Anh' },
    { id: 'cloze', icon: '🧩', name: 'Điền vào câu', desc: 'Điền từ vào câu trong đề thi' },
    { id: 'listen', icon: '🔊', name: 'Nghe – chọn nghĩa', desc: 'Nghe phát âm rồi chọn nghĩa' },
    { id: 'flip', icon: '🃏', name: 'Thẻ tự do', desc: 'Lật thẻ và tự đánh giá' }
  ];

  /** Từ nào mới luyện được bằng chế độ này? (điền từ cần câu ngữ cảnh trong đề) */
  function modePredicate(modeId) {
    if (modeId === 'cloze') {
      return function (entry) { return !!(entry.cloze && entry.cloze.text); };
    }
    return null;
  }

  function modeAvailable(mode) {
    if (mode.id === 'listen' && !tts) return false;
    if (mode.id === 'cloze' && !META.cloze) return false;
    return true;
  }

  function sessionSize() { return Number(store.prefs().sessionSize) || 20; }

  function startSession(modeId, ids, label) {
    var pool = ids && ids.length ? ids.slice() : selectIds({
      size: sessionSize(), now: Date.now(), rng: createRng(hashString('start' + Date.now() + modeId)),
      predicate: modePredicate(modeId)
    });
    if (!ids && modeId === 'cloze' && !pool.length) {
      pool = selectIds({ size: sessionSize(), now: Date.now(), rng: createRng(hashString('fallback' + Date.now())) });
    }
    if (!pool.length) {
      toast('Không có từ nào phù hợp để học.', 'bad');
      return false;
    }
    var mode = MODES.filter(function (item) { return item.id === modeId; })[0] || MODES[1];
    engine.start({ ids: pool, mode: modeId, label: label || mode.name });
    app.summary = null;
    showView('study', { focus: true });
    renderStudy();
    announce('Bắt đầu ' + (label || mode.name) + ' với ' + pool.length + ' từ');
    return true;
  }

  function sizeOptions() {
    var select = $('#size-select');
    if (!select) return;
    var sizes = [10, 20, 30, 50];
    select.textContent = '';
    sizes.forEach(function (size) {
      var option = make('option', null, size + ' từ');
      option.value = String(size);
      if (size === sessionSize()) option.selected = true;
      select.appendChild(option);
    });
  }

  function renderHome() {
    var now = Date.now();
    var stats = store.summarize(now);
    setText($('#home-greeting'), greeting(now) + '!');
    setText($('#home-subtitle'), stats.fresh
      ? 'Còn ' + stats.fresh + ' từ chưa gặp trong tổng số ' + stats.total + ' từ đã học.'
      : 'Bạn đã gặp đủ ' + stats.total + ' từ. Giờ là lúc ôn cho chắc.');

    setText($('#plan-due'), stats.due);
    setText($('#plan-weak'), stats.counts.weak);
    setText($('#plan-fresh'), stats.fresh);
    setText($('#plan-mastered'), stats.counts.mastered);
    setText($('#plan-today'), stats.today.answered + ' câu · ' + Math.round((stats.today.correct / (stats.today.answered || 1)) * 100) + '% đúng');

    var resume = $('#resume-card');
    var snapshot = store.getSession();
    if (snapshot && snapshot.ids && snapshot.ids.length) {
      reveal(resume, true);
      setText($('#resume-text'), snapshot.label + ' · đã trả lời ' + (snapshot.answers || []).length + '/' + snapshot.ids.length + ' từ');
    } else {
      reveal(resume, false);
    }

    var grid = $('#mode-cards');
    if (grid && !grid.dataset.ready) {
      MODES.forEach(function (mode) {
        var node = cloneTemplate('tpl-mode-card');
        if (!node) return;
        node.dataset.mode = mode.id;
        setText($('.mode-icon', node), mode.icon);
        setText($('.mode-name', node), mode.name);
        setText($('.mode-desc', node), mode.desc);
        if (!modeAvailable(mode)) {
          node.disabled = true;
          setText($('.mode-meta', node), 'Không hỗ trợ trong trình duyệt này');
        } else if (mode.id === 'cloze') {
          setText($('.mode-meta', node), META.cloze + ' câu điền từ có sẵn');
        } else if (mode.id === 'listen') {
          setText($('.mode-meta', node), 'Dùng giọng đọc của trình duyệt');
        }
        node.addEventListener('click', function () { startSession(mode.id, null, mode.name); });
        grid.appendChild(node);
      });
      grid.dataset.ready = '1';
    }

    sizeOptions();
    renderLevelChips();
    renderBrowseFilters(stats);
    renderWordOfDay(now, stats);
    renderRecent(now);
  }

  /** Gợi ý lọc nhanh theo mức ưu tiên và độ khó. */
  function renderLevelChips() {
    var host = $('#home-levels');
    if (!host || host.dataset.ready) return;
    var counts = META.levelCounts || {};
    for (var level = 1; level <= 5; level += 1) {
      var chip = make('button', 'chip lv-' + level, 'Mức ' + level + ' (' + (counts[level] || 0) + ')');
      chip.type = 'button';
      chip.dataset.level = String(level);
      chip.addEventListener('click', function () {
        var value = this.dataset.level;
        var active = this.classList.toggle('is-on');
        $$('#home-levels .chip').forEach(function (other) { if (other !== chip) other.classList.remove('is-on'); });
        app.homeLevel = active ? value : 'all';
        startSession('smart', selectIds({ level: app.homeLevel, size: sessionSize(), now: Date.now() }), 'Mức ' + value);
      });
      host.appendChild(chip);
    }
  }

  function renderWordOfDay(now, stats) {
    var host = $('#wotd');
    if (!host) return;
    var pool = ENTRIES.filter(function (entry) { return entry.tier === 1; });
    if (!pool.length) pool = ENTRIES;
    var index = Math.abs(hashString(dateKey(now))) % pool.length;
    var entry = pool[index];
    setText($('#wotd-word'), entry.word);
    setText($('#wotd-meaning'), entry.meaning);
    var meta = 'Mức ' + entry.level + ' · ' + (POS_LABEL[entry.pos] || entry.pos);
    if (entry.ipa) meta += ' · ' + entry.ipa;
    if (entry.corpusFiles) meta += ' · ' + entry.corpusFiles + ' đề';
    setText($('#wotd-meta'), meta);
    host.dataset.id = entry.id;
    reveal($('#wotd'), true);
  }

  function renderRecent(now) {
    var host = $('#home-recent');
    if (!host) return;
    var stats = store.summarize(now);
    host.textContent = '';
    var records = Object.keys(store.progress()).map(function (id) {
      var record = store.progress()[id];
      return { id: id, record: record };
    }).filter(function (item) {
      return byId[item.id] && item.record && item.record.last;
    }).sort(function (a, b) { return b.record.last - a.record.last; }).slice(0, 6);
    if (!records.length) {
      var empty = make('li', 'hint', 'Chưa có từ nào được học. Bắt đầu một phiên để lưu tiến độ.');
      host.appendChild(empty);
      return;
    }
    records.forEach(function (item) {
      var entry = byId[item.id];
      var row = make('li');
      var button = make('button', 'btn small ghost');
      button.type = 'button';
      button.appendChild(make('b', null, entry.word));
      button.appendChild(make('span', null, ' · ' + STATE_LABEL[SRS.stateOf(item.record, now)] + ' · ' + formatWhen(item.record.last, now)));
      button.addEventListener('click', function () { openWord(entry.id); });
      row.appendChild(button);
      host.appendChild(row);
    });
  }

  /* ---------- màn hình học ---------- */

  function renderStudy() {
    var card = engine.current();
    var summary = $('#summary');
    var stage = $('#card-stage');
    if (!card) {
      if (app.summary) {
        reveal(summary, true);
        reveal(stage, false);
        renderSummary(app.summary);
      } else {
        reveal(summary, false);
        reveal(stage, true);
        renderStudyEmpty();
      }
      return;
    }
    reveal(summary, false);
    reveal(stage, true);
    renderCard(card);
    renderStudyBar();
  }

  function renderStudyEmpty() {
    setText($('#card-word'), 'Sẵn sàng học?');
    setText($('#card-prompt'), 'Chọn một chế độ ở trang chủ, hoặc bắt đầu phiên trộn thông minh.');
    var options = $('#options');
    var answerRow = $('#answer-row');
    var gradeRow = $('#grade-row');
    if (options) options.textContent = '';
    if (answerRow) reveal(answerRow, false);
    if (gradeRow) reveal(gradeRow, false);
    var feedback = $('#feedback');
    if (feedback) { feedback.hidden = true; feedback.textContent = ''; }
    var start = $('#card-start');
    reveal(start, true);
    reveal($('#card-answer'), false);
    setText($('#card-hint'), 'Mẹo: bấm ? để xem phím tắt.');
  }

  function renderStudyBar() {
    var progress = engine.progress();
    var total = Math.max(1, progress.total);
    var done = Math.min(progress.total, progress.answered);
    var bar = $('#study-progress span');
    if (bar) bar.style.width = Math.round((done / total) * 100) + '%';
    setText($('#study-count'), done + '/' + progress.total);
    var accuracy = progress.answered ? Math.round((progress.correct / progress.answered) * 100) : 0;
    setText($('#study-accuracy'), accuracy + '% đúng');
    setText($('#study-mode-label'), (engine.getState() ? engine.getState().label : '') +
      (progress.round ? ' · vòng ' + (progress.round + 1) : ''));
  }

  function renderCard(card) {
    var entry = byId[card.id];
    var question = card.question;
    var record = store.recordOf(entry.id);
    var stateName = SRS.stateOf(record, Date.now());
    var prefs = store.prefs();

    reveal($('#card-start'), false);
    renderTags(entry, stateName);

    var wordNode = $('#card-word');
    wordNode.classList.toggle('small', question.kind === 'cloze' || question.kind === 'listen');
    if (question.hideWord) {
      setText(wordNode, '🔊');
      wordNode.setAttribute('aria-label', 'Nghe từ rồi chọn nghĩa');
    } else {
      setText(wordNode, question.promptLang === 'vi' ? entry.word : question.prompt);
      wordNode.removeAttribute('aria-label');
    }

    var ipaNode = $('#card-ipa');
    if (prefs.showIpa && entry.ipa && !question.hideWord && question.promptLang !== 'vi') {
      reveal(ipaNode, true);
      setText(ipaNode, entry.ipa);
    } else {
      reveal(ipaNode, false);
    }

    var promptNode = $('#card-prompt');
    promptNode.classList.toggle('sentence', question.kind === 'cloze' || question.promptLang === 'vi');
    if (question.kind === 'cloze') {
      promptNode.innerHTML = '';
      String(question.prompt).split('_____').forEach(function (part, index) {
        if (index) promptNode.appendChild(make('span', 'blank', '_____'));
        promptNode.appendChild(document.createTextNode(part));
      });
    } else {
      setText(promptNode, question.prompt);
    }

    setText($('#card-hint'), prefs.showHints ? question.hint : '');
    setText($('#card-pos'), POS_LABEL[entry.pos] || entry.pos);

    var speakBtn = $('#card-speak');
    reveal(speakBtn, !!tts);
    var speakText = question.kind === 'cloze' ? pronouncedWord(entry.word) : entry.word;
    speakBtn.onclick = function () { speakWord(speakText); };

    var hintBtn = $('#card-hint-btn');
    if (hintBtn) hintBtn.hidden = !(question.input === 'typing' && card.phase === 'prompt');
    hintBtn.onclick = function () { useHint(entry); };

    var favBtn = $('#btn-fav');
    favBtn.textContent = store.isFavorite(entry.id) ? '★ Đã đánh dấu' : '☆ Đánh dấu';
    favBtn.classList.toggle('primary', store.isFavorite(entry.id));

    renderOptions(card);
    renderTyping(card);
    renderAnswerPanel(card, entry);
    renderGrades(card, entry);
    var exit = $('#btn-exit');
    if (exit) exit.textContent = 'Thoát';
  }

  function renderTags(entry, stateName) {
    var host = $('#card-tags');
    if (!host) return;
    host.textContent = '';
    var tags = [
      { text: TIER_LABEL[entry.tier], cls: 'tag tier-' + entry.tier, title: TIER_HINT[entry.tier] },
      { text: STATE_LABEL[stateName], cls: 'tag state-' + stateName },
      { text: 'Mức ' + entry.level, cls: 'tag' },
      { text: POS_LABEL[entry.pos] || entry.pos, cls: 'tag' }
    ];
    if (entry.corpusFiles) tags.push({ text: entry.corpusFiles + ' đề', cls: 'tag', title: META.notes && META.notes.corpus });
    if (store.isFavorite(entry.id)) tags.push({ text: '★', cls: 'tag' });
    tags.forEach(function (tag) {
      var node = make('span', tag.cls, tag.text);
      if (tag.title) node.title = tag.title;
      host.appendChild(node);
    });
  }

  function renderOptions(card) {
    var host = $('#options');
    if (!host) return;
    host.textContent = '';
    var question = card.question;
    if (question.input !== 'options' || !question.options) return;
    var answered = card.phase !== 'prompt';
    question.options.forEach(function (option, index) {
      var node = cloneTemplate('tpl-option') || make('button', 'option');
      node.querySelector('.key').textContent = String(index + 1);
      node.querySelector('.opt-text').textContent = option.text;
      node.dataset.index = String(index);
      node.disabled = answered;
      if (answered) {
        if (option.correct) node.classList.add('is-correct');
        if (card.chosen === index && !option.correct) node.classList.add('is-wrong');
      }
      node.addEventListener('click', function () { chooseOption(index); });
      host.appendChild(node);
    });
  }

  function renderTyping(card) {
    var row = $('#answer-row');
    var input = $('#answer-input');
    if (!row || !input) return;
    var question = card.question;
    var showTyping = question.input === 'typing' && card.phase === 'prompt';
    reveal(row, question.input === 'typing');
    input.disabled = card.phase !== 'prompt';
    if (app.typedFor !== card.id) {
      // Mỗi thẻ có ô nhập riêng, không giữ lại chữ của thẻ trước.
      input.value = '';
      app.typedFor = card.id;
    }
    if (card.phase !== 'prompt' && card.result && card.result.typed != null) input.value = card.result.typed;
    input.placeholder = question.kind === 'cloze' ? 'Điền từ còn thiếu…' : 'Viết từ tiếng Anh…';
    if (card.phase === 'prompt' && showTyping && document.activeElement !== input) {
      window.setTimeout(function () { input.focus({ preventScroll: true }); }, 30);
    }
  }

  function renderAnswerPanel(card, entry) {
    var panel = $('#card-answer');
    var revealed = card.phase !== 'prompt';
    if (!revealed) {
      reveal(panel, false);
      panel.textContent = '';
      return;
    }
    reveal(panel, true);
    panel.textContent = '';
    var question = card.question;
    var result = card.result || {};

    panel.appendChild(make('div', 'label', 'Đáp án'));
    panel.appendChild(make('div', 'value', question.answer));

    var feedback = $('#feedback');
    feedback.hidden = false;
    feedback.className = 'feedback ' + (card.phase === 'answered' && result.correct ? 'good' : (result.near ? 'near' : 'bad'));
    feedback.textContent = '';
    if (result.correct) {
      feedback.appendChild(make('span', null, '✅ Chính xác'));
      if (result.hinted) feedback.appendChild(make('span', 'card-note', '(có dùng gợi ý)'));
      if (result.typed != null && card.question.input === 'typing') feedback.appendChild(renderDiff(result.diff));
    } else if (result.diff) {
      feedback.appendChild(make('span', null, result.near ? '≈ Gần đúng: ' : '❌ Chưa đúng: '));
      feedback.appendChild(renderDiff(result.diff));
    } else {
      feedback.appendChild(make('span', null, '❌ Chưa đúng'));
      var chosen = card.question.options && card.chosen != null ? card.question.options[card.chosen] : null;
      if (chosen) feedback.appendChild(make('span', 'card-note', 'bạn chọn: ' + chosen.text));
    }
    if (result.acceptedForm) {
      feedback.appendChild(make('span', 'card-note', 'dạng khác của từ trong câu: ' + result.acceptedForm));
    }

    var detail = make('div', 'card-answer');
    detail.appendChild(make('div', 'label', 'Nghĩa'));
    detail.appendChild(make('div', 'value', entry.meaning));
    if (entry.documented) {
      if (entry.example) {
        detail.appendChild(make('div', 'label', 'Câu trong đề'));
        var example = make('div', 'value sentence');
        example.appendChild(highlightForm(entry.example, entry.exampleForm || entry.word));
        detail.appendChild(example);
      }
      if (entry.family) {
        detail.appendChild(make('div', 'label', 'Họ từ'));
        detail.appendChild(make('div', 'value', entry.family));
      }
      if (entry.distinction) {
        detail.appendChild(make('div', 'label', 'Phân biệt'));
        detail.appendChild(make('div', 'value', entry.distinction));
      }
    }
    if (entry.ref) {
      var source = make('div', 'card-note');
      var link = make('a', null, entry.ref.path.replace('De-chuyen-Anh-vao-10/', '') + ':' + entry.ref.line);
      link.href = entry.ref.url;
      link.target = '_blank';
      link.rel = 'noopener';
      source.appendChild(document.createTextNode('Nguồn: '));
      source.appendChild(link);
      detail.appendChild(source);
    }
    panel.appendChild(detail);
  }

  function renderDiff(diff) {
    var span = make('span', 'spell-letter');
    (diff.marks || []).forEach(function (mark) {
      var node = make('span', 'spell-letter ' + (mark.ok ? 'ok' : (mark.missing ? 'missing' : 'bad')), mark.ch);
      span.appendChild(node);
    });
    return span;
  }

  function highlightForm(text, form) {
    var fragment = document.createDocumentFragment();
    if (!form) { fragment.appendChild(document.createTextNode(text)); return fragment; }
    var pattern = new RegExp('(?<![\\w-])' + form.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![\\w-])', 'i');
    var match = pattern.exec(text);
    if (!match) { fragment.appendChild(document.createTextNode(text)); return fragment; }
    fragment.appendChild(document.createTextNode(text.slice(0, match.index)));
    fragment.appendChild(make('b', null, match[0]));
    fragment.appendChild(document.createTextNode(text.slice(match.index + match[0].length)));
    return fragment;
  }

  function renderGrades(card, entry) {
    var row = $('#grade-row');
    var isFlip = card.question.input === 'flip';
    reveal($('#flip-btn'), isFlip && card.phase === 'prompt');
    if (!row) return;
    reveal(row, card.phase === 'revealed' && isFlip);
    var nextRow = $('#next-row');
    if (nextRow) reveal(nextRow, card.phase === 'answered' || (card.phase === 'revealed' && !isFlip));
  }

  function renderSummary(summary) {
    setText($('#summary-title'), 'Hoàn thành: ' + summary.label);
    setText($('#summary-sub'), 'Bạn đã trả lời ' + summary.answered + ' lượt trong ' + formatDuration(summary.durationMs) + '.');
    var grid = $('#summary-grid');
    grid.textContent = '';
    [
      ['Chính xác', Math.round(summary.accuracy * 100) + '%'],
      ['Đúng', summary.correct],
      ['Sai', summary.wrong],
      ['Bỏ qua', summary.skipped],
      ['Số từ', summary.size],
      ['Thời gian', formatDuration(summary.durationMs)]
    ].forEach(function (pair) {
      var cell = make('div', 'cell');
      cell.appendChild(make('b', null, pair[1]));
      cell.appendChild(make('span', null, pair[0]));
      grid.appendChild(cell);
    });
    var weak = $('#summary-weak');
    var ids = summary.wrongIds || [];
    weak.textContent = '';
    if (ids.length) {
      weak.appendChild(make('p', 'hint', 'Cần ôn lại: ' + ids.length + ' từ'));
      var list = make('ul', 'chip-row');
      ids.slice(0, 14).forEach(function (id) {
        var chip = make('li', 'chip', byId[id] ? byId[id].word : id);
        list.appendChild(chip);
      });
      weak.appendChild(list);
    } else {
      weak.appendChild(make('p', 'hint', 'Không có từ nào sai trong phiên này. Tuyệt!'));
    }
  }

  function chooseOption(index) {
    var card = engine.current();
    if (!card || card.phase !== 'prompt' || card.question.input !== 'options') return;
    engine.answerOption(index);
    afterAnswer();
  }

  function submitTyped() {
    var card = engine.current();
    var input = $('#answer-input');
    if (!card || !input || card.phase !== 'prompt') return;
    if (!input.value.trim()) {
      // Enter hai lần liên tiếp không được tính là trả lời sai.
      input.focus({ preventScroll: true });
      toast('Hãy viết câu trả lời trước khi kiểm tra.');
      return;
    }
    engine.answerText(input.value);
    afterAnswer();
  }

  function speakWord(word) {
    if (!tts) { toast('Trình duyệt không hỗ trợ đọc tiếng Anh.', 'bad'); return; }
    if (!tts.speak(word, store.prefs().rate)) toast('Không đọc được từ này.', 'bad');
  }

  function useHint(entry) {
    var card = engine.current();
    if (!card || card.phase !== 'prompt') return;
    engine.markHint();
    var answer = lettersOnly(card.question.answer);
    var shown = Math.min(answer.length, (card.hintLevel = (card.hintLevel || 0) + 1));
    setText($('#card-hint'), 'Gợi ý: ' + answer.slice(0, shown).toUpperCase().split('').join(' ') + ' … (' + answer.length + ' chữ cái)');
  }

  function afterAnswer() {
    renderStudy();
    renderChrome();
    var card = engine.current();
    if (!card) return;
    var entry = byId[card.id];
    if (card.result) {
      announce(resultMessage(card, entry));
      if (card.result.correct && store.prefs().autoSpeak && tts && card.question.promptLang === 'vi') {
        tts.speak(entry.word, store.prefs().rate);
      }
    }
    var panel = $('#card-answer');
    if (panel && panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: prefersReduce() ? 'auto' : 'smooth' });
  }

  function resultMessage(card, entry) {
    var result = card.result || {};
    if (result.correct) return 'Đúng. ' + entry.word + ' - ' + entry.meaning;
    if (result.near) return 'Gần đúng. Đáp án là ' + (result.expected || entry.word);
    return 'Sai. Đáp án là ' + (result.expected || entry.word);
  }

  function nextCard() {
    var card = engine.current();
    if (!card) return;
    if (card.phase === 'prompt') {
      if (card.question.input === 'flip') { engine.reveal(); renderStudy(); return; }
      if (card.question.input === 'typing') { submitTyped(); return; }
      return;
    }
    if (card.phase === 'revealed') { renderStudy(); return; }
    var more = engine.advance();
    if (!more) {
      var summary = engine.finish();
      if (summary) {
        app.summary = summary;
        renderAll();
        announce('Phiên học hoàn tất: ' + summary.correct + '/' + summary.answered + ' đúng');
        showView('study', { focus: true });
        return;
      }
      app.summary = null;
      renderAll();
      showView('home', { focus: true });
      return;
    }
    renderStudy();
    renderChrome();
    announce('Thẻ tiếp theo');
  }

  /* ---------- danh sách từ ---------- */

  var BROWSE_FILTERS = [
    { id: 'all', label: 'Tất cả' },
    { id: 'due', label: 'Đến hạn' },
    { id: 'weak', label: 'Từ yếu' },
    { id: 'learning', label: 'Đang học' },
    { id: 'review', label: 'Cần ôn' },
    { id: 'mastered', label: 'Đã thuộc' },
    { id: 'new', label: 'Chưa gặp' },
    { id: 'fav', label: '★ Đánh dấu' }
  ];

  function renderBrowseFilters(stats) {
    var host = $('#browse-filters');
    if (!host) return;
    var now = Date.now();
    var counts = {
      all: stats.total,
      due: stats.due,
      weak: stats.counts.weak,
      learning: stats.counts.learning,
      review: stats.counts.review,
      mastered: stats.counts.mastered,
      new: stats.counts.new,
      fav: stats.favorite
    };
    host.textContent = '';
    BROWSE_FILTERS.forEach(function (filter) {
      var chip = make('button', 'chip' + (app.browse.state === filter.id ? ' is-on' : ''));
      chip.type = 'button';
      chip.dataset.state = filter.id;
      chip.appendChild(document.createTextNode(filter.label + ' '));
      chip.appendChild(make('span', 'count', '(' + (counts[filter.id] == null ? 0 : counts[filter.id]) + ')'));
      chip.addEventListener('click', function () {
        app.browse.state = filter.id;
        app.expandedId = null;
        renderBrowse();
      });
      host.appendChild(chip);
    });

    var levelHost = $('#browse-levels');
    if (levelHost && !levelHost.dataset.ready) {
      var levelCounts = META.levelCounts || {};
      ['all'].concat([1, 2, 3, 4, 5]).forEach(function (level) {
        var chip = make('button', 'chip' + (level === 'all' ? ' lv-all is-on' : ' lv-' + level));
        chip.type = 'button';
        chip.dataset.level = String(level);
        chip.textContent = level === 'all' ? 'Mọi mức' : 'Mức ' + level + ' (' + (levelCounts[level] || 0) + ')';
        chip.addEventListener('click', function () {
          app.browse.level = String(level);
          app.expandedId = null;
          $$('#browse-levels .chip').forEach(function (other) { other.classList.remove('is-on'); });
          chip.classList.add('is-on');
          renderBrowse();
        });
        levelHost.appendChild(chip);
      });
      levelHost.dataset.ready = '1';
    }

    var tierHost = $('#browse-tiers');
    if (tierHost && !tierHost.dataset.ready) {
      var tierCounts = META.tierCounts || {};
      ['all', 1, 2, 3].forEach(function (tier) {
        var chip = make('button', 'chip' + (tier === 'all' ? ' is-on' : ''));
        chip.type = 'button';
        chip.dataset.tier = String(tier);
        chip.textContent = tier === 'all' ? 'Mọi ưu tiên' : TIER_LABEL[tier] + ' (' + (tierCounts[tier] || 0) + ')';
        if (tier !== 'all') chip.title = TIER_HINT[tier];
        chip.addEventListener('click', function () {
          app.browse.tier = String(tier);
          app.expandedId = null;
          $$('#browse-tiers .chip').forEach(function (other) { other.classList.remove('is-on'); });
          chip.classList.add('is-on');
          renderBrowse();
        });
        tierHost.appendChild(chip);
      });
      tierHost.dataset.ready = '1';
    }
    var nowNote = new Date(now);
    setText($('#browse-today'), dateKey(nowNote.getTime()));
  }

  function browseSorted(entries) {
    var sort = app.browse.sort;
    var copy = entries.slice();
    if (sort === 'za') return copy.sort(function (a, b) { return b.word.localeCompare(a.word); });
    if (sort === 'level') return copy.sort(function (a, b) { return a.level - b.level || a.word.localeCompare(b.word); });
    if (sort === 'level-desc') return copy.sort(function (a, b) { return b.level - a.level || a.word.localeCompare(b.word); });
    if (sort === 'coverage') return copy.sort(function (a, b) { return b.corpusFiles - a.corpusFiles || a.word.localeCompare(b.word); });
    return copy.sort(function (a, b) { return a.word.localeCompare(b.word); });
  }

  function browseMatch(entry, query) {
    if (!query) return true;
    if (normalize(entry.word).indexOf(query) !== -1) return true;
    if (normalize(entry.meaning).indexOf(query) !== -1) return true;
    if (entry.family && normalize(entry.family).indexOf(query) !== -1) return true;
    if (entry.distinction && normalize(entry.distinction).indexOf(query) !== -1) return true;
    if (entry.example && normalize(entry.example).indexOf(query) !== -1) return true;
    return false;
  }

  function browseFiltered() {
    var now = Date.now();
    var stats = store.summarize(now);
    var query = normalize(app.browse.query);
    var state = app.browse.state;
    return ENTRIES.filter(function (entry) {
      if (app.browse.level !== 'all' && String(entry.level) !== app.browse.level) return false;
      if (app.browse.tier !== 'all' && String(entry.tier) !== app.browse.tier) return false;
      var record = store.recordOf(entry.id);
      var stateName = SRS.stateOf(record, now);
      if (state === 'due' && !SRS.isDue(record, now)) return false;
      if (state === 'fav' && !store.isFavorite(entry.id)) return false;
      if (['weak', 'learning', 'review', 'mastered', 'new'].indexOf(state) !== -1 && stateName !== state) return false;
      return browseMatch(entry, query);
    });
  }

  function renderBrowse() {
    var stats = store.summarize(Date.now());
    if (app.focusId && byId[app.focusId]) {
      app.expandedId = app.focusId;
      app.focusId = null;
    }
    renderBrowseFilters(stats);
    var search = $('#browse-search');
    if (search && search.value !== app.browse.query) search.value = app.browse.query;
    var sort = $('#browse-sort');
    if (sort) sort.value = app.browse.sort;

    var results = browseSorted(browseFiltered());
    app.browse.results = results;
    app.browse.ids = results.map(function (entry) { return entry.id; });
    var limit = app.browse.rendered || 60;
    app.browse.rendered = Math.min(results.length, Math.max(limit, 60));
    setText($('#browse-count'), results.length + ' từ khớp bộ lọc');
    var list = $('#browse-list');
    list.textContent = '';
    results.slice(0, app.browse.rendered).forEach(function (entry) {
      list.appendChild(renderBrowseRow(entry));
    });
    var empty = $('#browse-empty');
    reveal(empty, results.length === 0);
    var more = $('#browse-more');
    var remaining = results.length - app.browse.rendered;
    reveal(more, remaining > 0);
    if (remaining > 0) setText($('#browse-more'), 'Xem thêm ' + Math.min(60, remaining) + ' từ (còn ' + remaining + ')');
    var study = $('#browse-study');
    if (study) {
      study.disabled = results.length === 0;
      setText(study, 'Học ' + Math.min(sessionSize(), results.length) + ' từ đang lọc');
    }
  }

  function renderBrowseRow(entry) {
    var node = cloneTemplate('tpl-word-row');
    var record = store.recordOf(entry.id);
    var now = Date.now();
    var stateName = SRS.stateOf(record, now);
    var main = $('.word-row-main', node);
    node.dataset.id = entry.id;
    setText($('.w', node), entry.word);
    var meta = [POS_LABEL[entry.pos] || entry.pos, 'Mức ' + entry.level, TIER_LABEL[entry.tier]];
    if (entry.corpusFiles) meta.push(entry.corpusFiles + ' đề');
    if (record && record.n) meta.push(STATE_LABEL[stateName] + ' · ' + record.c + '/' + record.n);
    setText($('.m', node), entry.meaning);
    var metaHost = $('.meta', node);
    metaHost.textContent = '';
    meta.forEach(function (text) { metaHost.appendChild(make('span', 'tag', text)); });
    if (store.isFavorite(entry.id)) metaHost.appendChild(make('span', 'tag', '★'));
    main.setAttribute('aria-expanded', 'false');
    main.addEventListener('click', function () { toggleRow(node, entry); });
    node.__entry = entry;
    if (app.expandedId === entry.id) {
      node.classList.add('is-open');
      main.setAttribute('aria-expanded', 'true');
      expandRow(node, entry);
    }
    return node;
  }

  function expandRow(node, entry) {
    var detail = $('.word-row-detail', node);
    if (!detail.dataset.built) {
      detail.appendChild(buildDetail(entry));
      detail.dataset.built = '1';
    }
    reveal(detail, true);
  }

  function toggleRow(node, entry) {
    var open = node.classList.toggle('is-open');
    $('.word-row-main', node).setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) {
      expandRow(node, entry);
      app.expandedId = entry.id;
    } else {
      reveal($('.word-row-detail', node), false);
      if (app.expandedId === entry.id) app.expandedId = null;
    }
  }

  /** Khối chi tiết dùng chung cho câu trả lời và danh sách từ. */
  function buildDetail(entry) {
    var wrap = make('div');
    var record = store.recordOf(entry.id);
    var rows = [];
    rows.push(['Nghĩa', entry.meaning]);
    if (entry.ipa) rows.push(['Phiên âm', entry.ipa]);
    rows.push(['Số âm tiết', String(entry.syllables)]);
    rows.push(['Ưu tiên', TIER_LABEL[entry.tier] + ' - ' + TIER_HINT[entry.tier]]);
    rows.push(['Trong kho đề', entry.corpusFiles ? entry.corpusFiles + '/106 đề có từ này' : 'Chưa thấy trong 106 đề']);
    if (record && record.n) {
      rows.push(['Tiến độ', 'đúng ' + record.c + '/' + record.n + ' lượt · nhịp ' + formatInterval(record.ivl)]);
    }
    if (entry.family) rows.push(['Họ từ', entry.family]);
    if (entry.distinction) rows.push(['Phân biệt', entry.distinction]);
    rows.forEach(function (pair) {
      var row = make('div', 'row');
      row.appendChild(make('span', 'k', pair[0]));
      row.appendChild(make('span', 'v', pair[1]));
      wrap.appendChild(row);
    });
    if (entry.example) {
      var row = make('div', 'row');
      row.appendChild(make('span', 'k', 'Câu trong đề'));
      var value = make('span', 'v');
      value.appendChild(highlightForm(entry.example, entry.exampleForm || entry.word));
      row.appendChild(value);
      wrap.appendChild(row);
    }
    if (entry.ref) {
      var row2 = make('div', 'row');
      row2.appendChild(make('span', 'k', 'Nguồn'));
      var value2 = make('span', 'v');
      var link = make('a', null, entry.ref.path + ':' + entry.ref.line);
      link.href = entry.ref.url;
      link.target = '_blank';
      link.rel = 'noopener';
      value2.appendChild(link);
      row2.appendChild(value2);
      wrap.appendChild(row2);
    }
    var actions = make('div', 'actions');
    actions.appendChild(actionButton('🔊 Nghe', function () { speakWord(entry.word); }, !tts));
    actions.appendChild(actionButton(store.isFavorite(entry.id) ? '★ Bỏ đánh dấu' : '☆ Đánh dấu', function () {
      store.toggleFavorite(entry.id);
      renderAll();
    }));
    actions.appendChild(actionButton('🎯 Học riêng từ này', function () { startSession('smart', [entry.id], 'Từ: ' + entry.word); }));
    wrap.appendChild(actions);
    return wrap;
  }

  function actionButton(label, handler, disabled) {
    var button = make('button', 'btn small', label);
    button.type = 'button';
    button.disabled = !!disabled;
    button.addEventListener('click', function (event) {
      event.stopPropagation();
      handler();
    });
    return button;
  }

  /** Mở danh sách từ và bung sẵn một từ. */
  function openWord(id) {
    var entry = byId[id];
    if (!entry) return;
    app.browse.query = entry.word;
    app.browse.state = 'all';
    app.browse.level = 'all';
    app.browse.tier = 'all';
    app.browse.sort = 'az';
    app.focusId = id;
    if (window.location.hash !== '#/browse') window.location.hash = '#/browse';
    app.view = 'browse';
    renderBrowse();
    showView('browse');
    var row = $('#browse-list .word-row');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'center', behavior: prefersReduce() ? 'auto' : 'smooth' });
  }

  /* ---------- thống kê ---------- */

  function renderStats() {
    var now = Date.now();
    var stats = store.summarize(now);
    var grid = $('#stats-grid');
    if (!grid) return;
    grid.textContent = '';
    [
      ['Đã gặp', stats.seen + '/' + stats.total, 'từ đã xuất hiện ít nhất một lần'],
      ['Đã thuộc', stats.counts.mastered, 'nhịp ôn ≥ 21 ngày và đúng ≥ 75%'],
      ['Cần ôn hôm nay', stats.due, 'từ đã tới hạn'],
      ['Từ yếu', stats.counts.weak, 'trả lời sai gần đây'],
      ['Tỉ lệ đúng', Math.round(stats.accuracy * 100) + '%', stats.correct + '/' + stats.reviews + ' lượt'],
      ['Chuỗi ngày', stats.streak.current + ' ngày', 'kỷ lục ' + stats.streak.best + ' ngày'],
      ['Hôm nay', stats.today.answered, 'phiên: ' + stats.today.sessions],
      ['Đánh dấu', stats.favorite, 'từ trong danh sách riêng']
    ].forEach(function (item) {
      var tile = make('div', 'tile');
      tile.appendChild(make('b', null, item[1]));
      tile.appendChild(make('span', null, item[0]));
      tile.appendChild(make('small', null, item[2]));
      grid.appendChild(tile);
    });

    renderBars($('#stats-levels'), 'Mức ' + '', stats.levels, function (level) { return 'Mức ' + level; }, 'lv-');
    renderBars($('#stats-tiers'), '', stats.tiers, function (tier) { return TIER_LABEL[tier]; }, 'tier-');
    renderHeatmap(now);
    renderWeakList(now);
    renderHistory(now);
  }

  function renderBars(host, prefix, counts, labeler, clsPrefix) {
    if (!host) return;
    host.textContent = '';
    var max = 0;
    Object.keys(counts).forEach(function (key) { max = Math.max(max, counts[key]); });
    Object.keys(counts).forEach(function (key) {
      var row = make('div', 'bar-row ' + clsPrefix + key);
      row.appendChild(make('span', null, labeler(key)));
      var track = make('span', 'track');
      var fill = make('span', 'fill');
      fill.style.width = (max ? Math.round((counts[key] / max) * 100) : 0) + '%';
      track.appendChild(fill);
      row.appendChild(track);
      row.appendChild(make('span', 'num', String(counts[key])));
      host.appendChild(row);
    });
  }

  function renderHeatmap(now) {
    var host = $('#heatmap');
    if (!host) return;
    host.textContent = '';
    var daily = store.daily();
    var today = startOfDay(now);
    for (var i = 34; i >= 0; i -= 1) {
      var time = shiftDay(today, -i);
      var key = dateKey(time);
      var day = daily[key] || { answered: 0 };
      var level = day.answered === 0 ? 0 : day.answered < 6 ? 1 : day.answered < 15 ? 2 : day.answered < 30 ? 3 : 4;
      var cell = make('div', 'cell');
      cell.dataset.level = String(level);
      cell.title = key + ': ' + day.answered + ' câu';
      if (new Date(time).getDate() === new Date(today).getDate()) { cell.textContent = '●'; }
      if (i === 0) cell.classList.add('is-today');
      host.appendChild(cell);
    }
    var streakNode = $('#stats-streak');
    if (streakNode) {
      var stats = store.streak();
      streakNode.textContent = stats.current
        ? 'Chuỗi hiện tại ' + stats.current + ' ngày · kỷ lục ' + stats.best + ' ngày'
        : 'Chưa có chuỗi ngày nào — học một phiên hôm nay nhé.';
    }
    var recent = store.history();
    var week = 0;
    var cutoff = today - 6 * DAY;
    Object.keys(daily).forEach(function (key) {
      var time = Date.parse(key + 'T00:00:00');
      if (time >= cutoff) week += daily[key].answered;
    });
    setText($('#stats-week'), 'Tuần này: ' + week + ' câu');
    setText($('#stats-history-count'), recent.length + ' phiên gần đây');
  }

  function renderWeakList(now) {
    var host = $('#stats-weak-list');
    if (!host) return;
    host.textContent = '';
    var weak = ENTRIES.filter(function (entry) {
      return SRS.stateOf(store.recordOf(entry.id), now) === 'weak';
    }).sort(function (a, b) {
      var ra = store.recordOf(a.id) || { w: 0 };
      var rb = store.recordOf(b.id) || { w: 0 };
      return rb.w - ra.w;
    }).slice(0, 12);
    if (!weak.length) {
      host.appendChild(make('li', 'hint', 'Chưa có từ yếu nào. Những từ trả lời sai sẽ xuất hiện ở đây.'));
      return;
    }
    weak.forEach(function (entry) {
      var record = store.recordOf(entry.id) || { c: 0, w: 0 };
      var row = make('li');
      var info = make('span');
      info.appendChild(make('b', 'w', entry.word));
      info.appendChild(make('span', 'info', ' · ' + entry.meaning + ' · sai ' + record.w + ' lần'));
      row.appendChild(info);
      var actions = make('span', 'row');
      actions.appendChild(actionButton('Xem', function () { openWord(entry.id); }));
      actions.appendChild(actionButton('Nghe', function () { speakWord(entry.word); }, !tts));
      row.appendChild(actions);
      host.appendChild(row);
    });
    setText($('#stats-weak-count'), weak.length + ' từ yếu nhất');
  }

  function renderHistory(now) {
    var host = $('#stats-history');
    if (!host) return;
    host.textContent = '';
    var history = store.history();
    if (!history.length) {
      host.appendChild(make('li', 'hint', 'Chưa có phiên học nào được lưu.'));
      return;
    }
    history.slice(0, 8).forEach(function (item) {
      var row = make('li');
      var left = make('span');
      left.appendChild(make('b', null, item.label || 'Phiên học'));
      left.appendChild(make('span', 'when', ' · ' + formatWhen(item.at, now)));
      row.appendChild(left);
      row.appendChild(make('span', 'when', item.correct + '/' + item.answered + ' đúng · ' + Math.round((item.accuracy || 0) * 100) + '% · ' + formatDuration(item.durationMs || 0)));
      host.appendChild(row);
    });
  }

  /* ---------- hộp thoại ---------- */

  function closeDialog() {
    var host = document.getElementById('dialog-host');
    if (!host || host.hidden) return;
    host.hidden = true;
    host.textContent = '';
    app.modal = null;
    if (app.lastFocus && app.lastFocus.focus) app.lastFocus.focus({ preventScroll: true });
  }

  function openDialog(config) {
    var host = document.getElementById('dialog-host');
    if (!host) return function () {};
    app.lastFocus = document.activeElement;
    host.textContent = '';
    var dialog = make('div', 'dialog');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'dialog-title');
    var title = make('h2', null, config.title || '');
    title.id = 'dialog-title';
    dialog.appendChild(title);
    var body = make('div', 'body');
    if (config.body) body.appendChild(config.body);
    dialog.appendChild(body);
    var actions = make('div', 'actions' + (config.split ? ' split' : ''));
    (config.actions || []).forEach(function (action) {
      var button = make('button', 'btn ' + (action.className || ''), action.label);
      button.type = 'button';
      button.addEventListener('click', function () {
        var keep = action.onClick && action.onClick() === false;
        if (!keep) closeDialog();
      });
      actions.appendChild(button);
    });
    dialog.appendChild(actions);
    host.appendChild(dialog);
    host.hidden = false;
    app.modal = { dialog: dialog, config: config };
    var focusTarget = $('.btn.primary', actions) || $('.btn', actions) || dialog;
    focusTarget.focus({ preventScroll: true });
    return closeDialog;
  }

  function textDialog(title, lines, actions) {
    var body = make('div');
    lines.forEach(function (line) {
      var paragraph = make('p', null, line);
      body.appendChild(paragraph);
    });
    return openDialog({ title: title, body: body, actions: actions });
  }

  function openSettings() {
    var prefs = store.prefs();
    var body = make('div', 'settings-grid');

    body.appendChild(selectField('Chủ đề', 'theme-field', [
      ['auto', 'Theo hệ thống'], ['dark', 'Tối'], ['light', 'Sáng']
    ], prefs.theme, function (value) { store.updatePrefs({ theme: value }); applyPrefs(); }));

    body.appendChild(selectField('Cỡ chữ', 'size-field', [
      ['sm', 'Nhỏ'], ['md', 'Vừa'], ['lg', 'Lớn']
    ], prefs.size, function (value) { store.updatePrefs({ size: value }); applyPrefs(); }));

    body.appendChild(selectField('Số từ mỗi phiên', 'session-field', [
      ['10', '10 từ'], ['20', '20 từ'], ['30', '30 từ'], ['50', '50 từ']
    ], String(prefs.sessionSize), function (value) { store.updatePrefs({ sessionSize: Number(value) }); }));

    body.appendChild(selectField('Tốc độ đọc', 'rate-field', [
      ['0.7', 'Chậm'], ['0.9', 'Vừa'], ['1.1', 'Nhanh']
    ], String(prefs.rate), function (value) { store.updatePrefs({ rate: Number(value) }); }));

    body.appendChild(switchField('Hiện phiên âm IPA', prefs.showIpa, function (checked) {
      store.updatePrefs({ showIpa: checked }); renderStudy();
    }));
    body.appendChild(switchField('Hiện gợi ý trên thẻ', prefs.showHints, function (checked) {
      store.updatePrefs({ showHints: checked }); renderStudy();
    }));
    body.appendChild(switchField('Tự đọc từ khi trả lời đúng', prefs.autoSpeak, function (checked) {
      store.updatePrefs({ autoSpeak: checked });
    }));
    body.appendChild(switchField('Việt → Anh dạng viết (không trắc nghiệm)', prefs.typedAnswers, function (checked) {
      store.updatePrefs({ typedAnswers: checked });
    }));

    var tools = make('div', 'chip-row');
    tools.appendChild(actionButton('📤 Xuất JSON', exportJson));
    tools.appendChild(actionButton('📄 Xuất CSV', exportCsv));
    tools.appendChild(actionButton('📥 Nhập JSON', openImport));
    tools.appendChild(actionButton('♻️ Xoá tiến độ', confirmResetProgress));
    tools.appendChild(actionButton('🗑️ Xoá tất cả', confirmResetAll));
    body.appendChild(tools);
    return openDialog({
      title: 'Cài đặt & dữ liệu',
      body: body,
      actions: [{ label: 'Đóng', className: 'primary' }]
    });
  }

  function selectField(label, id, options, value, onChange) {
    var field = make('div', 'field');
    var labelNode = make('label', null, label);
    labelNode.setAttribute('for', id);
    var select = make('select');
    select.id = id;
    options.forEach(function (pair) {
      var option = make('option', null, pair[1]);
      option.value = pair[0];
      if (pair[0] === value) option.selected = true;
      select.appendChild(option);
    });
    select.addEventListener('change', function () { onChange(select.value); });
    field.appendChild(labelNode);
    field.appendChild(select);
    return field;
  }

  function switchField(label, checked, onChange) {
    var row = make('label', 'switch');
    row.appendChild(make('span', null, label));
    var input = document.createElement('input');
    input.type = 'checkbox';
    input.checked = !!checked;
    input.addEventListener('change', function () { onChange(input.checked); });
    row.appendChild(input);
    return row;
  }

  function exportJson() {
    var bundle = store.exportBundle(Date.now());
    download('chuyen-anh-flashcards-' + dateKey(Date.now()) + '.json', JSON.stringify(bundle, null, 2), 'application/json');
    toast('Đã xuất bản sao tiến độ.', 'good');
  }

  /** Các dòng CSV cho tiến độ hiện tại (tách riêng để kiểm thử được). */
  function csvRows(now) {
    var rows = [['id', 'word', 'pos', 'level', 'tier', 'state', 'seen', 'correct', 'wrong', 'interval_days', 'due', 'favorite', 'meaning']];
    ENTRIES.forEach(function (entry) {
      var record = store.recordOf(entry.id);
      if (!record || !record.n) return;
      rows.push([
        entry.id, entry.word, entry.pos, entry.level, entry.tier,
        SRS.stateOf(record, now), record.n, record.c, record.w,
        Math.round((record.ivl || 0) * 100) / 100, dateKey(record.due || now),
        store.isFavorite(entry.id) ? 'yes' : '', entry.meaning
      ]);
    });
    return rows;
  }

  function csvCell(value) {
    var text = txt(value);
    return /[",\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }

  function exportCsv() {
    var csv = '\ufeff' + csvRows(Date.now()).map(function (row) {
      return row.map(csvCell).join(',');
    }).join('\r\n');
    download('chuyen-anh-tien-do-' + dateKey(Date.now()) + '.csv', csv, 'text/csv');
    toast('Đã xuất CSV tiến độ.', 'good');
  }

  function download(filename, content, type) {
    try {
      var blob = new Blob([content], { type: type + ';charset=utf-8' });
      var url = URL.createObjectURL(blob);
      var link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
    } catch (error) {
      textDialog('Không xuất được tệp', ['Trình duyệt chặn tải tệp trong ngữ cảnh này.'], [{ label: 'Đóng', className: 'primary' }]);
    }
  }

  function openImport() {
    var body = make('div');
    body.appendChild(make('p', null, 'Chọn tệp JSON đã xuất từ ứng dụng này. Tiến độ hiện tại sẽ được giữ và cập nhật thêm.'));
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.id = 'import-file';
    body.appendChild(input);
    openDialog({
      title: 'Nhập tiến độ',
      body: body,
      actions: [
        { label: 'Huỷ' },
        {
          label: 'Nhập', className: 'primary', onClick: function () {
            var file = input.files && input.files[0];
            if (!file) { toast('Chưa chọn tệp nào.', 'bad'); return false; }
            var reader = new FileReader();
            reader.onload = function () {
              var bundle = null;
              try { bundle = JSON.parse(String(reader.result)); } catch (error) { bundle = null; }
              var problem = store.validateBundle(bundle);
              if (problem) { toast(problem, 'bad'); return; }
              var accepted = store.applyBundle(bundle, 'merge');
              renderAll();
              toast('Đã nhập ' + accepted + ' bản ghi tiến độ.', 'good');
            };
            reader.onerror = function () { toast('Không đọc được tệp.', 'bad'); };
            reader.readAsText(file);
            return false;
          }
        }
      ]
    });
  }

  function confirmResetProgress() {
    textDialog('Xoá tiến độ học?', [
      'Toàn bộ lịch sử ôn tập, chuỗi ngày và trạng thái từng từ sẽ bị xoá. Danh sách đánh dấu và cài đặt vẫn giữ nguyên.'
    ], [
      { label: 'Giữ nguyên' },
      {
        label: 'Xoá tiến độ', className: 'danger', onClick: function () {
          store.resetProgress();
          engine.cancel();
          app.summary = null;
          renderAll();
          showView('home');
          toast('Đã xoá tiến độ học.', 'good');
        }
      }
    ]);
  }

  function confirmResetAll() {
    textDialog('Xoá tất cả dữ liệu?', [
      'Tiến độ, danh sách đánh dấu và cài đặt sẽ trở về mặc định như khi mới mở file.'
    ], [
      { label: 'Giữ nguyên' },
      {
        label: 'Xoá tất cả', className: 'danger', onClick: function () {
          store.resetAll();
          engine.cancel();
          app.summary = null;
          applyPrefs();
          renderAll();
          showView('home');
          toast('Đã xoá toàn bộ dữ liệu.', 'good');
        }
      }
    ]);
  }

  function openHelp() {
    var body = make('div');
    var keys = [
      ['1 – 4', 'chọn đáp án trắc nghiệm'],
      ['Enter / Space', 'lật thẻ, nộp câu trả lời hoặc sang thẻ tiếp theo'],
      ['S', 'nghe phát âm từ'],
      ['F', 'đánh dấu / bỏ đánh dấu từ'],
      ['H', 'mở gợi ý khi viết chính tả'],
      ['/', 'tìm nhanh trong danh sách từ'],
      ['Esc', 'đóng hộp thoại hoặc thoát phiên'],
      ['?', 'mở bảng phím tắt này']
    ];
    var list = make('div');
    keys.forEach(function (pair) {
      var row = make('div', 'kv');
      row.appendChild(make('dt', null, pair[0]));
      row.appendChild(make('dd', null, pair[1]));
      list.appendChild(row);
    });
    var dl = make('dl', null, '');
    dl.appendChild(list);
    body.appendChild(dl);
    body.appendChild(make('p', null, 'Cách học gợi ý: mỗi ngày một phiên "Trộn thông minh" 20 từ. Từ sai sẽ quay lại trong cùng phiên và được xếp vào nhóm "Từ yếu" cho ngày hôm sau.'));
    return openDialog({ title: 'Phím tắt & cách học', body: body, actions: [{ label: 'Đóng', className: 'primary' }] });
  }

  function openAbout() {
    var body = make('div', 'about');
    var list = make('ul');
    var notes = META.notes || {};
    [
      ['Danh sách gốc: ' + txt(META.sourceList) + ' (' + META.total + ' từ).'],
      ['Nguồn dữ liệu: ' + (META.sources || []).join(' · ')],
      [notes.tier || ''],
      [notes.level || ''],
      [notes.corpus || ''],
      [notes.ipa || ''],
      ['Tiến độ được lưu trong localStorage của trình duyệt với tiền tố ' + PREFIX + '; file này không gửi dữ liệu đi đâu cả.']
    ].forEach(function (line) {
      if (line[0]) list.appendChild(make('li', null, line[0]));
    });
    body.appendChild(list);
    var meta = make('div', 'kv');
    [['Tổng số từ', String(META.total)],
     ['Có ngữ cảnh đề', String(META.documented)],
     ['Có câu điền từ', String(META.cloze)],
     ['Có phiên âm', String(META.withIpa)],
     ['Đề trong kho', String(META.corpusFiles)],
     ['Fingerprint', txt(META.fingerprint).slice(0, 12)]].forEach(function (pair) {
      meta.appendChild(make('dt', null, pair[0]));
      meta.appendChild(make('dd', null, pair[1]));
    });
    body.appendChild(meta);
    return openDialog({ title: 'Về file này', body: body, actions: [{ label: 'Đóng', className: 'primary' }] });
  }

  function exitSession() {
    if (!engine.hasSession()) { showView('home'); return; }
    var snapshot = engine.getState();
    textDialog('Thoát phiên học?', [
      'Tiến độ của phiên đang học được giữ lại, bạn có thể tiếp tục sau từ trang chủ.'
    ], [
      { label: 'Học tiếp' },
      {
        label: 'Thoát phiên', className: 'danger', onClick: function () {
          if (snapshot) {
            store.setSession({
              kind: 'session', mode: snapshot.mode, label: snapshot.label, seed: snapshot.seed,
              ids: snapshot.ids, queue: snapshot.queue, index: snapshot.index, round: snapshot.round,
              answers: snapshot.answers, correct: snapshot.correct, wrong: snapshot.wrong,
              startedAt: snapshot.startedAt
            });
          }
          app.summary = null;
          renderAll();
          showView('home');
        }
      }
    ]);
  }

  /* ---------- bàn phím ---------- */

  function onKeydown(event) {
    var tag = (event.target.tagName || '').toLowerCase();
    var typing = tag === 'input' || tag === 'textarea' || tag === 'select';
    if (event.key === 'Escape') {
      var host = document.getElementById('dialog-host');
      if (host && !host.hidden) { closeDialog(); event.preventDefault(); return; }
      if (app.view === 'study' && engine.hasSession()) { exitSession(); event.preventDefault(); }
      return;
    }
    if (typing && event.key !== 'Enter') return;
    if (app.view !== 'study') {
      if (event.key === '/' && !typing) {
        showView('browse');
        var search = $('#browse-search');
        if (search) { search.focus(); event.preventDefault(); }
      }
      if (event.key === '?' && !typing) { openHelp(); event.preventDefault(); }
      return;
    }
    var card = engine.current();
    if (event.key === '1' || event.key === '2' || event.key === '3' || event.key === '4') {
      if (!card) return;
      if (card.question.input === 'options' && card.phase === 'prompt') {
        chooseOption(Number(event.key) - 1);
        event.preventDefault();
      } else if (card.question.input === 'flip' && card.phase === 'revealed') {
        engine.gradeSelf(Number(event.key) - 1);
        afterAnswer();
        event.preventDefault();
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (typing && event.key === ' ') return;
      if (!card) return;
      event.preventDefault();
      nextCard();
      return;
    }
    var key = event.key.toLowerCase();
    if (key === 'f' && card) {
      store.toggleFavorite(card.id);
      renderStudy();
      renderChrome();
      toast(store.isFavorite(card.id) ? 'Đã đánh dấu từ.' : 'Đã bỏ đánh dấu.');
      event.preventDefault();
    } else if (key === 's' && card) {
      speakWord(card.question.kind === 'cloze' ? pronouncedWord(card.question.word) : card.question.word);
      event.preventDefault();
    } else if (key === 'h' && card && card.question.input === 'typing') {
      useHint(byId[card.id]);
      event.preventDefault();
    } else if (event.key === '?') {
      openHelp();
      event.preventDefault();
    }
  }

  /* ---------- gắn sự kiện ---------- */

  function bindEvents() {
    on($('#nav-home'), 'click', function () { showView('home'); });
    on($('#nav-study'), 'click', function () {
      if (engine.hasSession()) showView('study');
      else startSession('smart', null, 'Trộn thông minh');
    });
    on($('#nav-browse'), 'click', function () { showView('browse'); });
    on($('#nav-stats'), 'click', function () { showView('stats'); });

    on($('#btn-theme'), 'click', toggleTheme);
    on($('#btn-help'), 'click', openHelp);
    on($('#btn-settings'), 'click', openSettings);

    on($('#start-smart'), 'click', function () { startSession('smart', null, 'Trộn thông minh'); });
    on($('#plan-due-btn'), 'click', function () {
      var ids = selectIds({ size: sessionSize(), now: Date.now(), state: 'all' });
      startSession('smart', ids, 'Ôn đến hạn & từ mới');
    });
    on($('#plan-weak-btn'), 'click', function () {
      var ids = selectIds({ size: sessionSize(), now: Date.now(), state: 'weak' });
      if (!ids.length) { toast('Chưa có từ yếu nào.', 'bad'); return; }
      startSession('smart', ids, 'Ôn từ yếu');
    });
    on($('#plan-fresh-btn'), 'click', function () {
      var ids = selectIds({ size: sessionSize(), now: Date.now(), state: 'new' });
      if (!ids.length) { toast('Bạn đã gặp đủ 913 từ.', 'bad'); return; }
      startSession('smart', ids, 'Học từ mới');
    });
    on($('#plan-level-btn'), 'click', function () {
      var ids = selectIds({ size: sessionSize(), now: Date.now(), tier: '1' });
      startSession('smart', ids, 'Từ trọng tâm');
    });
    on($('#resume-btn'), 'click', function () {
      var restored = engine.restore();
      if (!restored) { toast('Không còn phiên nào để tiếp tục.', 'bad'); return; }
      showView('study');
      renderStudy();
    });
    on($('#size-select'), 'change', function () { store.updatePrefs({ sessionSize: Number(this.value) }); });
    on($('#wotd-btn'), 'click', function () {
      var id = $('#wotd') && $('#wotd').dataset.id;
      if (id) startSession('smart', [id], 'Từ của ngày');
    });
    on($('#wotd-open'), 'click', function () {
      var id = $('#wotd') && $('#wotd').dataset.id;
      if (id) openWord(id);
    });

    on($('#card-start'), 'click', function () { startSession('smart', null, 'Trộn thông minh'); });
    on($('#btn-fav'), 'click', function () {
      var card = engine.current();
      if (!card) return;
      store.toggleFavorite(card.id);
      renderStudy();
      renderChrome();
    });
    on($('#btn-skip'), 'click', function () {
      if (!engine.skip()) nextCard();
      else { renderStudy(); announce('Đã bỏ qua thẻ này'); }
    });
    on($('#btn-exit'), 'click', exitSession);
    on($('#answer-submit'), 'click', submitTyped);
    on($('#answer-input'), 'keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); submitTyped(); }
    });
    on($('#next-btn'), 'click', nextCard);
    $$('#grade-row .btn').forEach(function (button) {
      button.addEventListener('click', function () {
        engine.gradeSelf(Number(button.dataset.grade));
        afterAnswer();
      });
    });
    on($('#flip-btn'), 'click', function () { nextCard(); });
    on($('#summary-again'), 'click', function () { startSession('smart', null, 'Trộn thông minh'); });
    on($('#summary-home'), 'click', function () { app.summary = null; renderAll(); showView('home'); });
    on($('#summary-wrong-btn'), 'click', function () {
      var ids = (app.summary && app.summary.wrongIds) || [];
      if (!ids.length) { toast('Phiên này không có từ sai.', 'bad'); return; }
      startSession('smart', ids, 'Ôn từ sai');
    });

    on($('#browse-search'), 'input', function () {
      app.browse.query = this.value;
      app.browse.rendered = 60;
      app.expandedId = null;
      renderBrowse();
    });
    on($('#browse-sort'), 'change', function () {
      app.browse.sort = this.value;
      renderBrowse();
    });
    on($('#browse-more'), 'click', function () {
      app.browse.rendered += 60;
      renderBrowse();
    });
    on($('#browse-study'), 'click', function () {
      var ids = app.browse.ids.slice(0, sessionSize());
      if (!ids.length) { toast('Bộ lọc này không có từ nào.', 'bad'); return; }
      startSession('smart', ids, 'Học theo bộ lọc (' + ids.length + ' từ)');
    });
    on($('#browse-mastered'), 'click', function () {
      var ids = ENTRIES.filter(function (entry) { return SRS.stateOf(store.recordOf(entry.id), Date.now()) === 'mastered'; })
        .map(function (entry) { return entry.id; });
      if (!ids.length) { toast('Chưa có từ nào đã thuộc.', 'bad'); return; }
      startSession('flip', ids.slice(0, sessionSize()), 'Xem lại từ đã thuộc');
    });

    on($('#stats-weak'), 'click', function () {
      var ids = selectIds({ size: sessionSize(), now: Date.now(), state: 'weak' });
      if (!ids.length) { toast('Chưa có từ yếu nào.', 'bad'); return; }
      startSession('smart', ids, 'Ôn từ yếu');
    });
    on($('#stats-frequency'), 'click', function () {
      var ids = selectIds({ size: sessionSize(), now: Date.now(), tier: '1' });
      startSession('smart', ids, 'Từ trọng tâm & hay gặp');
    });
    on($('#stats-export'), 'click', exportJson);
    on($('#stats-csv'), 'click', exportCsv);
    on($('#stats-import'), 'click', openImport);
    on($('#stats-reset'), 'click', function () {
      textDialog('Xoá dữ liệu', ['Chọn mức xoá phù hợp.'], [
        { label: 'Đóng' },
        { label: 'Xoá tiến độ', className: 'danger', onClick: function () { store.resetProgress(); renderAll(); toast('Đã xoá tiến độ.', 'good'); } },
        { label: 'Xoá tất cả', className: 'danger', onClick: function () { store.resetAll(); applyPrefs(); renderAll(); toast('Đã xoá tất cả.', 'good'); } }
      ]);
    });
    on($('#stats-about'), 'click', openAbout);

    on(document.getElementById('dialog-host'), 'click', function (event) {
      if (event.target === this) closeDialog();
    });
    on(document, 'keydown', onKeydown);

    if (THEME_QUERY) {
      var listener = function () { if (store.prefs().theme === 'auto') applyPrefs(); };
      if (THEME_QUERY.addEventListener) THEME_QUERY.addEventListener('change', listener);
      else if (THEME_QUERY.addListener) THEME_QUERY.addListener(listener);
    }
    window.addEventListener('beforeunload', function () { store.flush(); });
    window.addEventListener('hashchange', function () {
      var name = (window.location.hash || '').replace('#/', '');
      if (VIEWS.indexOf(name) !== -1 && name !== app.view) showView(name);
    });
  }

  /* ======================= 10. Khởi động ======================= */

  function boot() {
    renderChrome();
    bindEvents();
    var restored = engine.restore();
    renderAll();
    var name = (window.location.hash || '').replace('#/', '');
    showView(VIEWS.indexOf(name) === -1 ? 'home' : name);
    if (restored) announce('Đã khôi phục phiên học đang dở.');
  }

  window.ChuyenAnhFlashcards = {
    version: 1,
    data: DATA,
    meta: META,
    entries: ENTRIES,
    byId: byId,
    store: store,
    engine: engine,
    app: app,
    tts: tts,
    core: {
      normalize: normalize,
      charDiff: charDiff,
      SRS: SRS,
      selectIds: selectIds,
      makeQuestion: makeQuestion,
      gradeTyped: gradeTyped,
      autoGrade: autoGrade,
      smartKind: smartKind,
      createRng: createRng,
      hashString: hashString,
      shiftDay: shiftDay,
      dateKey: dateKey,
      formatDuration: formatDuration,
      formatWhen: formatWhen,
      formatInterval: formatInterval,
      comparePriority: comparePriority,
      csvRows: csvRows,
      csvCell: csvCell,
      pronouncedWord: pronouncedWord,
      createStore: createStore,
      createEngine: createEngine,
      pickStorage: pickStorage,
      DEFAULT_PREFS: DEFAULT_PREFS,
      PREFIX: PREFIX,
      KEYS: KEYS
    },
    ui: {
      showView: showView, renderAll: renderAll, openWord: openWord, toast: toast,
      openDialog: openDialog, openHelp: openHelp, openAbout: openAbout, openSettings: openSettings,
      startSession: startSession, nextCard: nextCard, chooseOption: chooseOption, submitTyped: submitTyped
    }
  };

  /* Trong trình duyệt thì khởi động; trong Node thì để bộ kiểm thử gọi API. */
  if (typeof module === 'object' && module.exports) {
    module.exports = window.ChuyenAnhFlashcards;
  } else if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
