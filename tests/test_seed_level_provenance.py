"""A seed row's `level_source` may only name a work that prints that level for that POS.

`data/vocab-seed/*.tsv` rows carry an optional eighth cell naming the reference work
that states the row's level. Writing it is a provenance claim: it says "this work
prints this CEFR band for this part of speech". Phase III (v1.0.0) shipped seven rows
whose claim was false because the level had been copied from the *composite* band
list of a headword with several parts of speech rather than the band attached to the
row's own POS:

    neither  adv  A2   ->  Oxford prints `det./pron. A2, adv. B1`
    ride/run/stay/talk/welcome  v  A2  ->  Oxford prints `v. A1, n. A2`
    star  n  A2  ->  Oxford prints `n. A1, v. A2`

The shipped `senses` of those same rows already said A1 (the per-sense classifier
resolves POS-scoped bands correctly), so only the legacy `level:*` tag and its
`level-source` label disagreed with the data next to them.

These tests resolve every published-level seed row through the pinned reference files
and require the claimed band to be printed for the row's POS. A level is attested when
the reference gives a per-POS band (`v. A1, n. A2`), or when the entry prints a single
band and lists that POS. Unattested claims fail; rows with no `level_source` are
editorial estimates and are out of scope by design.
"""

import collections
import csv
import re
import sys
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from cefr_senses import (  # noqa: E402  (path insert must run first)
    OXFORD_POS_LABELS,
    POS_ALIASES,
    _oxford_levels,
    _oxford_pos_levels,
    normalize_word,
)

SEED_DIR = ROOT / "data" / "vocab-seed"
REFS = ROOT / "audit" / "v100" / "refs"
SEED_HEADER_WIDTH = 7

FULL_TO_SHORT = {
    "noun": "n", "n": "n",
    "verb": "v", "v": "v",
    "adjective": "adj", "adj": "adj",
    "adverb": "adv", "adv": "adv",
    "pronoun": "pron", "pron": "pron",
    "preposition": "prep", "prep": "prep",
    "determiner": "det", "det": "det",
    "conjunction": "conj", "conj": "conj",
    "number": "number",
    "modal auxiliary": "modal", "modal": "modal",
    "interjection": "interj", "interj": "interj", "exclamation": "interj",
}


def pos_codes(pos: str) -> tuple[str, ...]:
    """Bank POS cell ('v', 'adj/n', 'prep') as reference POS codes."""
    codes: list[str] = []
    for part in (pos or "").lower().replace(",", "/").split("/"):
        part = part.strip()
        for alias in POS_ALIASES.get(part, (part,)):
            code = FULL_TO_SHORT.get(alias, alias)
            if code and code not in codes:
                codes.append(code)
    return tuple(codes)


def printed_pos_codes(raw: str) -> set[str]:
    """POS codes named in an Oxford `Part of Speech` cell."""
    cell = (raw or "").lower()
    found = {code for label, code in OXFORD_POS_LABELS
             if re.search(r"(^|[,\s/;])" + re.escape(label), cell)}
    return found


def oxford_index(filename: str) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = collections.defaultdict(list)
    with (REFS / filename).open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle, delimiter="\t"):
            head = row["Word"].split("(")[0]
            record = {
                "pos_levels": _oxford_pos_levels(row["Part of Speech"]),
                "levels": _oxford_levels(row["Level"]),
                "pos_codes": printed_pos_codes(row["Part of Speech"]),
            }
            # Alternative headwords are comma/slash separated; a space is part of the headword
            # ("according to" is a preposition at A2, while "to" alone is A1 — splitting on
            # whitespace would let the wrong entry attest the wrong band).
            for form in dict.fromkeys(normalize_word(part)
                                      for part in re.split(r"[,/]+", head) if normalize_word(part)):
                index[form].append(record)
    return index


def profile_index(filename: str) -> dict[str, list[dict]]:
    index: dict[str, list[dict]] = collections.defaultdict(list)
    with (REFS / filename).open(encoding="utf-8") as handle:
        for row in csv.DictReader(handle):
            record = {
                "pos": FULL_TO_SHORT.get(row["pos"].strip().lower(), row["pos"].strip().lower()),
                "level": row["CEFR"].strip().upper(),
            }
            for form in dict.fromkeys(normalize_word(part)
                                      for part in row["headword"].split("/") if normalize_word(part)):
                index[form].append(record)
    return index


class SeedLevelProvenanceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.oxford3000 = oxford_index("oxford-3000.en.tsv")
        cls.oxford5000 = oxford_index("oxford-5000-expanded.en.tsv")
        cls.cefrj = profile_index("cefrj-vocabulary-profile-1.5.csv")
        cls.octanove = profile_index("octanove-vocabulary-profile-c1c2-1.0.csv")
        cls.rows = cls._seed_rows()

    @staticmethod
    def _seed_rows() -> list[dict]:
        rows: list[dict] = []
        for path in sorted(SEED_DIR.glob("*.tsv")):
            for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
                if not line.strip() or line.startswith("#"):
                    continue
                cells = line.split("\t")
                rows.append({
                    "file": path.name,
                    "line": number,
                    "word": cells[0],
                    "pos": cells[1],
                    "level": cells[3],
                    "source": cells[SEED_HEADER_WIDTH].strip() if len(cells) > SEED_HEADER_WIDTH else "",
                })
        return rows

    @staticmethod
    def _oxford_levels_for(index: dict[str, list[dict]], word: str, codes: tuple[str, ...]) -> set[str]:
        levels: set[str] = set()
        for record in index.get(normalize_word(word), []):
            inline = [record["pos_levels"][code] for code in codes if code in record["pos_levels"]]
            if inline:
                levels.update(inline)
                continue
            # One printed band on an entry that names this POS is that POS's band.
            if len(record["levels"]) == 1 and set(codes) & record["pos_codes"]:
                levels.update(record["levels"])
        return levels

    def _attested_levels(self, source: str, word: str, pos: str) -> set[str]:
        codes = pos_codes(pos)
        if source == "cefrj-vocabulary-profile-1.5":
            return {rec["level"] for rec in self.cefrj.get(normalize_word(word), []) if rec["pos"] in codes}
        if source == "octanove-vocabulary-profile-1.0":
            return {rec["level"] for rec in self.octanove.get(normalize_word(word), []) if rec["pos"] in codes}
        if source == "oxford-3000-wordlist":
            return self._oxford_levels_for(self.oxford3000, word, codes)
        if source == "oxford-3000-5000":
            return (self._oxford_levels_for(self.oxford3000, word, codes)
                    | self._oxford_levels_for(self.oxford5000, word, codes))
        return set()

    def test_every_published_level_is_printed_for_the_rows_part_of_speech(self) -> None:
        published = [row for row in self.rows if row["source"]]
        self.assertGreater(len(published), 5000, "the guard must still see the published-level rows")
        unresolved: list[str] = []
        mismatched: list[str] = []
        for row in published:
            attested = self._attested_levels(row["source"], row["word"], row["pos"])
            where = f"{row['file']}:{row['line']} {row['word']} ({row['pos']}) says {row['level']} via {row['source']}"
            if not attested:
                unresolved.append(where)
            elif row["level"] not in attested:
                mismatched.append(f"{where}; the reference prints {', '.join(sorted(attested))}")
        self.assertEqual([], mismatched,
                         "seed rows name a source that does not print their level for their POS:\n  "
                         + "\n  ".join(mismatched))
        self.assertEqual([], unresolved,
                         "seed rows name a source that cannot be resolved to a POS level:\n  "
                         + "\n  ".join(unresolved))

    def test_multiword_headwords_are_not_split_into_their_parts(self) -> None:
        """A spaced headword must be indexed whole, or its parts inherit its band."""
        self.assertTrue("according to" in self.oxford3000,
                        "the multiword headword must be indexed as printed")
        self.assertTrue("according" not in self.oxford3000,
                        "a fragment of a multiword headword must not become its own entry")

    def test_a_word_is_not_attested_by_a_multiword_headword_that_contains_it(self) -> None:
        """Negative control for the multiword fix (CodeRabbit 4514659122).

        "according to" is a preposition at A2 in the pinned Oxford snapshot, while
        "to" alone is a preposition at A1. Indexing the multiword entry by its words
        made `to` / prep / A2 resolve through the wrong entry, so a seed row could
        claim A2 for `to` and still pass. This asserts the resolution the guard
        actually performs, not just the shape of the index: `to` must attest A1 and
        must not attest A2.
        """
        attested = self._oxford_levels_for(self.oxford3000, "to", ("prep",))
        self.assertIn("A1", attested, "the pinned snapshot prints `to` as a preposition at A1")
        self.assertNotIn("A2", attested,
                         "`to` must not inherit the A2 band of the multiword entry "
                         "`according to`; that would let a seed row claim A2 for `to`")
        # And the multiword headword still attests its own band, so the control
        # above is not passing because the entry disappeared.
        self.assertEqual({"A2"}, self._oxford_levels_for(self.oxford3000, "according to", ("prep",)))

    def test_rows_without_a_source_are_editorial_and_out_of_scope(self) -> None:
        editorial = [row for row in self.rows if not row["source"]]
        self.assertGreater(len(editorial), 1000)
        self.assertTrue(all(row["level"] for row in editorial),
                        "an editorial row still states the level it is an estimate of")


if __name__ == "__main__":
    unittest.main()
