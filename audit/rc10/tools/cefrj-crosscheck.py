#!/usr/bin/env python3
"""rc10 cross-check lane — compare every row's stored CEFR label with an offline index.

Why this exists: primary attestation (a dictionary or official word list read one
entry at a time) is the only evidence that can promote a label, but it costs a
network round trip per entry. This lane runs *every* row against a compiled
reference index so that no row is left with zero reference evidence, and so the
disagreements that deserve primary attestation are discoverable instead of
sampled. It never promotes a label: rows it agrees with stay
`machine_assessed`, and rows it disagrees with become `crosscheck_conflict`.

Reference (pinned, open source, MIT):
  package   cefrpy==1.0.3   https://pypi.org/project/cefrpy/1.0.3/
  upstream  https://github.com/Maximax67/cefrpy
  data.bin  sha256 21866e2f58a859ca5d62d402c850729ef0919b0ff673384fd6d1437bdc9f6a38
  derived from CEFR-J (https://cefr-j.org/) plus Google Books 1-gram frequencies.
CEFR-J is a frequency-ordered learner list, not a dictionary entry annotation, so
its level for a word can sit one or two bands away from a dictionary's. That is
exactly why agreement is recorded per row and never treated as verification.

Reproduce:
  pip download --no-deps --no-binary :all: -d /tmp/pdl cefrpy==1.0.3
  tar xzf /tmp/pdl/cefrpy-1.0.3.tar.gz -C /tmp/cefrpy --strip-components=1
  PYTHONPATH=/tmp/cefrpy/src python3 audit/rc10/tools/cefrj-crosscheck.py
"""
import collections
import hashlib
import json
import os
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
DATA_BIN = pathlib.Path("/tmp/cefrpy/src/cefrpy/data.bin")
EXPECTED_SHA = "21866e2f58a859ca5d62d402c850729ef0919b0ff673384fd6d1437bdc9f6a38"
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")
# Our own part-of-speech codes mapped to the index's Penn Treebank tags, in the
# order they are preferred when a word has several tags in the same family.
OUR_TO_PTB = {
    "n": ("NN", "NNS", "NNP", "NNPS"),
    "v": ("VB", "VBP", "VBZ", "VBD", "VBG", "VBN"),
    "adj": ("JJ", "JJR", "JJS"),
    "adv": ("RB", "RBR", "RBS"),
    "prep": ("IN", "TO"),
    "conj": ("CC", "IN"),
    "pron": ("PRP", "PRP$", "WP"),
    "det": ("DT", "PDT", "WDT"),
    "num": ("CD",),
}

from cefrpy import CEFRAnalyzer  # noqa: E402


def tag_value(row, prefix):
    for tag in row.get("tags") or []:
        key, _, value = str(tag).partition(":")
        if key == prefix:
            return value
    return None


def main():
    if not DATA_BIN.exists():
        sys.exit("cefrpy data.bin missing — see the reproduction steps in this file's docstring")
    digest = hashlib.sha256(DATA_BIN.read_bytes()).hexdigest()
    if digest != EXPECTED_SHA:
        sys.exit(f"cefrpy data.bin sha256 {digest} does not match the pinned {EXPECTED_SHA}")

    analyzer = CEFRAnalyzer()
    vocabulary = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))

    records, agree, conflict, absent, pos_mismatch = [], 0, 0, 0, 0
    for row in vocabulary:
        word = str(row["word"]).strip().lower()
        stored = (tag_value(row, "level") or "UNCLASSIFIED").upper()
        if not analyzer.is_word_in_database(word):
            absent += 1
            records.append({
                "kind": "vocabulary", "id": row["id"], "item": row["word"], "pos": row.get("pos"),
                "storedLevel": stored, "referenceLevel": None, "evidenceStatus": "crosscheck_absent",
                "reference": "cefrpy 1.0.3 (CEFR-J index)",
                "reasoning": "The headword is not in the compiled index, so this lane says nothing about it.",
            })
            continue
        per_pos = {str(pos): (level if isinstance(level, str) else level.name)
                   for pos, level in analyzer.get_pos_level_dict_for_word(word).items()}
        family = OUR_TO_PTB.get(str(row.get("pos") or "").lower(), ())
        exact = next((per_pos[tag] for tag in family if tag in per_pos), None)
        picked = exact
        if picked is None:
            pos_mismatch += 1
            picked = max(per_pos.values(), key=lambda value: LEVELS.index(value) if value in LEVELS else -1)
        agreed = picked == stored
        agree += agreed
        conflict += not agreed
        records.append({
            "kind": "vocabulary", "id": row["id"], "item": row["word"], "pos": row.get("pos"),
            "storedLevel": stored, "referenceLevel": picked, "posLevels": per_pos,
            "posExact": exact is not None,
            "evidenceStatus": "crosscheck_agrees" if agreed else "crosscheck_conflict",
            "reference": "cefrpy 1.0.3 (CEFR-J index)",
            "referenceUrl": "https://pypi.org/project/cefrpy/1.0.3/",
            "reasoning": (
                f"Compiled index level {picked} matches the stored {stored}; cross-check only, not an attestation."
                if agreed else
                f"Compiled index level {picked} differs from the stored {stored}; queued for primary attestation."
            ),
        })

    (EVIDENCE / "cefrj-crosscheck.jsonl").write_text(
        "".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records), encoding="utf-8")
    summary = {
        "generatedAt": "2026-11-02T00:00:00Z",
        "reference": "cefrpy 1.0.3 (CEFR-J index)",
        "referenceUrl": "https://pypi.org/project/cefrpy/1.0.3/",
        "dataSha256": digest,
        "indexWords": analyzer.get_total_words(),
        "rows": len(vocabulary),
        "covered": len(vocabulary) - absent,
        "absent": absent,
        "agree": agree,
        "conflict": conflict,
        "posExactMatch": len(vocabulary) - absent - pos_mismatch,
        "posFallback": pos_mismatch,
        "conflictByStored": dict(collections.Counter(
            record["storedLevel"] for record in records if record["evidenceStatus"] == "crosscheck_conflict")),
        "promotions": 0,
        "note": "No stored label was changed by this lane; conflicts are queued for primary attestation.",
    }
    (EVIDENCE / "cefrj-crosscheck-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
