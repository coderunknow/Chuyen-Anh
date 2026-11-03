#!/usr/bin/env python3
"""rc10 — write the resolved CEFR level and its source into the seed set.

Reads `audit/rc10/evidence/reference-corrections.json` (produced by
`reference-resolve.py`) and writes each correction to the seed TSV: the level, and
an eighth cell naming the reference work that states it, so
`level-source:<work>` travels with the row instead of a blanket `editorial`.

Corrections for ids 1-913 are never written here: those rows are pinned by the dev4
evidence ledger and stay `pending_ledger` until that revision is recorded.

    python3 audit/rc10/tools/apply-resolutions.py --dry-run
    python3 audit/rc10/tools/apply-resolutions.py

Every applied correction is appended to `evidence/corrections-applied.jsonl` with
the source, the locator and the resolution kind, so the change is auditable after
the fact even though the seed file only stores the result.
"""
from __future__ import annotations

import argparse
import collections
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
SEEDS = ROOT / "data" / "vocab-seed"

SHORT_NAME = {
    "oxford_list": "oxford-3000-5000",
    "cefrj_1_5": "cefrj-vocabulary-profile-1.5",
    "octanove_c1c2": "octanove-vocabulary-profile-1.0",
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    payload = json.loads((EVIDENCE / "reference-corrections.json").read_text(encoding="utf-8"))
    corrections = {item["id"]: item for item in payload["corrections"]}
    applied, missing = [], []
    for path in sorted(SEEDS.glob("*.tsv")):
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
        changed = False
        for index, line in enumerate(lines):
            if line.startswith("#") or not line.strip():
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 4:
                continue
            record = None
            for item in corrections.values():
                if item["item"].strip().lower() == fields[0].strip().lower() and item["pos"] == fields[1].strip():
                    record = item
                    break
            if record is None:
                continue
            if record["id"] in {entry["id"] for entry in applied}:
                continue
            while len(fields) < 8:
                fields.append("")
            applied_before, level_before = record["from"], fields[3]
            fields[3] = record["to"]
            fields[7] = SHORT_NAME.get(record["source"], record["source"])
            lines[index] = "\t".join(fields) + "\n"
            changed = True
            applied.append({"id": record["id"], "item": fields[0], "pos": fields[1], "file": path.name,
                            "from": level_before, "to": record["to"], "source": fields[7],
                            "work": record["work"], "locator": record["locator"],
                            "resolution": record["resolution"], "dissent": record["dissent"],
                            "resolvedFrom": applied_before})
        if changed and not args.dry_run:
            path.write_text("".join(lines), encoding="utf-8")

    for item in corrections.values():
        if item["id"] not in {entry["id"] for entry in applied}:
            missing.append({"id": item["id"], "item": item["item"], "pos": item["pos"]})

    if applied and not args.dry_run:
        log = EVIDENCE / "corrections-applied.jsonl"
        with log.open("a", encoding="utf-8") as handle:
            for entry in applied:
                handle.write(json.dumps({
                    "appliedAt": "2026-11-02", "kind": "vocabulary", "id": entry["id"],
                    "item": entry["item"], "pos": entry["pos"], "file": entry["file"],
                    "from": entry["from"], "to": entry["to"],
                    "source": entry["source"], "work": entry["work"], "locator": entry["locator"],
                    "resolution": entry["resolution"], "dissent": entry["dissent"],
                    "appliedBy": "audit/rc10/tools/apply-resolutions.py",
                }, ensure_ascii=False) + "\n")

    print(json.dumps({"dryRun": args.dry_run, "written": len(applied),
                      "bySource": dict(collections.Counter(entry["source"] for entry in applied)),
                      "byTransition": dict(collections.Counter(f"{entry['from']}->{entry['to']}" for entry in applied).most_common()),
                      "notFoundInSeeds": len(missing),
                      "sample": missing[:5]}, indent=2, ensure_ascii=False))
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
