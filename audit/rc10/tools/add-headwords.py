#!/usr/bin/env python3
"""rc10 — turn authored glosses into seed rows for verified new headwords.

The pool (`evidence/new-word-pool.json`) supplies what a script can know: the
headword, its part of speech, the published level and the exact reference entry,
plus the exam papers that use it. What a script cannot know is the Vietnamese
gloss and the topic, so those are authored per word in a batch file:

    word<TAB>Vietnamese gloss<TAB>topic

Each accepted row is written to `data/vocab-seed/21-exam-corpus-expansion.tsv`
with its level source in the optional eighth cell, and the evidence for the row is
recorded in `evidence/new-headword-evidence.jsonl` (reference work, locator, exam
locators). A word is refused if it is not in the pool, if its gloss is empty, if
the topic is not a slug, or if the row would duplicate an existing headword.

    python3 audit/rc10/tools/add-headwords.py --dry-run batch1.txt batch2.txt
    python3 audit/rc10/tools/add-headwords.py batch1.txt batch2.txt
"""
from __future__ import annotations

import argparse
import collections
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
SEED = ROOT / "data" / "vocab-seed" / "21-exam-corpus-expansion.tsv"
HEADER = ("# Exam-corpus expansion added by rc10 (P5).\n"
          "# word<TAB>pos<TAB>meaning<TAB>level<TAB>topic<TAB>type<TAB>skills<TAB>level_source\n")
SHORT = {"oxford_list": "oxford-3000-5000", "cefrj_1_5": "cefrj-vocabulary-profile-1.5",
         "octanove_c1c2": "octanove-vocabulary-profile-1.0"}
TOPIC_RE = re.compile(r"^[a-z][a-z-]{2,24}$")
POS_OK = {"n", "v", "adj", "adv", "prep", "conj", "pron", "det", "num", "modal", "excl"}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("batches", nargs="+", type=pathlib.Path)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    pool = {item["word"]: item for item in
            json.loads((EVIDENCE / "new-word-pool.json").read_text(encoding="utf-8"))["candidates"]}
    vocabulary = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
    taken = {str(row["word"]).strip().lower() for row in vocabulary}
    existing_rows = {}
    if SEED.exists():
        for line in SEED.read_text(encoding="utf-8").splitlines():
            if line.startswith("#") or not line.strip():
                continue
            existing_rows[line.split("\t")[0].strip().lower()] = line

    accepted, refused = [], []
    for path in args.batches:
        for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            cells = [cell.strip() for cell in line.split("\t")]
            if len(cells) != 3:
                refused.append({"line": f"{path.name}:{number}", "reason": "expected word, gloss, topic", "raw": line})
                continue
            word, gloss, topic = cells
            key = word.lower()
            if key not in pool:
                refused.append({"word": word, "reason": "not in the candidate pool"})
                continue
            if not gloss:
                refused.append({"word": word, "reason": "empty gloss"})
                continue
            if not TOPIC_RE.match(topic):
                refused.append({"word": word, "reason": f"topic {topic!r} is not a slug"})
                continue
            if key in taken and key not in existing_rows:
                refused.append({"word": word, "reason": "headword already in the bank"})
                continue
            if key in existing_rows:
                refused.append({"word": word, "reason": "already added in an earlier batch"})
                continue
            item = pool[key]
            pos = item["pos"]
            if pos not in POS_OK:
                refused.append({"word": word, "reason": f"part of speech {pos!r} unsupported"})
                continue
            kind = "academic" if topic == "academic" else "topic"
            skills = "reading,writing" if pos in {"n", "adj", "adv"} else "cloze,reading"
            row = "\t".join([word, pos, gloss, item["level"], topic, kind, skills,
                             SHORT.get(item["source"], item["source"])])
            accepted.append({"word": word, "line": row, "evidence": {
                "word": word, "pos": pos, "gloss": gloss, "topic": topic, "type": kind,
                "level": item["level"], "levelSource": SHORT.get(item["source"], item["source"]),
                "levelWork": item["work"], "levelLocator": item["locator"],
                "examDocuments": item["examDocuments"], "examPapers": item["examPapers"],
                "examOccurrences": item["examOccurrences"], "examLocator": item["examLocator"],
                "glossAuthorship": "editorial Vietnamese gloss authored for this row",
            }})
            taken.add(key)

    if accepted and not args.dry_run:
        lines = [HEADER] if not SEED.exists() else []
        lines += [entry["line"] + "\n" for entry in accepted]
        with SEED.open("a", encoding="utf-8") as handle:
            handle.write("".join(lines))
        with (EVIDENCE / "new-headword-evidence.jsonl").open("a", encoding="utf-8") as handle:
            for entry in accepted:
                handle.write(json.dumps(entry["evidence"], ensure_ascii=False) + "\n")

    print(json.dumps({"dryRun": args.dry_run, "accepted": len(accepted), "refused": len(refused),
                      "byLevel": dict(collections.Counter(entry["evidence"]["level"] for entry in accepted)),
                      "byPos": dict(collections.Counter(entry["evidence"]["pos"] for entry in accepted).most_common()),
                      "refusals": refused[:10]}, indent=1, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
