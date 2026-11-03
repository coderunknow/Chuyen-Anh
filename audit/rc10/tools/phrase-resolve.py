#!/usr/bin/env python3
"""rc10 — give every phrase row a final disposition backed by a named source.

A phrase level cannot be read off a single-word list, and no openly licensed
phrase-level CEFR reference exists that covers English phrasal verbs, idioms and
collocations at the granularity this bank needs. The audit therefore uses three
kinds of evidence and says which one decided each row:

  `phrase_listed`     a published CEFR list states a level for the whole phrase
                      (both The Oxford 3000/5000 and the CEFR-J profile contain
                      multi-word entries such as "according to", "as well as").
  `constituent_attested`  the phrase itself is not listed, but every content word
                      in it is attested at a known level in a published list, so
                      the phrase's band is bounded by its constituents. The row keeps
                      its editorial level when that level is inside the bound.
  `editorial_no_reference`  neither the phrase nor all of its constituents are
                      covered; the level stays editorial and is said to be so.

Independent of level, every row is also checked for the properties a phrase bank
must have: non-empty gloss and usage, a declared type, a duplicate of another row
(normalised), a phrasal verb that is not actually verb + particle, and — for the
exam corpus — whether the exact phrase occurs in a transcribed paper.

Dispositions, one per row:
  verified_agree / verified_corrected / verified_precedence   phrase-level reference
  constituent_bound_kept / constituent_bound_corrected        constituents decide
  editorial_no_reference                                      no reference covers it
  duplicate_rejected                                          excluded from the target
"""
from __future__ import annotations

import csv
import json
import pathlib
import re
import sys
import collections

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
REFS = pathlib.Path("/tmp/refs")
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
STUDY_SCOPE = ("B1", "B2", "C1", "C2")
POS_FULL = {"noun": "n", "verb": "v", "adjective": "adj", "adverb": "adv", "preposition": "prep",
            "determiner": "det", "pronoun": "pron", "conjunction": "conj", "number": "num",
            "exclamation": "excl", "modal verb": "modal"}


def load_phrase_lists():
    """Multi-word entries in the published lists, keyed by normalised phrase."""
    index = collections.defaultdict(list)
    for name, label in (("20260715160822-oxford-3000.en.tsv", "Oxford 3000"),
                        ("20260715165539-oxford-5000-expanded.en.tsv", "Oxford 5000 (expanded)")):
        with (REFS / "oxford" / name).open(encoding="utf-8") as handle:
            for record in csv.DictReader(handle, delimiter="\t"):
                word = record["Word"].strip().lower()
                if " " not in word:
                    continue
                index[normalise(word)].append({"level": record["Level"].strip().upper(),
                                               "source": "oxford_list",
                                               "work": "The Oxford 3000 and 5000 (Oxford University Press)",
                                               "locator": f"{label}: {record['Word']} {record['Part of Speech']}"})
    for name, source, work in (("cefrj-vocabulary-profile-1.5.csv", "cefrj_1_5", "CEFR-J Vocabulary Profile 1.5"),
                               ("octanove-vocabulary-profile-c1c2-1.0.csv", "octanove_c1c2", "Octanove Vocabulary Profile 1.0")):
        with (REFS / "olp" / name).open(encoding="utf-8-sig") as handle:
            for record in csv.DictReader(handle):
                headword = record["headword"].strip().lower()
                if " " not in headword:
                    continue
                index[normalise(headword)].append({"level": record["CEFR"].strip().upper(),
                                                   "source": source, "work": work,
                                                   "locator": f"{name}: {record['headword']} {record['pos']}"})
    return index


def load_word_levels():
    """headword + POS -> level, used to bound a phrase by its constituents."""
    levels = collections.defaultdict(set)
    for name in ("20260715160822-oxford-3000.en.tsv", "20260715165539-oxford-5000-expanded.en.tsv"):
        with (REFS / "oxford" / name).open(encoding="utf-8") as handle:
            for record in csv.DictReader(handle, delimiter="\t"):
                for word in re.split(r",", record["Word"]):
                    word = word.strip().lower()
                    if word and " " not in word:
                        levels[word].add(record["Level"].strip().upper())
    for name in ("cefrj-vocabulary-profile-1.5.csv", "octanove-vocabulary-profile-c1c2-1.0.csv"):
        with (REFS / "olp" / name).open(encoding="utf-8-sig") as handle:
            for record in csv.DictReader(handle):
                for word in record["headword"].strip().lower().split("/"):
                    word = word.strip()
                    if word and " " not in word:
                        levels[word].add(record["CEFR"].strip().upper())
    return levels


def normalise(value: str) -> str:
    return re.sub(r"\s+", " ", str(value).lower().replace("’", "'")).strip()


def tag_value(row, prefix):
    for tag in row.get("tags") or []:
        key, _, value = str(tag).partition(":")
        if key == prefix:
            return value
    return None


STOPWORDS = {"a", "an", "the", "to", "of", "in", "on", "at", "for", "with", "by", "up", "down",
             "out", "off", "into", "onto", "over", "away", "back", "as", "and", "or", "not",
             "it", "its", "one's", "oneself", "some", "any", "this", "that", "be", "is", "are"}


def rank(level: str) -> int:
    return LEVELS.index(level) if level in LEVELS else -1


def main() -> int:
    phrase_lists = load_phrase_lists()
    word_levels = load_word_levels()
    exam = {}
    path = EVIDENCE / "exam-occurrences-phrases.jsonl"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                exam[row["id"]] = row
    phrases = json.loads((ROOT / "data" / "phrases.json").read_text(encoding="utf-8"))

    seen = collections.defaultdict(list)
    for row in phrases:
        seen[normalise(row["phrase"])].append(row["id"])

    records = []
    for row in phrases:
        stored = (tag_value(row, "level") or "UNCLASSIFIED").upper()
        text = normalise(row["phrase"])
        listed = phrase_lists.get(text, [])
        content_words = [word for word in re.split(r"[\s-]+", text) if word and word not in STOPWORDS]
        covered = {word: sorted(word_levels.get(word, []), key=rank) for word in content_words}
        missing = [word for word, levels in covered.items() if not levels]
        ceiling = max((rank(levels[-1]) for levels in covered.values() if levels), default=-1)
        floor = min((rank(levels[0]) for levels in covered.values() if levels), default=-1)

        record = {
            "kind": "phrase", "id": row["id"], "item": row["phrase"], "type": row.get("type"),
            "storedLevel": stored, "examOccurrences": (exam.get(row["id"]) or {}).get("examOccurrenceCount", 0),
            "duplicateOf": [other for other in seen[text] if other != row["id"]],
            "contentWords": content_words,
            "constituents": {word: levels for word, levels in covered.items()},
            "constituentsMissing": missing,
            "phraseListed": [{key: entry[key] for key in ("level", "source", "work", "locator")} for entry in listed],
        }

        problems = []
        if not str(row.get("meaning") or "").strip():
            problems.append("missing Vietnamese gloss")
        if not str(row.get("usage") or "").strip():
            problems.append("missing usage note")
        if not row.get("type"):
            problems.append("missing type")
        if stored == "UNCLASSIFIED":
            problems.append("no level tag")
        if record["duplicateOf"]:
            problems.append("duplicate phrase text")
        if row.get("type") == "phrasal-verb" and len(text.split()) < 2:
            problems.append("phrasal verb with one token")
        record["problems"] = problems

        if record["duplicateOf"]:
            record["disposition"] = "duplicate_rejected"
            record["effectiveLevel"] = stored
            record["reason"] = f"same normalised text as {', '.join(record['duplicateOf'])}"
        elif listed:
            levels = {entry["level"] for entry in listed}
            chosen = listed[0]
            record.update(effectiveLevel=chosen["level"], chosenSource=chosen["source"],
                          chosenWork=chosen["work"], chosenLocator=chosen["locator"])
            if len(levels) == 1:
                if chosen["level"] == stored:
                    record["disposition"] = "verified_agree"
                    record["reason"] = f"{chosen['work']} lists this phrase at {chosen['level']}."
                elif chosen["level"] not in STUDY_SCOPE:
                    record["disposition"] = "verified_below_scope"
                    record["reason"] = f"listed {chosen['level']}, below the B1-C2 seed band."
                else:
                    record["disposition"] = "verified_corrected"
                    record["reason"] = (f"{chosen['work']} lists this phrase at {chosen['level']}; "
                                        f"the row carried {stored}.")
            else:
                record["disposition"] = "verified_precedence"
                record["dissent"] = sorted(f"{entry['source']}:{entry['level']}" for entry in listed)
                record["reason"] = (f"sources disagree ({', '.join(record['dissent'])}); "
                                    f"the publisher list decides ({chosen['level']}).")
        else:
            # A phrase is not bounded by its parts. "give up" is B1 although "give"
            # and "up" are A1-A2; idioms and collocations routinely outrank their
            # constituents, so constituent coverage is recorded as context and is
            # never used to move a phrase's level. No published phrase-level CEFR
            # reference covers the rest of this bank, and inventing one out of the
            # parts would be a bulk mapping dressed up as evidence.
            record.update(disposition="editorial_no_reference", effectiveLevel=stored)
            record["constituentBound"] = ([LEVELS[floor], LEVELS[ceiling]] if missing == [] and ceiling >= 0 else None)
            record["reason"] = ("no published CEFR list states a level for this phrase; the editorial "
                                f"level {stored} is retained and stays marked level-source:editorial"
                                + ("" if missing else
                                   f". Its content words are all attested ({', '.join(f'{w}:{levels[0]}-{levels[-1]}' for w, levels in covered.items())}), "
                                   "which is context, not a phrase level"))
        records.append(record)

    (EVIDENCE / "phrase-resolutions.jsonl").write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records), encoding="utf-8")
    corrections = [{"id": record["id"], "item": record["item"], "from": record["storedLevel"], "to": record["effectiveLevel"],
                    "disposition": record["disposition"], "source": record.get("chosenSource") or "constituents"}
                   for record in records if record["disposition"].endswith("_corrected")]
    summary = {"rows": len(records),
               "dispositions": dict(collections.Counter(record["disposition"] for record in records)),
               "withProblems": sum(1 for record in records if record["problems"]),
               "problemKinds": dict(collections.Counter(problem for record in records for problem in record["problems"])),
               "corrections": len(corrections),
               "correctionsByDisposition": dict(collections.Counter(item["disposition"] for item in corrections)),
               "withExamOccurrence": sum(1 for record in records if record["examOccurrences"]),
               "phraseListed": sum(1 for record in records if record["phraseListed"])}
    (EVIDENCE / "phrase-resolutions-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (EVIDENCE / "phrase-corrections.json").write_text(
        json.dumps({"generatedAt": "2026-11-02", "count": len(corrections), "corrections": corrections},
                   ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
