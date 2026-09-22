/**
 * Fast client-side search
 */

export function createSearchIndex(vocab, progressMap, favorites) {
  // Precompute lowercased fields for fast search
  return vocab.map(entry => {
    const p = progressMap[entry.id];
    return {
      id: entry.id,
      word: entry.word,
      wordLower: entry.word.toLowerCase(),
      meaningLower: (entry.meaning || '').toLowerCase(),
      posLower: (entry.pos || '').toLowerCase(),
      tagsLower: (entry.tags || []).map(t => t.toLowerCase()).join(' '),
      state: p ? p.state : 'new',
      progress: p,
      fav: favorites ? favorites.has(entry.id) : false,
      entry
    };
  });
}

export function search(index, query, filters = {}) {
  const q = (query || '').toLowerCase().trim();
  const { state, pos, favoritesOnly, tag } = filters;

  let results = index;

  if (state && state !== 'all') {
    if (state === 'due') {
      const now = Date.now();
      results = results.filter(item => item.progress && item.progress.nextReview <= now);
    } else if (state === 'favorites') {
      results = results.filter(item => item.fav);
    } else {
      results = results.filter(item => item.state === state);
    }
  }

  if (pos && pos !== 'all') {
    results = results.filter(item => item.posLower === pos.toLowerCase());
  }

  if (favoritesOnly) {
    results = results.filter(item => item.fav);
  }

  if (tag && tag !== 'all') {
    results = results.filter(item => item.tagsLower.includes(tag.toLowerCase()));
  }

  if (q) {
    // Search across multiple fields, with scoring
    results = results.map(item => {
      let score = 0;
      if (item.wordLower === q) score += 100;
      else if (item.wordLower.startsWith(q)) score += 80;
      else if (item.wordLower.includes(q)) score += 60;

      if (item.meaningLower.includes(q)) {
        score += 40;
        if (item.meaningLower.startsWith(q)) score += 10;
      }
      if (item.posLower.includes(q)) score += 5;
      if (item.tagsLower.includes(q)) score += 5;

      return { ...item, score };
    }).filter(item => item.score > 0)
      .sort((a,b) => b.score - a.score);
  }

  return results;
}

export function sortResults(results, sortBy = 'az') {
  const arr = [...results];
  switch (sortBy) {
    case 'az':
      arr.sort((a,b) => a.word.localeCompare(b.word));
      break;
    case 'za':
      arr.sort((a,b) => b.word.localeCompare(a.word));
      break;
    case 'difficulty':
      arr.sort((a,b) => (b.progress?.difficulty||0) - (a.progress?.difficulty||0));
      break;
    case 'newest':
      // Assuming higher id = newer? Use id numeric descending
      arr.sort((a,b) => {
        const na = parseInt(a.id,10) || 0;
        const nb = parseInt(b.id,10) || 0;
        return nb - na;
      });
      break;
    case 'mostWrong':
      arr.sort((a,b) => (b.progress?.wrongCount||0) - (a.progress?.wrongCount||0));
      break;
    case 'dueSoon':
      arr.sort((a,b) => (a.progress?.nextReview||0) - (b.progress?.nextReview||0));
      break;
    default:
      break;
  }
  return arr;
}
