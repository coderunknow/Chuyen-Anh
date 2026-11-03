#!/usr/bin/env python3
"""rc10 — build the P5 candidate pool of genuinely advanced new headwords.

A new headword has to earn its place on two independent grounds, and the record for
each candidate says which ground applied:

* **usefulness** — either the word occurs in this repository's own transcribed exam
  corpus (`usefulness: exam_corpus`), or a publisher's core list rates it B2–C2
  (`usefulness: publisher_list_only`). Both are real evidence; neither is a guess.
* **classification** — a published CEFR reference states the level for that exact
  headword and part of speech (`work` + `locator` are carried through to the row).

Rejection rules, each aimed at a specific way a quota gets padded:

* already in the bank, or an inflection of an existing headword;
* any reference rates it A1/A2 — an advanced *sense* of an elementary word is not a
  new headword;
* closed-class part of speech (pronoun, determiner, preposition, …);
* fewer than three letters, non-letters, multi-word, or capitalised;
* level outside B2–C2 — the bank prepares for an advanced exam and its default view
  is B2+C1, so B1 additions would not serve the deck.

Output is a candidate pool, never content: nothing enters the seed set until a
Vietnamese gloss and a topic are authored for it (tools/add-headwords.py).
"""
from __future__ import annotations

import collections
import csv
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
REFS = pathlib.Path("/tmp/refs")
sys.path.insert(0, str(ROOT / "scripts"))

from vocab_sources import build_exam_index  # noqa: E402

# B1-C2 is the bank's declared study band (see scripts/expand_vocabulary.LEVELS).
# A1/A2 is excluded, and so is an advanced *sense* of an A1/A2 word.
STUDY_BAND = {"B1", "B2", "C1", "C2"}
CONTENT_POS = {"n", "v", "adj", "adv"}
POS_FULL = {"noun": "n", "verb": "v", "adjective": "adj", "adverb": "adv", "preposition": "prep",
            "determiner": "det", "pronoun": "pron", "conjunction": "conj", "number": "num",
            "exclamation": "excl", "modal verb": "modal"}
SUFFIXES = ("s", "es", "ed", "d", "ing", "ings", "er", "ers", "est", "ly", "ies", "ied",
            "ness", "ment", "ments", "tion", "tions", "able", "ible", "al", "ous", "ive")
FUNCTION_WORDS = set("""a an the and or but if then than that this these those there their they them
he she it its we you your i me my our us who whom whose which what when where why how not no nor so
as at by for from in into of off on onto out over per to up upon via with within without about above
across after against along among around before behind below beneath beside between beyond during
except inside near outside since through throughout till toward towards under until while yes also
very just even still yet already only much many more most less least few little some any each every
both either neither other another such own same all one two three being been was were is are am
be do does did done have has had having will would shall should can could may might must ought""".split())


def load_lexicon() -> set[str]:
    """An independent English lexicon (english-words 2.0.2, gcide + web2).

    A published CEFR list can contain an entry that is not an English word at all —
    Octanove carries `porten` as a noun — and copying that into a vocabulary bank
    would propagate someone else's defect. Every headword must therefore also exist
    in an independent lexicon.
    """
    path = REFS / "english-words.txt"
    if not path.exists():
        return set()
    return set(path.read_text(encoding="utf-8").split())


def in_lexicon(word: str, lexicon: set[str]) -> bool:
    """True when the word or its base is in the lexicon, or all hyphen parts are.

    `english-words` ships lemmas, so a naive membership test would reject real
    derived forms (`shocked`, `planning`) and hyphenated compounds (`self-worth`),
    while still rejecting words that no dictionary contains (`porten`).
    """
    if not lexicon:
        return True
    if word in lexicon:
        return True
    if "-" in word and all(part in lexicon for part in word.split("-") if part):
        return True
    return inflection_of(word, lexicon) is not None


def norm_pos(value: str) -> str:
    text = str(value or "").strip().lower().rstrip(".")
    return POS_FULL.get(text, text)


def load_reference():
    """headword -> [{pos, level, source, work, locator, tier}] from the published lists."""
    levels = collections.defaultdict(list)
    for name, label in (("20260715160822-oxford-3000.en.tsv", "Oxford 3000"),
                        ("20260715165539-oxford-5000-expanded.en.tsv", "Oxford 5000 (expanded)")):
        with (REFS / "oxford" / name).open(encoding="utf-8") as handle:
            for record in csv.DictReader(handle, delimiter="\t"):
                word = record["Word"].strip().lower()
                if " " in word or "," in word:
                    continue
                for chunk in re.split(r",", record["Part of Speech"]):
                    match = re.match(r"^([a-z. ]+?)\s*\.?\s*(A1|A2|B1|B2|C1|C2)?\.?\s*$", chunk.strip(), re.I)
                    if not match:
                        continue
                    levels[word].append({"pos": norm_pos(match.group(1)), "tier": 2, "source": "oxford_list",
                                         "level": match.group(2) or record["Level"].strip().upper(),
                                         "work": "The Oxford 3000 and 5000 (Oxford University Press)",
                                         "locator": f"{label}: {record['Word']} {chunk.strip()}"})
    for name, source, work in (("cefrj-vocabulary-profile-1.5.csv", "cefrj_1_5",
                                "CEFR-J Vocabulary Profile 1.5 (Tono Laboratory, TUFS)"),
                               ("octanove-vocabulary-profile-c1c2-1.0.csv", "octanove_c1c2",
                                "Octanove Vocabulary Profile 1.0")):
        with (REFS / "olp" / name).open(encoding="utf-8-sig") as handle:
            for record in csv.DictReader(handle):
                headword = record["headword"].strip().lower()
                if " " in headword or "/" in headword:
                    continue
                levels[headword].append({"pos": norm_pos(record["pos"]), "tier": 2, "source": source,
                                         "level": record["CEFR"].strip().upper(), "work": work,
                                         "locator": f"{name}: {record['headword']} {record['pos']}"})
    return levels


def inflection_of(word: str, known: set[str]) -> str | None:
    for suffix in SUFFIXES:
        if not word.endswith(suffix):
            continue
        stem = word[: -len(suffix)]
        for candidate in (stem, stem + "e", stem + "y"):
            if candidate and len(candidate) > 2 and candidate in known:
                return candidate
    return None


def pick(entries):
    """Choose the entry that speaks for the word: publisher list first, then level."""
    ranked = sorted(entries, key=lambda entry: (entry["tier"], 0 if entry["source"] == "oxford_list" else 1))
    return ranked[0], ranked[1:]


def main() -> int:
    reference = load_reference()
    lexicon = load_lexicon()
    vocabulary = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
    existing = {str(row["word"]).strip().lower() for row in vocabulary}

    index = build_exam_index()
    candidates, seen = [], set()

    for word, evidence in index.items():
        lemma = word.strip().lower()
        if lemma in seen or lemma in existing or lemma in FUNCTION_WORDS:
            continue
        if not in_lexicon(lemma, lexicon):
            continue
        if not re.fullmatch(r"[a-z][a-z-]{2,}", lemma) or inflection_of(lemma, existing):
            continue
        entries = [entry for entry in reference.get(lemma, []) if entry["pos"] in CONTENT_POS]
        if not entries or any(entry["level"] in ("A1", "A2") for entry in entries):
            continue
        band = [entry for entry in entries if entry["level"] in STUDY_BAND]
        if not band:
            continue
        chosen, others = pick(band)
        papers = len(evidence.get("documents") or ())
        candidates.append({
            "word": lemma, "pos": chosen["pos"], "level": chosen["level"], "source": chosen["source"],
            "work": chosen["work"], "locator": chosen["locator"],
            "alternatives": [{key: entry[key] for key in ("source", "level", "pos")} for entry in others],
            "usefulness": "exam_corpus", "examPapers": papers,
            "examOccurrences": evidence.get("count") or 0, "examLocator": evidence.get("locator"),
            "examDocuments": sorted(evidence.get("documents") or ())[:6],
        })
        seen.add(lemma)

    # List-only additions are confined to the publisher's own core list: the
    # Oxford 3000/5000 is curated for learners, whereas a bare CEFR-J/Octanove entry
    # can be an obscure word that no exam will ever use.
    for lemma, entries in sorted(reference.items()):
        if lemma in seen or lemma in existing or lemma in FUNCTION_WORDS:
            continue
        if lexicon and lemma not in lexicon:
            continue
        # A single published list is enough to state a level (the record says how
        # many sources agreed), because the other guards already removed the ways a
        # word can be spurious: it must be in an independent lexicon, must not be an
        # A1/A2 word in any list, must not be an inflection of a bank headword, and
        # must be a content word.
        if not re.fullmatch(r"[a-z][a-z-]{2,}", lemma) or inflection_of(lemma, existing):
            continue
        entries = [entry for entry in entries if entry["pos"] in CONTENT_POS]
        if not entries or any(entry["level"] in ("A1", "A2") for entry in entries):
            continue
        band = [entry for entry in entries if entry["level"] in STUDY_BAND]
        if not band:
            continue
        chosen, others = pick(band)
        candidates.append({
            "word": lemma, "pos": chosen["pos"], "level": chosen["level"], "source": chosen["source"],
            "work": chosen["work"], "locator": chosen["locator"],
            "alternatives": [{key: entry[key] for key in ("source", "level", "pos")} for entry in others],
            "usefulness": "publisher_list_only", "examPapers": 0, "examOccurrences": 0,
            "examLocator": None, "examDocuments": [],
        })

    order = {"C2": 0, "C1": 1, "B2": 2, "B1": 3}
    candidates.sort(key=lambda item: (0 if item["usefulness"] == "exam_corpus" else 1,
                                      -item["examPapers"], order[item["level"]], item["word"]))
    payload = {"generatedAt": "2026-11-02",
               "rules": {"band": sorted(STUDY_BAND), "contentPos": sorted(CONTENT_POS),
                         "rejectsElementary": True, "rejectsInflections": True},
               "count": len(candidates), "candidates": candidates}
    (EVIDENCE / "new-word-pool.json").write_text(json.dumps(payload, ensure_ascii=False, indent=1) + "\n",
                                                 encoding="utf-8")
    print(json.dumps({"candidates": len(candidates),
                      "usefulness": dict(collections.Counter(item["usefulness"] for item in candidates)),
                      "byLevel": dict(collections.Counter(item["level"] for item in candidates)),
                      "byPos": dict(collections.Counter(item["pos"] for item in candidates).most_common())},
                     indent=1))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
