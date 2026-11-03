#!/usr/bin/env python3
"""rc10 — join every vocabulary row to the reference lanes and decide its disposition.

Three lanes, in ascending authority:
  cefrj    cefrpy 1.0.3 index (CEFR-J), 97.5% coverage, deliberately divergent
           (frequency list, not dictionary annotation). Cross-check only.
  mirror   a third-party TSV transcription of the official Oxford 3000/5000
           lists. Its fidelity is *measured* against primary entries in
           evidence/reference-attestations.jsonl and reported, never assumed.
  primary  the publisher's own pages, read one entry at a time (Cambridge
           dictionary pages, Oxford list HTML). The only lane that may change a
           stored label.

Dispositions:
  conflict_primary_needed  a lane disagrees and no primary attestation exists yet
  confirmed_by_lanes       lanes agree with the stored label (still not verified)
  absent_everywhere        no lane covers the row
  attested                 a primary attestation exists (see reference-attestations.jsonl)
A row is only ever *changed* by the primary lane.
"""
import csv
import json
import pathlib
import re
import collections

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
MIRROR_FILES = (
    pathlib.Path("/tmp/oxq/20260715160822-oxford-3000.en.tsv"),
    pathlib.Path("/tmp/oxq/20260715165539-oxford-5000-expanded.en.tsv"),
)
MIRROR_URL = "https://github.com/voothi/20260715190122-oxford-3000-5000"
POSMAP = {"n": "n", "noun": "n", "v": "v", "verb": "v", "adj": "adj", "adjective": "adj",
          "adv": "adv", "adverb": "adv", "prep": "prep", "preposition": "prep",
          "conj": "conj", "pron": "pron", "det": "det", "exclamation": "excl",
          "number": "num", "modal verb": "modal", "indefinite article": "det"}
LEVELS = ("A1", "A2", "B1", "B2", "C1", "C2")


def norm_pos(value):
    return POSMAP.get(str(value or "").strip().lower(), str(value or "").strip().lower())


def parse_pos(field):
    out = []
    for chunk in re.split(r",", field):
        text = chunk.strip()
        if not text:
            continue
        match = re.match(r"^([a-z .]+?)\s*\.?\s*(A1|A2|B1|B2|C1|C2)?\.?\s*$", text, re.I)
        if not match:
            continue
        out.append((norm_pos(match.group(1)), match.group(2)))
    return out


def tag_value(row, prefix):
    for tag in row.get("tags") or []:
        key, _, value = str(tag).partition(":")
        if key == prefix:
            return value
    return None


def load_mirror():
    mirror = collections.defaultdict(list)
    for path in MIRROR_FILES:
        with path.open(encoding="utf-8") as handle:
            for record in csv.DictReader(handle, delimiter="\t"):
                for word in re.split(r",", record["Word"]):
                    word = word.strip().lower()
                    if not word:
                        continue
                    for pos, own in parse_pos(record["Part of Speech"]):
                        mirror[word].append({"pos": pos, "level": own or record["Level"].strip().upper()})
    return mirror


def main():
    mirror = load_mirror()
    crosscheck = {}
    for line in (EVIDENCE / "cefrj-crosscheck.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            record = json.loads(line)
            crosscheck[record["id"]] = record
    attested = {}
    path = EVIDENCE / "reference-attestations.jsonl"
    if path.exists():
        for line in path.read_text(encoding="utf-8").splitlines():
            if line.strip():
                record = json.loads(line)
                attested[record["id"]] = record

    vocabulary = json.loads((ROOT / "data" / "vocabulary.json").read_text(encoding="utf-8"))
    records = []
    for row in vocabulary:
        stored = (tag_value(row, "level") or "UNCLASSIFIED").upper()
        key = str(row["word"]).strip().lower()
        pos = norm_pos(row.get("pos"))
        mirror_hits = [c for c in mirror.get(key, []) if c["pos"] == pos]
        mirror_level = mirror_hits[0]["level"] if mirror_hits else None
        cross = crosscheck.get(row["id"], {})
        cross_level = cross.get("referenceLevel") if cross.get("evidenceStatus", "").startswith("crosscheck_") else None
        primary = attested.get(row["id"])

        lanes = {}
        if mirror_level:
            lanes["mirror"] = {"level": mirror_level, "agrees": mirror_level == stored}
        if cross_level:
            lanes["cefrj"] = {"level": cross_level, "agrees": cross_level == stored}
        if primary:
            lanes["primary"] = {"level": primary["referenceLabel"], "agrees": primary["referenceLabel"] == stored}

        agreeing = [name for name, lane in lanes.items() if lane["agrees"]]
        disagreeing = [name for name, lane in lanes.items() if not lane["agrees"]]
        if primary:
            disposition = "attested"
        elif disagreeing and "mirror" not in agreeing:
            disposition = "conflict_primary_needed" if lanes else "absent_everywhere"
        elif agreeing:
            disposition = "confirmed_by_lanes"
        else:
            disposition = "absent_everywhere"

        records.append({
            "kind": "vocabulary", "id": row["id"], "item": row["word"], "pos": row.get("pos"),
            "storedLevel": stored, "lanes": lanes, "laneCount": len(lanes),
            "agreeing": agreeing, "disagreeing": disagreeing,
            "disposition": disposition,
            "editable": int(row["id"]) > 913,
        })

    (EVIDENCE / "reference-join.jsonl").write_text(
        "".join(json.dumps(r, ensure_ascii=False) + "\n" for r in records), encoding="utf-8")

    def tally(predicate):
        return sum(1 for record in records if predicate(record))

    summary = {
        "generatedAt": "2026-11-02T00:00:00Z",
        "rows": len(records),
        "byDisposition": dict(collections.Counter(r["disposition"] for r in records)),
        "lanesAvailable": {
            "primary": tally(lambda r: "primary" in r["lanes"]),
            "mirror": tally(lambda r: "mirror" in r["lanes"]),
            "cefrj": tally(lambda r: "cefrj" in r["lanes"]),
        },
        "anyLane": tally(lambda r: r["laneCount"] > 0),
        "noLane": tally(lambda r: r["laneCount"] == 0),
        "conflictsByLane": {
            lane: tally(lambda r, lane=lane: lane in r["disagreeing"]) for lane in ("primary", "mirror", "cefrj")
        },
        "allLanesAgree": tally(lambda r: r["laneCount"] >= 2 and not r["disagreeing"]),
        "conflictEditable": tally(lambda r: r["disposition"] == "conflict_primary_needed" and r["editable"]),
        "conflictFrozen": tally(lambda r: r["disposition"] == "conflict_primary_needed" and not r["editable"]),
        "mirrorSource": MIRROR_URL,
        "promotions": 0,
        "note": "Only the primary lane may change a stored label; this join changes nothing by itself.",
    }
    (EVIDENCE / "reference-join-summary.json").write_text(
        json.dumps(summary, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
