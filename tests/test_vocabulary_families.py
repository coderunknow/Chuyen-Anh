"""The root rule: one headword per word root.

These tests pin the shape of `docs/vocabulary-families.json`, the rows it
produced in `Learned_Vocabulary_List.md`, and the app data in
`data/vocabulary.json`, so a same-root form can never be counted as a second
headword again.
"""
import json
import pathlib
import sys
import unittest

ROOT = pathlib.Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
sys.path.insert(0, str(SCRIPTS))
from learned_vocabulary import parse_table  # noqa: E402
from vocab_sources import word_key  # noqa: E402
import vocabulary_families as fam  # noqa: E402

SPEC = fam.load_spec()
RECORDS = parse_table(ROOT / "Learned_Vocabulary_List.md")
APP = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))


class FamilySpecTests(unittest.TestCase):
    def test_spec_is_well_formed_and_counted(self):
        families = SPEC["families"]
        self.assertGreaterEqual(len(families), 300, "the map must cover the families found in the data")
        members = [member for family in families for member in family["members"]]
        self.assertEqual(len(members), SPEC["counts"]["mergedRows"])
        self.assertEqual(len(families), SPEC["counts"]["families"])
        for family in families:
            self.assertIn(family["kind"], {"derived", "same root", "inflection"})
            self.assertTrue(family["members"], f"{family['head']} has no members")
            for member in family["members"]:
                for field in ("id", "word", "pos", "meaning"):
                    self.assertTrue(str(member.get(field, "")).strip(), f"{family['head']}: member missing {field}")

    def test_no_word_is_used_twice(self):
        heads = [word_key(family["head"]) for family in SPEC["families"]]
        self.assertEqual(len(heads), len(set(heads)), "a headword is declared twice")
        seen = {}
        for family in SPEC["families"]:
            for member in family["members"]:
                key = word_key(member["word"])
                self.assertNotIn(key, seen, f"{member['word']} is in {seen.get(key)} and {family['head']}")
                seen[key] = family["head"]
        self.assertEqual(set(heads), set(heads) - set(seen), "a word is both a headword and a member")

    def test_every_family_resolves_to_rows(self):
        by_key = {}
        for row in RECORDS:
            by_key.setdefault(word_key(row["word"]), row)
        for family in SPEC["families"]:
            head = by_key[word_key(family["head"])]
            self.assertEqual(head["id"], family["headId"])
            self.assertNotIn(fam.MERGED_TAG, head["tags"], f"{family['head']} is merged into another headword")
            note = head["wordFamily"]
            self.assertIn(fam.NOTE_PREFIX, note, f"{family['head']} has no family note")
            for member in family["members"]:
                row = by_key[word_key(member["word"])]
                self.assertEqual(row["id"], member["id"])
                self.assertIn(fam.MERGED_TAG, row["tags"], f"{member['word']} is not marked merged")
                self.assertEqual(fam.head_id_of(row["tags"]), head["id"])
                self.assertIn(member["word"].lower(), note.lower())
                self.assertEqual((row["pos"], row["meaning"]), (member["pos"], member["meaning"]),
                                 f"{member['word']} changed; the note is stale")

    def test_map_matches_the_rows_it_marks(self):
        marked = [row for row in RECORDS if fam.MERGED_TAG in row["tags"]]
        declared = [member for family in SPEC["families"] for member in family["members"]]
        self.assertEqual({row["id"] for row in marked}, {member["id"] for member in declared})
        self.assertEqual(fam.validate(RECORDS), [])

    def test_active_headwords_are_the_roots(self):
        merged_ids = {row["id"] for row in RECORDS if fam.MERGED_TAG in row["tags"]}
        active = [row for row in RECORDS if row["id"] not in merged_ids]
        self.assertEqual(len(active), SPEC["counts"]["activeHeadwords"])
        self.assertEqual(len(RECORDS), SPEC["counts"]["rowsInTable"])
        # Every active word is unique after the app's normalization, and no active
        # word is a declared family member: the count is a count of roots.
        keys = [word_key(row["word"]) for row in active]
        self.assertEqual(len(keys), len(set(keys)))
        members = {word_key(member["word"]) for family in SPEC["families"] for member in family["members"]}
        self.assertEqual(members & set(keys), set(), "a family member is still an active headword")


class AppDataTests(unittest.TestCase):
    def test_json_marks_merged_rows_and_hides_nothing_else(self):
        by_id = {entry["id"]: entry for entry in APP}
        merged = [entry for entry in APP if entry.get("familyHead")]
        active = [entry for entry in APP if not entry.get("familyHead")]
        self.assertEqual(len(APP), len(RECORDS))
        self.assertEqual(len(active), SPEC["counts"]["activeHeadwords"])
        self.assertEqual(len(merged), SPEC["counts"]["mergedRows"])
        for entry in merged:
            head = by_id[entry["familyHead"]]
            self.assertNotIn("familyHead", head, "a merged row points at another merged row")
            self.assertIn(entry["word"].lower(), head["wordFamily"].lower())
            self.assertIn(fam.MERGED_TAG, entry["tags"])

    def test_no_active_pair_shares_a_root_among_declared_families(self):
        # The map is the reviewed statement of the rule; this asserts the data
        # obeys it rather than re-deriving families from spelling heuristics.
        active = {word_key(entry["word"]) for entry in APP if not entry.get("familyHead")}
        for family in SPEC["families"]:
            self.assertIn(word_key(family["head"]), active)
            for member in family["members"]:
                self.assertNotIn(word_key(member["word"]), active, member["word"])

    def test_retired_ids_are_never_reused(self):
        # Merged rows keep their ID in the table and in the JSON, so no later row
        # can take an ID a learner may already have progress for.
        ids = [row["id"] for row in RECORDS]
        self.assertEqual(ids, [str(number) for number in range(1, len(ids) + 1)])
        merged = {row["id"] for row in RECORDS if fam.MERGED_TAG in row["tags"]}
        self.assertTrue(merged)
        self.assertEqual(sorted(int(value) for value in merged), sorted(int(value) for value in merged))
        self.assertEqual(set(ids) - {entry["id"] for entry in APP}, set(), "the JSON drops a row id")


if __name__ == "__main__":
    unittest.main()
