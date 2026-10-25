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

    def test_report_evidence_tiers_pair_each_count_with_its_own_label(self) -> None:
        """Each tier label must carry *its own* count, not merely appear somewhere.

        Review round 3: the previous assertion was a membership check (it was even
        written as ``f"... " if False else str(value)``), so a report that swapped
        ``61`` and ``24`` still passed. The pairs are now compared as a mapping,
        which fails on any swap, and the arithmetic total is pinned separately.
        """
        ledger = (ROOT / "docs" / "EXAM_AUDIT_LEDGER.md").read_text(encoding="utf-8")
        counts = {
            tier: int(re.search(rf"\| `{tier}` \| `(\d+)`", ledger).group(1))
            for tier in ("partially-supported", "structure-metadata-only", "insufficient-source")
        }
        self.assertEqual(sum(counts.values()), 106)
        report = (ROOT / "docs" / "RC1_AUDIT_REPORT.md").read_text(encoding="utf-8")
        section = report.split("### C.1", 1)[1].split("### C.2", 1)[0]
        line = next((line for line in section.splitlines() if "Tier distribution recomputed" in line), None)
        self.assertIsNotNone(line, "the report must recompute the tier distribution")
        pairs = re.findall(r"(\d+) `([a-z-]+)`", line)
        self.assertEqual(len(pairs), 3, f"expected three tier/count pairs on one line, got {pairs}")
        self.assertEqual({tier: int(value) for value, tier in pairs}, counts,
                         "each tier label must carry its own count (a swapped pair must fail here)")
        total = re.search(r"=\s*(\d+)\*\*", line)
        self.assertIsNotNone(total, "the recomputed distribution must state its total")
        self.assertEqual(int(total.group(1)), 106)
        self.assertEqual(sum(int(value) for value, _tier in pairs), 106,
                         "61 + 21 + 24 must still account for every paper exactly once")
        disclaimer = report.split("### C.2", 1)[1].split("### C.3", 1)[0]
        self.assertNotIn("82 papers", disclaimer,
                         "the old tier description double-counted two papers already in insufficient-source")
        self.assertIn("all 106 papers", disclaimer,
                      "technical integrity is verified for every paper, not for a subset")

    def test_report_listening_tally_matches_the_ledger(self) -> None:
        """The report's listening figures must come from the ledger's four categories.

        Review round 3: the §C.3 sentence had been corrected from 55 to 56 while the
        same sentence in §G (residual risk) still said 55, so the two sections
        disagreed with each other and with the ledger. Both are now checked, and the
        "no listening section" category is asserted separately so it cannot be folded
        into the silent-listening figure again.
        """
        ledger = (ROOT / "docs" / "EXAM_AUDIT_LEDGER.md").read_text(encoding="utf-8")
        figures = {}
        for key, pattern in (
            ("with_listening", r"Across `(\d+)` papers with listening sections"),
            ("full", r"`(\d+)` include full written transcripts"),
            ("truncated", r"`(\d+)` contain truncated/incomplete transcripts"),
            ("silent", r"and `(\d+)` omit both audio and transcript"),
            ("no_section", r"`(\d+)` papers contain no listening section"),
        ):
            found = re.search(pattern, ledger)
            self.assertIsNotNone(found, f"the ledger summary lost its claim: {pattern}")
            figures[key] = int(found.group(1))
        self.assertEqual(figures["with_listening"] + figures["no_section"], 106)
        self.assertEqual(figures["full"] + figures["truncated"] + figures["silent"], figures["with_listening"])

        report = (ROOT / "docs" / "RC1_AUDIT_REPORT.md").read_text(encoding="utf-8")
        claimed = re.search(r"(\d+) papers have a listening section with \*\*no audio and no transcript\*\*", report)
        self.assertIsNotNone(claimed, "the report must state the silent-listening count")
        self.assertEqual(int(claimed.group(1)), figures["silent"],
                         "the report's C.3 listening tally disagrees with the ledger summary")
        self.assertEqual(int(claimed.group(1)), 56)

        residual = report.split("## G. Residual risk", 1)[1]
        stated = re.search(
            r"(\d+) of the (\d+) papers that contain a listening section have neither audio nor a written transcript",
            residual)
        self.assertIsNotNone(stated, "residual risk must state the silent-listening count the same way")
        self.assertEqual(int(stated.group(1)), figures["silent"],
                         "the residual-risk section disagrees with the ledger (it said 55 before review round 3)")
        self.assertEqual(int(stated.group(2)), figures["with_listening"])
        truncated = re.search(r"a further (\d+) carry only a truncated transcript", residual)
        self.assertIsNotNone(truncated, "residual risk must keep the truncated category separate")
        self.assertEqual(int(truncated.group(1)), figures["truncated"])
        no_section = re.search(r"(\d+) papers have no listening section at all", residual)
        self.assertIsNotNone(no_section, "residual risk must keep the no-listening category separate")
        self.assertEqual(int(no_section.group(1)), figures["no_section"])

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
