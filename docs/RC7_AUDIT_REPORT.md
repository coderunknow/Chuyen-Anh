# v1.0.0-rc7 audit report — answer leakage, full-product red team, release evidence

Status: **rc7 candidate** (this file is updated with observed GitHub evidence after merge/tag/release/Pages; nothing below claims a stage that has not happened yet). Stable readiness remains **NO-GO** for the same reason as rc6: 0/106 official answer keys.

## 1. Starting repository state (verified live, 2026-10-31)

- `main` = `4a003d39737775a171d99ee45fe967ad410cd407` (merge of PR #70); working branch `arena/679c76cb-chuyen-anh` starts from that commit, clean tree.
- Published prerelease `v1.0.0-rc6` (2026-10-29T15:48:09Z); `APP_VERSION` = `v1.0.0-rc6`; `DEPLOY_HOLD` = `v1.0.0-rc6`; no open PRs or issues (`gh pr list`, `gh issue list` both empty).
- Baseline before any change: all 14 data/embed `--check` commands clean; Python **157/157 OK**; Node `static-app` + `exam-scoring` **135 pass**; telemetry **16/16**. Every rc7 failure found afterwards was reproduced against this baseline or attributed to the rc7 change itself.

## 2. Priority defect — answer and vocabulary leakage (owner report)

The owner reported that certain vocabulary items appear directly in the question. No example was supplied, so the whole dataset was scanned with the shipped generator (`generateQuestion` over the active 4,581-row deck × 7 single-card types, plus data-level token scans over all 5,852 rows).

### 2.1 Root cause RC7-01 (the reported defect, reproduced)

A recorded Vietnamese gloss may quote its own headword in an English usage pattern, e.g. id 453 `Derive` → “bắt nguồn từ (**derive** from); thu được, rút ra (derive sth from)”. Every pre-answer surface that printed the gloss verbatim printed the answer:

| Surface | Pre-rc7 behaviour |
|---|---|
| `MC_VI_EN` prompt | the English answer is inside the Vietnamese prompt |
| `FILL_EN` prompt | the word to type is inside the prompt (copy, don't recall) |
| `MC_EN_VI` / `MC4` correct option | the prompt word is inside exactly one option (free pick by string match) |
| `MATCH` meaning tile | the tile pairs itself by string matching |
| Phrase practice prompt | one record (`oppose to` → “…be **opposed** to”) leaks an inflected form |

Counts (token-aware scan of all 5,852 rows): **55** glosses contain the headword token sequence (**25 active** in the learning deck), plus inflection-only (`Stimulus` → “stimuli”), constituent-only (`Streaky bacon` → “bacon”) and long-stem relatives (`photocopier` → “photocopy”). After the fix, **64** recorded glosses (**32 active**) are masked when used as a question surface. Affected active records include: 283 Culminate, 453 Derive, 490 Lactose intolerant, 492 Averse, 493 Aversion, 494 Incidental, 522 Lest + S + (should) V-bare, 532 Insulate, 537 Stimulus, 545 Adrenaline surge, 548 Summary, 549 Summarily, 555 Obsolescence, 578 Lark, 584 Streaky bacon, 585 Roving, 586 Plethora, 587 Chronically, 594 Extraction, 609 Retentive, 621 Conduct, 739 Disposal, 1630 footprint, 1635 diesel, 2832 behalf, 4188 proton, 4287 podcaster, 4492 gluten, 4493 lactose, 4494 cholesterol, 4851 logical, 5363 logically.

**Fix.** The stored gloss is never edited. New token-aware guards in `index.html` mask only the question surface: `maskAnswerInPrompt(text, answerWord)` blanks whole-token sequences of the answer in any regular written form (+s/es/ed/ing/er/est/ly, e-drop, y→ies/ied, doubled consonants, possessives, `stimulus→stimuli`), distinctive constituents of multi-token answers, and long-stem relatives (≥5 shared leading letters) — while leaving substring look-alikes (“art” in “article”) and diacritic-bearing Vietnamese tokens untouched. Applied to Việt→Anh and spelling prompts, recognition/MC4 option glosses (masked with the prompt word), matching tiles (masked with their own headword; the planner now judges tile distinctness on the printed text), and phrase prompts. Grading (`question.answer`, option ids, typed-answer rules) is unchanged; post-answer feedback still prints the recorded gloss in full.

### 2.2 RC7-02 — degenerate loanword glosses

9 rows (3 active: 4188 `proton`, 4492 `gluten`, 4494 `cholesterol` — the same three the rc4 vocabulary audit flagged REVIEW) record the gloss as the headword itself, so stimulus and answer are the same text in both directions (typed-Vietnamese could be answered by copying the prompt; the correct recognition option literally equals the prompt). These now keep **only the self-assessed flashcard path**: `glossEqualsWord` / `glossSegmentEqualsWord` gate `exerciseAvailability`, planned turns are refused `unavailable` (skipped ungraded, like a short MC4), and unplanned paths degrade to flashcard. No record was deleted or re-glossed; the data limitation stays visible in lookup.

### 2.3 RC7-03 — CLOZE blanking

Only **1** of 5,852 rows carries an example sentence (448 `Menial task`), so cloze was already near-absent and off by default — but its blanking regex recognised only the exact form + optional `s`, always used `examples[0]`, and silently degraded to a gloss prompt (`_____ · meaning`, itself leaky under RC7-01) when the word was inflected. rc7 replaces it with `usableClozeExample`: the first recorded example whose every answer-shaped token (exact, inflected, or long-stem relative) can be blanked; sentences that would leave a stem in view make cloze unavailable in **both** the planner predicate and the generator (explicit requests are refused `no-usable-cloze-example`; no-example keeps the documented recognition fallback). Substring safety is preserved (`art` is never blanked out of `article`, but a real second `art` is).

### 2.4 RC7-04 — cross-card leakage (sprint hand-off)

The sprint hand-off strip prints the previous card's word + gloss on the next card. Two recorded headwords can share one gloss, so the strip could answer the card it sits on. `handOffForDisplay` now drops the word/gloss (keeping the ✓/✕ mark) when either matches the current turn's word or gloss, including every pair of a matching board.

### 2.5 Surfaces audited and found clean (no change)

Spelling hint (first letter + length is deliberate scaffolding; withheld for a hypothetical 1-letter answer), first-look introductions (ungraded teaching stage, already skipped when meanings are hidden), flashcard flip (deliberate reveal), pending/skip chips (print other queued words only, never the current answer or its gloss), option `data-option` ids (the current card exposes no target id to compare against), search highlighting and `title` attributes (gloss printed only in show-meanings mode), ambiguous-answer panel (prints the learner's input, never the expected answer), exam practice (keys absent pre-submission since rc6), `question.example` (carried for feedback; not rendered pre-answer). Architectural limit, stated plainly: the dataset ships inside the HTML file, so this guards the learning interface, not a learner reading page source.

### 2.6 Permitted/prohibited matrix (enforced by tests)

| Type | Stimulus (intended) | Answer must not appear in |
|---|---|---|
| `MC_EN_VI`, `MC4` | prompt = word; options = glosses | any option gloss (prompt word masked) |
| `MC_VI_EN` | prompt = masked gloss; options = words | prompt, sub-prompt |
| `FILL_VI` | prompt = word | — (no recorded sense may equal the prompt) |
| `FILL_EN` | prompt = masked gloss; hint = 1st letter + length | prompt, sub-prompt, hint (never whole word) |
| `CLOZE` | blanked sentence; options = words | sentence (all written forms + stem relatives) |
| `MATCH` | word tiles + masked meaning tiles | a meaning tile quoting its own headword |
| `FLASHCARD` | word; gloss on flip | pre-flip DOM (unchanged, verified by suite) |

## 3. Other red-team findings

| ID | Severity | Finding | Disposition |
|---|---|---|---|
| RC7-05 | Low | `tests/pages_smoke.py` read `DEPLOY_HOLD` via an unclosed `open()` (ResourceWarning in every Python run) | Fixed (`pathlib` read); probe gains an rc7 marker branch |
| RC7-06 | Info | Availability sweep over the full deck costs more with gloss masking (Node sandbox: 73 ms → ~160 ms cold for 4,581×8) | Memoised per immutable row (`WeakMap`, same pattern as option keys); question generation median unchanged (2.2 ms → 2.2 ms, same harness); UI pools are session-sized |
| RC7-07 | Info | Sprint retrieval ladder demand vs actual mode already diverged for untypable spelling; rc7 adds the same divergence for 3 degenerate records (flashcard inside sprint) | Documented; progress only ever moves on first pass, consolidation never re-queues itself; correctness over sprint speed for 3 records |
| — | — | Scheduler priority (`due → weak → learning → new → review → mastered`), mastery, XP, streak, backup v1 schema, storage keys, telemetry contract: reviewed in diff, untouched | No change |

Failure-oriented checks that found nothing new: duplicate/ambiguous options after masking (dataset-wide assertion), planner↔generator availability agreement (asserted for every record × type), typed-grading ambiguity behind a masked prompt (regression-tested; the comparison now reads the target record's raw gloss), match-board ambiguity after tile masking (planner keys on printed text), malformed/oversized imports and quota rollback (existing suites), exam key hiding (existing suites).

## 4. Exam archive audit (all 106 records, regenerated)

No exam data changed in rc7. The build-time audits were re-run and are byte-current (`--check` clean), reproducing the rc6 counts exactly — they are re-stated here as regenerated fact, not copied:

- Records: **106** (22 HTML/OCR read-only for practice); embedded bodies byte-identical to `De-chuyen-Anh-vao-10/*.md` sources with per-record SHA-256 (static suite recomputes all 106).
- Extracted questions: **6,457** (choice 3,639; text 2,569; multiple 46; true/false 12; essay 191). Extraction counts are not official coverage.
- Provenance (question denominator): `official_verified` **0**, `independently_cross_checked` **0**, `source_transcription_unverified` **1,769**, `inferred_unverified` **0**, `user_confirmed` **0 at build**, `missing_answer` **3,216**, `ambiguous_review` **1,472**. Provisionally gradable: **1,269**. Official primary sources checked: **0/106** — no official key was obtained in rc7 either, and nothing was upgraded, inferred or silently resolved.
- Rendering audit: 106/106 render without error; 0 script tags, 0 inline handlers in rendered output.

## 5. Security, telemetry, privacy (reviewed, no code change)

`api/telemetry.js`, `app.js`, `vercel.json` and `supabase/migrations/20261029_telemetry_ingest.sql` re-read in full. Origin allowlist (403), content-type (415), 16 KB streamed body cap (413 while reading), contract/version/event validation, payload rebuilt from allowlisted fields only, salted-HMAC rate-limit key (no stored IP), no body/header logging, RLS enabled with no policies and a single `SECURITY DEFINER` entry point executable by `service_role` only. Client stays opt-in, one POST per explicit click, no retry. `PRIVACY.md` version line moved to rc7; no guarantee changed. Telemetry contract suite **16/16**.

## 6. Tests actually run (candidate tree)

- Data/embed synchronization: all 14 commands clean (vocabulary 5,852 rows / 5,112 headwords; phrases 780; exams 106 papers / 6,457 questions / 1,269 provisional; provenance 106/106 hashes).
- Python: **157/157 OK**.
- Node static: **131/131** (124 baseline + 7 rc7 regressions; the 7 new tests fail 0/7→7/7 against the pre-fix `index.html`, verified by temporarily restoring rc6 bytes). Exam scoring **11/11**; telemetry **16/16**.
- Exhaustive leakage regression: every eligible record of the real 5,852-row dataset in every supported exercise type (>30,000 generated questions) checked for pre-answer answer appearance in prompt/sub-prompt/hint/options, one-correct-option and distinct-option invariants; cloze blank asserted (1 eligible record).
- Browser (Chromium 133.0.6943.0 via `@sparticuz/chromium`, suites run sequentially locally): `tests/browser-learning.cjs` **PASS** (including the new rc7 scenario: record 453's Việt→Anh prompt is masked pre-answer and the full gloss appears only in feedback; first attempt at that scenario opened one more 14 MB page and the sandbox Chromium died with “Target page, context or browser has been closed” — the same environment limit rc6 recorded — so the scenario reuses the already-open rc5 page); `tests/browser-exams.cjs` **PASS** (106-record catalogue, key hidden before submit, deterministic 3/3 provisional summary, correction/history/import flows, VI/EN, Classic/Modern, 320/375/768/1024/1440 px, no network or page errors).
- Offline: single `index.html` opened via `file://` with the browser context offline renders, opens a session, zero page errors and zero non-file network requests.
- `git diff --check`: clean.
- Not tested: Firefox, Safari/WebKit, physical devices, screen readers. Browser evidence is Chromium only; axe runs inside the existing learning suite.

## 7. Performance and memory (same sandbox harness, Node)

Question-generation median over the active deck: `mc_en_vi` 2.24→2.22 ms, `mc_vi_en` 2.52→~2.5–3.2 ms (noise-level), `fill_en` ~0 ms, `cloze` ~2.2→2.7 ms. Full-deck availability sweep (worst case, only tests do this): 73 ms → ~160 ms cold, memoised afterwards. No new timers, listeners or background work; heap in the probe process ~78 MB (dominated by the embedded datasets, unchanged).

## 8. Release evidence

_To be appended after each observed stage: PR number/head SHA, CI runs, merge commit, annotated tag target, release-artifact run, asset sizes/SHA-256, prerelease publication time, deploy run, Pages deployment id/URL, Pages smoke probe result._

## 9. Known limitations and stable-readiness

- Cloze remains effectively unavailable (1 usable example in the dataset); rc7 makes its guard honest rather than inventing sentences.
- Three active loanword records (`proton`, `gluten`, `cholesterol`) are flashcard-only until a sourced Vietnamese gloss is recorded; thin loanword glosses (`diesel` → “dầu _____”) stay askable but easy.
- `enzyme` → “enzym” is a Vietnamese loanword stimulus, deliberately not masked when it is the entire gloss.
- 0/106 official exam sources/keys; 3,216 missing + 1,472 ambiguous mappings; no listening audio; 22 HTML/OCR read-only; no Firefox/Safari/screen-reader/physical-device evidence.
- **Stable readiness: NO-GO.** rc7 is a prerelease candidate; publishing it does not change that assessment.
