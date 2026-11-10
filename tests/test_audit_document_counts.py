"""Every document must state the same default-selection deck count as the data.

`DEFECTS.md` D6 recorded the re-pinned totals as "3,032 default B2+C1 eligible"
while `GATES.md` S9, `FINAL_READINESS.md` and `README.md` all said `3,020`
headwords / `3,043` senses, and the shipped data agrees with `3,020`. A stale pin
inside the defect ledger is the failure O6 itself describes — a number that no
longer matches what the suite measures.

The count is recomputed here from `data/vocabulary.json` with the same rule the
app uses (headwords, not family rows, not curated-archived, at least one sense in
`B2`/`C1`), cross-checked by the JavaScript suites that pin `3,020` / `3,043`.
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SELECTION = {"B2", "C1"}


def is_archived(tags) -> bool:
    """The app hides a row only when its tags contain the exact `curation:archived` tag."""
    return "curation:archived" in (tags or [])


def normalized(number: str) -> int:
    return int(number.replace(",", "").replace(".", ""))


def measured():
    rows = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
    headwords = [row for row in rows if not row.get("familyHead")]
    active = [row for row in headwords if not is_archived(row.get("tags"))]
    eligible = [row for row in active
                if {sense.get("cefr") for sense in row.get("senses") or []} & SELECTION]
    senses = sum(len([sense for sense in row.get("senses") or [] if sense.get("cefr") in SELECTION])
                 for row in eligible)
    return len(headwords), len(active), len(eligible), senses


# Each pattern states where a document claims the default-selection size. A
# missing claim fails too: the report is supposed to say how big the deck is.
CLAIMS = {
    "audit/v100/DEFECTS.md": r"([\d,]+) default B2\+C1 eligible",
    "audit/v100/GATES.md": r"active focus deck = \*\*`([\d,]+)` headwords \(`([\d,]+)` senses\)\*\*",
    "audit/v100/FINAL_READINESS.md": r"default `B2\+C1` focus selection: `([\d,]+)` headwords / `([\d,]+)` senses",
    "README.md": r"mặc định chọn B2\+C1 \(([\d.]+) từ trọng tâm / ([\d.]+) nghĩa\)",
}


class AuditDocumentCountTests(unittest.TestCase):
    def setUp(self) -> None:
        self.headwords, self.active, self.eligible, self.senses = measured()

    def test_the_measured_deck_matches_the_javascript_pins(self) -> None:
        # tests/static-app.test.js and tests/v100-senses.test.js pin these values.
        self.assertEqual(self.headwords, 8112)
        self.assertEqual(self.active, 6841)
        self.assertEqual(self.eligible, 3020)
        self.assertEqual(self.senses, 3043)

    def test_every_document_states_the_measured_default_selection(self) -> None:
        problems = []
        for name, pattern in CLAIMS.items():
            text = (ROOT / name).read_text(encoding="utf-8")
            found = re.findall(pattern, text)
            if not found:
                problems.append(f"{name}: no default-selection claim matches {pattern!r}")
                continue
            for match in found:
                numbers = match if isinstance(match, tuple) else (match,)
                stated_headwords = normalized(numbers[0])
                if stated_headwords != self.eligible:
                    problems.append(f"{name}: states {stated_headwords} headwords, "
                                    f"the data has {self.eligible}")
                if len(numbers) > 1 and normalized(numbers[1]) != self.senses:
                    problems.append(f"{name}: states {normalized(numbers[1])} senses, "
                                    f"the data has {self.senses}")
        self.assertEqual([], problems, "stale default-selection counts:\n  " + "\n  ".join(problems))

    def test_the_changelog_totals_agree_with_the_checklist_and_their_own_parts(self) -> None:
        """The unreleased section quoted `237 OK` / `214 pass` long after the suite had grown."""
        text = (ROOT / "CHANGELOG.md").read_text(encoding="utf-8")
        current = text.split("\n## v1.0.0-rc10", 1)[0]
        checklist = (ROOT / "audit" / "v100" / "FINAL_READINESS_CHECKLIST.md").read_text(encoding="utf-8")
        row = next((line for line in checklist.splitlines()
                    if "test_archive.py" in line and "unit tests" in line), None)
        self.assertIsNotNone(row, "the checklist must keep a Python test-suite row")
        expected_python = int(re.search(r"`(\d+)` unit tests", row).group(1))
        stated_python = re.search(r"`unittest` \*\*(\d+) OK\*\*", current)
        self.assertIsNotNone(stated_python, "the current section must state the Python total")
        self.assertEqual(expected_python, int(stated_python.group(1)),
                         "the changelog states a Python total the checklist does not")
        node_line = next((line for line in current.splitlines()
                          if "pass / 0 fail" in line and "Node" in line), None)
        self.assertIsNotNone(node_line, "the current section must state the Node total")
        stated_node = int(re.search(r"\*\*(\d+) pass / 0 fail\*\*", node_line).group(1))
        parts = [int(number.replace(",", "")) for number in re.findall(r"`([\d,]+)`", node_line)]
        self.assertGreater(len(parts), 5, "the changelog must list each Node suite's count")
        self.assertEqual(sum(parts), stated_node,
                         f"the changelog's per-suite numbers sum to {sum(parts)}, it claims {stated_node}")


if __name__ == "__main__":
    unittest.main()
