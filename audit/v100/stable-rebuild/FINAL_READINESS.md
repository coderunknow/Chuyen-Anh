# FINAL READINESS — `v1.0.0` stable candidate rebuild (2026-11-17)

**Verdict: NOT-YET-STABLE — verified stable CANDIDATE, delivered as a Draft PR.**
Round 2 (2026-11-17) resolved all seven CodeRabbit review findings and removed
the automatic production-write trigger from the telemetry smoke workflow. The
owner-authorized `@coderabbitai review` on that head then produced a fresh
review (13 findings, 2 Major); round 3 (2026-11-17) resolved all of them —
including the real gap it caught (the Bearer class omitted `-`, which RFC 6750
allows) — and hardened every audit script the review flagged. The independent
audits were re-run at the round-3 head: vocabulary deep audit 0 defects, exam
totals and 2,146/2,146 curated hashes re-derived (`verdictOk: true`),
transcript fallback exactly 307 scorable / all LOW, injection scan clean with
negative controls, browser suites green, sprint benchmark 22.09 s median with
0 page errors. Every remaining item is either the CI run on the exact final
head (recorded in the PR body, §15 of the PR — recording it here would require
another commit and a new head), the next CodeRabbit pass on that head, an
owner decision, or an externally blocked infrastructure check. No merge, tag,
release or deployment has been performed, and none may be inferred from this
document.

## What changed on the branch (base: `948f6f9`)

1. **Two defects fixed with the full proof chain** (baseline reproduction →
   fix → regression tests → mutation controls → post-fix green):
   - `NODE-LOCKS-ENV` (`tests/exam-persistence.test.js`): a stale environment
     assumption broke the suite on Node ≥24.22; the app code was right. The
     test now pins the honesty invariant (`mode` equals actual lock support) on
     both kinds of environments.
   - `TELEMETRY-NOTE-SECRETS` (`index.html` + `api/telemetry.js`): diagnostics
     notes could carry verbatim credentials (GitHub PAT, OpenAI-style key,
     bearer header, URL credentials). Both scrubbers now redact secret-shaped
     strings, in sync, with new tests on both sides (telemetry-api 17 → 18,
     Node total 305 → 306).
2. **Stable identity reconciled behind the dual gate:** `APP_VERSION = 'v1.0.0'`,
   `DEPLOY_HOLD` unchanged at the published prerelease `v1.0.0-rc11`;
   `deploy_gate.py` is open, `app_release_gate.py` holds Pages until the stable
   release is published **and** separately authorized (`stable_deploy_authorized=true`;
   force alone is insufficient). All version-dependent tests, checklist totals,
   PRIVACY/SECURITY/README/CHANGELOG reconciled. Merging does **not** deploy:
   production Pages keeps serving rc11 until the owner authorizes the cutover.
3. **Documentation:** CHANGELOG stable-candidate section, append-only log
   entries, and this evidence directory (`audit/v100/stable-rebuild/`).

## Quality results (all re-verified at the candidate head)

- **Tests:** Python 302/302 (incl. 8 telemetry-smoke structural gate tests);
  Node 308/308 (incl. the round-2 scrubber regression tests); archive 5/5;
  21 validator commands exit 0; both browser suites green on Chromium
  133.0.6943.0 at the round-2 head (learning: 35 phases incl. WCAG 2.1 A/AA
  axe runs, responsive 320/375/768, light/dark, reduced-motion, backup
  round-trip; exams: 106-record catalogue, table/keyboard semantics);
  `git diff --check` clean.
- **Round-2 review findings (7/7 fixed, tests + mutation controls):**
  fine-grained GitHub-token scrubbing, full RFC 6750 Bearer alphabet (incl.
  trailing `=` and short credentials), empty-username URL user-info
  redaction, secret patterns before the quote split (both scrubbers), a
  pinned-worktree baseline procedure, and the five cited audit scripts
  tracked with repo-relative paths. 8/8 mutants killed
  (`evidence/review-round/mutation_controls.log`).
- **Production-write prevention:** the telemetry smoke workflow is
  dispatch-only with an explicit confirmation input, a required deployment
  identity and a concurrency group (structural tests:
  `tests/test_telemetry_smoke_gate.py`, 8/8; negative control: re-adding a
  `pull_request` trigger fails the suite).
- **Vocabulary deep audit (fresh code):** 0 defects across 8,852 rows /
  8,928 senses / 1,094 phrases — unique IDs, structural integrity, no
  locator-level CEFR conflicts inside multi-sense headwords, distractor
  pools sufficient at every level (`evidence/review-round/vocab-deep-audit.json`).
- **Transcript-fallback policy (fresh code):** 325 fallback-flagged items;
  exactly **307 scorable — all LOW confidence**; the 18 exempt ones carry
  13 VERY_LOW + 5 LOW; 0 official-verification claims
  (`evidence/review-round/transcript-fallback-audit.json`).
- **Workflow security scan:** 8 workflows, 0 injection-shaped `${{ }}`
  interpolations inside `run:` bodies after the parse-verified
  literal-matrix allowlist; negative controls detect injected branch-name
  and PR-title interpolation in both block and inline forms
  (`evidence/review-round/workflow-injection-scan.json`).
- **Performance (round-2 head):** sprint benchmark median 22.09 s
  (round mean 22.14 s, range 22.01–22.32 s), 27.2 turns/min, mean feedback
  latency 26 ms / hand-off 55 ms / continue 40 ms, first-pass and hand-off
  medians 54/57 ms, 0 page errors — consistent with the round-1 medians
  (23.66→24.22 s) within observed sandbox noise. Software-rendered sandbox
  only; no physical-device claim
  (`evidence/review-round/speed-benchmark-round2.json`).
- **Exam data (independent recomputation, fresh code):** 106 papers, 6,708
  questions, 5,155 scorable (76.85%), 1,553 exempt with the exact category
  split (749 ocr-structural + 12 option-overflow + 7 key-not-an-option + 627
  stimulus-incomplete + 158 essay), 100% non-exempt coverage; all 2,146
  curated SHA-256 bindings re-derived with 0 mismatches; deterministic
  10-question solving sample: 8/8 verifiable agree (2 listening/context items
  left unclaimed rather than guessed).
- **Vocabulary (independent sample):** 201/201 senses agree with the five
  pinned reference snapshots (198 automatic + 3 manual lookups).
- **Security:** red-team probes confirmed the allow-list rebuild drops unknown
  fields, hostile counters are dropped, the injection-shaped client_key is
  rejected by the hardened SQL (and inert in the old one, parameter-bound),
  and the live endpoint answers preflight `204` / GET `405` exactly per
  contract. No production-writing request was sent.
- **Performance:** artifact size byte-identical to baseline (28,273,009 B raw,
  3,093,228 B gzip); speed benchmark medians 23.66 s → 24.22 s (~2%, within
  observed run-to-run noise in a software-rendered sandbox), 0 page errors.
  The scrub change sits on the diagnostics path only, not any hot path.
  Physical-device memory claims remain unverified (no device).

## Infrastructure findings

- **Supabase:** the old `20261029` ingest function demonstrably lets a keyless
  flood store 120 rows and exhaust the global budget; the `20261031` hardening
  stores 5, buckets missing keys (`client:missing`, cap 5) and rejects
  non-32-hex keys — demonstrated against the **real SQL** in an in-memory
  Postgres (PGlite). Disclosed residual: refused attempts still count toward
  the global attempt budget, so a >120-attempt flood closes the window for
  everyone (bounded rows, not bounded accounting). Whether the hardening is
  actually applied to the live database could not be verified (no
  credentials) — externally blocked. The shared `compute_jobs` table (RLS
  disabled, broad privileges) was **not** read or modified and remains an
  owner decision on the shared project.
- **Vercel:** project settings/logs/observability not inspectable without
  credentials; the deployed endpoint's public contract was verified read-only.
  The deployed function does not yet contain the new secret-scrub — it ships
  when the maintainer next deploys the function (no deployment authorized from
  here).
- **GitHub:** no `v1.0.0` tag exists (mission premise false) — a future stable
  publication has no tag collision; `RELEASE_BLOCKED_TAG_COLLISION` not
  applicable. Live Pages serves rc11 (deployment `7798610277`, success).

## Open items before this candidate could be called stable

1. **CI on the exact PR head** — runs recorded for the exact final head in
   the PR body (§15); round 1 head `248b75a` was 16/16 green, and the
   round-2 head is re-run and recorded there after push.
2. **Code review status** on the exact PR head — round 2 findings all
   resolved; a fresh `@coderabbitai review` run on the final head is the
   remaining verification (the repository's CodeRabbit plan does not
   auto-review; the owner-authorized review command is used once).
3. **Owner decision — listening grading policy:** the mission text forbids
   auto-grading listening questions even with a transcript; the shipped
   application grades 307 transcript-fallback listening items with `LOW`
   confidence and explicit warnings (per the published README). Changing this
   flips scoring semantics on published numbers, so it was documented, not
   silently changed (`AGENT.md` rule 4).
4. **Owner action — Supabase:** verify/apply `20261031_telemetry_hardening.sql`
   on the live database; remediate the shared `compute_jobs` exposure.
5. **Owner action — Vercel:** re-deploy `api/telemetry.js` to ship the
   secret-scrub; then a single authorized live POST recheck.
6. **Externally blocked verification:** Firefox/WebKit local runs (CI covers),
   screen-reader pass, physical low-memory devices, the 186 external asset
   digests.

Compliance statement: no merge, no tag create/move/delete, no release
publication, no Pages/Vercel deployment, no Vercel settings change, no Supabase
mutation, no production telemetry POST **initiated by the session** (the repository's
then-automatic smoke workflow stored one synthetic row when PR #88 opened —
disclosed in the PR body and FAILURE_LEDGER F-SR11 — and its automatic
trigger surface is now removed), and no unauthorized review-trigger comments
(the one `@coderabbitai review` comment is owner-authorized by the mission).
The PR is and stays **Draft** while the items above remain open.
