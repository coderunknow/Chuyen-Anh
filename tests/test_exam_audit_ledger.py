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


def ledger_columns(text: str) -> dict:
    """Map each per-paper table header to its cell index.

    Review round 3: a test read the first cell containing "listening" and could
    therefore read the completeness description instead of the listening column.
    The mapping is derived from the header row so a renamed, reordered or removed
    column fails loudly instead of silently changing what is measured.
    """
    header = next(
        (line for line in text.splitlines() if line.startswith("| # |")),
        None,
    )
    if header is None:
        raise AssertionError("the per-paper ledger table header is missing")
    names = [cell.strip() for cell in header.strip().strip("|").split("|")]
    columns = {name: index for index, name in enumerate(names)}
    for required in ("ID", "Completeness vs Source", "Listening & Auxiliary Materials", "Evidence Tier"):
        if required not in columns:
            raise AssertionError(
                f"the per-paper ledger table lost its {required!r} column; headers are {names}"
            )
    return columns


def listening_counts(rows, columns) -> dict:
    """Tally the listening categories from the Listening column only.

    ``rows`` is a sequence of ``(key, cells)`` pairs as returned by
    :func:`ledger_rows`; ``columns`` is the header mapping from
    :func:`ledger_columns`.
    """
    column = columns["Listening & Auxiliary Materials"]
    counts = {"with_listening": 0, "without_listening": 0, "full": 0, "incomplete": 0,
              "missing": 0, "speaking": 0}
    for _key, cells in rows:
        cell = cells[column]
        if cell.startswith("No listening section"):
            counts["without_listening"] += 1
            continue
        if not cell.startswith("Listening section present"):
            raise AssertionError(f"unrecognised listening cell: {cell!r}")
        counts["with_listening"] += 1
        if "partial/truncated written transcript" in cell:
            counts["incomplete"] += 1
        elif "full written transcript included" in cell:
            counts["full"] += 1
        elif "no transcript in source" in cell:
            counts["missing"] += 1
        else:
            raise AssertionError(f"listening cell states neither a transcript nor its absence: {cell!r}")
        if "speaking guide asset" in cell:
            counts["speaking"] += 1
    return counts


class ExamAuditLedgerConsistencyTests(unittest.TestCase):
    """RC1: the ledger's prose must agree with its own per-paper table.

    The per-paper rows are pinned by ExamAuditLedgerTests above; these tests keep
    the summary paragraphs from drifting away from them (and from the archive it
    describes). They are regression tests for defects found in RC1 (three
    unrendered ``{len(...)}`` template placeholders, an ``insufficient-source``
    description that named the wrong second digital paper) and in review round 3
    (a listening count read from the wrong column).
    """

    REQUIRED_COLUMNS = (
        "Completeness vs Source",
        "Listening & Auxiliary Materials",
        "Evidence Tier",
    )

    @classmethod
    def setUpClass(cls) -> None:
        cls.text = LEDGER_PATH.read_text(encoding="utf-8")
        cls.columns = ledger_columns(cls.text)
        cls.rows = ledger_rows(cls.text)
        cls.selection = json.loads(SELECTION_PATH.read_text(encoding="utf-8"))

    def test_no_unrendered_template_placeholders(self) -> None:
        # A generator bug once committed the literal text "{len(listen_missing)}".
        placeholders = re.findall(r"\{(?:len\([^)]*\)|[a-z_]+)\}", self.text)
        self.assertEqual(placeholders, [], f"unrendered placeholders in the ledger: {placeholders}")

    def test_insufficient_source_description_names_the_rows_that_carry_the_tier(self) -> None:
        tier_column = self.columns["Evidence Tier"]
        digital = [
            key for key, cells in self.rows
            if cells[tier_column] == "`insufficient-source`"
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

    def test_listening_summary_matches_the_listening_column(self) -> None:
        """Every listening claim is derived from the Listening column only.

        Review round 3: the previous helper returned the *first* cell containing
        "listening", and eight rows mention listening in the completeness column
        ("… listening transcript incomplete"), so those rows were read from the
        wrong place. The column is now selected by header name.
        """
        counts = listening_counts(self.rows, self.columns)
        self.assertEqual(counts["with_listening"] + counts["without_listening"], 106)
        self.assertEqual(
            counts["full"] + counts["incomplete"] + counts["missing"], counts["with_listening"]
        )
        for pattern, value in (
            (r"Across `(\d+)` papers with listening sections", counts["with_listening"]),
            (r"`(\d+)` include full written transcripts", counts["full"]),
            (r"`(\d+)` contain truncated/incomplete transcripts", counts["incomplete"]),
            (r"and `(\d+)` omit both audio and transcript", counts["missing"]),
            (r"`(\d+)` papers contain no listening section", counts["without_listening"]),
            (r"`(\d+)` papers include speaking prompt/marking guide assets", counts["speaking"]),
        ):
            found = re.search(pattern, self.text)
            self.assertIsNotNone(found, f"missing claim: {pattern}")
            self.assertEqual(int(found.group(1)), value, f"claim does not match the per-paper rows: {pattern}")
        # The categories that must stay distinct, pinned to the evidence that decides them.
        self.assertEqual(counts["missing"], 56)
        self.assertEqual(counts["without_listening"], 23)

    def test_a_changed_listening_cell_changes_the_count_even_when_completeness_does_not(self) -> None:
        """The counts must come from the Listening column, not from a nearby cell.

        This is the fail-first guard for review round 3: it rewrites the listening
        cell of a row whose completeness cell also mentions listening and asserts
        that the tally follows the listening cell — and that rewriting the
        completeness cell alone changes nothing.
        """
        target = "2023/dak-lak/so"
        rows = [(key, list(cells)) for key, cells in self.rows]
        index = next(i for i, (key, _cells) in enumerate(rows) if key == target)
        cells = rows[index][1]
        listening_column = self.columns["Listening & Auxiliary Materials"]
        completeness_column = self.columns["Completeness vs Source"]
        self.assertIn("listening", cells[completeness_column].lower(),
                      f"{target} is the fixture that makes the wrong-column read possible")

        baseline = listening_counts([(key, list(c)) for key, c in self.rows], self.columns)

        # Rewriting only the completeness cell must not move any listening count.
        completeness_only = [(key, list(cells)) for key, cells in self.rows]
        completeness_only[index][1][completeness_column] = "Full extracted text (1 source asset)"
        self.assertEqual(
            listening_counts([(key, list(c)) for key, c in completeness_only], self.columns), baseline,
            "the listening tally must not be influenced by the completeness column",
        )

        # Rewriting only the listening cell must move the matching count.
        listening_only = [(key, list(cells)) for key, cells in self.rows]
        listening_only[index][1][listening_column] = "No listening section in paper (`0` audio assets)"
        moved = listening_counts([(key, list(c)) for key, c in listening_only], self.columns)
        self.assertEqual(moved["without_listening"], baseline["without_listening"] + 1)
        self.assertEqual(moved["incomplete"], baseline["incomplete"] - 1)
        self.assertNotEqual(listening_counts([(key, list(c)) for key, c in listening_only], self.columns),
                            baseline, "changing the listening cell must change the tally")


if __name__ == "__main__":
    unittest.main()
