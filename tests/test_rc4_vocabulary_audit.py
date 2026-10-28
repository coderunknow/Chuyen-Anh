"""RC4 vocabulary audit: the report reconciles with the shipped data.

These tests do not re-audit the vocabulary; they prove that the audit's numbers
are arithmetic facts about `Learned_Vocabulary_List.md`, that the curated
exclusion is functional (archived rows cannot reach a study deck), and that the
committed report cannot silently go stale.
"""
from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from learned_vocabulary import parse_table  # noqa: E402
from rc4_vocabulary_audit import (  # noqa: E402
    CURRICULUM,
    REPORT_JSON,
    classify,
    curriculum_tokens,
    family_head,
    tag_value,
)
from vocabulary_curation import is_archived, load_spec  # noqa: E402


class Rc4VocabularyAuditTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = parse_table(ROOT / "Learned_Vocabulary_List.md")
        cls.spec = load_spec()
        cls.report = classify(cls.rows, cls.spec)
        cls.committed = json.loads(REPORT_JSON.read_text(encoding="utf-8"))

    def test_every_row_is_accounted_for_exactly_once(self):
        counts = self.report["counts"]
        self.assertEqual(counts["inspectedRows"], len(self.rows))
        self.assertEqual(
            counts["inspectedHeadwords"] + counts["familyForms"],
            counts["inspectedRows"],
            "every row is either a headword or a documented family form",
        )
        self.assertEqual(
            counts["retainedHeadwords"] + counts["excludedHeadwords"],
            counts["inspectedHeadwords"],
            "retained and excluded headwords must partition the headword set",
        )
        self.assertEqual(counts["excludedRowsIncludingFamilyForms"], counts["excludedHeadwords"])
        self.assertEqual(sum(self.report["categories"].values()), counts["excludedHeadwords"])

    def test_curation_policy_replays_without_drift(self):
        replay = self.report["policyReplay"]
        self.assertTrue(replay["reconciled"], replay)
        self.assertEqual(replay["decisions"], replay["stored"])
        self.assertEqual(replay["missing"], [])
        self.assertEqual(replay["extra"], [])
        self.assertEqual(replay["categoryMismatch"], [])
        self.assertEqual(replay["problems"], [])

    def test_archived_rows_are_absent_from_the_study_deck(self):
        # The app's boot rule: a study row is a headword that is not archived.
        deck = [
            row for row in self.rows
            if not family_head(row) and not is_archived(row.get("tags"))
        ]
        deck_ids = {row["id"] for row in deck}
        archived_ids = {row["id"] for row in self.rows if is_archived(row.get("tags"))}
        self.assertEqual(len(deck), self.report["counts"]["retainedHeadwords"])
        self.assertEqual(deck_ids & archived_ids, set(), "an archived row may never enter a session")
        self.assertEqual(len(archived_ids), self.report["counts"]["excludedHeadwords"])

    def test_every_family_form_points_at_a_headword_or_an_archived_head(self):
        by_id = {row["id"]: row for row in self.rows if not family_head(row)}
        archived_ids = {row["id"] for row in self.rows if is_archived(row.get("tags"))}
        for row in self.rows:
            head = family_head(row)
            if not head:
                continue
            self.assertIn(head, by_id, f"{row['word']} points at a missing headword {head}")
            head_archived = head in archived_ids
            row_archived = is_archived(row.get("tags"))
            self.assertEqual(
                head_archived, row_archived,
                f"{row['word']} and its headword disagree about curation",
            )

    def test_every_excluded_row_declares_one_known_category(self):
        categories = set(self.spec.get("categories") or {})
        self.assertTrue(categories)
        for row in self.rows:
            if not is_archived(row.get("tags")):
                self.assertFalse(
                    [tag for tag in row.get("tags") or [] if tag.startswith("curation-category:")],
                    f"{row['word']} carries a category without the archived tag",
                )
                continue
            declared = [tag for tag in row["tags"] if tag.startswith("curation-category:")]
            self.assertEqual(len(declared), 1, f"{row['word']} needs exactly one category")
            self.assertIn(declared[0].split(":", 1)[1], categories)

    def test_curriculum_cross_check_uses_only_attested_words(self):
        spec = json.loads(CURRICULUM.read_text(encoding="utf-8"))
        self.assertTrue(spec["sources"], "the curriculum file must name its sources")
        for source in spec["sources"]:
            self.assertTrue(source["url"].startswith("http"))
            self.assertTrue(source["retrievedAt"])
            self.assertTrue(source["supports"])
        tokens = curriculum_tokens()
        self.assertGreater(len(tokens), 100)
        # Grades 6 and 7 publish topic lists only; that limitation must stay explicit.
        for grade in ("6", "7"):
            self.assertTrue(spec["grades"][grade]["topics"])
            self.assertEqual(spec["grades"][grade]["words"], [])
        curriculum = self.report["curriculum"]
        self.assertEqual(curriculum["tokens"], len(tokens))
        self.assertEqual(
            curriculum["presentInBank"],
            curriculum["inFocus"] + curriculum["excluded"],
            "a curriculum word is either taught or excluded, never both",
        )
        for record in curriculum["focusRows"]:
            self.assertIn(record["level"], ("", "A1", "A2", "B1", "B2", "C1", "C2"))

    def test_a_curriculum_level_retention_needs_the_family_root_exemption(self):
        curriculum = self.report["curriculum"]
        for record in curriculum["unexplained"]:
            self.assertTrue(
                record["familyRoot"] is False,
                "an unexplained retention must not be a family root",
            )
            self.assertIn(record["level"], ("A1", "A2", "B1"))
        # The audited tree explains every one of them; a regression adds a row here.
        self.assertEqual(curriculum["unexplained"], [])

    def test_gloss_that_repeats_the_headword_is_queued_for_review(self):
        repeated = [
            row for row in self.rows
            if not family_head(row)
            and not is_archived(row.get("tags"))
            and row["meaning"].strip().casefold() == row["word"].strip().casefold()
        ]
        queued = {record["id"] for record in self.report["review"]}
        self.assertEqual({row["id"] for row in repeated}, queued)

    def test_quality_signals_are_counted_from_the_rows(self):
        focus = [
            row for row in self.rows
            if not family_head(row) and not is_archived(row.get("tags"))
        ]
        self.assertEqual(self.report["quality"]["examples"], sum(1 for row in focus if row.get("examples")))
        self.assertEqual(self.report["quality"]["synonyms"], sum(1 for row in focus if row.get("synonyms")))
        self.assertEqual(self.report["quality"]["collocations"], sum(1 for row in focus if row.get("collocations")))
        self.assertEqual(
            self.report["structure"]["word-formation"],
            sum(1 for row in focus if tag_value(row, "type") == "word-formation"),
        )
        self.assertEqual(self.report["counts"]["corrected"], 0)
        self.assertEqual(self.report["counts"]["added"], 0)

    def test_committed_report_matches_the_data(self):
        self.assertEqual(
            self.committed, self.report,
            "docs/rc4-vocabulary-audit.json is stale; run python scripts/rc4_vocabulary_audit.py",
        )

    def test_markdown_report_states_the_reconciled_counts(self):
        text = (ROOT / "docs" / "rc4-vocabulary-audit.md").read_text(encoding="utf-8")
        counts = self.report["counts"]
        self.assertIn(f"| Inspected rows | {counts['inspectedRows']:,} |", text)
        self.assertIn(f"| Retained (KEEP, in the focus deck) | {counts['retainedHeadwords']:,} |", text)
        self.assertIn(f"| Reviewed (REVIEW queue) | {counts['reviewed']} |", text)
        self.assertIn("**Result: reconciled.**", text)


if __name__ == "__main__":
    unittest.main()
