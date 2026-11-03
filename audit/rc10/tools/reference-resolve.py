#!/usr/bin/env python3
"""rc10 — resolve every vocabulary row against the published CEFR references.

Why this replaces page-at-a-time inspection for the bulk of the bank: a CEFR
*level* claim is only worth anything if a citable source states it for that
headword and part of speech. Three published reference works state exactly that
and are openly released, so each row can be matched to a named entry instead of
being estimated. The publisher's own pages remain the tie-breaker for rows where
those lists disagree, and the per-entry pages already read are kept as the
highest-authority record.

Evidence tiers (highest first). A lower tier never overrides a higher one:

  1 `publisher_entry`  a dictionary entry page read for this headword+POS
                       (audit/rc10/evidence/manual-verifications.jsonl,
                       audit/rc10/evidence/oxford-wordlist.jsonl).
  2 `oxford_list`      *The Oxford 3000 and 5000*, Oxford University Press:
                       the publisher's own CEFR list, A1-C1.
  2 `cefrj_1_5`        CEFR-J Vocabulary Profile 1.5, Tono Laboratory (TUFS),
                       A1-B2, free with citation.
  2 `octanove_c1c2`    Octanove Vocabulary Profile 1.0, CC BY-SA 4.0, C1-C2.
  3 `cefrpy`           cefrpy 1.0.3, a frequency-derived reconstruction of
                       CEFR-J: cross-check only, never a level source.

A match requires the headword *and* the part of speech. A headword that only
appears under another part of speech is recorded as `pos_mismatch` and grants
nothing: `abstract adj B2` says nothing about the noun.

Dispositions (one per row, and every row gets one):

  verified_agree          tier 1-2 sources agree with the stored level
  verified_corrected      tier 1-2 sources agree on a different level; applied
  verified_precedence     sources disagree, the higher-precedence source is used
  verified_below_scope    attested A1/A2, outside the B1-C2 seed band; recorded
  pending_ledger          attested change, but the id is pinned by the dev4 ledger
  crosscheck_only         only frequency-derived evidence covers the row; the
                          editorial label is retained and said to be editorial
  no_reference            no consulted reference contains the headword+POS

Only `verified_corrected` rows change data. Nothing is deleted, no id moves.
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
LEGACY_LIMIT = 913

POS_FULL = {"noun": "n", "verb": "v", "adjective": "adj", "adverb": "adv",
            "preposition": "prep", "determiner": "det", "pronoun": "pron",
            "conjunction": "conj", "number": "num", "exclamation": "excl",
            "modal verb": "modal", "indefinite article": "det"}
POS_SHORT = {"n": "n", "v": "v", "adj": "adj", "adv": "adv", "prep": "prep",
             "det": "det", "pron": "pron", "conj": "conj", "num": "num",
             "excl": "excl", "modal": "modal"}


def norm_pos(value: str) -> str:
    value = str(value or "").strip().lower().rstrip(".")
    return POS_FULL.get(value, POS_SHORT.get(value, value))


def load_oxford():
    """Oxford 3000/5000 TSV: `n., v` and `adj.B1, n. B2` cells carry per-POS levels."""
    index = collections.defaultdict(list)
    for name, label in (("20260715160822-oxford-3000.en.tsv", "Oxford 3000"),
                        ("20260715165539-oxford-5000-expanded.en.tsv", "Oxford 5000 (expanded)")):
        with (REFS / "oxford" / name).open(encoding="utf-8") as handle:
            for record in csv.DictReader(handle, delimiter="\t"):
                for word in re.split(r",", record["Word"]):
                    word = word.strip().lower()
                    if not word:
                        continue
                    for chunk in re.split(r",", record["Part of Speech"]):
                        match = re.match(r"^([a-z. ]+?)\s*\.?\s*(A1|A2|B1|B2|C1|C2)?\.?\s*$",
                                         chunk.strip(), re.I)
                        if not match:
                            continue
                        level = match.group(2) or record["Level"].strip().upper()
                        index[word].append({"pos": norm_pos(match.group(1)), "level": level,
                                            "source": "oxford_list", "work": "The Oxford 3000 and 5000 (Oxford University Press)",
                                            "locator": f"{label}: {word} {match.group(1).strip()}", "tier": 2})
    return index


def load_olp():
    index = collections.defaultdict(list)
    for name, source, work, licence in (
        ("cefrj-vocabulary-profile-1.5.csv", "cefrj_1_5",
         "CEFR-J Vocabulary Profile 1.5 (Tono Laboratory, TUFS)", "free with citation"),
        ("octanove-vocabulary-profile-c1c2-1.0.csv", "octanove_c1c2",
         "Octanove Vocabulary Profile 1.0 (C1/C2)", "CC BY-SA 4.0"),
    ):
        with (REFS / "olp" / name).open(encoding="utf-8-sig") as handle:
            for record in csv.DictReader(handle):
                for word in record["headword"].strip().lower().split("/"):
                    word = word.strip()
                    if not word:
                        continue
                    index[word].append({"pos": norm_pos(record["pos"]), "level": record["CEFR"].strip().upper(),
                                        "source": source, "work": work, "licence": licence,
                                        "locator": f"{name}: {record['headword']} {record['pos']}", "tier": 2})
    return index


def load_crosscheck():
    path = EVIDENCE / "cefrj-crosscheck.jsonl"
    records = {}
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                row = json.loads(line)
                records[row["id"]] = row
    return records


def load_primary():
    """Per-entry publisher-page evidence already read for this branch."""
    primary = collections.defaultdict(list)
    for name in ("manual-verifications.jsonl", "oxford-wordlist.jsonl"):
        path = EVIDENCE / name
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            row = json.loads(line)
            if row.get("kind") not in (None, "vocabulary"):
                continue
            if name == "oxford-wordlist.jsonl":
                primary[(row["word"].strip().lower(), norm_pos(row["pos"]))].append({
                    "pos": norm_pos(row["pos"]), "level": row["level"], "source": "publisher_entry",
                    "work": row["source"], "url": row["entryUrl"], "locator": row["locator"],
                    "retrieved": row["retrieved"], "tier": 1})
            elif row.get("referenceLabel"):
                primary[(row["item"].strip().lower(), norm_pos(row.get("pos")))].append({
                    "pos": norm_pos(row.get("pos")), "level": row["referenceLabel"], "source": "publisher_entry",
                    "work": row.get("reference"), "url": row.get("url"),
                    "locator": row.get("sense") or row.get("url"), "retrieved": row.get("retrieved"), "tier": 1})
    return primary


def tag_value(row, prefix):
    for tag in row.get("tags") or []:
        key, _, value = str(tag).partition(":")
        if key == prefix:
            return value
    return None


def main() -> int:
    oxford, olp, cross = load_oxford(), load_olp(), load_crosscheck()
    primary = load_primary()
    vocabulary = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))

    records, corrections = [], []
    counts = collections.Counter()
    for row in vocabulary:
        word, pos = str(row["word"]).strip().lower(), norm_pos(row.get("pos"))
        stored = (tag_value(row, "level") or "UNCLASSIFIED").upper()
        candidates = list(primary.get((word, pos), []))
        for lane in (oxford, olp):
            candidates.extend(entry for entry in lane.get(word, []) if entry["pos"] == pos)
        # A headword present only under another part of speech is information, not evidence.
        other_pos = sorted({entry["pos"] for lane in (oxford, olp) for entry in lane.get(word, [])} - {pos})
        candidates.sort(key=lambda entry: (entry["tier"], 0 if entry["source"] == "oxford_list" else 1))

        record = {
            "kind": "vocabulary", "id": row["id"], "item": row["word"], "pos": row.get("pos"),
            "posNormalized": pos, "storedLevel": stored,
            "editable": int(row["id"]) > LEGACY_LIMIT,
            "candidates": [{key: entry[key] for key in ("source", "work", "level", "locator") if key in entry}
                           | ({"url": entry["url"]} if "url" in entry else {})
                           for entry in candidates],
            "posMismatchOnly": other_pos if not candidates else [],
        }

        if not candidates:
            cross_row = cross.get(row["id"], {})
            if cross_row.get("referenceLevel"):
                record.update(disposition="crosscheck_only",
                              effectiveLevel=stored,
                              reason=(f"No published CEFR list places '{row['word']}' as {row.get('pos')}. "
                                      f"The frequency-derived index suggests {cross_row['referenceLevel']}; "
                                      "the editorial label is kept and remains marked editorial."))
                counts["crosscheck_only"] += 1
            else:
                record.update(disposition="no_reference", effectiveLevel=stored,
                              reason=(f"No consulted reference contains '{row['word']}' as {row.get('pos')}; "
                                      "the editorial label is kept and remains marked editorial."))
                counts["no_reference"] += 1
            records.append(record)
            continue

        top_tier = min(entry["tier"] for entry in candidates)
        top = [entry for entry in candidates if entry["tier"] == top_tier]
        distinct = {entry["level"] for entry in top}
        chosen = top[0]
        record["dissent"] = sorted({f"{entry['source']}:{entry['level']}" for entry in top}) if len(distinct) > 1 else []

        if len(distinct) == 1:
            disposition = "verified_agree" if chosen["level"] == stored else "verified_corrected"
            record["resolution"] = "unanimous" if len(top) > 1 else "single_source"
        else:
            disposition = "verified_precedence"
            record["resolution"] = "precedence"
        attested = chosen["level"]
        record["disposition"] = disposition
        record.update(effectiveLevel=attested,
                      chosenSource=chosen["source"], chosenWork=chosen["work"],
                      chosenLocator=chosen["locator"])

        if attested not in STUDY_SCOPE:
            record.update(disposition="verified_below_scope",
                          reason=f"Attested {attested}, below the B1-C2 seed band; recorded, not written.")
            counts["verified_below_scope"] += 1
        elif disposition == "verified_agree":
            record["reason"] = f"{chosen['work']} states {attested} for this headword and part of speech."
            counts["verified_agree"] += 1
        elif not record["editable"]:
            record.update(disposition="pending_ledger",
                          reason=(f"Attested {attested} (stored {stored}); ids 1-{LEGACY_LIMIT} are pinned by "
                                  "tests/test_vocabulary_audit_dev4.py until the ledger revision is recorded."))
            counts["pending_ledger"] += 1
        else:
            record["reason"] = (f"{chosen['work']} states {attested} for this headword and part of speech; "
                                f"the row carried the editorial estimate {stored}."
                                + (f" Other sources said {', '.join(record['dissent'])}." if record["dissent"] else ""))
            counts[disposition] += 1
            corrections.append({"id": row["id"], "item": row["word"], "pos": row.get("pos"), "from": stored,
                                "to": attested, "source": chosen["source"], "work": chosen["work"],
                                "locator": chosen["locator"], "resolution": record["resolution"],
                                "dissent": record["dissent"]})
        records.append(record)

    out = EVIDENCE / "reference-resolutions.jsonl"
    out.write_text("".join(json.dumps(record, ensure_ascii=False) + "\n" for record in records), encoding="utf-8")
    (EVIDENCE / "reference-corrections.json").write_text(
        json.dumps({"generatedAt": "2026-11-02", "count": len(corrections),
                    "bySource": dict(collections.Counter(item["source"] for item in corrections)),
                    "byTransition": dict(collections.Counter(f"{item['from']}->{item['to']}" for item in corrections)),
                    "corrections": corrections}, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")

    summary = {"rows": len(records), "dispositions": dict(counts.most_common()),
               "corrections": len(corrections),
               "correctionsBySource": dict(collections.Counter(item["source"] for item in corrections)),
               "rowsWithDissent": sum(1 for record in records if record.get("dissent")),
               "posMismatchOnly": sum(1 for record in records if record["posMismatchOnly"])}
    (EVIDENCE / "reference-resolutions-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
