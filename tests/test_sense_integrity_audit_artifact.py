"""The committed sense-integrity queue must equal what the shipped auditor produces.

`audit/v100/evidence/sense-integrity-review-queue.json` is release evidence: it
records which entries still need a human to look at a sense-to-gloss mapping. It
had drifted from the data it claims to describe — entry `8393` (`bloom`) was
queued with the gloss `nở hoa` while the shipped row said `hoa, sự nở hoa` — and
nothing could notice, because `scripts/sense_integrity_audit.py` had no `--check`
mode and no workflow ever ran it. `tests/test_sense_integrity_audit.py` tests the
auditor's helpers, never the artifact.

These tests regenerate the queue from `data/vocabulary.json` and require the
committed file to match it exactly, require the new `--check` mode to exist, and
require CI and the deploy workflow to actually run it, so a future gloss or CEFR
edit cannot drift the evidence again.
"""

import json
import subprocess
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARTIFACT = ROOT / "audit" / "v100" / "evidence" / "sense-integrity-review-queue.json"
SCRIPT = ROOT / "scripts" / "sense_integrity_audit.py"
WORKFLOWS = (ROOT / ".github" / "workflows" / "ci.yml",
             ROOT / ".github" / "workflows" / "deploy.yml")


def run_audit(*args: str) -> subprocess.CompletedProcess:
    return subprocess.run([sys.executable, str(SCRIPT), *args],
                          cwd=ROOT, capture_output=True, text=True, check=False)


def describe_drift(committed: dict, fresh: dict) -> str:
    """Name the entries that differ, so a failure is actionable."""
    old = {row["id"]: row for row in committed.get("entries", [])}
    new = {row["id"]: row for row in fresh.get("entries", [])}
    lines = []
    for entry_id in sorted(set(old) | set(new)):
        if old.get(entry_id) != new.get(entry_id):
            was, now = old.get(entry_id), new.get(entry_id)
            word = (was or now or {}).get("word")
            lines.append(f"{entry_id} {word}: committed={json.dumps(was, ensure_ascii=False)[:160]} "
                         f"regenerated={json.dumps(now, ensure_ascii=False)[:160]}")
    old_counts, new_counts = committed.get("issueCounts"), fresh.get("issueCounts")
    if old_counts != new_counts:
        lines.append(f"issueCounts: committed={old_counts} regenerated={new_counts}")
    return "\n  ".join(lines)


class SenseIntegrityArtifactTests(unittest.TestCase):
    def test_committed_queue_matches_a_fresh_regeneration(self) -> None:
        result = run_audit()
        self.assertEqual(0, result.returncode, f"the auditor failed: {result.stderr[-800:]}")
        fresh = json.loads(result.stdout)
        committed = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        self.assertEqual(fresh, committed,
                         "the committed review queue is stale; regenerate it with "
                         "`python scripts/sense_integrity_audit.py > "
                         "audit/v100/evidence/sense-integrity-review-queue.json`:\n  "
                         + describe_drift(committed, fresh))

    def test_check_mode_succeeds_on_the_committed_artifact(self) -> None:
        result = run_audit("--check")
        self.assertEqual(0, result.returncode,
                         f"--check must exit 0 for a current artifact:\n{result.stdout[-800:]}{result.stderr[-800:]}")

    def test_check_mode_fails_when_the_artifact_drifts(self) -> None:
        """A checker that cannot fail is not a gate."""
        import tempfile
        original = ARTIFACT.read_text(encoding="utf-8")
        drifted = json.loads(original)
        drifted["entriesFlagged"] = drifted["entriesFlagged"] + 1
        with tempfile.TemporaryDirectory() as tmp:
            copy = Path(tmp) / "queue.json"
            copy.write_text(json.dumps(drifted, ensure_ascii=False), encoding="utf-8")
            result = run_audit("--check", "--artifact", str(copy))
        self.assertNotEqual(0, result.returncode, "a stale artifact must fail the gate")
        self.assertIn("stale", (result.stdout + result.stderr).lower())

    def test_ci_and_deploy_workflows_run_the_check(self) -> None:
        for path in WORKFLOWS:
            text = path.read_text(encoding="utf-8")
            self.assertIn("scripts/sense_integrity_audit.py --check", text,
                          f"{path.name} must run the sense-integrity gate; evidence that no "
                          f"workflow checks it is how the committed queue drifted")
    def test_check_mode_rejects_a_reshaped_artifact(self) -> None:
        """`--check` compared a projection, so scope, duplicates and order slipped through."""
        import copy
        import tempfile
        original = json.loads(ARTIFACT.read_text(encoding="utf-8"))
        mutants = {
            "scope claim": lambda d: d.update(scope="Every entry is independently verified"),
            "duplicate entry": lambda d: d["entries"].append(copy.deepcopy(d["entries"][0])),
            "reordered entries": lambda d: d.__setitem__("entries", list(reversed(d["entries"]))),
            "unknown field": lambda d: d.update(unexpected="x"),
        }
        for name, mutate in mutants.items():
            payload = copy.deepcopy(original)
            mutate(payload)
            with tempfile.TemporaryDirectory() as tmp:
                copy_path = Path(tmp) / "queue.json"
                copy_path.write_text(json.dumps(payload, ensure_ascii=False), encoding="utf-8")
                result = run_audit("--check", "--artifact", str(copy_path))
            self.assertNotEqual(0, result.returncode,
                                f"an artifact with a changed {name} must fail the gate")


if __name__ == "__main__":
    unittest.main()
