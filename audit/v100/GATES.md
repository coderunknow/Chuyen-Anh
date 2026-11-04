# v1.0.0 candidate — gate table S1–S25

Evaluated on branch `arena/6b7c2879-chuyen-anh`. Baseline (main): `f12b4bc5241e330eb8c051ada749d4f514111b61`.
Head at evaluation time: see `git rev-parse HEAD` / the PR. Nothing below is claimed
before it is measured; commands are listed so every number can be re-derived.

## 2026-11-04 — renewed stable-release audit

The user has authorized stable publication **only after all hard gates pass**, while
protecting `DEPLOY_HOLD`. The evidence below predates this renewed audit: historical
results are useful, but are not a full independent assessment or evidence for a new
head. Prior PASS labels are reset to NOT STARTED until independently re-evaluated
against the exact candidate SHA. S10 is FAIL: `lie` shares a combined gloss between
A1 and B1, and the Oxford `rock` labels are paired with opposite glosses. S25 is
BLOCKED pending the new review findings and independent review. Three-engine CI run
`41813222542` passed on `1d61c7bc9f8fed221025cb253ea3c15e51389cee`, not on any later
commit. The current audit is incomplete; no release is authorized.

### Additional stable-release gates

| Gate | Requirement | Status and evidence |
| --- | --- | --- |
| S26 | App-version and hold gates prevent prerelease deployment of stable app | NOT STARTED — local regression tests for both workflow conditions added; live workflow not exercised |
| S27 | All sense mappings, source claims and unresolved estimates independently audited | BLOCKED — automated labelling is not independent evidence; real cross-level gloss leak reproduced |
| S28 | Stable-tag artifact build and publication | NOT STARTED — existing artifact script and trigger only support prerelease tags |
| S29 | Full 106-paper / 6,804-question primary-evidence assessment | NOT STARTED — existing reason accounting is not an individual primary-source review |
| S30 | Application-wide accessibility, physical/screen-reader checks and production smoke | NOT STARTED — exam-view axe and prior browser suites are not application-wide proof |

## Phase I — audit & defect ledger

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| S1 | Baseline captured before any change | `audit/v100/baseline.json` (head `f12b4bc5…`, sha256 of vocabulary/phrases/index.html/md) | **NOT STARTED** |
| S2 | Defect ledger with per-defect disposition | `audit/v100/DEFECTS.md` — 14 defects, all fixed or documented; 0 silently patched | **NOT STARTED** |

## Phase II — sense-level CEFR model

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| S3 | Every row carries senses with stable senseIds `^<id>-sN$`, a CEFR level, evidence class, confidence, sources, rationale | `python3 scripts/build_senses.py --check`: 8,852 entries, **8,860 senses**, 8 multi-sense, **unresolved 0**; `validate_vocab.py` passes (incl. `editorial_estimate` → `needsIndependentValidation === true`); `tests/v100-senses.test.js` 7/7 | **NOT STARTED** |
| S4 | Sense badges/ranges in the UI (flashcard + feedback), level only, never the definition | `entryCefrBadgesHtml`/`cefrBadgeHtml` in `index.html`; static-app test 138 + v100-senses badge tests; browser suites show badges | **NOT STARTED** |
| S5 | Per-sense `scope` example present and honoured | entry 1470 `scope`: B1 (`disputed`, CEFR-J B1 > word-level Oxford 5000 C1 per documented hierarchy, both votes recorded); synthetic C1/C2 fixture proves C1-only vs C1+C2 narrowing (v100-senses tests 3–4) | **NOT STARTED** |
| S6 | Migration + backward compatibility | `scripts/migrate_senses.py` + `tests/test_migrate_senses.py` (field preservation, determinism, reversibility by stripping `senses`, 913 untagged legacy rows classified, CLI migrates `audit/v100/backup/data-pre-v100.tgz`); legacy `level:` tag untouched, runtime falls back per entry | **NOT STARTED** |
| S7 | All rows reclassified through one pipeline | `build_senses.py --report` → `audit/v100/evidence/cefr-sense-audit.json`: byLevel A1 940 · A2 1,168 · B1 1,919 · B2 2,248 · C1 1,443 · C2 1,142 · UNCLASSIFIED 0; byEvidence source_supported 3,085 · cross_validated 1,663 · disputed 2,267 · editorial_estimate 1,845 (all `needsIndependentValidation`) · unresolved 0; confidence HIGH 4,702 · MEDIUM 4,158 | **NOT STARTED** |
| S8 | Multi-select CEFR + Unclassified control | 128 selections × every entry tested (v100-senses test 2); UI chips + Unclassified toggle persisted in `chuyen-anh.cefr.v1` | **NOT STARTED** |
| S9 | Default selection B2+C1 | `defaultCefrSelection()` = {B2,C1}; eligible headwords on deck = **3,032** (3,033 senses, test-pinned) | **NOT STARTED** |
| S10 | No level leakage | no-leak test across all modes × 4 selections; `cefrDeck()` sense-filtered so sessions/sprint/priority/distractors/answers all narrow | **FAIL** |
| S11 | Lookup comprehensive by default | search/lookup covers all 8,852 rows (static-app test 110: 8,112 headwords reachable); optional persisted `lookupCefrNarrow` toggle | **NOT STARTED** |

## Phase III — +500 A1 / +500 A2

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| S12 | Exactly +500 A1 and +500 A2 new headwords | `expand_vocabulary.py --report`: seed file `22-a1a2-stable.tsv` has 1,144 candidates → **newByLevel A1 500, A2 500** (144 skipped with recorded reasons: inflection 81 · word-family 53 · comparative 6 · spelling variant 4); bank 7,852 → 8,852 rows, headwords 7,112 → 8,112, deck 5,841 → 6,841 | **NOT STARTED** |
| S13 | Provenance + accepted/rejected counts | over the **1,000 accepted** new rows, `level-source:` is `cefrj-vocabulary-profile-1.5` (**892**) or `oxford-3000-wordlist` (**108**; sum = 1,000, 0 `editorial`) and every row carries `source:` evidence; refs vendored and SHA-256 verified in `audit/v100/refs/`; accepted `type:` split is `core` 446 + `topic` 554 = 1,000 | **NOT STARTED** |

## Exam scoring

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| S14 | Scoring recomputed and current | `node scripts/exams/build_answer_keys.mjs --check`: 106 papers, 6,804 questions, **3,011 scorable (44.25%)**, 3,793 ungradeable; `docs/exam-scoring-audit.json` regenerated | **NOT STARTED** |
| S15 | Provenance states; `officialScore=null` without official evidence | key records carry verificationStatus/sourceStatus/confidence/limitations; runtime summary `officialScore: null`, attempt `officialScore: false`; 0 papers with an official primary source (provenance audit) | **NOT STARTED** |
| S16 | 0 unresolved non-exempt blockers | all 3,793 ungradeable items carry an exempt documented reason (sum = 3,793); 8 answer-claim-without-section papers listed in `docs/exam-provenance-audit.json`; inference lexicon fail-closed (`tests/test_exam_inference_fail_closed.py`) | **NOT STARTED** |

## Preserve functionality / UX

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| S17 | Import/export/backups + migration tests keep working | python suite 194 OK (incl. `test_migrate_senses.py`, import/export/backup tests); browser suites: backup round-trip, malformed import rejected atomically, over-quota restore, cross-tab two-tab grades | **NOT STARTED** |
| S18 | UX audit | `docs/learning-experience-audit-2026-10-13.md` + browser suites (first-look, keyboard, light/dark, VI/EN, classic/modern) | **NOT STARTED** |

## Full validation

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| S19 | Playwright 3 engines | chromium **PASS locally on 153.0.8010.0** (both suites); firefox + webkit **PASS in CI** on PR #82 (run `41794025530` on `c8138af`); current branch head CI pending | **NOT STARTED** |
| S20 | Responsive widths | 320/375/768/1024/1440 px, no horizontal overflow (both suites) | **NOT STARTED** |
| S21 | axe WCAG 2.1 AA | axe-core 4.14 clean on exam view with `wcag2a`, `wcag2aa`, `wcag21a`, `wcag21aa` (`tests/browser-exams.cjs:215`); 0 violations | **NOT STARTED** |
| S22 | Keyboard + reduced motion | tab order reaches language/theme/shortcut selectors, card operable by keyboard; `reducedMotion:'reduce'` removes transitions (both suites) | **NOT STARTED** |
| S23 | file:// + zero external deps | `tests/static-app.test.js` (no `<link>`, no `src=`, no `fetch(`, no module imports) + browser suite opens the file over `file://` offline with no network/page errors | **NOT STARTED** |
| S24 | Cross-tab persistence | RC2 two-tab scenario in browser-learning suite: grades survive cross-tab writes, wipes never resurrected | **NOT STARTED** |

## Process

| Gate | Requirement | Evidence | Verdict |
| --- | --- | --- | --- |
| S25 | Review bots per `.coderabbit.yaml` recorded by PR head SHA; PR only, no merge/tag/release/deploy | PR #82 opened from `arena/6b7c2879-chuyen-anh`; CodeRabbit reviewed `c8138af` (run `3f8762ce-2219-4cd2-8a76-5034afdadc95`, 11 comments — all verified fixes applied on the follow-up commit, deploy-gate comment skipped per explicit `DEPLOY_HOLD`-unchanged directive) new head review pending; DEPLOY_HOLD untouched; only the v1.0.0 version string changed | **BLOCKED** |

## Test totals (measured on this head)

- node: `static-app.test.js` 144 + `exam-scoring.test.js` 25 + `exam-anomalies.test.js` 7 + `rc10-cefr.test.js` 10 + `v100-senses.test.js` 7 + `telemetry-api.test.js` 17 = **210 pass / 0 fail**
- python: `python3 -m unittest discover -s tests -p 'test_*.py'` = **194 OK**
- browser: `tests/run-browser-suites.sh` on chromium 153.0.8010.0 = **both suites PASS** (learning + exams); CI matrix `[chromium, firefox, webkit]` green on `c8138af`; current branch head pending
- checks: expand/build/validate/embed vocabulary, build_senses, phrases, answer keys, archive embed, all audits — all `--check` green
