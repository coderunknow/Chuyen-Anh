/**
 * LocalStorage persistence for progress
 * Keys:
 * - flashcard-progress-v1: map id -> progress
 * - flashcard-prefs-v1: preferences
 * - flashcard-favorites-v1: Set of ids
 * - flashcard-history-v1: session history
 */

const PROGRESS_KEY = 'flashcard-progress-v1';
const PREFS_KEY = 'flashcard-prefs-v1';
const FAV_KEY = 'flashcard-favorites-v1';
const HISTORY_KEY = 'flashcard-history-v1';
const STREAK_KEY = 'flashcard-streak-v1';

export const defaultPrefs = {
  sessionSize: 20,
  keyboardShortcuts: true,
  darkMode: false,
  sound: false
};

export function loadProgress() {
  try {
    const raw = localStorage.getItem(PROGRESS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch (e) {
    console.warn('Failed to load progress', e);
    return {};
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('Cannot save progress (storage full?)', e);
    throw new Error('Không thể lưu tiến trình trên thiết bị này.');
  }
}

export function loadPrefs() {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...defaultPrefs };
    return { ...defaultPrefs, ...JSON.parse(raw) };
  } catch {
    return { ...defaultPrefs };
  }
}

export function savePrefs(prefs) {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch (e) {
    console.warn('Cannot save prefs', e);
  }
}

export function loadFavorites() {
  try {
    const raw = localStorage.getItem(FAV_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

export function saveFavorites(favSet) {
  try {
    localStorage.setItem(FAV_KEY, JSON.stringify([...favSet]));
  } catch (e) {
    console.warn('Cannot save favorites', e);
  }
}

export function loadHistory() {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function saveHistory(history) {
  try {
    // Keep last 50 sessions
    const trimmed = history.slice(-50);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
  } catch (e) {
    console.warn('Cannot save history', e);
  }
}

export function loadStreak() {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { current: 0, longest: 0, lastDate: null };
    return JSON.parse(raw);
  } catch {
    return { current: 0, longest: 0, lastDate: null };
  }
}

export function saveStreak(streak) {
  try {
    localStorage.setItem(STREAK_KEY, JSON.stringify(streak));
  } catch (e) {
    console.warn('Cannot save streak', e);
  }
}

export function exportAll() {
  const data = {
    version: 1,
    exportedAt: new Date().toISOString(),
    progress: loadProgress(),
    prefs: loadPrefs(),
    favorites: [...loadFavorites()],
    history: loadHistory(),
    streak: loadStreak()
  };
  return data;
}

export function importAll(json) {
  if (!json || typeof json !== 'object') throw new Error('Invalid import format');
  if (json.version !== 1) throw new Error('Unsupported version');
  if (json.progress && typeof json.progress === 'object') {
    // Validate progress shape
    for (const [id, p] of Object.entries(json.progress)) {
      if (!p || typeof p !== 'object') throw new Error(`Invalid progress for ${id}`);
      if (typeof p.correctCount !== 'number' || typeof p.wrongCount !== 'number') {
        throw new Error(`Invalid counts for ${id}`);
      }
    }
    saveProgress(json.progress);
  }
  if (json.prefs) savePrefs(json.prefs);
  if (Array.isArray(json.favorites)) saveFavorites(new Set(json.favorites));
  if (Array.isArray(json.history)) saveHistory(json.history);
  if (json.streak) saveStreak(json.streak);
}
