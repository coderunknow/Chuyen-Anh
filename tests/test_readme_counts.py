"""RC1: counts stated in user-facing documentation must match the data.

`README.md` opens with the size of the shipped data set. That sentence had drifted
to an older build ("5.205 từ gốc", "647 dạng cùng gốc") while the data it
describes held 5.112 headwords and 740 same-root forms, and while the same file
later stated the correct numbers. These tests recompute the counts from the data
and the hand-reviewed root map instead of trusting any document.
"""

import json
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
README_PATH = ROOT / "README.md"
VOCABULARY_PATH = ROOT / "data" / "vocabulary.json"
FAMILIES_PATH = ROOT / "docs" / "vocabulary-families.json"
PHRASES_PATH = ROOT / "data" / "phrases.json"


def grouped(value: int) -> list:
    """Both written forms of an integer count (vi-VN groups, en-US groups)."""
    text = str(value)
    return [text] if len(text) <= 3 else [f"{value:,}", f"{value:,}".replace(",", ".")]


class ReadmeCountTests(unittest.TestCase):
    def setUp(self) -> None:
        self.vocabulary = json.loads(VOCABULARY_PATH.read_text(encoding="utf-8"))
        self.families = json.loads(FAMILIES_PATH.read_text(encoding="utf-8"))
        self.phrases = json.loads(PHRASES_PATH.read_text(encoding="utf-8"))
        self.readme = README_PATH.read_text(encoding="utf-8")

    def test_data_counts_are_internally_consistent(self) -> None:
        headwords = [row for row in self.vocabulary if not row.get("familyHead")]
        merged = [row for row in self.vocabulary if row.get("familyHead")]
        self.assertEqual(len(self.vocabulary), len(headwords) + len(merged))
        self.assertEqual(len(headwords), self.families["counts"]["activeHeadwords"])
        self.assertEqual(len(merged), self.families["counts"]["mergedRows"])
        self.assertEqual(len(self.vocabulary), self.families["counts"]["rowsInTable"])
        self.assertEqual(len(self.families["families"]), self.families["counts"]["families"])
        covered = {member["id"] for family in self.families["families"] for member in family["members"]}
        self.assertEqual(covered, {row["id"] for row in merged}, "every merged row belongs to exactly one family")

    def test_readme_opening_sentence_states_the_current_counts(self) -> None:
        opening = self.readme.splitlines()[2]
        headwords = self.families["counts"]["activeHeadwords"]
        merged = self.families["counts"]["mergedRows"]
        rows = self.families["counts"]["rowsInTable"]
        self.assertTrue(
            any(f"{form} từ gốc" in opening for form in grouped(headwords)),
            f"README must state {headwords} headwords; it says: {opening[:160]}",
        )
        self.assertTrue(
            any(f"{form} dạng cùng gốc" in opening for form in grouped(merged)),
            f"README must state {merged} same-root forms; it says: {opening[:160]}",
        )
        self.assertTrue(
            any(f"{form} hàng" in opening for form in grouped(rows)),
            f"README must state {rows} rows; it says: {opening[:160]}",
        )

    def test_no_stale_headword_count_survives_anywhere_in_the_readme(self) -> None:
        headwords = self.families["counts"]["activeHeadwords"]
        merged = self.families["counts"]["mergedRows"]
        # Stated counts must be one of the two accepted groupings of the real value.
        # A stated target ("≥5.000 từ gốc") is a goal, not a claim about the data.
        allowed = set(grouped(headwords))
        for match in re.finditer(r"(\d[\d.,]*)\s*từ gốc", self.readme):
            value = match.group(1)
            prefix = self.readme[max(0, match.start() - 2):match.start()]
            if "≥" in prefix:
                continue
            self.assertIn(value, allowed, f"stale headword count '{value} từ gốc' in README")
        allowed_forms = set(grouped(merged))
        for match in re.finditer(r"(\d[\d.,]*)\s*dạng cùng gốc", self.readme):
            self.assertIn(match.group(1), allowed_forms, f"stale same-root count in README: {match.group(0)}")

    def test_phrase_total_is_reported_separately_and_correctly(self) -> None:
        count = len(self.phrases)
        self.assertTrue(
            any(f"{form} cụm từ" in self.readme for form in grouped(count)),
            f"README must state {count} phrases",
        )
        # The phrase bank is a separate store: it is never added to the word count.
        self.assertNotIn(f"{count + 5112:,} ", self.readme)


if __name__ == "__main__":
    unittest.main()
