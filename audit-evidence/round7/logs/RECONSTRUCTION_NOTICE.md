# Reconstruction notice — round 7 evidence

The `audit-evidence/round7/` tree was produced in the working tree across rounds
and **was never committed**. A sandbox reset restored the checkout to the base
commit (`0026267`) while the working tree kept the later work; the evidence
directory did not survive the round trip. Verified on 2026-11-11:
`git log --all -- audit-evidence/` returned no commits, `git ls-files
audit-evidence/` returned no files, and the directory was absent from disk.

Per the standing rule, missing evidence is **reconstructed and labelled**, never
invented. What that means for each artefact:

- **Re-runnable now (real, not reconstructed):** every measurement whose command
  still exists in the repository — test suites, gate checks, browser suites,
  byte counts, greps. These were re-executed at the final SHA and their output is
  recorded verbatim in `logs/final-sha-verification.log`.
- **Not re-derivable (marked as lost):** the interactive probe scripts under
  `scripts/` were hand-written harnesses; the originals are gone. Any file here
  that says *reconstructed* is a rewrite against the same method, not the
  original artifact, and it is labelled as such in its own header.
- **Never existed as evidence (unaffected):** the screen-reader criterion, which
  was always incomplete and stays incomplete (see `accessibility/`).

The code fixes those rounds produced are unaffected: they are committed and
verified independently of this directory.
