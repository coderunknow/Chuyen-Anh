# FAILURE LEDGER — stable-rebuild session (2026-11-17)

## F-SR1 — first independent-vocab sampling pass checked only 24 senses

- **Hypothesis:** a deterministic stride sample of source-backed senses can be
  verified directly against the pinned reference snapshots.
- **Method:** load CEFR-J + Oxford 3000, stride 137, first-source lookup.
- **Raw outcome:** 24 checked, 24 agree — far below the intended ~200.
- **Why it failed:** four of the five reference files were not loaded
  (`oxford-5000-expanded`, `octanove`, `cambridge-evp`), so most candidates were
  filtered out before sampling.
- **Learned:** sample density depends on reference coverage, not candidate count.
- **Next experiment:** load all five references, compute the stride from the
  candidate pool, target ~200 checks → 198 automatic + 3 manual = 201/201 agree
  (`independent_vocab_audit.mjs`, `work/evidence/independent-vocab-audit.json`).

## F-SR2 — independent exam audit first run crashed (`curated is not iterable`)

- **Hypothesis:** `data/exam-curated-keys.json` is a bare array of entries.
- **Raw outcome:** `TypeError: curated is not iterable`.
- **Cause:** the file is a document object (`schemaVersion`, `policy`,
  `summary`, `entries[]`), and the embedded exam records carry raw
  `markdown` + `answerKey` (questions are parsed at runtime, not stored).
- **Learned:** read the real shapes before re-deriving; re-parsing with the
  production parser (`app.parseExamQuestions`) is the meaningful binding check.
- **Next experiment:** re-parse each paper body, recompute coverage, and
  re-derive `promptSha256`/`optionsSha256` exactly as the manifest canonicalizes
  (`sha256Text(prompt)` and `id:label:text` joined by `|`) → 2,146/2,146 verified,
  0 mismatches, every published coverage number reproduced
  (`independent_exam_audit.mjs`, `work/evidence/independent-exam-audit.json`).

## F-SR3 — PGlite evidence harness: first hardened-window expectation was wrong

- **Hypothesis:** under the hardened function, a 130-call keyless flood leaves
  the global budget untouched for other clients (`firstGlobalRefusal === -1`).
- **Raw outcome:** `hardened-behavior-demonstrated=false`;
  `firstGlobalRefusal=120`, and the second honest client was globally refused.
- **Cause:** the hardened function increments the global attempt counter BEFORE
  the per-client check, so *refused* attempts still consume the global budget.
- **Learned:** the hardening bounds *stored rows* (120 → 5) and adds a missing-key
  bucket, but a >120-attempt flood still closes the global window for everyone in
  that window — a disclosed design property, not a regression.
- **Next experiment:** split into B1 (10-call burst: 5 stored, 5 client-refused,
  global intact, another client inserts OK) and B2 (130-call flood: 5 stored,
  first client refusal at 6, global refusal from 121) → both demonstrated
  (`pglite_rate_limit_evidence.mjs`, `RESULT old-behavior-demonstrated=true
  hardened-behavior-demonstrated=true`).

## F-SR4 — mutation harness leaked the lockless navigator stub across cases

- **Raw outcome:** mutant 4 (`always-unserialized` on a locking context) was not
  caught because case 3 had replaced `globalThis.navigator` with `{}`.
- **Cause:** test-order contamination in the harness itself.
- **Fix:** save the original navigator and restore it for locking-env cases →
  `MUTATION-CONTROLS: OK`.

## F-SR5 — version-literal meta-test failure list did not match `grep`

- **Raw outcome:** after the version bump, the Node meta-test listed stale rc11
  literals in `browser-learning.cjs` that plain `grep -n "v1.0.0-rc11"` did not
  find.
- **Cause:** the remaining pins use escaped regexes (`v1\.0\.0-rc11`) at lines
  3128 and 3190.
- **Learned:** the meta-test scans escaped forms by design; search for both
  literal and escaped variants before believing a "clean" grep.
- **Fix:** updated both escaped pins; suite green (306/306).

## F-SR6 — `deploy_gate.py --repo` reported "release v1.0.0-rc11 is missing"

- **Raw outcome:** with `--repo coderunknow/Chuyen-Anh`, the gate reported
  missing even though the API shows the rc11 prerelease published.
- **Cause:** the gate shells out to `gh api`; `gh` is not installed in this
  sandbox, and the gate fails closed with the documented reason.
- **Learned:** environment artifact, not a repository defect; the release state
  was verified directly through the REST API instead.
- **Next step:** CI (which has `gh`) re-evaluates the gates at the PR head.

## F-SR7 — live Vercel/Supabase inspection not possible from this session

- **Hypothesis:** read-only inspection of project settings, deployments, logs
  and the live `telemetry_ingest` function.
- **Raw outcome:** no Vercel or Supabase credentials exist in this environment;
  the mission forbids decrypting or printing secrets and no secret material was
  provided for those services.
- **What was done instead:** unauthenticated read-only probes of the deployed
  endpoint (preflight `204` for the published origin; `405` on GET with
  `Allow: POST, OPTIONS`), the GitHub Pages deployment API, and the real-SQL
  PGlite demonstration of both migration behaviours.
- **Status:** EXTERNALLY BLOCKED; exact required owner action recorded in
  `FINAL_READINESS.md`.
