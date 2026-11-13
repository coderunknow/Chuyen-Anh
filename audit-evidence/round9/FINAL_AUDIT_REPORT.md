# Round 9 — final audit report

Branch `arena/34e7e96d-chuyen-anh`. Base `2f686f7` (PR #85 head). Final head
**`b687b86`**, CI run `43434146112`, 4/4 green. Review PR **#86**,
open and ready for review, stacked on `arena/chuyen-anh-r8-ready-review`.
No merge, tag, release, prerelease, publication or deploy was performed, and
`DEPLOY_HOLD` stayed in force throughout.

This report is written to be checkable rather than reassuring: every claim names
either a command, a file in this tree, a CI run id, or a mutation that was made to
fail.

---

## 1. What this round did

Four passes, in this order:

1. **Delivery infrastructure** — path filters, trigger coverage, credential
   persistence, failure diagnostics, the summary script, the deploy gate.
2. **Review** — twelve CodeRabbit findings, all read and judged on the code; eight
   accepted as real defects, four of them in this round's *own* work.
3. **Measurement** — a real Actions baseline, one optimization tried and honestly
   refuted and reverted, one unreproduced drift recorded as unexplained.
4. **Coverage** — *"what does the suite not look at?"* This pass produced the
   round's most consequential findings, and it is the one that matters most for
   how much confidence this audit can honestly claim.

## 2. The findings that changed the app

| ID | Class | What was wrong | Evidence it was real | Proof the fix is guarded |
|---|---|---|---|---|
| **R9-21** | confirmed defect, a11y | 8 of 24 openable exam papers rendered **17 column headers with no name** (`<th scope="col"></th>`) | axe full AA rule set on papers CI never opened | mutation **M19** fails; **M19b** shows the old single-paper suite passes with the bug present |
| **R9-23** | confirmed defect, a11y | light: active-nav count pill **4.37:1**; dark: sprint badge **2.30:1** (AA needs 4.5:1) | 126 nodes axe left `incomplete`, resolved by pixel sampling + exact gradient maths | mutations **M20** and **M21** fail, each on the correct theme |
| **R9-22** | harness defect | the "WCAG 2.1 AA" claim rested on **two** axe rules on two views | injecting one unnamed icon button: old set `[]`, full set `["button-name"]` | the widened check is itself the regression test |
| **R9-24** | harness defect (this round's own test) | the R9-23 test audited dark **twice** under a "light" label | mutation M21 reported a 2.30:1 failure labelled `light` | loop now asserts the resolved theme before measuring |
| R9-25 | process (this round) | a generated artefact was not regenerated; CI's own guard caught it in 27 s | `audit_rendering.mjs --check` failed at `24bfad5`; only `rendererOutputBytes` on 11 records changed | the existing `--check` gate |
| R9-14, R9-15, R9-16, R9-17, R9-18 | confirmed/harness | publishing checkout persisted the token; failure screenshots could never work; summary script reported unfinished runs; parity test could pass over unequal filters; checklist overclaimed | review + mutation | M10–M13 |

Full ledger, including the refuted hypothesis and the things that held under
attack, is in `DEFECTS.md` (25 entries, classified, 21 mutations M1–M21).

## 3. What the suite now covers that it did not before

- **Every openable exam record**, not one: 24 papers, 791 tables, 2 330 headers.
- **The full WCAG 2.1 A/AA rule set on all six views in both themes** (12 audits
  per engine), where two rules on two views were checked before.
- **A positive control before those audits** — three injected defects must be
  reported, so a broken probe fails instead of passing silently.
- **The contrast axe structurally cannot decide** (gradients, translucent chips),
  recomputed from computed styles at each element's own size threshold.

## 4. What is *not* claimed

Being explicit is the point of this section.

- **Not "fully audited", not "all bugs fixed", not "production-ready".**
- **Firefox and WebKit were not run in this sandbox.** Chromium 133 was, end to
  end, and every new browser assertion was executed there before push. CI runs all
  three engines at 140; the engine-version gap is stated, not glossed.
- **The 186 external asset digests were not verified** against their bytes
  (`R9-B7b`) — they cannot be fetched from this sandbox.
- **CI failure capture and artifact upload were never observed on a failing run**
  (`R9-C8`). A passing run reports that step `skipped`, which is not evidence.
- **No screen-reader session was performed** (`MANUAL_REQUIRED`). Running axe is
  not the same thing and is not described as such.
- **WebKit's slowdown (R9-20) is unexplained.** 747 → 740 → 904 → 907 → 1174 →
  1150 s with byte-identical suites; chromium stayed 387–458 s. Recorded, not
  attributed to the code, not "fixed".
- **The telemetry smoke test still fails** for an external reason (R9-10).
- **`#cefr-narrow`'s 13×13 box is not a defect** — its real target is the label.
  Recorded as a probe artifact; no code was changed for it.

## 5. Actions cost, measured

Final numbers for the head `b687b86` (run `43434146112`, 4/4 green):

| Job | Duration | Suite step |
|---|---:|---:|
| `browser (chromium)` | 494 s | 453 s |
| `browser (firefox)` | 639 s | 583 s |
| `browser (webkit)` | 834 s | 748 s |
| `checks` | 145 s | — |
| **wall-clock** | **835 s (13 m 55 s)** | |
| **runner-seconds** | **2 112 s** | |

The suite step grew by design (the exam-header sweep and twelve WCAG audits per
engine); `checks` grew from 133 s to 145 s for the same reason. Both are paid
knowingly.

Wall-clock across ten runs of this branch spans **13 m 18 s – 20 m 11 s** on
identical work. That is the single most important number in this report for
anyone reviewing the "optimize CI" objective: **no change smaller than ~7 minutes
is measurable on this workload.** It is why the one optimization attempted was
judged on runner-seconds, reported as costing **+201 s**, and reverted. Details and
the full table: `actions/OPTIMIZATION_REPORT.md`.

No cache was introduced, so there is no stale-cache-as-evidence path. No
`continue-on-error`, no advisory-ised required check, no weakened assertion.

## 6. Review status, read rather than assumed

| Reviewer | Status at the final SHA | Real reason, from its own output |
|---|---|---|
| **CodeRabbit** | `skipped` | *"manual review required for this OSS repository"* / *"fewer than 10 stars"* — a **policy threshold, not quota**. Two `@coderabbitai review` commands were honoured and produced 12 findings, all dispositioned. |
| Copilot | not reached | the fallback condition (CodeRabbit provably exhausted) never became true; Copilot's own status is a quota message, not a review |
| Kilo | `action_required` | *"out of credits"* — it never reviewed. **Not** cited as approval anywhere. |

## 7. Where the confidence actually stands

The honest summary:

- Delivery infrastructure was audited closely and **four real defects were found
  and fixed** there, all mutation-verified.
- The scoring and data-integrity core held under attack (106 papers, 6 708
  questions, SHA-256 106/106, exemptions, partial credit, persistence, backup
  injection) with no defect found.
- **Accessibility was the weakest area, and it was weakest precisely where the
  suite was not looking.** Three of the four last-pass findings are there. The
  pattern in all of them: a green check measuring less than its label claimed.
  That is now fixed for the views and rules named above — and it is reasonable to
  assume the same pattern exists somewhere this round did not look.
- The exam renderer was verified on all 24 openable records for the specific
  defect found; it was **not** verified cell-by-cell for every other rendering
  property.

So: materially better tested than it was, with the specific weaknesses this round
found closed and guarded — not proven correct.

## 8. Question for the maintainer

**Is this audit accepted as it stands** — the 21 mutation-verified fixes, the
narrowed claims in `CHECKLIST.md`, and the open items listed in §4 — or would you
like any of those open items (notably R9-B7b, R9-C8 and the screen-reader pass)
carried further before this review is considered closed?
