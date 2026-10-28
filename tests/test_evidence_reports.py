"""The evidence artifacts must be current, and their claims must be checkable.

Two reports were added in rc3:

* `docs/exam-provenance-audit.*` — what the archive can prove about its own
  sources, including a recomputed content hash per transcription and the answer
  claims that the stored body does not support;
* `docs/vocabulary-evidence-review.*` — the causes behind the review queue
  (923 focus headwords without a corpus source), each with a locator when one
  exists.

The tests here recompute both from the repository, require the committed files to
match, and then open the locators the review cites. A report that says "this
word appears in that line" is only worth something if the line says so.
"""
from __future__ import annotations

import json
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from audit_exam_provenance import (  # noqa: E402
    build_report as build_exam_report,
    parse_front_matter,
    paper_paths,
    render as render_exam_report,
    transcribed_body,
)
from vocabulary_evidence_review import (  # noqa: E402
    build_report as build_vocabulary_review,
    normalize,
    render as render_vocabulary_review,
)

EXAM_JSON = ROOT / "docs" / "exam-provenance-audit.json"
EXAM_MD = ROOT / "docs" / "exam-provenance-audit.md"
VOCAB_JSON = ROOT / "docs" / "vocabulary-evidence-review.json"
VOCAB_MD = ROOT / "docs" / "vocabulary-evidence-review.md"
EXAM_ROOT = ROOT / "De-chuyen-Anh-vao-10"


class ExamProvenanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = build_exam_report()

    def test_committed_report_is_current(self) -> None:
        payload = json.dumps(self.report, ensure_ascii=False, indent=1) + "\n"
        self.assertEqual(EXAM_JSON.read_text(encoding="utf-8"), payload,
                         "run python scripts/audit_exam_provenance.py")
        self.assertEqual(EXAM_MD.read_text(encoding="utf-8"), render_exam_report(self.report),
                         "run python scripts/audit_exam_provenance.py")

    def test_every_transcription_matches_its_declared_content_hash(self) -> None:
        # Filtering the archive's own notes out of the body changed line numbers
        # once already; the hash pins the bytes, so a silent edit cannot pass.
        paths = paper_paths()
        self.assertEqual(len(paths), 106)
        for path in paths:
            with self.subTest(paper=path.name):
                text = path.read_text(encoding="utf-8")
                meta = parse_front_matter(text)
                import hashlib

                self.assertEqual(
                    hashlib.sha256(transcribed_body(text).encode("utf-8")).hexdigest(),
                    meta["sha256_noi_dung"],
                    f"{path.relative_to(ROOT)} was edited after it was transcribed",
                )
        self.assertEqual(self.report["totals"]["contentHashMatches"], 106)

    def test_no_paper_is_claimed_as_verified_against_a_primary_source(self) -> None:
        self.assertEqual(self.report["totals"]["verifiedPrimary"], 0)
        self.assertEqual(self.report["totals"]["papersWithOfficialSource"], 0)
        self.assertEqual(self.report["totals"]["distinctSourceHosts"], 1,
                         "the archive still depends on a single republishing host")
        for paper in self.report["papers"]:
            self.assertIn(paper["verification"], {"unverified", "cross-checked-secondary"})

    def test_answer_claims_are_split_into_measured_groups(self) -> None:
        totals = self.report["totals"]
        self.assertEqual(totals["answerClaimed"], 74, "same claim count as De-chuyen-Anh-vao-10/DO-PHU.md")
        self.assertEqual(totals["answerClaimed"], totals["answerSectionInBody"] + totals["answerClaimWithoutSection"])
        # Pinned deliberately: a new transcription must be measured, not assumed.
        self.assertEqual(sorted(self.report["answerClaimWithoutSectionIds"]), sorted([
            "2022-ha-noi-so", "2022-hai-duong-so", "2022-dong-thap-so",
            "2023-ba-ria-vung-tau-so", "2023-phu-yen-so", "2023-dong-nai-so",
            "2024-tp-ho-chi-minh-so", "2026-quang-tri-so",
        ]))

    def test_crosschecks_name_real_papers_and_real_pages(self) -> None:
        ids = {paper["id"] for paper in self.report["papers"]}
        self.assertGreaterEqual(len(self.report["crosschecks"]), 3)
        for entry in self.report["crosschecks"]:
            with self.subTest(paper=entry["id"]):
                self.assertIn(entry["id"], ids)
                self.assertFalse(entry["primarySourceFound"],
                                 "a primary source would have to be recorded, not assumed")
                self.assertGreaterEqual(len(entry["anchors"]), 4)
                self.assertTrue(all(anchor["match"] for anchor in entry["anchors"]))
                for reproduction in entry["reproductions"]:
                    self.assertTrue(reproduction["url"].startswith("https://"))
                    self.assertTrue(reproduction["publisher"].strip())


class VocabularyEvidenceReviewTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.report = build_vocabulary_review()

    def test_committed_report_is_current(self) -> None:
        payload = json.dumps(self.report, ensure_ascii=False, indent=1) + "\n"
        self.assertEqual(VOCAB_JSON.read_text(encoding="utf-8"), payload,
                         "run python scripts/vocabulary_evidence_review.py")
        self.assertEqual(VOCAB_MD.read_text(encoding="utf-8"), render_vocabulary_review(self.report),
                         "run python scripts/vocabulary_evidence_review.py")

    def test_queue_matches_the_quality_audit(self) -> None:
        audit = json.loads((ROOT / "docs" / "vocabulary-quality-audit.json").read_text(encoding="utf-8"))
        totals = self.report["totals"]
        self.assertEqual(totals["queue"], audit["reviewQueue"]["count"],
                         "the two reports must agree on the size of the review queue")
        self.assertEqual(sum(bucket["count"] for bucket in self.report["buckets"].values()), totals["queue"])
        self.assertEqual(len(self.report["reviewed"]), totals["queue"])
        self.assertEqual(len({item["id"] for item in self.report["reviewed"]}), totals["queue"])

    def test_every_cited_locator_shows_the_form_it_claims(self) -> None:
        lines: dict[str, list[str]] = {}
        checked = 0
        for item in self.report["reviewed"]:
            if item["bucket"] == "phrase-in-corpus":
                relative, number = item["evidence"]
                expected = normalize(item["word"])
            elif item["bucket"] == "surface-variant":
                relative, number = item["evidence"]
                expected = item["variant"]
            else:
                continue
            if relative not in lines:
                lines[relative] = (EXAM_ROOT / relative).read_text(encoding="utf-8").splitlines()
            line = lines[relative][number - 1]
            haystack = normalize(line) if item["bucket"] == "phrase-in-corpus" else line.lower()
            self.assertIn(expected, haystack,
                          f"{item['word']}: {relative}:L{number} does not show {expected!r}")
            checked += 1
        self.assertGreater(checked, 150, "the review locators were not actually walked")

    def test_no_row_is_deleted_or_archived_by_the_review(self) -> None:
        audit = json.loads((ROOT / "docs" / "vocabulary-quality-audit.json").read_text(encoding="utf-8"))
        self.assertEqual(audit["totals"]["retainedHeadwords"], 3841)
        self.assertEqual(audit["totals"]["archivedHeadwords"], 1271)
        for bucket, data in self.report["buckets"].items():
            with self.subTest(bucket=bucket):
                self.assertTrue(data["action"])
                self.assertTrue(data["label"])


if __name__ == "__main__":
    unittest.main()
