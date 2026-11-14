# Round 7 — failure ledger

> **Reconstructed document.** Identifiers `H9`–`H16` are preserved because the
> continuation report and PR replies cite them. Entries were re-derived from the
> committed code and re-executed measurements; anything that could not be
> re-derived is marked **lost** rather than restated.

Each entry records a way the code, or this process, produced a wrong answer —
including the ways **this audit itself** was wrong, because those are the ones a
later reader is most likely to repeat.

## H9 — A test that enforced the bug it was written to catch

`r7-chip-state.mjs` asserted `aria-disabled="true"` on an operable chip. That
attribute is what makes assistive technology announce "unavailable" for a control
the user can actually operate. The probe passed for as long as the bug existed.

The attribute had been added while fixing D60, whose real remedy was a CSS
contrast change. The probe encoded the implementation, not the requirement.

**Rule:** when a finding contradicts an earlier fix, re-read *why* the earlier
change was made before "restoring" it.

## H10 — Searching for a bare word matches your own explanatory comments

A check for `aria-disabled` counted matches inside the comment that explained why
the attribute had been removed. Assert on the attribute form (`\baria-disabled=`)
and on a scope that excludes comments.

## H11 — A self-consistent stale bullet satisfies a sum check

A documented total of 244 was checked against the sum of the rows *in the same
document*, which also said 244. Self-consistency is not truth. The only reliable
check recomputes each row from the files that define it — which is what
`tests/test_ci_gate_coverage.py` now does, and what caught the stale `59` when
`exam-scoring` gained its 60th test.

## H12 — The exam-history fast path skipped verification entirely

Adding a read-back to the merge path left the **common** path unprotected: the
fast path returns before the merge. A race test found it. The lesson is not "add
a check", it is "prove the repair test fails without the fix" — a repair test that
passes on the broken code has proved nothing.

This bit twice more in this round:
- the first version of the identity test substituted an ISO **string** for
  `submittedAt`, which the schema stores as a number, so the history was invalid
  and the repair never met a valid impostor. It passed with the fix removed.
- the paper-snapshot test was written to assert on a mutated prompt precisely
  because a validity-breaking mutation would have made it vacuous the same way.

## H13 — `toast('literal'` probing has a blind spot

Ternary-selected messages are invisible to a scan for literal arguments. The
usable method walks balanced `toast(...)` argument lists.

## H14 — A broad "looks Vietnamese" scan is not a gate

156 hits, nearly all of them legitimate bilingual content. Scoping to toast
arguments is what made the check meaningful (66 literals, 0 untranslated).

## H15 — Playwright file-chooser leak

A file chooser left open keeps focus indeterminate. Dismiss with `Escape`, assert
`document.activeElement.id`, retry once.

## H16 — Evidence that was never committed

**The most consequential process failure of the round.** The whole
`audit-evidence/round7/` tree lived only in the working tree. `git log --all --
audit-evidence/` returns nothing, `git ls-files audit-evidence/` returns nothing.
A sandbox reset restored the checkout to the base commit and preserved the
uncommitted work — but the evidence directory did not survive.

Everything that could be re-executed has been, at the final SHA, and is recorded
in `logs/final-sha-verification.log`. Interactive probes that cannot be
re-executed are marked reconstructed. The repository convention
(`audit/rc10/`) commits exactly this kind of markdown evidence and ignores only
heavy derived artifacts, so there was never a reason to leave it untracked.

**Rule:** evidence that is not in a commit does not exist. Commit it in the same
chunk as the measurement.
