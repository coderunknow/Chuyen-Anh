/**
 * Vocabulary loading and helpers
 * Source of truth: /data/vocabulary.json
 */

export async function loadVocabulary() {
  try {
    const res = await fetch('./data/vocabulary.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('Invalid format');
    return data;
  } catch (e) {
    // Fallback to absolute path for dev
    try {
      const res2 = await fetch('/data/vocabulary.json');
      if (res2.ok) {
        return await res2.json();
      }
    } catch {}
    throw new Error('Không thể tải dữ liệu từ vựng: ' + e.message);
  }
}

export async function loadMeta() {
  try {
    const res = await fetch('./data/meta.json');
    if (!res.ok) return null;
    return await res.json();
  } catch {
    try {
      const res2 = await fetch('/data/meta.json');
      if (res2.ok) return await res2.json();
    } catch {}
    return null;
  }
}

export function normalize(str) {
  return (str || '').toLowerCase().trim();
}

export function getWordById(vocab, id) {
  return vocab.find(w => w.id === id);
}
