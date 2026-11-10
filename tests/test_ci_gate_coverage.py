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


def discovered_cases() -> int:
    """How many tests `unittest discover -s tests` collects — the number the report claims."""
    loader = unittest.TestLoader()
    return loader.discover(str(ROOT / "tests"), pattern="test_*.py").countTestCases()


def node_test_commands() -> str:
    """Only the `node --test …` run blocks: a suite named in a comment or a path filter runs nothing."""
    lines = [line.split(" #", 1)[0] for line in CI.splitlines()]  # drop YAML comments first
    blocks = []
    for index, line in enumerate(lines):
        if "--test" not in line:
            continue
        block = [line]
        for follower in lines[index + 1:]:
            if follower.strip() and not follower.startswith((" ", "\t")):
                break
            block.append(follower)
        blocks.append("\n".join(block))
    return "\n".join(blocks)


class CiGateCoverageTests(unittest.TestCase):
    def test_the_archive_conversion_suite_runs_in_ci_with_its_dependencies(self) -> None:
        self.assertIn(REQUIREMENTS, CI,
                      "CI must install scripts/exams/requirements.txt; without it two archive tests error out")
        self.assertIn(ARCHIVE_SUITE, CI,
                      "CI must run scripts/exams/test_archive.py, or the readiness count claims untested work")

    def test_every_node_test_file_is_run_by_the_ci_workflow(self) -> None:
        files = sorted(path.name for path in (ROOT / "tests").glob("*.test.js"))
        self.assertGreater(len(files), 5)
        commands = node_test_commands()
        missing = [name for name in files if f"tests/{name}" not in commands]
        self.assertEqual([], missing,
                         "these Node suites exist but no `node --test` command runs them: "
                         + ", ".join(missing))

    def test_the_readiness_checklist_and_the_workflows_describe_the_same_suites(self) -> None:
        text = CHECKLIST.read_text(encoding="utf-8")
        self.assertIn(ARCHIVE_SUITE, text, "the checklist claims the archive suite; CI must run it")
        # A hand-installed `.venv` is not a reproducible instruction.
        self.assertNotIn(".venv/bin/python scripts/exams/test_archive.py", text,
                         "the checklist must not require a local virtualenv the repository does not create")

    def test_the_python_total_in_the_report_matches_the_discovered_suite(self) -> None:
        """The stated total must be the number `discover` actually runs — exactly, not approximately."""
        cases = discovered_cases()
        text = CHECKLIST.read_text(encoding="utf-8")
        row = next((line for line in text.splitlines()
                    if "test_archive.py" in line and "unit tests" in line), None)
        self.assertIsNotNone(row, "the checklist must keep a Python test-suite row")
        match = re.search(r"`(\d+)` unit tests", row)
        self.assertIsNotNone(match, "the checklist row must state `N` unit tests")
        stated = int(match.group(1))
        self.assertEqual(cases, stated,
                         f"checklist states {stated} unit tests; discover collects {cases}")


if __name__ == "__main__":
    unittest.main()
