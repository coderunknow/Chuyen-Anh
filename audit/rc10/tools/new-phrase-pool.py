#!/usr/bin/env python3
"""rc10 — build the P6 candidate pool for new phrases, with the evidence each row may claim.

A phrase level is not a thing a single-word list can tell you, and no openly
licensed phrase-level CEFR reference covers English phrasal verbs and idioms at
this granularity (measured: the Oxford 3000/5000 carries 10 multi-word entries,
CEFR-J 1.5 has 144, Octanove 10 — none of them phrasal verbs beyond seven
items). So the pool is built from two kinds of check, and it reports which one a
candidate actually passed:

  corpus      the whole phrase occurs in a transcribed exam paper. That is a fact
              about the corpus, proven with file and line, and it is the same
              evidence the shipped bank uses for `source:exam`.
  constituents every content word of the phrase has a published CEFR entry, so
              the phrase's band is *bounded below* by its hardest word. The bound
              is a lower bound, never a claim that the publisher graded the
              phrase itself; candidates that fail it are dropped. Unlike a single
              word, a phrase is NOT rejected for being built from elementary
              words: `get up` is two A1 words and a B1 item, which is exactly why
              a phrase level cannot be read off its parts. The recorded level is
              `max(B1, hardest constituent)`: the floor is the bank's study scope
              and is declared editorial, the bound is evidenced.

The pool refuses a candidate when:

  * the phrase is already in the bank (normalised) or already a vocabulary
    headword in the legacy block (which the phrase build would skip), or is a
    single word;
  * the phrase does not occur in any transcribed paper (corpus < 1);
  * a content word has no published entry at all (the phrase then has no bound);
  * the derived level falls outside B1–C2.

Output: `evidence/new-phrase-pool.json`, one record per accepted candidate.
"""
from __future__ import annotations

import collections
import csv
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

from build_phrases import LineIndex  # noqa: E402
from phrase_bank import TYPES, phrase_key  # noqa: E402

EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
REFS = pathlib.Path("/tmp/refs")
CANDIDATES = EVIDENCE / "phrase-candidates.txt"
OUT = EVIDENCE / "new-phrase-pool.json"
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
STUDY_BAND = ("B1", "B2", "C1", "C2")
TIER = {"oxford-3000-5000": 0, "cefrj-vocabulary-profile-1.5": 1, "octanove-vocabulary-profile-1.0": 2}
WORKS = {
    "oxford-3000-5000": "The Oxford 3000 and 5000 (Oxford University Press)",
    "cefrj-vocabulary-profile-1.5": "CEFR-J Vocabulary Profile 1.5 (Tono Laboratory, TUFS)",
    "octanove-vocabulary-profile-1.0": "Octanove Vocabulary Profile C1/C2 1.0 (CC BY-SA 4.0)",
}
PARTICLES = set("""up down out in on off over through back away along apart around about by for
into with to at after across ahead aside forth together under upon without behind forward
within throughout""".split())
FUNCTION_WORDS = set("""a an the and or but if then than that this these those there their they
them he she it its we you your i me my our us who whom whose which what when where why how not
no nor so as at by for from in of off on onto out over per to up upon via with within without
about above across after against along among around before behind below beneath beside between
beyond during except inside near outside since through throughout till toward towards under until
while yes also very just even still yet already only much many more most less least few little
some any each every both either neither other another such own same all one two three being been
was were is are am be do does did done have has had having will would shall should can could may
might must ought""".split())


def load_reference() -> dict[str, list[dict[str, str]]]:
    reference: dict[str, list[dict[str, str]]] = collections.defaultdict(list)
    for name in ("20260715160822-oxford-3000.en.tsv", "20260715165539-oxford-5000-expanded.en.tsv"):
        with (REFS / "oxford" / name).open(encoding="utf-8") as handle:
            for record in csv.DictReader(handle, delimiter="\t"):
                level = record["Level"].strip().upper()
                if level in LEVELS:
                    reference[record["Word"].strip().lower()].append(
                        {"source": "oxford-3000-5000", "level": level, "work": WORKS["oxford-3000-5000"],
                         "locator": f"{name}: {record['Word'].strip()} {level.lower()}"})
    for name, label in (("cefrj-vocabulary-profile-1.5.csv", "cefrj-vocabulary-profile-1.5"),
                        ("octanove-vocabulary-profile-c1c2-1.0.csv", "octanove-vocabulary-profile-1.0")):
        with (REFS / "olp" / name).open(encoding="utf-8-sig") as handle:
            for record in csv.DictReader(handle):
                level = record["CEFR"].strip().upper()
                if level in LEVELS:
                    reference[record["headword"].strip().lower()].append(
                        {"source": label, "level": level, "work": WORKS[label],
                         "locator": f"{name}: {record['headword'].strip()} {record['pos'].strip()} {level}"})
    return reference


def best_level(word: str, reference: dict[str, list[dict[str, str]]]) -> dict[str, str] | None:
    entries = reference.get(word.strip().lower())
    if not entries:
        return None
    return sorted(entries, key=lambda entry: (TIER[entry["source"]], LEVELS.index(entry["level"])))[0]


def main() -> int:
    bank = {phrase_key(row["phrase"]) for row in
            json.loads((ROOT / "data" / "phrases.json").read_text(encoding="utf-8"))}
    vocabulary = {row["word"].strip().lower() for row in
                  json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))}
    reference = load_reference()
    index = LineIndex(ROOT)

    candidates = [line.strip() for line in CANDIDATES.read_text(encoding="utf-8").splitlines()
                  if line.strip() and not line.lstrip().startswith("#")]
    accepted: list[dict[str, object]] = []
    rejected: dict[str, list[str]] = collections.defaultdict(list)
    seen: set[str] = set()
    for phrase in candidates:
        key = phrase_key(phrase)
        if not key or key in seen:
            rejected["duplicate_candidate"].append(phrase)
            continue
        seen.add(key)
        if len(key.split()) < 2:
            rejected["single_word"].append(phrase)
            continue
        if key in bank:
            rejected["already_in_bank"].append(phrase)
            continue
        if key in vocabulary:
            # `rule out`, `write off` and `in the face of` are already vocabulary
            # headwords in the legacy block; the build would skip the duplicate, so
            # the pool refuses it here instead of counting a row that cannot land.
            rejected["already_a_vocabulary_headword"].append(phrase)
            continue
        hits = index.occurrences(phrase)
        if not hits:
            rejected["no_corpus_occurrence"].append(phrase)
            continue
        words = [word for word in re.split(r"[^a-z-]+", key) if word]
        content = [word for word in words if word not in FUNCTION_WORDS and len(word) > 2]
        constituent: list[dict[str, str]] = []
        missing: list[str] = []
        for word in content:
            entry = best_level(word, reference)
            if entry is None:
                missing.append(word)
            else:
                constituent.append({"word": word, **entry})
        if missing:
            rejected["constituent_has_no_reference"].append(f"{phrase} ({', '.join(missing)})")
            continue
        if not constituent:
            rejected["no_content_word"].append(phrase)
            continue
        hardest = max(constituent, key=lambda entry: LEVELS.index(entry["level"]))
        level = hardest["level"] if hardest["level"] in STUDY_BAND else "B1"
        if level not in STUDY_BAND:
            rejected["outside_study_band"].append(phrase)
            continue
        accepted.append({
            "phrase": phrase,
            "key": key,
            "level": level,
            "levelBasis": ("hardest constituent word in the published lists (lower bound); floored at B1 "
                           "because the bank teaches B1-C2 and no consulted list grades the phrase itself"),
            "constituents": constituent,
            "corpusPapers": len({hit[0] for hit in hits}),
            "corpusLocators": [f"{relative}:L{line}" for relative, line in hits[:5]],
            "corpusDocuments": sorted({hit[0] for hit in hits}),
            "inVocabularyAsHeadword": key in vocabulary,
            "hardestConstituent": hardest["word"],
            "typeHint": "phrasal-verb" if len(key.split()) == 2 and key.split()[1] in PARTICLES else None,
        })

    payload = {
        "generatedBy": "audit/rc10/tools/new-phrase-pool.py",
        "candidateSource": "audit/rc10/evidence/phrase-candidates.txt",
        "rules": [
            "not already in the phrase bank (normalised), not a single word",
            "the whole phrase occurs in at least one transcribed exam paper",
            "every content word has a published CEFR entry, none of them A1/A2",
            "derived level (hardest constituent) inside B1-C2",
        ],
        "candidates": sorted(accepted, key=lambda row: (LEVELS.index(row["level"]), row["key"])),
        "rejected": {reason: words for reason, words in sorted(rejected.items())},
        "counts": {
            "candidates": len(candidates),
            "accepted": len(accepted),
            "byLevel": dict(collections.Counter(row["level"] for row in accepted)),
            "byTypeHint": dict(collections.Counter(row["typeHint"] or "other" for row in accepted)),
            "rejected": {reason: len(words) for reason, words in sorted(rejected.items())},
        },
    }
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(payload["counts"], indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
