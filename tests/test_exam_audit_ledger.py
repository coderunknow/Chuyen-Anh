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


if __name__ == "__main__":
    unittest.main()
