# FINAL READINESS — `v1.0.0` stable candidate rebuild (2026-11-17)

**Verdict: NOT-YET-STABLE — verified stable CANDIDATE, delivered as a Draft PR.**
The application work that can be executed and evidenced inside this session is
complete; every remaining item is either CI-at-head verification (runs after
push), an owner decision, or an externally blocked infrastructure check. No
merge, tag, release or deployment has been performed, and none may be inferred
from this document.

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

- **Tests:** Python 294/294; Node 306/306; archive 5/5; 21 validator commands
  exit 0; both browser suites green on Chromium 133.0.6943.0 (in-sandbox,
  re-run after the version bump); `git diff --check` clean.
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

1. **CI on the exact PR head** — runs after push; all required jobs must be
   green on the head SHA (pending).
2. **Code review status** on the exact PR head (CodeRabbit auto-runs; no
   review-trigger comments posted).
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
mutation, no production telemetry POST, no review-trigger comments. The PR is
and stays **Draft** while the items above remain open.
