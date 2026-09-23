/*
 * Chuyên Anh Flashcard
 * Static-first application: the only remote resource is data/vocabulary.json.
 * Progress and preferences stay in the browser; there is no API or server state.
 */

export const STATES = Object.freeze({
  NEW: 'new',
  LEARNING: 'learning',
  WEAK: 'weak',
  REVIEW: 'review',
  MASTERED: 'mastered'
});

export const MODES = Object.freeze({
  RECOGNITION: 'recognition',
  RECALL: 'recall',
  SPELLING: 'spelling',
  CLOZE: 'cloze'
});

const VALID_STATES = new Set(Object.values(STATES));
const STORAGE_KEYS = Object.freeze({
  progress: 'chuyen-anh.progress.v1',
  prefs: 'chuyen-anh.prefs.v1',
  favorites: 'chuyen-anh.favorites.v1',
  history: 'chuyen-anh.history.v1',
  streak: 'chuyen-anh.streak.v1'
});

export const DEFAULT_PREFS = Object.freeze({
  sessionSize: 20,
  keyboardShortcuts: true,
  darkMode: false
});

export function normalize(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[char]);
}

function memorySafeStorage() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage : null;
  } catch {
    return null;
  }
}

function readJson(storage, key, fallback) {
  try {
    const raw = storage?.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(storage, key, value) {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function createInitialProgress(id, now = Date.now()) {
  return {
    id: String(id),
    state: STATES.NEW,
    correctCount: 0,
    wrongCount: 0,
    streak: 0,
    lastReviewed: null,
    nextReview: now,
    interval: 0,
    ease: 2.5,
    difficulty: 0
  };
}

function sanitizeProgress(value, id, now = Date.now()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const numeric = ['correctCount', 'wrongCount', 'streak', 'nextReview', 'interval', 'ease', 'difficulty'];
  if (numeric.some(key => value[key] !== undefined && (!Number.isFinite(value[key]) || value[key] < 0))) return null;
  const state = VALID_STATES.has(value.state) ? value.state : STATES.NEW;
  return {
    id: String(id),
    state,
    correctCount: Math.floor(value.correctCount || 0),
    wrongCount: Math.floor(value.wrongCount || 0),
    streak: Math.floor(value.streak || 0),
    lastReviewed: Number.isFinite(value.lastReviewed) ? value.lastReviewed : null,
    nextReview: Number.isFinite(value.nextReview) ? value.nextReview : now,
    interval: Math.min(180, value.interval || 0),
    ease: Math.min(2.8, Math.max(1.3, value.ease || 2.5)),
    difficulty: Math.min(1, Math.max(0, value.difficulty || 0))
  };
}

export function loadProgress(storage = memorySafeStorage()) {
  const raw = readJson(storage, STORAGE_KEYS.progress, {});
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  return Object.fromEntries(Object.entries(raw)
    .map(([id, value]) => [id, sanitizeProgress(value, id)])
    .filter(([, value]) => value));
}

export function saveProgress(progress, storage = memorySafeStorage()) {
  return writeJson(storage, STORAGE_KEYS.progress, progress);
}

export function ensureProgress(progressMap, vocabulary, now = Date.now()) {
  const result = {};
  for (const entry of vocabulary) {
    result[entry.id] = sanitizeProgress(progressMap?.[entry.id], entry.id, now)
      || createInitialProgress(entry.id, now);
  }
  return result;
}

function intervalDue(days, now) {
  return now + days * 24 * 60 * 60 * 1000;
}

export function updateProgress(progress, correct, responseTimeMs = 0, now = Date.now()) {
  const current = sanitizeProgress(progress, progress?.id ?? 'unknown', now) || createInitialProgress(progress?.id ?? 'unknown', now);
  let next = { ...current, lastReviewed: now };

  if (!correct) {
    next.correctCount = current.correctCount;
    next.wrongCount = current.wrongCount + 1;
    next.streak = 0;
    next.state = STATES.WEAK;
    next.interval = 0;
    next.ease = Math.max(1.3, current.ease - 0.2);
    // The item is immediately due, but a session can still prioritise it first.
    next.nextReview = now;
  } else {
    next.correctCount = current.correctCount + 1;
    next.wrongCount = current.wrongCount;
    next.streak = current.streak + 1;
    next.ease = Math.min(2.8, current.ease + (responseTimeMs > 0 && responseTimeMs < 3000 ? 0.1 : 0.08));

    if (current.state === STATES.NEW) {
      next.state = STATES.LEARNING;
      next.interval = 1;
    } else if (current.state === STATES.LEARNING) {
      next.interval = next.streak >= 2 ? 3 : 1;
      next.state = next.streak >= 2 && next.correctCount >= 3 ? STATES.REVIEW : STATES.LEARNING;
    } else if (current.state === STATES.WEAK) {
      next.interval = next.streak >= 2 ? 2 : 1;
      next.state = next.streak >= 2 ? STATES.REVIEW : STATES.LEARNING;
    } else if (current.state === STATES.REVIEW) {
      next.interval = Math.max(2, Math.round(Math.max(1, current.interval) * next.ease));
      next.state = next.interval >= 21 && next.correctCount >= 5 && next.streak >= 3
        ? STATES.MASTERED : STATES.REVIEW;
    } else {
      next.interval = Math.min(180, Math.max(7, Math.round(Math.max(1, current.interval) * next.ease * 1.1)));
      next.state = STATES.MASTERED;
    }
    next.nextReview = intervalDue(Math.min(180, next.interval), now);
  }

  const total = next.correctCount + next.wrongCount;
  next.difficulty = Math.min(1, Math.max(0,
    (total ? next.wrongCount / total : 0) * 0.7 + ((2.8 - next.ease) / 1.5) * 0.3
  ));
  return next;
}

export function isDue(progress, now = Date.now()) {
  return Boolean(progress && Number.isFinite(progress.nextReview) && progress.nextReview <= now);
}

export function calculateStats(progressMap, now = Date.now()) {
  const stats = { total: 0, new: 0, learning: 0, weak: 0, review: 0, mastered: 0, due: 0, correct: 0, wrong: 0 };
  for (const progress of Object.values(progressMap || {})) {
    if (!progress || typeof progress !== 'object' || Array.isArray(progress)) continue;
    stats.total += 1;
    if (VALID_STATES.has(progress.state)) stats[progress.state] += 1;
    if (Number.isFinite(progress.correctCount) && progress.correctCount > 0) stats.correct += progress.correctCount;
    if (Number.isFinite(progress.wrongCount) && progress.wrongCount > 0) stats.wrong += progress.wrongCount;
    if (isDue(progress, now)) stats.due += 1;
  }
  stats.accuracy = stats.correct + stats.wrong
    ? Math.round(stats.correct / (stats.correct + stats.wrong) * 100) : 0;
  stats.learned = stats.total - stats.new;
  return stats;
}

function shuffle(items) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function selectSession(vocabulary, progressMap, { size = 20, mode = 'due', favorites = new Set(), now = Date.now() } = {}) {
  const entries = Array.isArray(vocabulary) ? vocabulary : [];
  const byId = new Map(entries.map(entry => [entry.id, entry]));
  const make = progress => ({ vocab: byId.get(progress.id), progress });
  const valid = progress => progress && byId.has(progress.id);
  const all = Object.values(progressMap || {}).filter(valid);
  const limit = Number.isFinite(Number(size)) ? Math.max(0, Math.floor(Number(size))) : 0;
  const favoriteIds = favorites && typeof favorites.has === 'function' ? favorites : new Set(Array.isArray(favorites) ? favorites : []);
  let candidates;

  if (mode === 'new') {
    candidates = all.filter(p => p.state === STATES.NEW).map(make);
  } else if (mode === 'weak') {
    candidates = all.filter(p => p.state === STATES.WEAK)
      .sort((a, b) => b.wrongCount - a.wrongCount || a.nextReview - b.nextReview).map(make);
  } else if (mode === 'favorites') {
    candidates = all.filter(p => favoriteIds.has(p.id)).map(make);
  } else if (mode === 'random') {
    candidates = shuffle(all).map(make);
  } else {
    const priority = { weak: 0, learning: 1, review: 2, new: 3, mastered: 4 };
    const due = all.filter(p => isDue(p, now))
      .sort((a, b) => priority[a.state] - priority[b.state] || b.wrongCount - a.wrongCount);
    const selectedIds = new Set(due.map(p => p.id));
    const fill = all.filter(p => !selectedIds.has(p.id))
      .sort((a, b) => priority[a.state] - priority[b.state] || a.nextReview - b.nextReview);
    candidates = [...due, ...fill].map(make);
  }

  // Interleave states for non-due sessions without losing weak-word priority.
  if (mode === 'new' || mode === 'favorites') {
    const buckets = new Map();
    candidates.forEach(item => {
      if (!buckets.has(item.progress.state)) buckets.set(item.progress.state, []);
      buckets.get(item.progress.state).push(item);
    });
    const interleaved = [];
    let index = 0;
    while (interleaved.length < candidates.length) {
      let added = false;
      for (const bucket of buckets.values()) {
        if (bucket[index]) { interleaved.push(bucket[index]); added = true; }
      }
      if (!added) break;
      index += 1;
    }
    candidates = interleaved;
  }
  return candidates.slice(0, limit);
}

function examplesFor(entry) {
  return Array.isArray(entry?.examples) ? entry.examples.filter(Boolean).map(example => {
    if (typeof example === 'string') return { en: example, vi: '' };
    return { en: example.en || '', vi: example.vi || '' };
  }).filter(example => example.en) : [];
}

function escapeRegExp(value) {
  return String(value ?? '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function distractors(vocabulary, current, field) {
  const seen = new Set([normalize(current[field])]);
  const entries = Array.isArray(vocabulary) ? vocabulary : [];
  return shuffle(entries.filter(entry => entry && entry.id !== current.id && entry[field] && !seen.has(normalize(entry[field]))))
    .slice(0, 3);
}

export function generateQuestion(item, vocabulary, modeHint = null) {
  const entry = item.vocab || item;
  const progress = item.progress || createInitialProgress(entry.id);
  const examples = examplesFor(entry);
  let mode = Object.values(MODES).includes(modeHint) ? modeHint : null;
  if (!mode) {
    const choices = examples.length ? [MODES.RECOGNITION, MODES.RECALL, MODES.SPELLING, MODES.CLOZE] : [MODES.RECOGNITION, MODES.RECALL, MODES.SPELLING];
    mode = choices[(progress.correctCount + progress.wrongCount) % choices.length];
  }
  if (mode === MODES.CLOZE && !examples.length) mode = MODES.RECOGNITION;

  if (mode === MODES.RECOGNITION) {
    const options = shuffle([{ id: entry.id, text: entry.meaning, correct: true }, ...distractors(vocabulary, entry, 'meaning').map(other => ({ id: other.id, text: other.meaning, correct: false }))]);
    return { mode, prompt: entry.word, subPrompt: entry.pos, options, answer: entry.meaning };
  }
  if (mode === MODES.RECALL) {
    const options = shuffle([{ id: entry.id, text: entry.word, correct: true }, ...distractors(vocabulary, entry, 'word').map(other => ({ id: other.id, text: other.word, correct: false }))]);
    return { mode, prompt: entry.meaning, subPrompt: `(${entry.pos}) · Việt → Anh`, options, answer: entry.word };
  }
  if (mode === MODES.SPELLING) {
    return { mode, prompt: entry.meaning, subPrompt: `${entry.pos} · gõ từ tiếng Anh`, options: null, answer: entry.word, hint: `${entry.word[0]}${'•'.repeat(Math.max(0, entry.word.length - 1))}` };
  }

  const example = examples[0];
  const escapedWord = escapeRegExp(entry.word);
  // Match a whole word or phrase and recognise a regular plural (task -> tasks)
  // without accidentally replacing a substring such as art in article.
  const examplePattern = new RegExp(`(^|[^A-Za-z])${escapedWord}s?(?=$|[^A-Za-z])`, 'ig');
  const cloze = examplePattern.test(example.en)
    ? example.en.replace(examplePattern, (_match, prefix) => `${prefix}_____`)
    : `_____ · ${entry.meaning}`;
  const options = shuffle([{ id: entry.id, text: entry.word, correct: true }, ...distractors(vocabulary, entry, 'word').map(other => ({ id: other.id, text: other.word, correct: false }))]);
  return { mode: MODES.CLOZE, prompt: cloze, subPrompt: `${entry.pos} · chọn từ phù hợp`, options, answer: entry.word, example };
}

export function checkAnswer(question, answer) {
  if (!question) return false;
  if (question.mode === MODES.SPELLING) return normalize(answer) === normalize(question.answer);
  return Boolean(question.options?.find(option => option.id === answer && option.correct));
}

function searchText(entry) {
  const examples = examplesFor(entry).flatMap(example => [example.en, example.vi]);
  return normalize([entry.word, entry.meaning, entry.pos, ...(entry.tags || []), ...examples].join(' '));
}

export function createSearchIndex(vocabulary, progressMap = {}, favorites = new Set()) {
  const favoriteIds = favorites && typeof favorites.has === 'function' ? favorites : new Set(Array.isArray(favorites) ? favorites : []);
  return (Array.isArray(vocabulary) ? vocabulary : []).map(entry => ({
    entry,
    word: entry.word,
    wordLower: normalize(entry.word),
    searchLower: searchText(entry),
    posLower: normalize(entry.pos),
    state: progressMap?.[entry.id]?.state || STATES.NEW,
    progress: progressMap?.[entry.id],
    favorite: favoriteIds.has(entry.id)
  }));
}

export function searchVocabulary(index = [], query = '', filters = {}, now = Date.now()) {
  const normalizedQuery = normalize(query);
  const safeFilters = filters && typeof filters === 'object' ? filters : {};
  const state = safeFilters.state || 'all';
  const pos = safeFilters.pos || 'all';
  const sort = safeFilters.sort || 'az';
  let results = (Array.isArray(index) ? index : []).filter(item => {
    if (!item || !item.entry) return false;
    if (state === 'due' && !isDue(item.progress, now)) return false;
    if (state === 'favorites' && !item.favorite) return false;
    if (VALID_STATES.has(state) && item.state !== state) return false;
    if (pos !== 'all' && normalize(item.entry.pos) !== normalize(pos)) return false;
    return !normalizedQuery || item.searchLower.includes(normalizedQuery);
  });
  if (normalizedQuery) {
    results = results.map(item => ({ ...item, score: item.wordLower === normalizedQuery ? 100 : item.wordLower.startsWith(normalizedQuery) ? 80 : item.searchLower.includes(normalizedQuery) ? 50 : 0 }))
      .sort((a, b) => b.score - a.score || a.word.localeCompare(b.word));
  } else {
    results = sortResults(results, sort);
  }
  return results;
}

export function sortResults(results, sort = 'az') {
  const copy = [...results];
  const numeric = value => Number.isFinite(value) ? value : 0;
  if (sort === 'za') copy.sort((a, b) => b.word.localeCompare(a.word));
  else if (sort === 'difficulty') copy.sort((a, b) => numeric(b.progress?.difficulty) - numeric(a.progress?.difficulty));
  else if (sort === 'mostWrong') copy.sort((a, b) => numeric(b.progress?.wrongCount) - numeric(a.progress?.wrongCount));
  else if (sort === 'dueSoon') copy.sort((a, b) => numeric(a.progress?.nextReview) - numeric(b.progress?.nextReview));
  else copy.sort((a, b) => a.word.localeCompare(b.word));
  return copy;
}

export function loadPrefs(storage = memorySafeStorage()) {
  const value = readJson(storage, STORAGE_KEYS.prefs, {});
  return {
    ...DEFAULT_PREFS,
    ...(value && typeof value === 'object' ? value : {}),
    sessionSize: [10, 20, 30, 50].includes(Number(value?.sessionSize)) ? Number(value.sessionSize) : DEFAULT_PREFS.sessionSize,
    keyboardShortcuts: value?.keyboardShortcuts !== false,
    darkMode: value?.darkMode === true
  };
}

export function savePrefs(prefs, storage = memorySafeStorage()) {
  return writeJson(storage, STORAGE_KEYS.prefs, { ...DEFAULT_PREFS, ...prefs });
}

export function loadFavorites(storage = memorySafeStorage()) {
  const value = readJson(storage, STORAGE_KEYS.favorites, []);
  return new Set(Array.isArray(value) ? value.filter(id => typeof id === 'string') : []);
}

export function saveFavorites(favorites, storage = memorySafeStorage()) {
  const values = favorites && typeof favorites[Symbol.iterator] === 'function' ? [...favorites] : [];
  return writeJson(storage, STORAGE_KEYS.favorites, values.filter(id => typeof id === 'string'));
}

function sanitizeHistoryEntry(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const numericKeys = ['total', 'correct', 'wrong', 'accuracy', 'durationSec'];
  if (typeof value.date !== 'string' || !value.date || Number.isNaN(Date.parse(value.date))) return null;
  if (typeof value.mode !== 'string' || !value.mode || value.mode.length > 80) return null;
  if (numericKeys.some(key => !Number.isFinite(value[key]) || value[key] < 0)) return null;
  return {
    date: value.date,
    total: Math.floor(value.total),
    correct: Math.floor(value.correct),
    wrong: Math.floor(value.wrong),
    accuracy: Math.min(100, Math.floor(value.accuracy)),
    mode: value.mode,
    durationSec: Math.floor(value.durationSec)
  };
}

export function loadHistory(storage = memorySafeStorage()) {
  const value = readJson(storage, STORAGE_KEYS.history, []);
  if (!Array.isArray(value)) return [];
  return value.map(sanitizeHistoryEntry).filter(Boolean).slice(-50);
}

export function saveHistory(history, storage = memorySafeStorage()) {
  const entries = Array.isArray(history) ? history.map(sanitizeHistoryEntry).filter(Boolean) : [];
  return writeJson(storage, STORAGE_KEYS.history, entries.slice(-50));
}

function sanitizeStreak(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (![value.current, value.longest].every(number => Number.isFinite(number) && number >= 0)) return null;
  const lastDate = value.lastDate ?? null;
  if (lastDate !== null && (typeof lastDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(lastDate))) return null;
  return {
    current: Math.floor(value.current),
    longest: Math.floor(value.longest),
    lastDate
  };
}

export function loadStreak(storage = memorySafeStorage()) {
  const value = readJson(storage, STORAGE_KEYS.streak, {});
  return sanitizeStreak(value) || { current: 0, longest: 0, lastDate: null };
}

export function saveStreak(streak, storage = memorySafeStorage()) {
  return writeJson(storage, STORAGE_KEYS.streak, sanitizeStreak(streak) || { current: 0, longest: 0, lastDate: null });
}

export function exportProgressBundle({ progress, prefs, favorites, history, streak }) {
  return {
    app: 'chuyen-anh-flashcard',
    version: 1,
    exportedAt: new Date().toISOString(),
    progress,
    prefs,
    favorites: [...favorites],
    history,
    streak
  };
}

export function validateImportPayload(payload, validIds = null) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Tệp backup phải là một JSON object.');
  if (payload.app !== 'chuyen-anh-flashcard' || payload.version !== 1) throw new Error('Tệp backup không đúng phiên bản của Chuyên Anh.');
  if (!payload.progress || typeof payload.progress !== 'object' || Array.isArray(payload.progress)) throw new Error('Backup thiếu progress hợp lệ.');
  const progress = {};
  for (const [id, value] of Object.entries(payload.progress)) {
    if (!value || typeof value !== 'object' || !VALID_STATES.has(value.state)) throw new Error(`Progress của từ ${id} không hợp lệ.`);
    const sanitized = sanitizeProgress(value, id);
    if (!sanitized) throw new Error(`Progress của từ ${id} không hợp lệ.`);
    if (!validIds || validIds.has(id)) progress[id] = sanitized;
  }
  if (!Array.isArray(payload.favorites) || payload.favorites.some(id => typeof id !== 'string')) throw new Error('favorites phải là một mảng chuỗi.');
  if (!Array.isArray(payload.history)) throw new Error('history không hợp lệ.');
  const history = payload.history.map(sanitizeHistoryEntry);
  if (history.some(item => !item)) throw new Error('history không hợp lệ.');
  if (!payload.streak || typeof payload.streak !== 'object' || Array.isArray(payload.streak)) throw new Error('streak không hợp lệ.');
  const streak = sanitizeStreak(payload.streak);
  if (!streak) throw new Error('streak không hợp lệ.');
  if (payload.prefs !== undefined && (!payload.prefs || typeof payload.prefs !== 'object' || Array.isArray(payload.prefs))) throw new Error('prefs không hợp lệ.');
  const importedPrefs = { ...DEFAULT_PREFS, ...(payload.prefs || {}) };
  if (![10, 20, 30, 50].includes(Number(importedPrefs.sessionSize)) || typeof importedPrefs.keyboardShortcuts !== 'boolean' || typeof importedPrefs.darkMode !== 'boolean') {
    throw new Error('prefs chứa giá trị không hợp lệ.');
  }
  return {
    progress,
    prefs: { ...importedPrefs, sessionSize: Number(importedPrefs.sessionSize) },
    favorites: new Set(validIds ? payload.favorites.filter(id => validIds.has(id)) : payload.favorites),
    history: history.slice(-50),
    streak
  };
}

function fingerprint(text) {
  // A small deterministic fingerprint avoids a generated build step while making the displayed version data-derived.
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return `${text.length.toString(16)}-${(hash >>> 0).toString(16).padStart(8, '0')}`;
}

function validateRuntimeEntry(entry, index) {
  if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return `Entry ${index + 1} phải là object.`;
  if (typeof entry.id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(entry.id.trim())) return `Entry ${index + 1} có id không hợp lệ.`;
  for (const field of ['word', 'pos', 'meaning']) {
    if (typeof entry[field] !== 'string' || !entry[field].trim()) return `Entry ${index + 1} thiếu ${field}.`;
  }
  if (entry.examples !== undefined) {
    if (!Array.isArray(entry.examples)) return `Entry ${index + 1} có examples không hợp lệ.`;
    if (entry.examples.some(example => !example || typeof example !== 'object' || Array.isArray(example)
      || typeof example.en !== 'string' || !example.en.trim()
      || typeof example.vi !== 'string' || !example.vi.trim())) {
      return `Entry ${index + 1} có example không hợp lệ.`;
    }
  }
  if (entry.tags !== undefined && (!Array.isArray(entry.tags)
    || entry.tags.some(tag => typeof tag !== 'string' || !tag.trim()))) return `Entry ${index + 1} có tags không hợp lệ.`;
  if (entry.difficulty !== undefined && (typeof entry.difficulty !== 'number'
    || !Number.isFinite(entry.difficulty) || entry.difficulty < 0 || entry.difficulty > 5)) return `Entry ${index + 1} có difficulty không hợp lệ.`;
  return null;
}

export async function loadVocabulary(url = './data/vocabulary.json') {
  const separator = url.includes('?') ? '&' : '?';
  const response = await fetch(`${url}${separator}refresh=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Vocabulary request failed (${response.status}).`);
  const raw = await response.text();
  let data;
  try { data = JSON.parse(raw); } catch (error) { throw new Error(`Vocabulary JSON không hợp lệ: ${error.message}`); }
  if (!Array.isArray(data) || data.length === 0) throw new Error('Vocabulary phải là một mảng không rỗng.');
  const ids = new Set();
  const words = new Set();
  for (const [index, entry] of data.entries()) {
    const validationError = validateRuntimeEntry(entry, index);
    if (validationError) throw new Error(validationError);
    const id = entry.id.trim().toLowerCase();
    const word = normalize(entry.word);
    if (ids.has(id)) throw new Error(`Trùng ID trong dữ liệu: ${entry.id}`);
    if (words.has(word)) throw new Error(`Trùng word trong dữ liệu: ${entry.word}`);
    ids.add(id); words.add(word);
  }
  return { data, version: fingerprint(raw) };
}

function formatDate(value) {
  try { return new Date(value).toLocaleDateString('vi-VN'); } catch { return ''; }
}

function formatNextReview(timestamp) {
  const diff = timestamp - Date.now();
  if (diff <= 0) return 'đến hạn';
  const hours = Math.ceil(diff / 3600000);
  return hours < 24 ? `${hours} giờ nữa` : `${Math.ceil(hours / 24)} ngày nữa`;
}

function exampleHtml(entry) {
  const example = examplesFor(entry)[0];
  if (!example) return '';
  return `<div class="example"><strong>Ví dụ</strong><br><em>${escapeHtml(example.en)}</em>${example.vi ? `<br><span>${escapeHtml(example.vi)}</span>` : ''}</div>`;
}

function dateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayKey() { return dateKey(); }

export async function createApp(root) {
  let loaded;
  try {
    loaded = await loadVocabulary();
  } catch (error) {
    root.innerHTML = `<main class="layout" style="display:block"><div class="error"><strong>Không thể tải dữ liệu từ vựng</strong><span>${escapeHtml(error.message)}</span><br><button class="btn primary" id="retry" style="margin-top:14px">Tải lại</button><p style="margin:12px 0 0;font-size:.75rem">Khi mở file trực tiếp, một số trình duyệt chặn fetch vì chính sách file://. Hãy dùng GitHub Pages hoặc <code class="code">python -m http.server</code>.</p></div></main>`;
    root.querySelector('#retry')?.addEventListener('click', () => location.reload());
    return;
  }

  const vocabulary = loaded.data;
  const validIds = new Set(vocabulary.map(entry => entry.id));
  const storage = memorySafeStorage();
  let progress = ensureProgress(loadProgress(storage), vocabulary);
  let prefs = loadPrefs(storage);
  let favorites = new Set([...loadFavorites(storage)].filter(id => validIds.has(id)));
  let history = loadHistory(storage);
  let streak = loadStreak(storage);
  let view = 'learn';
  let session = null;
  let question = null;
  let questionStarted = 0;
  let answered = false;
  let revealed = false;
  let answerResult = null;
  let lastAnswered = null;
  let repeatQueued = false;
  let sessionStats = null;
  let sessionSummary = null;

  function persist() {
    const ok = [saveProgress(progress, storage), savePrefs(prefs, storage), saveFavorites(favorites, storage), saveHistory(history, storage), saveStreak(streak, storage)].every(Boolean);
    if (!ok) toast('Không thể lưu dữ liệu trên thiết bị này.', 'error');
  }

  function updateStreak() {
    const today = todayKey();
    if (streak.lastDate === today) return;
    const yesterdayDate = new Date();
    yesterdayDate.setDate(yesterdayDate.getDate() - 1);
    const yesterday = dateKey(yesterdayDate);
    streak.current = streak.lastDate === yesterday ? streak.current + 1 : 1;
    streak.longest = Math.max(streak.longest, streak.current);
    streak.lastDate = today;
    saveStreak(streak, storage);
  }

  function toast(message, type = 'info') {
    document.querySelector('.toast')?.remove();
    const node = document.createElement('div');
    node.className = 'toast';
    node.textContent = `${type === 'error' ? '⚠️ ' : type === 'success' ? '✓ ' : ''}${message}`;
    document.body.append(node);
    setTimeout(() => node.remove(), 3200);
  }

  function applyTheme() { document.documentElement.dataset.theme = prefs.darkMode ? 'dark' : 'light'; }

  function stats() { return calculateStats(progress); }

  function renderShell() {
    applyTheme();
    const currentStats = stats();
    root.innerHTML = `
      <header class="topbar">
        <div class="topbar-inner">
          <a class="brand" href="#learn" id="brand-link" aria-label="Về trang học">
            <span class="brand-mark">CA</span>
            <span><span class="brand-name">Chuyên Anh</span><span class="brand-detail">Flashcard · ${vocabulary.length} từ · data ${escapeHtml(loaded.version)}</span></span>
          </a>
          <div class="top-meta"><span>📚 ${vocabulary.length} từ</span><i class="dot"></i><span>⏰ ${currentStats.due} đến hạn</span><i class="dot"></i><span>🔥 ${streak.current}</span></div>
          <div class="top-actions"><button class="btn subtle small" id="theme-button" aria-label="Đổi giao diện">◐</button><button class="btn small" id="export-top">Xuất</button></div>
        </div>
      </header>
      <div class="layout">
        <aside class="sidebar">
          <div class="panel"><nav class="nav" aria-label="Điều hướng chính">
            ${navButton('learn', '📖', 'Học', currentStats.due)}
            ${navButton('dashboard', '▦', 'Dashboard')}
            ${navButton('search', '⌕', 'Tra cứu', vocabulary.length)}
            ${navButton('settings', '⚙', 'Cài đặt')}
          </nav></div>
          <div class="panel"><div class="panel-heading">Tiến độ</div><div class="panel-body"><div class="mini-stats">
            ${miniStat(currentStats.total, 'Tổng')}${miniStat(currentStats.mastered, 'Thành thạo')}${miniStat(currentStats.weak, 'Từ yếu')}${miniStat(`${currentStats.accuracy}%`, 'Chính xác')}
          </div></div></div>
          <div class="panel"><div class="panel-heading">Phím tắt</div><div class="panel-body shortcuts">
            <div class="shortcut"><span>Chọn đáp án</span><kbd>1–4</kbd></div><div class="shortcut"><span>Lật / tiếp</span><kbd>Space</kbd></div><div class="shortcut"><span>Xác nhận / tiếp</span><kbd>Enter</kbd></div><div class="shortcut"><span>Lặp lại</span><kbd>R</kbd></div>
          </div></div>
        </aside>
        <main class="content" id="content" tabindex="-1"></main>
      </div>
      <footer class="footer">Static frontend · localStorage · active recall · spaced repetition · data version ${escapeHtml(loaded.version)}</footer>
    `;
    root.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => { view = button.dataset.view; sessionSummary = null; renderShell(); }));
    root.querySelector('#brand-link').addEventListener('click', event => { event.preventDefault(); view = 'learn'; sessionSummary = null; renderShell(); });
    root.querySelector('#theme-button').addEventListener('click', () => { prefs.darkMode = !prefs.darkMode; savePrefs(prefs, storage); applyTheme(); renderShell(); });
    root.querySelector('#export-top').addEventListener('click', exportDownload);
    renderView();
  }

  function navButton(id, icon, label, count = null) {
    return `<button class="nav-button ${view === id ? 'active' : ''}" data-view="${id}" ${view === id ? 'aria-current="page"' : ''}><span class="nav-icon">${icon}</span><span>${label}</span>${count === null ? '' : `<span class="nav-count">${count}</span>`}</button>`;
  }

  function miniStat(value, label) { return `<div class="mini-stat"><strong>${value}</strong><span>${label}</span></div>`; }

  function renderView() {
    const content = root.querySelector('#content');
    if (!content) return;
    if (view === 'learn') renderLearn(content);
    else if (view === 'dashboard') renderDashboard(content);
    else if (view === 'search') renderSearch(content);
    else renderSettings(content);
    content.focus({ preventScroll: true });
  }

  function renderLearn(container) {
    if (session?.length) { renderFlashcard(container); return; }
    if (sessionSummary) { renderSummary(container); return; }
    const currentStats = stats();
    container.innerHTML = `
      <div class="page-header"><div><h1>Học từ vựng Chuyên Anh</h1><p>Ôn chủ động, gặp lại đúng lúc. Phiên học ưu tiên từ yếu và từ đã đến hạn trước khi thêm từ mới.</p></div></div>
      <div class="session-grid">
        ${sessionCard('due', '⏰', 'Đến hạn hôm nay', 'Ôn những từ cần truy xuất lại', `${currentStats.due} từ`)}
        ${sessionCard('weak', '🎯', 'Từ yếu', 'Tập trung vào các từ hay sai', `${currentStats.weak} từ`)}
        ${sessionCard('new', '✦', 'Từ mới', 'Bắt đầu với các từ chưa học', `${currentStats.new} từ`)}
        ${sessionCard('random', '◈', 'Ngẫu nhiên', 'Interleave toàn bộ kho từ', `${vocabulary.length} từ`)}
        ${sessionCard('favorites', '★', 'Yêu thích', 'Ôn lại danh sách đã đánh dấu', `${favorites.size} từ`)}
        ${sessionCard('quick10', '⚡', 'Nhanh 10 từ', 'Một phiên ngắn trong giờ giải lao', '10 từ')}
        ${sessionCard('quick20', '◫', '20 từ', 'Phiên cân bằng mỗi ngày', '20 từ')}
        ${sessionCard('quick30', '↗', '30 từ', 'Phiên học sâu hơn', '30 từ')}
      </div>
      <section class="panel"><div class="panel-heading">Cách học hiệu quả</div><div class="panel-body info-grid">
        <div class="info-item"><b>🧠 Active recall<span>Tự nhớ trước khi xem đáp án.</span></b></div>
        <div class="info-item"><b>⏱ Spaced repetition<span>Sai gặp lại sớm, đúng giãn cách.</span></b></div>
        <div class="info-item"><b>🔀 Interleaving<span>Trộn nhiều dạng câu hỏi và chủ đề.</span></b></div>
      </div></section>
    `;
    container.querySelectorAll('[data-session]').forEach(button => button.addEventListener('click', () => startSession(button.dataset.session)));
  }

  function sessionCard(id, icon, title, description, count) {
    return `<button class="session-card" data-session="${id}"><span class="session-icon">${icon}</span><h3>${title}</h3><p>${description}</p><span class="session-count">${count}</span></button>`;
  }

  function startSession(type) {
    const sizes = { quick10: 10, quick20: 20, quick30: 30 };
    const mode = type.startsWith('quick') ? 'due' : type;
    const size = sizes[type] || prefs.sessionSize;
    const selected = selectSession(vocabulary, progress, { size, mode, favorites });
    if (!selected.length) {
      toast(type === 'favorites' ? 'Bạn chưa đánh dấu từ yêu thích nào.' : 'Chưa có từ phù hợp cho phiên này. Hãy thử chế độ khác.');
      return;
    }
    session = selected;
    sessionStats = { total: selected.length, correct: 0, wrong: 0, startedAt: Date.now(), mode };
    sessionSummary = null;
    lastAnswered = null;
    repeatQueued = false;
    nextQuestion();
    renderShell();
  }

  function nextQuestion() {
    if (!session?.length) return finishSession();
    const item = session[0];
    item.progress = progress[item.vocab.id];
    question = generateQuestion(item, vocabulary);
    questionStarted = Date.now();
    answered = false;
    revealed = false;
    answerResult = null;
  }

  function renderFlashcard(container) {
    if (!session?.length) { renderLearn(container); return; }
    const item = session[0];
    const currentStats = stats();
    const done = sessionStats.total - session.length;
    const percent = Math.round(done / sessionStats.total * 100);
    const options = question.options || [];
    container.innerHTML = `
      <div class="flashcard-wrap">
        <div class="page-header"><div><h1>Phiên học</h1><p>${sessionStats.mode === 'due' ? 'Ưu tiên due + weak' : `Chế độ ${escapeHtml(sessionStats.mode)}`} · ${session.length} từ còn lại</p></div><button class="btn" id="exit-session">Thoát phiên</button></div>
        <div class="session-progress" aria-label="Tiến độ phiên" role="progressbar" aria-valuenow="${percent}" aria-valuemin="0" aria-valuemax="100"><span style="width:${percent}%"></span></div>
        <article class="flashcard">
          <div class="flashcard-head"><span><b>${done + 1}</b> / ${sessionStats.total} · ${session.length} còn lại</span><div class="flashcard-head-actions"><span class="state-pill state-${escapeHtml(item.progress.state)}">${escapeHtml(item.progress.state)}</span><button class="fav ${favorites.has(item.vocab.id) ? 'active' : ''}" id="favorite-card" aria-label="${favorites.has(item.vocab.id) ? 'Bỏ yêu thích' : 'Thêm yêu thích'}">${favorites.has(item.vocab.id) ? '★' : '☆'}</button><button class="btn small" id="skip-card">Bỏ qua</button></div></div>
          <div class="flashcard-body">
            <div class="mode-label">${modeLabel(question.mode)} · ${escapeHtml(item.vocab.pos)}</div>
            <div class="prompt">${escapeHtml(question.prompt)}</div><div class="sub-prompt">${escapeHtml(question.subPrompt || '')}</div>
            <div id="question-area"></div>
            ${revealed && !answered ? `<div class="reveal"><strong>${escapeHtml(question.answer)}</strong><span>Đây là đáp án. Tự đánh giá rồi chọn bên dưới.</span><div class="actions" style="justify-content:center;margin-top:10px"><button class="btn primary small" id="reveal-correct">Nhớ được</button><button class="btn danger small" id="reveal-wrong">Chưa nhớ</button></div></div>` : ''}
            <div id="feedback-area"></div>
          </div>
          <div class="card-footer"><span><span>Đúng ${item.progress.correctCount}</span><span>Sai ${item.progress.wrongCount}</span><span>Khó ${Math.round(item.progress.difficulty * 100)}%</span></span><span><kbd>Space</kbd> lật · <kbd>Enter</kbd> tiếp</span></div>
        </article>
      </div>
    `;
    const questionArea = container.querySelector('#question-area');
    if (question.mode === MODES.SPELLING) {
      questionArea.innerHTML = `<div class="spelling"><input id="spelling-input" aria-label="Nhập từ tiếng Anh" autocomplete="off" spellcheck="false" placeholder="Gõ từ tiếng Anh…" ${answered ? 'disabled' : ''}><button class="btn primary" id="submit-answer" ${answered ? 'disabled' : ''}>Xác nhận</button></div><div style="margin-top:8px;color:var(--muted);font-size:.75rem">Gợi ý: <span class="code">${escapeHtml(question.hint)}</span></div>`;
      const input = questionArea.querySelector('#spelling-input');
      input.addEventListener('keydown', event => { if (event.key === 'Enter') { event.preventDefault(); handleAnswer(input.value); } });
      questionArea.querySelector('#submit-answer').addEventListener('click', () => handleAnswer(input.value));
      if (!answered) setTimeout(() => input.focus(), 0);
    } else {
      questionArea.innerHTML = `<div class="options" role="radiogroup">${options.map((option, index) => `<button class="option ${answerResult && option.correct ? 'correct' : ''} ${answerResult && answerResult.selected === option.id && !answerResult.correct ? 'wrong' : ''}" data-option="${escapeHtml(option.id)}" ${answered ? 'disabled' : ''}><span class="option-index">${index + 1}</span><span>${escapeHtml(option.text)}</span></button>`).join('')}</div>`;
      questionArea.querySelectorAll('[data-option]').forEach(button => button.addEventListener('click', () => handleAnswer(button.dataset.option)));
    }
    container.querySelector('#favorite-card').addEventListener('click', () => toggleFavorite(item.vocab.id));
    container.querySelector('#skip-card').addEventListener('click', skipCard);
    container.querySelector('#exit-session').addEventListener('click', () => { session = null; question = null; renderShell(); });
    container.querySelector('#reveal-correct')?.addEventListener('click', () => handleAnswer('__revealed_correct__', true));
    container.querySelector('#reveal-wrong')?.addEventListener('click', () => handleAnswer('__revealed_wrong__', false));
    if (answered) renderFeedback(container);
  }

  function modeLabel(mode) { return ({ recognition: 'Nhận diện', recall: 'Gợi nhớ ngược', spelling: 'Chính tả', cloze: 'Điền vào ngữ cảnh' })[mode] || mode; }

  function handleAnswer(answer, forced = null) {
    if (answered || !question || !session?.length) return;
    const correct = forced === null ? checkAnswer(question, answer) : forced;
    const item = session[0];
    const updated = updateProgress(progress[item.vocab.id], correct, Date.now() - questionStarted);
    progress[item.vocab.id] = updated;
    item.progress = updated;
    answered = true;
    answerResult = { correct, selected: answer };
    lastAnswered = item;
    updateStreak();
    repeatQueued = false;
    if (correct) sessionStats.correct += 1; else sessionStats.wrong += 1;
    persist();
    renderFlashcard(root.querySelector('#content'));
  }

  function renderFeedback(container) {
    const item = session[0];
    const correct = answerResult.correct;
    const answerText = question.answer;
    container.querySelector('#feedback-area').innerHTML = `<div class="feedback ${correct ? 'correct' : 'wrong'}" role="alert"><div class="feedback-title">${correct ? '✓ Chính xác!' : `✕ Chưa đúng · Đáp án: ${escapeHtml(answerText)}`}</div><p><strong>${escapeHtml(item.vocab.word)}</strong> · ${escapeHtml(item.vocab.meaning)}</p>${!correct ? `<p>Bạn sai từ này ${item.progress.wrongCount} lần. Từ yếu sẽ được ưu tiên trong phiên sau.</p>` : ''}${exampleHtml(item.vocab)}<p style="color:var(--muted);font-size:.75rem">Lần ôn tiếp theo: ${formatNextReview(item.progress.nextReview)} · trạng thái: ${item.progress.state}</p><div class="actions" style="margin-top:12px"><button class="btn primary full" id="next-card">Tiếp tục <kbd>Enter</kbd></button></div></div>`;
    container.querySelector('#next-card').addEventListener('click', advanceCard);
  }

  function advanceCard() {
    if (!answered || !session?.length) return;
    session.shift();
    if (!session.length) return finishSession();
    nextQuestion();
    renderShell();
  }

  function skipCard() {
    if (!session?.length || answered) return;
    session.push(session.shift());
    nextQuestion();
    renderFlashcard(root.querySelector('#content'));
  }

  function repeatCurrent() {
    if (!answered || !session?.length || repeatQueued) return;
    session.unshift({ vocab: lastAnswered.vocab, progress: progress[lastAnswered.vocab.id] });
    repeatQueued = true;
    toast('Đã xếp lại từ này ngay sau thẻ hiện tại.');
    advanceCard();
  }

  function toggleFavorite(id) {
    if (favorites.has(id)) { favorites.delete(id); toast('Đã bỏ yêu thích.'); }
    else { favorites.add(id); toast('Đã thêm vào yêu thích.', 'success'); }
    saveFavorites(favorites, storage);
    renderShell();
  }

  function finishSession() {
    const total = sessionStats.total;
    const accuracy = total ? Math.round(sessionStats.correct / total * 100) : 0;
    sessionSummary = { ...sessionStats, accuracy, duration: Math.max(1, Math.round((Date.now() - sessionStats.startedAt) / 1000)) };
    history.push({ date: new Date().toISOString(), total, correct: sessionStats.correct, wrong: sessionStats.wrong, accuracy, mode: sessionStats.mode, durationSec: sessionSummary.duration });
    saveHistory(history, storage);
    session = null; question = null; answered = false;
    renderShell();
  }

  function renderSummary(container) {
    const summary = sessionSummary;
    container.innerHTML = `<div class="summary"><section class="panel"><div class="panel-body"><div style="font-size:2.3rem">🎉</div><h2>Hoàn thành phiên học</h2><p>${summary.total} thẻ · ${summary.duration}s · ${escapeHtml(summary.mode)}</p><div class="summary-grid"><div><strong>${summary.accuracy}%</strong><span>Chính xác</span></div><div><strong style="color:var(--success)">${summary.correct}</strong><span>Đúng</span></div><div><strong style="color:var(--danger)">${summary.wrong}</strong><span>Sai</span></div><div><strong>${stats().weak}</strong><span>Từ yếu</span></div></div><div class="actions" style="justify-content:center"><button class="btn primary" id="again">Học tiếp</button><button class="btn" id="summary-dashboard">Xem dashboard</button></div></div></section></div>`;
    container.querySelector('#again').addEventListener('click', () => { sessionSummary = null; renderLearn(container); });
    container.querySelector('#summary-dashboard').addEventListener('click', () => { view = 'dashboard'; sessionSummary = null; renderShell(); });
  }

  function renderDashboard(container) {
    const currentStats = stats();
    const colors = { new: '#849590', learning: '#d49120', weak: '#c9564d', review: '#4e91c8', mastered: '#2f9b66' };
    const totalForBar = Math.max(1, currentStats.total);
    const recent = [...history].reverse().slice(0, 8);
    container.innerHTML = `<div class="page-header"><div><h1>Dashboard</h1><p>Tổng quan tiến độ học trên thiết bị này. Dữ liệu không rời khỏi trình duyệt.</p></div></div><div class="stat-grid">${statCard(currentStats.total, 'Tổng từ')}${statCard(currentStats.new, 'Từ mới')}${statCard(currentStats.learning + currentStats.review, 'Đang học')}${statCard(currentStats.weak, 'Từ yếu')}${statCard(currentStats.mastered, 'Thành thạo')}${statCard(currentStats.due, 'Đến hạn')}${statCard(`${currentStats.accuracy}%`, 'Độ chính xác')}${statCard(`🔥 ${streak.current}`, 'Streak')}</div><div class="two-col"><section class="panel"><div class="section-header"><h2 class="section-title">Phân bố trạng thái</h2><span style="color:var(--muted);font-size:.73rem">${currentStats.learned} đã học</span></div><div class="panel-body"><div class="bar">${Object.keys(colors).map(state => `<i style="flex:${Math.max(.001, currentStats[state] / totalForBar)};background:${colors[state]}" title="${state}: ${currentStats[state]}"></i>`).join('')}</div><div class="legend">${Object.keys(colors).map(state => `<span><i style="background:${colors[state]}"></i>${state} · ${currentStats[state]}</span>`).join('')}</div></div></section><section class="panel"><div class="section-header"><h2 class="section-title">Lịch sử phiên học</h2><span style="color:var(--muted);font-size:.73rem">${history.length} phiên</span></div><div class="history">${recent.length ? recent.map(item => `<div class="history-row"><div><b>${escapeHtml(item.mode)}</b><small>${formatDate(item.date)} · ${item.total} thẻ</small></div><strong>${item.accuracy}%</strong></div>`).join('') : '<div class="empty" style="padding:20px;border:0">Chưa có phiên học.</div>'}</div></section></div>`;
  }

  function statCard(value, label) { return `<div class="stat-card"><strong>${value}</strong><span>${label}</span></div>`; }

  function renderSearch(container) {
    const index = createSearchIndex(vocabulary, progress, favorites);
    const positions = [...new Set(vocabulary.map(entry => entry.pos).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    container.innerHTML = `<div class="page-header"><div><h1>Tra cứu từ vựng</h1><p>Tìm theo tiếng Anh, tiếng Việt, từ loại, tag hoặc ví dụ · ${vocabulary.length} từ.</p></div></div><div class="search-tools"><input class="search-input" id="search-field" placeholder="Tìm từ hoặc nghĩa…" aria-label="Tìm kiếm từ vựng"><button class="btn" id="clear-search">Xóa</button></div><div class="filters"><select class="select" id="state-filter" aria-label="Lọc trạng thái"><option value="all">Tất cả trạng thái</option><option value="new">New</option><option value="learning">Learning</option><option value="weak">Weak</option><option value="review">Review</option><option value="mastered">Mastered</option><option value="due">Đến hạn</option><option value="favorites">Yêu thích</option></select><select class="select" id="pos-filter" aria-label="Lọc từ loại"><option value="all">Tất cả từ loại</option>${positions.map(pos => `<option value="${escapeHtml(pos)}">${escapeHtml(pos)}</option>`).join('')}</select><select class="select" id="sort-filter" aria-label="Sắp xếp"><option value="az">A → Z</option><option value="za">Z → A</option><option value="difficulty">Khó nhất</option><option value="mostWrong">Sai nhiều nhất</option><option value="dueSoon">Đến hạn sớm</option></select></div><div id="results"></div>`;
    const field = container.querySelector('#search-field');
    const state = container.querySelector('#state-filter');
    const pos = container.querySelector('#pos-filter');
    const sort = container.querySelector('#sort-filter');
    const results = container.querySelector('#results');
    let page = 1;
    const pageSize = 50;
    const draw = () => {
      const matches = searchVocabulary(index, field.value, { state: state.value, pos: pos.value, sort: sort.value });
      const pages = Math.max(1, Math.ceil(matches.length / pageSize));
      page = Math.min(page, pages);
      const visible = matches.slice((page - 1) * pageSize, page * pageSize);
      results.innerHTML = matches.length ? `<p class="results-meta">${matches.length} kết quả · trang ${page}/${pages}</p><div class="vocab-list">${visible.map(item => `<div class="vocab-row"><span class="vocab-word">${escapeHtml(item.entry.word)}</span><span class="vocab-pos">${escapeHtml(item.entry.pos)}</span><span class="vocab-meaning" title="${escapeHtml(item.entry.meaning)}">${escapeHtml(item.entry.meaning)}</span><span class="state-pill state-${escapeHtml(item.state)}">${escapeHtml(item.state)}</span><button class="fav ${item.favorite ? 'active' : ''}" data-fav="${escapeHtml(item.entry.id)}" aria-label="${item.favorite ? 'Bỏ yêu thích' : 'Thêm yêu thích'}">${item.favorite ? '★' : '☆'}</button></div>`).join('')}</div>${pages > 1 ? `<div class="pagination">${Array.from({ length: pages }, (_, i) => `<button class="btn small ${i + 1 === page ? 'primary' : ''}" data-page="${i + 1}">${i + 1}</button>`).join('')}</div>` : ''}` : '<div class="empty"><strong>Không tìm thấy</strong>Thử từ khóa khác hoặc bỏ bớt bộ lọc.</div>';
      results.querySelectorAll('[data-fav]').forEach(button => button.addEventListener('click', () => toggleFavorite(button.dataset.fav)));
      results.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => { page = Number(button.dataset.page); draw(); }));
    };
    [field, state, pos, sort].forEach(element => element.addEventListener('input', () => { page = 1; draw(); }));
    [state, pos, sort].forEach(element => element.addEventListener('change', () => { page = 1; draw(); }));
    container.querySelector('#clear-search').addEventListener('click', () => { field.value = ''; page = 1; draw(); field.focus(); });
    draw();
  }

  function renderSettings(container) {
    container.innerHTML = `<div class="page-header"><div><h1>Cài đặt & dữ liệu</h1><p>Tiến độ được lưu localStorage. Bạn có thể sao lưu hoặc chuyển sang thiết bị khác bằng JSON.</p></div></div><div class="settings"><section class="panel"><div class="panel-heading">Tùy chọn học</div><div class="panel-body"><div class="setting-row"><div><b>Giao diện tối</b><small>Giảm chói khi học buổi tối.</small></div><label class="switch"><input type="checkbox" id="dark-setting" ${prefs.darkMode ? 'checked' : ''}><span></span></label></div><div class="setting-row"><div><b>Phím tắt bàn phím</b><small>Tắt nếu bạn thường gõ trên trang học.</small></div><label class="switch"><input type="checkbox" id="keys-setting" ${prefs.keyboardShortcuts ? 'checked' : ''}><span></span></label></div><div class="setting-row"><div><b>Số thẻ mặc định mỗi phiên</b><small>Áp dụng cho nút phiên học mặc định.</small></div><select class="setting-select" id="size-setting" style="width:100px"><option ${prefs.sessionSize === 10 ? 'selected' : ''}>10</option><option ${prefs.sessionSize === 20 ? 'selected' : ''}>20</option><option ${prefs.sessionSize === 30 ? 'selected' : ''}>30</option><option ${prefs.sessionSize === 50 ? 'selected' : ''}>50</option></select></div></div></section><section class="panel"><div class="panel-heading">Sao lưu tiến độ</div><div class="panel-body"><p style="margin-top:0;color:var(--muted);font-size:.82rem">Export lưu progress, favorites, streak, lịch sử và cài đặt. Import được kiểm tra toàn bộ trước khi ghi đè.</p><div class="setting-actions"><button class="btn primary" id="export-setting">Xuất progress JSON</button><label class="btn" for="import-setting">Nhập progress JSON<input id="import-setting" type="file" accept="application/json,.json" hidden></label><button class="btn danger" id="reset-setting">Xóa progress</button></div></div></section><section class="panel"><div class="panel-heading">Thông tin dữ liệu</div><div class="panel-body" style="font-size:.82rem;color:var(--muted)"><p style="margin-top:0"><b style="color:var(--text)">${vocabulary.length} từ</b> · phiên bản dữ liệu <code class="code">${escapeHtml(loaded.version)}</code></p><p>Nguồn duy nhất: <code class="code">data/vocabulary.json</code>. Frontend đọc file này trực tiếp, không build và không gọi backend.</p></div></section></div>`;
    container.querySelector('#dark-setting').addEventListener('change', event => { prefs.darkMode = event.target.checked; persist(); applyTheme(); renderShell(); });
    container.querySelector('#keys-setting').addEventListener('change', event => { prefs.keyboardShortcuts = event.target.checked; persist(); });
    container.querySelector('#size-setting').addEventListener('change', event => { prefs.sessionSize = Number(event.target.value); persist(); });
    container.querySelector('#export-setting').addEventListener('click', exportDownload);
    container.querySelector('#import-setting').addEventListener('change', importFile);
    container.querySelector('#reset-setting').addEventListener('click', resetProgress);
  }

  function exportDownload() {
    const bundle = exportProgressBundle({ progress, prefs, favorites, history, streak });
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url; anchor.download = `chuyen-anh-progress-${todayKey()}.json`; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 0);
    toast('Đã xuất progress JSON.', 'success');
  }

  async function importFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const imported = validateImportPayload(parsed, validIds); // no storage mutation before this completes
      progress = ensureProgress(imported.progress, vocabulary);
      prefs = { ...DEFAULT_PREFS, ...imported.prefs };
      favorites = imported.favorites;
      history = imported.history;
      streak = imported.streak;
      persist();
      toast('Đã nhập progress thành công.', 'success');
      renderShell();
    } catch (error) {
      toast(`Import thất bại: ${error.message}`, 'error');
    } finally {
      event.target.value = '';
    }
  }

  function resetProgress() {
    if (!confirm('Xóa toàn bộ progress, favorites, streak và lịch sử trên thiết bị này?')) return;
    progress = ensureProgress({}, vocabulary);
    favorites = new Set(); history = []; streak = { current: 0, longest: 0, lastDate: null };
    persist(); toast('Đã xóa progress.', 'success'); renderShell();
  }

  document.addEventListener('keydown', event => {
    if (!prefs.keyboardShortcuts || !session?.length) return;
    const tag = event.target?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || event.target?.isContentEditable) return;
    if (event.key >= '1' && event.key <= '4' && !answered && question?.options) {
      event.preventDefault();
      const button = root.querySelectorAll('[data-option]')[Number(event.key) - 1];
      button?.click();
    } else if (event.key === ' ') {
      event.preventDefault();
      if (answered) advanceCard(); else if (!revealed) { revealed = true; renderFlashcard(root.querySelector('#content')); }
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (answered) advanceCard();
      else root.querySelector('#submit-answer')?.click();
    } else if (event.key.toLowerCase() === 'r') {
      event.preventDefault();
      repeatCurrent();
    }
  });

  renderShell();
}

if (typeof document !== 'undefined') {
  const root = document.getElementById('app');
  if (root) createApp(root).catch(error => console.error(error));
}
