"""Every test suite the readiness report counts must actually run in CI.

The v1.0.0 checklist reported `243/243` Python tests as PASS, counting
`scripts/exams/test_archive.py` — but that suite was never wired into a workflow
and needs `scripts/exams/requirements.txt` (PyMuPDF, BeautifulSoup, markdownify),
so a fresh checkout errors in two of its five tests. The claim was true only on a
machine where someone had already installed those packages by hand.

These tests make the claim auditable: the archive suite must be installed and run
by CI, and every `tests/*.test.js` file must be named by a workflow, so a new test
cannot be added without a workflow that runs it.
"""

import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CI = (ROOT / ".github" / "workflows" / "ci.yml").read_text(encoding="utf-8")
ARCHIVE_SUITE = "scripts/exams/test_archive.py"
REQUIREMENTS = "scripts/exams/requirements.txt"
CHECKLIST = ROOT / "audit" / "v100" / "FINAL_READINESS_CHECKLIST.md"


class CiGateCoverageTests(unittest.TestCase):
    def test_the_archive_conversion_suite_runs_in_ci_with_its_dependencies(self) -> None:
        self.assertIn(REQUIREMENTS, CI,
                      "CI must install scripts/exams/requirements.txt; without it two archive tests error out")
        self.assertIn(ARCHIVE_SUITE, CI,
                      "CI must run scripts/exams/test_archive.py, or the readiness count claims untested work")

    def test_every_node_test_file_is_named_by_a_workflow(self) -> None:
        files = sorted(path.name for path in (ROOT / "tests").glob("*.test.js"))
        self.assertGreater(len(files), 5)
        missing = [name for name in files if f"tests/{name}" not in CI]
        self.assertEqual([], missing, "these Node suites exist but no workflow runs them: " + ", ".join(missing))

    def test_the_readiness_checklist_and_the_workflows_describe_the_same_suites(self) -> None:
        text = CHECKLIST.read_text(encoding="utf-8")
        self.assertIn(ARCHIVE_SUITE, text, "the checklist claims the archive suite; CI must run it")
        # A hand-installed `.venv` is not a reproducible instruction.
        self.assertNotIn(".venv/bin/python scripts/exams/test_archive.py", text,
                         "the checklist must not require a local virtualenv the repository does not create")

    def test_the_python_total_in_the_report_matches_the_discovered_suite(self) -> None:
        """The stated total must be the number the repository actually has."""
        cases = len(re.findall(r"^\s*def test_", "".join(
            path.read_text(encoding="utf-8") for path in sorted((ROOT / "tests").glob("test_*.py"))), re.M))
        text = CHECKLIST.read_text(encoding="utf-8")
        row = next((line for line in text.splitlines()
                    if "test_archive.py" in line and "unit tests" in line), None)
        self.assertIsNotNone(row, "the checklist must keep a Python test-suite row")
        stated = int(re.search(r"`(\d+)` unit tests", row).group(1))
        # `discover` also collects tests defined by helpers that do not start with `def test_` in a
        # nested class body edge case, so allow a small tolerance but never a large drift.
        self.assertLessEqual(abs(stated - cases), 5,
                             f"checklist states {stated} unit tests; tests/ defines {cases}")


if __name__ == "__main__":
    unittest.main()
