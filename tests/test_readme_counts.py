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


class DocumentationConsistencyTests(unittest.TestCase):
    """RC1 review round 2: the documents must agree with the data and each other.

    Four inconsistencies were found by reading the report against its sources: a
    Markdown table row broken by a literal pipe inside a cell, a byte count that was
    really a character count of an older build, an evidence tier that double-counted
    two papers, and a listening tally that disagreed with the ledger by one. Each
    check below is derived from the data, so a later edit cannot quietly reintroduce
    them.
    """

    DOCUMENTS = ("README.md", "CHANGELOG.md", "docs/RC1_AUDIT_REPORT.md",
                 "docs/EXAM_AUDIT_LEDGER.md", "AGENTS_LOG.md", "DESIGN_LOG.md")

    def test_markdown_tables_keep_one_column_count_per_table(self) -> None:
        for name in self.DOCUMENTS:
            header = None
            for number, line in enumerate((ROOT / name).read_text(encoding="utf-8").splitlines(), 1):
                if not line.startswith("|"):
                    header = None
                    continue
                cells = len(re.split(r"(?<!\\)\|", line)) - 2
                if header is None:
                    header = cells
                    continue
                self.assertEqual(cells, header,
                                 f"{name}:{number} has {cells} columns, the table header has {header}")

    def test_report_byte_count_matches_the_embedded_data(self) -> None:
        html = (ROOT / "index.html").read_text(encoding="utf-8")
        block = re.search(r'<script id="vocabulary-data" type="application/json">(.*?)</script>', html, re.S)
        self.assertIsNotNone(block)
        real_bytes = len(block.group(1).encode("utf-8"))
        real_chars = len(block.group(1))
        report = (ROOT / "docs" / "RC1_AUDIT_REPORT.md").read_text(encoding="utf-8")
        self.assertIn(f"{real_bytes:,} bytes", report, "the report must quote the real byte count")
        self.assertIn(f"{real_chars:,} characters", report, "and the character count it used to quote as bytes")

    def test_report_evidence_tiers_are_mutually_exclusive(self) -> None:
        ledger = (ROOT / "docs" / "EXAM_AUDIT_LEDGER.md").read_text(encoding="utf-8")
        counts = {
            tier: int(re.search(rf"\| `{tier}` \| `(\d+)`", ledger).group(1))
            for tier in ("partially-supported", "structure-metadata-only", "insufficient-source")
        }
        self.assertEqual(sum(counts.values()), 106)
        report = (ROOT / "docs" / "RC1_AUDIT_REPORT.md").read_text(encoding="utf-8")
        section = report.split("### C.2", 1)[1].split("### C.3", 1)[0]
        for tier, value in counts.items():
            self.assertIn(f"{value} `{tier}`" if False else str(value), section)
        self.assertNotIn("82 papers", section,
                         "the old tier description double-counted two papers already in insufficient-source")
        self.assertIn("all 106 papers", section,
                      "technical integrity is verified for every paper, not for a subset")

    def test_report_listening_tally_matches_the_ledger(self) -> None:
        ledger = (ROOT / "docs" / "EXAM_AUDIT_LEDGER.md").read_text(encoding="utf-8")
        silent = int(re.search(r"and `(\d+)` omit both audio and transcript", ledger).group(1))
        report = (ROOT / "docs" / "RC1_AUDIT_REPORT.md").read_text(encoding="utf-8")
        claimed = re.search(r"(\d+) papers have a listening section with \*\*no audio and no transcript\*\*", report)
        self.assertIsNotNone(claimed, "the report must state the silent-listening count")
        self.assertEqual(int(claimed.group(1)), silent,
                         "the report's listening tally disagrees with the ledger summary")

    def test_readme_current_deploy_hold_marker_matches_the_gate_file(self) -> None:
        hold = (ROOT / "DEPLOY_HOLD").read_text(encoding="utf-8").strip()
        readme = (ROOT / "README.md").read_text(encoding="utf-8")
        paragraph = next(line for line in readme.splitlines() if line.startswith("**Cổng deploy-hold"))
        current = re.search(r"Marker hiện nêu `([^`]+)`", paragraph)
        self.assertIsNotNone(current, "the deploy-hold paragraph must state the current marker in the present tense")
        self.assertEqual(current.group(1), hold,
                         "the present-tense marker must be the tag DEPLOY_HOLD actually names")
        self.assertIn(f"`{hold}`", paragraph)


if __name__ == "__main__":
    unittest.main()
