#!/usr/bin/env python3
"""rc10 — turn authored phrase rows into seed rows for verified new phrases (P6).

The pool (`evidence/new-phrase-pool.json`) supplies what a script can know: the
phrase, the exam papers that contain it (document + line), the level bound from
its constituents, and each constituent's own reference entry and source. What a
script cannot know is the Vietnamese meaning, the usage note, the grammar
pattern, the topic and the skills, so those are authored per phrase in a batch
file:

    phrase<TAB>type<TAB>meaning<TAB>usage<TAB>pattern<TAB>topic<TAB>skills

`level` is **not** authored: it comes from the pool's constituent bound, so no
row can quietly claim a band its own words do not support. Each accepted row is
appended to `data/phrase-seed/07-rc10-expansion.tsv` and its evidence is written
to `evidence/new-phrase-evidence.jsonl` (constituent sources, corpus locators,
authorship). A row is refused when the phrase is not in the pool, when its
type/skills/topic is not allowed, when a field is empty, when a phrasal verb is
not actually verb + particle, or when it would duplicate a bank phrase.

    python3 audit/rc10/tools/add-phrases.py --dry-run batch1.txt
    python3 audit/rc10/tools/add-phrases.py batch1.txt
"""
from __future__ import annotations

import argparse
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
sys.path.insert(0, str(ROOT / "scripts"))

from phrase_bank import TYPES, phrase_key  # noqa: E402

EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
POOL = EVIDENCE / "new-phrase-pool.json"
SEED = ROOT / "data" / "phrase-seed" / "07-rc10-expansion.tsv"
HEADER = ("# rc10 P6 expansion: phrases that occur in a transcribed paper and whose\n"
          "# level is bounded by published constituent entries (collocation / idiom /\n"
          "# phrasal verb / dependent preposition). Level is derived, never authored.\n"
          "# phrase<TAB>type<TAB>meaning<TAB>usage<TAB>pattern<TAB>level<TAB>topic<TAB>skills\n")
TOPIC_RE = re.compile(r"^[a-z][a-z-]{2,24}$")
SKILLS = {"reading", "writing", "cloze", "sentence-transformation", "grammar", "word-formation"}
PARTICLES = set("""up down out in on off over through back away along apart around about by for
into with to at after across ahead aside forth together under upon without behind forward
within throughout""".split())
COLUMNS = 7


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("batches", nargs="+", type=pathlib.Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pool = {row["key"]: row for row in json.loads(POOL.read_text(encoding="utf-8"))["candidates"]}
    taken = {phrase_key(row["phrase"]) for row in
             json.loads((ROOT / "data" / "phrases.json").read_text(encoding="utf-8"))}
    accepted: list[dict[str, object]] = []
    refused: list[dict[str, str]] = []
    for path in args.batches:
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cells = [cell.strip() for cell in line.split("\t")]
            where = f"{path.name}:{number}"
            if len(cells) != COLUMNS:
                refused.append({"where": where, "phrase": cells[0], "reason": f"expected {COLUMNS} cells, found {len(cells)}"})
                continue
            phrase, kind, meaning, usage, pattern, topic, skills = cells
            key = phrase_key(phrase)
            if not key:
                refused.append({"where": where, "phrase": phrase, "reason": "empty phrase"})
                continue
            if key in taken:
                refused.append({"where": where, "phrase": phrase, "reason": "phrase already in the bank"})
                continue
            item = pool.get(key)
            if item is None:
                refused.append({"where": where, "phrase": phrase, "reason": "not in the candidate pool"})
                continue
            if kind not in TYPES:
                refused.append({"where": where, "phrase": phrase, "reason": f"type {kind!r} is not one of {list(TYPES)}"})
                continue
            if not (meaning and usage and pattern):
                refused.append({"where": where, "phrase": phrase, "reason": "meaning, usage and pattern must all be authored"})
                continue
            if not TOPIC_RE.match(topic):
                refused.append({"where": where, "phrase": phrase, "reason": f"topic {topic!r} is not a lowercase slug"})
                continue
            skill_list = [skill.strip() for skill in skills.split(",") if skill.strip()]
            if not skill_list or any(skill not in SKILLS for skill in skill_list):
                refused.append({"where": where, "phrase": phrase, "reason": f"skills {skills!r} must be a subset of {sorted(SKILLS)}"})
                continue
            if len(key.split()) < 2:
                refused.append({"where": where, "phrase": phrase, "reason": "single words belong in the vocabulary table"})
                continue
            tokens = key.split()
            if kind == "phrasal-verb" and not (tokens[-1] in PARTICLES and 2 <= len(tokens) <= 3):
                refused.append({"where": where, "phrase": phrase, "reason": "a phrasal verb must be a verb plus a particle"})
                continue
            if kind != "phrasal-verb" and item["typeHint"] == "phrasal-verb" and kind not in ("idiom", "fixed-expression"):
                refused.append({"where": where, "phrase": phrase,
                                "reason": "this candidate is a verb + particle: type it phrasal-verb (or explicitly idiom)"})
                continue
            taken.add(key)
            accepted.append({
                "line": "\t".join([phrase, kind, meaning, usage, pattern, item["level"], topic, ",".join(skill_list)]),
                "evidence": {
                    "phrase": phrase,
                    "type": kind,
                    "level": item["level"],
                    "levelBasis": item["levelBasis"],
                    "hardestConstituent": item["hardestConstituent"],
                    "constituents": item["constituents"],
                    "corpusPapers": item["corpusPapers"],
                    "corpusDocuments": item["corpusDocuments"],
                    "corpusLocators": item["corpusLocators"],
                    "meaningAuthorship": "editorial Vietnamese meaning and usage note authored for this row",
                    "batch": f"{path.name}:{number}",
                },
            })

    if accepted and not args.dry_run:
        lines = [HEADER] if not SEED.exists() else []
        lines += [entry["line"] + "\n" for entry in accepted]
        with SEED.open("a", encoding="utf-8") as handle:
            handle.write("".join(lines))
        with (EVIDENCE / "new-phrase-evidence.jsonl").open("a", encoding="utf-8") as handle:
            for entry in accepted:
                handle.write(json.dumps(entry["evidence"], ensure_ascii=False) + "\n")

    print(json.dumps({"dryRun": args.dry_run, "accepted": len(accepted), "refused": len(refused),
                      "byType": dict(collections.Counter(entry["evidence"]["type"] for entry in accepted)),
                      "byLevel": dict(collections.Counter(entry["evidence"]["level"] for entry in accepted)),
                      "refusals": refused[:12]}, indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
