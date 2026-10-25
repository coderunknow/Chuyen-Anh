import hashlib
import json
from pathlib import Path
import re
import unittest

ROOT = Path(__file__).resolve().parents[1]
SELECTION_PATH = ROOT / "scripts" / "exams" / "selection.json"
LEDGER_PATH = ROOT / "docs" / "EXAM_AUDIT_LEDGER.md"
VOCAB_MD_PATH = ROOT / "Learned_Vocabulary_List.md"

VALID_TIERS = {
    "official-verified",
    "non-official-source-compared",
    "structure-metadata-only",
    "partially-supported",
    "insufficient-source",
}


class ExamAuditLedgerTests(unittest.TestCase):
    def test_ledger_exists_and_audits_all_106_records_honestly(self) -> None:
        self.assertTrue(LEDGER_PATH.is_file(), f"Missing 106-exam audit ledger: {LEDGER_PATH}")
        selection = json.loads(SELECTION_PATH.read_text(encoding="utf-8"))
        self.assertEqual(len(selection), 106)

        text = LEDGER_PATH.read_text(encoding="utf-8")
        # Extract markdown table rows for individual exam records `| 001 | \`2022/an-giang/so\` | ...`
        row_re = re.compile(
            r"^\|\s*(\d{3})\s*\|\s*`([0-9]{4}/[a-z0-9-]+/[a-z0-9-]+)`\s*\|(.+)\|\s*$",
            re.MULTILINE,
        )
        matches = list(row_re.finditer(text))
        self.assertEqual(len(matches), 106, f"Expected 106 per-paper ledger rows, got {len(matches)}")

        seen_keys = []
        for expected_idx, (match, paper) in enumerate(zip(matches, selection), start=1):
            idx_num = int(match.group(1))
            key = match.group(2)
            rest_cols = [col.strip() for col in match.group(3).split("|")]
            self.assertEqual(idx_num, expected_idx)
            self.assertEqual(key, paper["key"])
            seen_keys.append(key)

            # Verify evidence tier column uses an exact allowed tier and never claims official-verified
            tier_hits = [tier for tier in VALID_TIERS if f"`{tier}`" in match.group(0)]
            self.assertEqual(len(tier_hits), 1, f"Row {key} must carry exactly one explicit evidence tier: {rest_cols}")
            tier = tier_hits[0]
            self.assertNotEqual(
                tier,
                "official-verified",
                f"Row {key} must not claim official-verified without a primary official source",
            )
            if paper["quality"] == "HTML/OCR-cần-soát":
                self.assertEqual(tier, "insufficient-source", f"Unreviewed OCR paper {key} must be insufficient-source")

            # Verify contentSha256 prefix is accurately cited in the row
            md_path = ROOT / "De-chuyen-Anh-vao-10" / f"{key}.md"
            raw = md_path.read_text(encoding="utf-8")
            body = raw.split("\n---\n", 1)[1] if "\n---\n" in raw else raw
            # embed_archive strips leading blank lines in body the exact same way index.html stores markdown;
            # verify the asset sha256 prefix from selection.json is cited accurately.
            asset_sha_prefix = paper["assets"][0]["sha256"][:12]
            self.assertIn(asset_sha_prefix, match.group(0), f"Row {key} must cite real asset sha256 prefix {asset_sha_prefix}")

        self.assertEqual(len(set(seen_keys)), 106)

    def test_learned_vocabulary_list_has_no_personal_progress_state(self) -> None:
        header = VOCAB_MD_PATH.read_text(encoding="utf-8").splitlines()[:20]
        joined = "\n".join(header)
        for forbidden in ("lastReviewed", "nextReview", "correctCount", "wrongCount", "streak", "interval", "ease"):
            self.assertNotIn(forbidden, joined)


def ledger_rows(text: str):
    """Return the 106 per-paper table rows as (key, cells) pairs."""
    rows = []
    for line in text.splitlines():
        match = re.match(r"^\|\s*(\d{3})\s*\|\s*`([0-9]{4}/[a-z0-9-]+/[a-z0-9-]+)`\s*\|", line)
        if match:
            rows.append((match.group(2), [cell.strip() for cell in line.strip().strip("|").split("|")]))
    return rows


class ExamAuditLedgerConsistencyTests(unittest.TestCase):
    """RC1: the ledger's prose must agree with its own per-paper table.

    The per-paper rows are pinned by ExamAuditLedgerTests above; these tests keep
    the summary paragraphs from drifting away from them (and from the archive it
    describes). They are regression tests for three defects found in RC1:
    three unrendered ``{len(...)}`` template placeholders, an ``insufficient-source``
    description that named the wrong second digital paper and asserted Private-Use
    glyphs that the file does not contain.
    """

    @classmethod
    def setUpClass(cls) -> None:
        cls.text = LEDGER_PATH.read_text(encoding="utf-8")
        cls.rows = ledger_rows(cls.text)
        cls.selection = json.loads(SELECTION_PATH.read_text(encoding="utf-8"))

    def test_no_unrendered_template_placeholders(self) -> None:
        # A generator bug once committed the literal text "{len(listen_missing)}".
        placeholders = re.findall(r"\{(?:len\([^)]*\)|[a-z_]+)\}", self.text)
        self.assertEqual(placeholders, [], f"unrendered placeholders in the ledger: {placeholders}")

    def test_insufficient_source_description_names_the_rows_that_carry_the_tier(self) -> None:
        digital = [
            key for key, cells in self.rows
            if "`insufficient-source`" in cells
            and next(paper["quality"] for paper in self.selection if paper["key"] == key) != "HTML/OCR-cần-soát"
        ]
        self.assertEqual(sorted(digital), ["2022/ha-noi/so", "2025/thai-nguyen/so"])
        tier_sentence = next(
            line for line in self.text.splitlines()
            if line.startswith("| `insufficient-source`")
        )
        for key in digital:
            self.assertIn(f"`{key}`", tier_sentence, f"{key} carries the tier but is not named in its definition")
        # The file must not be described as containing glyphs it does not contain.
        binh_thuan = ROOT / "De-chuyen-Anh-vao-10" / "2023" / "binh-thuan" / "so.md"
        has_pua = bool(re.search(r"[\ue000-\uf8ff]", binh_thuan.read_text(encoding="utf-8")))
        self.assertFalse(has_pua, "the fixture assumption changed: 2023/binh-thuan/so now has PUA glyphs")
        self.assertNotIn("2023/binh-thuan/so` with `18`", tier_sentence)

    def test_listening_summary_matches_the_per_paper_columns(self) -> None:
        def listening_cell(cells):
            return next((cell for cell in cells if "istening" in cell), "")

        cells = [listening_cell(row) for _, row in self.rows]
        with_listening = sum(1 for cell in cells if cell.startswith("Listening section present") or "listening transcript incomplete" in cell)
        without_listening = sum(1 for cell in cells if cell.startswith("No listening section"))
        full = sum(1 for cell in cells if "full written transcript included" in cell)
        incomplete = sum(1 for cell in cells if "transcript incomplete" in cell)
        missing = sum(1 for cell in cells if cell.startswith("Listening section present") and "no transcript" in cell)
        speaking = sum(1 for cell in cells if "speaking guide asset" in cell)

        self.assertEqual(with_listening + without_listening, 106)
        self.assertEqual(full + incomplete + missing, with_listening)
        for pattern, value in (
            (r"Across `(\d+)` papers with listening sections", with_listening),
            (r"`(\d+)` include full written transcripts", full),
            (r"`(\d+)` contain truncated/incomplete transcripts", incomplete),
            (r"and `(\d+)` omit both audio and transcript", missing),
            (r"`(\d+)` papers contain no listening section", without_listening),
            (r"`(\d+)` papers include speaking prompt/marking guide assets", speaking),
        ):
            found = re.search(pattern, self.text)
            self.assertIsNotNone(found, f"missing claim: {pattern}")
            self.assertEqual(int(found.group(1)), value, f"claim does not match the per-paper rows: {pattern}")


if __name__ == "__main__":
    unittest.main()
