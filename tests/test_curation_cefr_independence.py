"""CEFR classification and deck membership are independent decisions.

An earlier revision derived the archived set from the live `level:` tag. That made
a dictionary-driven level correction remove a word from a learner's deck — a
visibility decision taken by an audit that has no mandate over visibility. These
tests pin the separation: the frozen per-row decisions in
`docs/vocabulary-curation-decisions.json` decide the deck, and a level change can
never move a row across it.
"""
import copy
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from audit_vocabulary_quality import seed_origin_map  # noqa: E402
from learned_vocabulary import parse_table  # noqa: E402
from vocabulary_curation import (  # noqa: E402
    DECISIONS_PATH, SPEC_PATH, apply_curation, load_frozen, load_spec, matched_rows,
    resolve_decisions,
)


def level_of(row):
    for tag in row.get("tags") or []:
        if tag.startswith("level:"):
            return tag.split(":", 1)[1]
    return None


def set_level(row, level):
    row["tags"] = [tag for tag in row["tags"] if not tag.startswith("level:")] + [f"level:{level}"]


class CurationCefrIndependenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.rows = parse_table(ROOT / "Learned_Vocabulary_List.md")
        cls.spec = load_spec(SPEC_PATH)
        cls.origins = seed_origin_map()

    def archived_ids(self, rows, spec=None):
        rows = copy.deepcopy(rows)
        summary = apply_curation(rows, spec or self.spec, self.origins)
        return {row["id"] for row in rows if "curation:archived" in (row.get("tags") or [])}, summary

    def test_frozen_decisions_file_exists_and_covers_the_deck(self):
        self.assertTrue(DECISIONS_PATH.exists(), "the frozen decision file is required")
        frozen = load_frozen()
        self.assertIsNotNone(frozen)
        archived, _ = self.archived_ids(self.rows)
        self.assertEqual(set(frozen), archived,
                         "every archived row must have a frozen decision, and vice versa")

    def test_changing_a_level_never_changes_deck_membership(self):
        baseline, _ = self.archived_ids(self.rows)
        # Move a wide spread of rows across bands, including rows that match the
        # B1 rule and rows that do not.
        rows = copy.deepcopy(self.rows)
        touched = 0
        for row in rows:
            if int(row["id"]) <= 913:
                continue
            if touched >= 400:
                break
            current = level_of(row)
            set_level(row, "B1" if current != "B1" else "C2")
            touched += 1
        self.assertGreater(touched, 200, "the test must actually move labels")
        moved, _ = self.archived_ids(rows)
        self.assertEqual(moved, baseline,
                         "a CEFR correction must not add or remove a deck member")

    def test_a_newly_matching_row_is_reported_not_archived(self):
        frozen = load_frozen()
        derived, problems = matched_rows(self.rows, self.spec, self.origins)
        self.assertEqual(problems, [])
        # Drop one frozen decision: the rule still proposes the row, but nothing
        # may happen to it until a curator accepts it.
        victim = sorted(frozen)[0]
        pruned = {key: value for key, value in frozen.items() if key != victim}
        resolved = resolve_decisions(self.rows, self.spec, self.origins, pruned)
        self.assertNotIn(victim, resolved["archived"])
        self.assertIn(victim, {item["id"] for item in resolved["pendingReview"]},
                      "the proposal must surface for review")
        self.assertIsNotNone(derived)

    def test_correcting_the_academic_level_keeps_it_in_the_deck(self):
        """The concrete case: `academic` is attested B1 and stays taught."""
        academic = next(row for row in self.rows if row["word"].lower() == "academic")
        self.assertEqual(level_of(academic), "B1",
                         "the attested level must be applied, not suppressed to protect the deck")
        self.assertNotIn("curation:archived", academic.get("tags") or [],
                         "and the row must stay in the learner's deck")
        # The documented reason lives with the decision, not in a code path.
        frozen = load_frozen()
        self.assertNotIn(academic["id"], frozen)


if __name__ == "__main__":
    unittest.main()
