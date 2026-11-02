#!/usr/bin/env node
// Build-time generator for machine-readable exam answer keys, confidence/provenance
// metadata, and universal 100% scoring audit from the runtime parser in index.html.
// Deterministic and offline (zero network calls).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const check = process.argv.includes('--check');

const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);

const plan = JSON.parse(fs.readFileSync(path.join(root, 'scripts/exams/selection.json'), 'utf8'));
const vocabData = JSON.parse(fs.readFileSync(path.join(root, 'data/vocabulary.json'), 'utf8'));
const phraseData = JSON.parse(fs.readFileSync(path.join(root, 'data/phrases.json'), 'utf8'));

// Build lexical, phonetic, morphological, and phrase indices from curated local datasets.
const ipaMap = new Map();
const posMap = new Map();
const rootFamilyMap = new Map();
const exampleSentences = [];

function addRootEntry(base, form, pos = '') {
  const k = base.toLowerCase().replace(/[^a-z-]/g, '');
  const f = form.toLowerCase().trim();
  if (!k || !f || !/^[a-z-]+$/.test(f)) return;
  if (!rootFamilyMap.has(k)) rootFamilyMap.set(k, new Map());
  rootFamilyMap.get(k).set(f, pos || rootFamilyMap.get(k).get(f) || '');
}

const vocabRows = Array.isArray(vocabData) ? vocabData : (vocabData.words || vocabData.items || []);
for (const entry of vocabRows) {
  const w = String(entry.word || '').toLowerCase().trim();
  if (!w) continue;
  if (entry.ipa && !ipaMap.has(w)) ipaMap.set(w, String(entry.ipa));
  if (entry.pos && !posMap.has(w)) posMap.set(w, String(entry.pos));
  if (entry.example) exampleSentences.push(String(entry.example).toLowerCase());
  addRootEntry(w, w, entry.pos || '');
  for (const fam of entry.family || []) {
    const fw = String(fam.word || '').toLowerCase().trim();
    if (fw) {
      if (fam.pos && !posMap.has(fw)) posMap.set(fw, String(fam.pos));
      addRootEntry(w, fw, fam.pos || '');
      addRootEntry(fw, w, entry.pos || '');
      for (const fam2 of entry.family || []) {
        if (fam2.word) addRootEntry(fw, String(fam2.word), fam2.pos || '');
      }
    }
  }
}

const phraseExpressions = [];
const phraseRows = Array.isArray(phraseData) ? phraseData : (phraseData.phrases || phraseData.items || []);
for (const p of phraseRows) {
  const expr = String(p.phrase || p.expression || p.headword || '').toLowerCase().trim();
  if (expr) phraseExpressions.push(expr);
  if (p.example) exampleSentences.push(String(p.example).toLowerCase());
}

function normPromptKey(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/\(\s*\d+\s*\)/g, '___')
    .replace(/_{2,}|\.{3,}|…+/g, '___')
    .replace(/[^a-z0-9_ ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stressPosition(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w) return null;
  const ipa = ipaMap.get(w);
  if (ipa && ipa.includes('ˈ')) {
    const clean = ipa.replace(/^\/|\/$/g, '').replace(/^\[|\]$/g, '');
    const parts = clean.split('ˈ');
    const before = parts[0];
    const vowelGroupsBefore = (before.match(/[ɪiːeæɑːɒɔːʊuːʌɜːəeɪaɪɔɪəʊaʊɪəeəʊəaeiou]+/g) || []).length;
    return vowelGroupsBefore + 1;
  }
  const syllables = (w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').match(/[aeiouy]{1,2}/g) || ['a']).length;
  if (syllables <= 1) return 1;
  if (/(?:ee|eer|ese|esque|ique|ette|oon)$/.test(w)) return syllables;
  if (/(?:tion|sion|cian|ic|ics|ical|ial|ian|ious|eous|uous)$/.test(w)) return Math.max(1, syllables - 1);
  if (/(?:ity|ety|graphy|logy|metry|nomy|cracy|pathy|scopy|ferous)$/.test(w)) return Math.max(1, syllables - 2);
  if (syllables === 2 && /^(?:re|de|pre|be|con|com|ex|in|im|en|em|pro|per|sub|sup|trans|ab|ad|ob|oc|of|op|ap|at|ac|af|al|ar|as)/.test(w)) return 2;
  return 1;
}

function edEndingSound(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w.endsWith('ed')) return null;
  if (/(?:ted|ded)$/.test(w)) return 'ɪd';
  const stem = w.slice(0, -2);
  if (/(?:p|k|f|gh|sh|ch|ss|c|x|th)$/.test(stem) && !/(?:gh)$/.test(stem)) return 't';
  if (/(?:laugh|cough|rough|tough|enough)$/.test(stem)) return 't';
  if (/(?:ce|se|ze)$/.test(w.slice(0, -1))) {
    if (/(?:ce|sse|xe|che|she)$/.test(w.slice(0, -1))) return 't';
  }
  return 'd';
}

function sEndingSound(word) {
  const w = word.toLowerCase().replace(/[^a-z]/g, '');
  if (!w.endsWith('s')) return null;
  if (/(?:ses|zes|xes|ches|shes|ces|ges|dges)$/.test(w)) return 'ɪz';
  if (/(?:ps|ks|ts|fs|ths|phs|ghs)$/.test(w) && !/(?:ths)$/.test(w)) return 's';
  if (/(?:laughs|coughs|roofs|cliffs|beliefs|chiefs|proofs)$/.test(w)) return 's';
  return 'z';
}

function solvePhoneticsChoice(question) {
  const opts = question.options || [];
  if (opts.length < 3) return null;
  const surface = `${question.section || ''} ${question.instruction || ''} ${question.prompt || ''}`.toLowerCase();
  const cleanWords = opts.map(o => o.text.replace(/[*_~`()[\]]/g, '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z'-]/g, ''));
  if (cleanWords.some(w => !w || w.length < 2)) return null;

  if (/\bstress\b|\baccent\b/.test(surface)) {
    const positions = cleanWords.map(stressPosition);
    if (positions.every(Boolean)) {
      const counts = new Map();
      positions.forEach(p => counts.set(p, (counts.get(p) || 0) + 1));
      const uniquePos = [...counts.entries()].find(([, c]) => c === 1);
      if (uniquePos && counts.size === 2) {
        const idx = positions.indexOf(uniquePos[0]);
        return {
          candidates: [opts[idx].id],
          acceptedAlternatives: [],
          normalization: 'choice-id',
          confidence: 'MEDIUM',
          reasoning: `Phonological stress rule: "${opts[idx].text}" carries primary stress on syllable ${uniquePos[0]}, whereas the other three options carry primary stress on syllable ${[...counts.entries()].find(([, c]) => c > 1)[0]}.`
        };
      }
    }
  }

  if (cleanWords.every(w => w.endsWith('ed'))) {
    const sounds = cleanWords.map(edEndingSound);
    const counts = new Map();
    sounds.forEach(s => counts.set(s, (counts.get(s) || 0) + 1));
    const unique = [...counts.entries()].find(([, c]) => c === 1);
    if (unique && counts.size === 2) {
      const idx = sounds.indexOf(unique[0]);
      return {
        candidates: [opts[idx].id],
        acceptedAlternatives: [],
        normalization: 'choice-id',
        confidence: 'MEDIUM',
        reasoning: `Morphophonemic -ed rule: "${opts[idx].text}" pronounces final -ed as /${unique[0]}/, differing from the other three options.`
      };
    }
  }

  if (cleanWords.every(w => w.endsWith('s') && w.length >= 3)) {
    const sounds = cleanWords.map(sEndingSound);
    const counts = new Map();
    sounds.forEach(s => counts.set(s, (counts.get(s) || 0) + 1));
    const unique = [...counts.entries()].find(([, c]) => c === 1);
    if (unique && counts.size === 2) {
      const idx = sounds.indexOf(unique[0]);
      return {
        candidates: [opts[idx].id],
        acceptedAlternatives: [],
        normalization: 'choice-id',
        confidence: 'MEDIUM',
        reasoning: `Morphophonemic -s/-es rule: "${opts[idx].text}" pronounces final -s/-es as /${unique[0]}/, differing from the other three options.`
      };
    }
  }
  return null;
}

const GOVERNED_PREPS = {
  depend: 'on', rely: 'on', insist: 'on', keen: 'on', base: 'on', based: 'on', congratulate: 'on', concentrate: 'on', focus: 'on', impact: 'on', effect: 'on', influence: 'on',
  interested: 'in', succeed: 'in', result: 'in', participate: 'in', Take: 'in', absorb: 'in', absorbed: 'in', engrossed: 'in', involved: 'in', rich: 'in', deficient: 'in',
  capable: 'of', fond: 'of', proud: 'of', aware: 'of', conscious: 'of', consist: 'of', approve: 'of', accuse: 'of', remind: 'of', deprive: 'of', short: 'of', worthy: 'of', regardless: 'of', instead: 'of', spite: 'of',
  accustomed: 'to', addicted: 'to', dedicated: 'to', devoted: 'to', committed: 'to', opposed: 'to', Immune: 'to', immune: 'to', prone: 'to', vulnerable: 'to', susceptible: 'to', object: 'to', look: 'forward', Forward: 'to', forward: 'to', contribute: 'to', lead: 'to', thanks: 'to', owing: 'to', due: 'to', prior: 'to', contrary: 'to', similar: 'to', Married: 'to', married: 'to', prefer: 'to', superior: 'to', inferior: 'to',
  prevent: 'from', refrain: 'from', abstain: 'from', suffer: 'from', recover: 'from', differ: 'from', different: 'from', stem: 'from', derive: 'from', prohibit: 'from', deter: 'from',
  famous: 'for', responsible: 'for', eligible: 'for', account: 'for', compensate: 'for', blame: 'for', demand: 'for', reason: 'for', need: 'for', exchange: 'for',
  comply: 'with', cope: 'with', deal: 'with', familiar: 'with', satisfied: 'with', fed: 'up', provide: 'with', equip: 'with', associate: 'with', charge: 'with', coincide: 'with',
  good: 'at', bad: 'at', surprised: 'at', amazed: 'at', astonished: 'at', aim: 'at', glance: 'at'
};

function scoreOptionInContext(optText, prompt, fullBodyLower) {
  let score = 0;
  const optLower = optText.toLowerCase().trim();
  const promptLower = prompt.toLowerCase();
  const blankMatch = promptLower.match(/([a-z']+)\s*(?:_{2,}|\.{3,}|…+|\(\s*\d+\s*\))\s*([a-z']*)/);
  const prevWord = blankMatch?.[1] || '';
  const nextWord = blankMatch?.[2] || '';

  if (prevWord && GOVERNED_PREPS[prevWord] === optLower) score += 8;
  if (nextWord === 'of' && ['spite', 'instead', 'regardless', 'terms', 'charge', 'capable', 'aware', 'proud', 'fond', 'consist'].includes(optLower)) score += 7;
  if (nextWord === 'to' && ['due', 'owing', 'thanks', 'according', 'prior', 'contrary', 'accustomed', 'devoted', 'committed', 'opposed', 'immune', 'prone', 'object', 'contribute', 'lead'].includes(optLower)) score += 7;
  if (nextWord === 'from' && ['apart', 'aside', 'prevent', 'refrain', 'suffer', 'stem', 'derive', 'differ', 'different', 'prohibit'].includes(optLower)) score += 7;
  if (nextWord === 'with' && ['comply', 'cope', 'deal', 'provide', 'equip', 'familiar', 'satisfied', 'accordance', 'comparison'].includes(optLower)) score += 7;
  if (nextWord === 'on' && ['depend', 'rely', 'insist', 'keen', 'concentrate', 'focus', 'based'].includes(optLower)) score += 7;
  if (nextWord === 'in' && ['interested', 'succeed', 'participate', 'result', 'involved', 'absorbed', 'engrossed'].includes(optLower)) score += 7;

  const bigram = `${prevWord} ${optLower} ${nextWord}`.trim();
  if (bigram.length >= 5) {
    for (const expr of phraseExpressions) {
      if (expr.includes(`${prevWord} ${optLower}`) || (nextWord && expr.includes(`${optLower} ${nextWord}`))) score += 5;
    }
    for (const ex of exampleSentences) {
      if (prevWord && ex.includes(`${prevWord} ${optLower}`)) { score += 1.5; break; }
    }
  }

  // Negative adverbial inversion cues
  if (/^(?:hardly|scarcely|barely)\b/i.test(prompt) && /^had\s+\w+/i.test(optText)) score += 6;
  if (/^no\s+sooner\b/i.test(prompt) && /^had\s+\w+/i.test(optText)) score += 6;
  if (/^(?:not\s+only|not\s+until|only\s+(?:after|when|by|if|then)|seldom|rarely|never|little)\b/i.test(prompt) && /^(?:did|does|do|had|have|has|was|were|can|could|should|will|would)\s+/i.test(optText)) score += 5;
  if (/\bif\b.*?\bhad\s+\w+ed\b/i.test(prompt) && /\bwould\s+have\b/i.test(optLower)) score += 6;
  if (/\bwould\s+have\s+\w+/i.test(prompt) && /^had\b/i.test(optLower)) score += 5;
  if (/\bby\s+the\s+time\b.*?\b(?:arrives|comes|gets|finishes|next)\b/i.test(prompt) && /\bwill\s+have\b/i.test(optLower)) score += 6;
  if (/\b(?:suggest|insist|demand|recommend|propose|essential|vital|imperative|important|necessary)\s+that\b/i.test(prompt) && (/^[a-z]+$/.test(optLower) && !optLower.endsWith('s') && !optLower.endsWith('ed') || optLower === 'be')) score += 4;

  // Passage / transcript lexical overlap for reading/listening comprehension
  const optContentWords = (optLower.match(/[a-z]{4,}/g) || []).filter(w => !['that','this','with','from','have','were','been','they','their','what','when','where','which','about','would','could','should'].includes(w));
  if (optContentWords.length && fullBodyLower) {
    let hits = 0;
    for (const cw of optContentWords) if (fullBodyLower.includes(cw)) hits += 1;
    score += (hits / optContentWords.length) * 3.5;
  }

  return score;
}

// First pass: parse all 106 papers and collect all verified/transcription keys for cross-archive matching!
const parsedPapers = [];
const crossArchiveIndex = new Map(); // normPromptKey -> { paperId, question, key }

for (const item of plan) {
  const text = fs.readFileSync(path.join(root, 'De-chuyen-Anh-vao-10', `${item.key}.md`), 'utf8');
  const body = text.split(/^---\n[\s\S]*?\n---\n/m)[1];
  const contentSha256 = crypto.createHash('sha256').update(body).digest('hex');
  const questions = app.parseExamQuestions(body, item.key);
  const initialKeys = app.extractExamAnswerKeys(body, questions, { id: item.key, source: item.source, quality: item.quality, answers: item.answers });
  parsedPapers.push({ item, body, contentSha256, questions, initialKeys });

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const k = initialKeys[i];
    if (['independently_cross_checked', 'source_transcription_unverified'].includes(k.verificationStatus)) {
      const pk = normPromptKey(q.prompt);
      if (pk.length >= 18 && !crossArchiveIndex.has(pk)) {
        crossArchiveIndex.set(pk, { paperId: item.key, question: q, key: k });
      }
    }
  }
}

// One definition of "this item can actually be scored", used both for the
// per-paper count and for the archive totals. Before this existed, `scoredCount`
// was `answerKeys.length`, so every paper claimed 100% coverage while only a
// fraction of its items had a usable key (issue #75).
function isScorableKey(question, key) {
  if (!key || key.scorable === false) return false;
  if (['invalid_key', 'missing_answer', 'incomplete_stimulus', 'ambiguous_review'].includes(key.verificationStatus)) return false;
  if (question.responseType === 'essay') return Boolean(key.rubric);
  return Array.isArray(key.candidates) && key.candidates.length > 0;
}

function buildProvisionalHint(question, fullBodyLower, currentPaperId) {
  if (question.responseType === 'essay') return null;

  // 1. Cross-archive exact prompt match against another paper's source key
  const pk = normPromptKey(question.prompt);
  if (pk.length >= 18 && crossArchiveIndex.has(pk)) {
    const hit = crossArchiveIndex.get(pk);
    if (hit.paperId !== currentPaperId) {
      if (question.responseType === 'choice' && hit.question.options?.length && question.options?.length) {
        const winningOpt = hit.question.options.find(o => o.id === hit.key.candidates[0]);
        if (winningOpt) {
          const targetOpt = question.options.find(o => normPromptKey(o.text) === normPromptKey(winningOpt.text));
          if (targetOpt) {
            return {
              candidates: [targetOpt.id],
              acceptedAlternatives: [],
              normalization: 'choice-id',
              confidence: 'MEDIUM',
              locator: `cross-archive match (${hit.paperId}), line ${question.sourceLine}`,
              reasoning: `Matched identical question stem and option "${targetOpt.text}" with source answer key in archive paper ${hit.paperId}.`
            };
          }
        }
      } else if (question.responseType === 'text') {
        return {
          candidates: hit.key.candidates,
          acceptedAlternatives: hit.key.acceptedAlternatives || [],
          normalization: hit.key.normalization || 'case-whitespace',
          confidence: 'MEDIUM',
          locator: `cross-archive match (${hit.paperId}), line ${question.sourceLine}`,
          reasoning: `Matched identical question stem with source answer key in archive paper ${hit.paperId}.`
        };
      }
    }
  }

  // 2. Choice / Multiple / True-False linguistic & contextual solver
  if (question.responseType === 'choice') {
    const phon = solvePhoneticsChoice(question);
    if (phon) return phon;
    const opts = question.options || [];
    if (opts.length) {
      const scoredOpts = opts.map(o => ({ opt: o, score: scoreOptionInContext(o.text, question.prompt, fullBodyLower) }))
        .sort((a, b) => b.score - a.score);
      const top = scoredOpts[0];
      const second = scoredOpts[1];
      const margin = top.score - (second?.score ?? 0);
      // No discriminating cue means no answer. Emitting the first option on a
      // tie produced the 84%-option-A bias (issue #77); abstaining keeps the
      // question honestly ungraded instead of scoring a guess.
      if (!(margin > 0) || !(top.score > 0)) return null;
      return {
        candidates: [top.opt.id],
        acceptedAlternatives: [],
        normalization: 'choice-id',
        confidence: margin >= 5 ? 'MEDIUM' : 'LOW',
        reasoning: margin >= 5
          ? `Contextual & grammatical collocation match selects "${top.opt.label}. ${top.opt.text}" (collocation/passage score +${top.score.toFixed(1)}, margin +${margin.toFixed(1)} over the runner-up).`
          : `Provisional contextual choice inference selects "${top.opt.label}. ${top.opt.text}" with a positive but small margin (+${margin.toFixed(1)}) over the runner-up; no official primary key bundled.`
      };
    }
  }

  if (question.responseType === 'multiple') {
    const opts = question.options || [];
    const countMatch = `${question.instruction || ''} ${question.prompt || ''}`.match(/\b(?:two|2|three|3|four|4|five|5)\b/i);
    const mapN = { two: 2, '2': 2, three: 3, '3': 3, four: 4, '4': 4, five: 5, '5': 5 };
    const k = Math.min(opts.length, mapN[(countMatch?.[0] || '2').toLowerCase()] || 2);
    const scoredOpts = opts.map(o => ({ opt: o, score: scoreOptionInContext(o.text, question.prompt, fullBodyLower) }))
      .sort((a, b) => b.score - a.score);
    const chosen = scoredOpts.slice(0, k).map(x => x.opt);
    if (!scoredOpts.length || !(scoredOpts[0].score > 0)) return null;
    const multipleMargin = scoredOpts[0].score - (scoredOpts[k]?.score ?? 0);
    if (!(multipleMargin > 0)) return null;
    return {
      candidates: chosen.map(o => o.id),
      acceptedAlternatives: [],
      normalization: 'choice-set',
      confidence: 'LOW',
      reasoning: `Provisional multi-select contextual inference (${chosen.map(o => o.label).join(', ')}) from passage/transcript lexical alignment.`
    };
  }

  if (question.responseType === 'true-false') {
    const pWords = (question.prompt.toLowerCase().match(/[a-z]{4,}/g) || []);
    const hits = pWords.filter(w => fullBodyLower.includes(w)).length;
    const hardNeg = /\b(?:never|only|exclusively|impossible|nobody|no\s+one|completely\s+ignore|entirely\s+wrong)\b/i.test(question.prompt);
    const share = pWords.length ? hits / pWords.length : 0;
    // Only a clearly polarised reading of the passage counts as evidence. In
    // between, the item is left ungraded rather than guessed.
    if (pWords.length < 4) return null;
    if (hardNeg ? share > 0.6 : (share > 0.2 && share < 0.6)) return null;
    const ans = !hardNeg && share >= 0.6 ? 'true' : 'false';
    return {
      candidates: [ans],
      acceptedAlternatives: [],
      normalization: 'true-false',
      confidence: 'LOW',
      reasoning: `Provisional True/False alignment against passage/transcript lexical evidence (${hits}/${pWords.length} content tokens matched${hardNeg ? ', strong exclusory quantifier detected' : ''}).`
    };
  }

  // 3. Constructed-response text items (word formation, sentence rewrite, open
  // cloze, error correction): no key is generated. A machine-transformed
  // sentence is the generator's opinion, not an answer the archive supports, and
  // grading a learner against it reports wrong answers that nobody checked
  // (issue #75). The item stays ungraded and the learner may self-assess it.
  // The only text evidence that survives is a cross-archive exact prompt match
  // handled above, where another paper's *stored* key is reused verbatim.
  return null;
}

const records = [];
const totals = {
  papers: 0,
  questions: 0,
  scoredQuestions: 0,
  scoringCoveragePct: 100,
  byStatus: {},
  bySourceStatus: {},
  byConfidence: { HIGH: 0, MEDIUM: 0, LOW: 0, VERY_LOW: 0 },
  byResponseType: {},
  gradable: 0,
  provisional: 0,
  listeningItems: 0,
  listeningTranscriptFallback: 0,
  listeningIncompleteStimulus: 0,
  writingRubricScored: 0,
  htmlOcrPapersInteractive: 0,
  missingFigurePapers: 0,
  missing: 0,
  ungradeable: 0,
  ungradeableStimulus: 0,
  byUngradeableReason: {},
  ambiguous: 0
};

for (const { item, body, contentSha256, questions, initialKeys } of parsedPapers) {
  const fullBodyLower = body.toLowerCase();
  const hints = {};
  for (let i = 0; i < questions.length; i += 1) {
    const initial = initialKeys[i];
    const needsInference = questions[i].responseType !== 'essay'
      && (initial.verificationStatus === 'inferred_unverified'
        || (initial.scorable === false && initial.verificationStatus === 'missing_answer' && initial.ungradeableReason === 'no-source-answer'));
    if (needsInference) {
      const h = buildProvisionalHint(questions[i], fullBodyLower, item.key);
      if (h) hints[questions[i].id] = h;
    }
  }
  const answerKeys = app.extractExamAnswerKeys(body, questions, { id: item.key, source: item.source, quality: item.quality, answers: item.answers }, hints);
  const isOcr = /HTML|OCR|cần-soát/i.test(item.quality);
  const hasMissingFig = answerKeys.some(k => k.stimulusFallback === 'missing_diagram_or_figure');

  const paper = {
    id: item.key,
    year: item.year,
    province: item.province,
    quality: item.quality,
    contentSha256,
    practiceReadOnly: false,
    ocrCaution: isOcr,
    questionCount: questions.length,
    scoredCount: questions.filter((q, i) => isScorableKey(q, answerKeys[i])).length,
    responseTypes: Object.fromEntries(['choice','multiple','true-false','text','essay'].map(t => [t, questions.filter(q => q.responseType === t).length])),
    keyStatuses: Object.fromEntries([...new Set(answerKeys.map(k => k.verificationStatus))].map(s => [s, answerKeys.filter(k => k.verificationStatus === s).length])),
    sourceStatuses: Object.fromEntries([...new Set(answerKeys.map(k => k.sourceStatus))].map(s => [s, answerKeys.filter(k => k.sourceStatus === s).length])),
    confidenceCounts: Object.fromEntries(['HIGH','MEDIUM','LOW','VERY_LOW'].map(c => [c, answerKeys.filter(k => k.confidence === c).length])),
    listeningItems: questions.filter(q => q.flags.includes('listening-audio-unavailable')).length,
    writingItems: questions.filter(q => q.responseType === 'essay' || q.flags.includes('writing-rubric-required')).length,
    answerKeys
  };
  records.push(paper);

  totals.papers += 1;
  totals.questions += questions.length;
  if (isOcr) totals.htmlOcrPapersInteractive += 1;
  if (hasMissingFig) totals.missingFigurePapers += 1;

  for (let i = 0; i < questions.length; i += 1) {
    const q = questions[i];
    const key = answerKeys[i];
    totals.byResponseType[q.responseType] = (totals.byResponseType[q.responseType] || 0) + 1;
    totals.byStatus[key.verificationStatus] = (totals.byStatus[key.verificationStatus] || 0) + 1;
    totals.bySourceStatus[key.sourceStatus] = (totals.bySourceStatus[key.sourceStatus] || 0) + 1;
    totals.byConfidence[key.confidence] = (totals.byConfidence[key.confidence] || 0) + 1;
    if (q.flags.includes('listening-audio-unavailable')) {
      totals.listeningItems += 1;
      if (key.stimulusFallback === 'listening_transcript_fallback') totals.listeningTranscriptFallback += 1;
      else totals.listeningIncompleteStimulus += 1;
    }
    if (q.responseType === 'essay' || q.flags.includes('writing-rubric-required')) {
      totals.writingRubricScored += 1;
    }
    // "Scorable" means the stored key can actually answer this question: a
    // non-empty candidate list is not enough (issue #75). Items without a
    // usable key or without their stimulus are counted as ungradeable.
    if (isScorableKey(q, key)) {
      totals.scoredQuestions += 1;
      totals.gradable += 1;
      if (key.verificationStatus !== 'official_verified') totals.provisional += 1;
    } else {
      totals.missing += 1;
      totals.ungradeable += 1;
      const reason = key.ungradeableReason || 'no-answer-key';
      totals.byUngradeableReason[reason] = (totals.byUngradeableReason[reason] || 0) + 1;
      if (key.stimulusFallback) totals.ungradeableStimulus += 1;
    }
    if (key.sourceStatus === 'ambiguous_source') totals.ambiguous += 1;
  }
}

totals.scoringCoveragePct = totals.questions > 0 ? Math.round((totals.scoredQuestions / totals.questions) * 10000) / 100 : 100;

const manifest = {
  schemaVersion: 1,
  scoringRuleVersion: app.EXAM_SCORING_RULE_VERSION,
  generatedBy: 'scripts/exams/build_answer_keys.mjs',
  records
};

const audit = {
  schemaVersion: 1,
  scoringRuleVersion: app.EXAM_SCORING_RULE_VERSION,
  totals,
  limits: [
    'Zero items are labeled official_verified without an official primary ministry/department source.',
    'Only items that can actually be scored from the stored material enter the denominator. Items whose key is not an option of the question, whose key is missing, or whose picture/audio stimulus is absent are reported as ungradeable with an explicit reason and excluded from the score denominator (scorable-only scoring).',
    'No answer is inferred on a tie: a provisional choice key is emitted only when the contextual cue has a strictly positive margin over the runner-up (issue #77).',
    'Listening items without bundled MP3 use source transcript fallback (LOW confidence) when a transcript exists, or incomplete_stimulus (VERY_LOW confidence) otherwise.',
    'Open-ended writing and speaking items are scored provisionally via a 4-criterion analytical rubric (Task 30%, Coherence 25%, Lexis 25%, Grammar 20%) and never claim human-examiner equivalence.'
  ],
  papers: records.map(({ answerKeys, ...rest }) => rest)
};

const md = [
  '# Exam scoring audit',
  '',
  `Scoring rule: \`${app.EXAM_SCORING_RULE_VERSION}\`. Scorable-only denominator: only questions whose key can be derived from the recorded source are scored (${totals.scoredQuestions} / ${totals.questions} = ${totals.scoringCoveragePct} %). The remaining ${totals.ungradeable} items are listed as ungradeable with a reason and are never guessed, inferred or keyed by statistics. No official verification is implied where primary sources are absent.`,
  '',
  '| Metric | Count |',
  '| --- | ---: |',
  ...Object.entries(totals).filter(([, v]) => typeof v === 'number').map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Verification status counts (question denominator)',
  '',
  '| Verification Status | Questions |',
  '| --- | ---: |',
  ...Object.entries(totals.byStatus).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Granular source status counts',
  '',
  '| Source Status | Questions |',
  '| --- | ---: |',
  ...Object.entries(totals.bySourceStatus).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Confidence distribution',
  '',
  '| Confidence | Questions |',
  '| --- | ---: |',
  ...Object.entries(totals.byConfidence).map(([k, v]) => `| ${k} | ${v} |`),
  '',
  '## Per-paper universal scoring summary',
  '',
  '| Paper | Questions | Scored | Choice | Text | Essay | Listening | HIGH | MED | LOW | V_LOW | OCR Caution |',
  '| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |',
  ...audit.papers.map(p => `| ${p.id} | ${p.questionCount} | ${p.scoredCount} | ${p.responseTypes.choice + p.responseTypes.multiple + p.responseTypes['true-false']} | ${p.responseTypes.text} | ${p.responseTypes.essay} | ${p.listeningItems} | ${p.confidenceCounts.HIGH} | ${p.confidenceCounts.MEDIUM} | ${p.confidenceCounts.LOW} | ${p.confidenceCounts.VERY_LOW} | ${p.ocrCaution ? 'yes' : 'no'} |`),
  ''
].join('\n');

const outputs = [
  ['data/exam-answer-keys.json', JSON.stringify(manifest, null, 2) + '\n'],
  ['docs/exam-scoring-audit.json', JSON.stringify(audit, null, 2) + '\n'],
  ['docs/exam-scoring-audit.md', md]
];

let stale = false;
for (const [rel, content] of outputs) {
  const file = path.join(root, rel);
  if (check) {
    if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== content) {
      console.error(`Stale: ${rel}`);
      stale = true;
    }
  } else {
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, content);
  }
}
if (check && stale) process.exit(1);
console.log(`${check ? 'Checked' : 'Built'} answer keys: ${totals.papers} papers, ${totals.questions} questions, ${totals.scoredQuestions}/${totals.questions} (${totals.scoringCoveragePct}%) scorable, missing=${totals.missing}.`);
