#!/usr/bin/env python3
"""rc10 — write phrase-level corrections that a published list attests.

Only rows whose whole phrase is listed in a published CEFR reference can change
here (see tools/phrase-resolve.py for why constituents cannot decide a phrase).
"""
import argparse
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
SEEDS = ROOT / "data" / "phrase-seed"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    payload = json.loads((EVIDENCE / "phrase-corrections.json").read_text(encoding="utf-8"))
    targets = {item["item"].strip().lower(): item for item in payload["corrections"]}
    applied = []
    for path in sorted(SEEDS.glob("*.tsv")):
        lines = path.read_text(encoding="utf-8").splitlines(keepends=True)
        changed = False
        for index, line in enumerate(lines):
            if line.startswith("#") or not line.strip():
                continue
            fields = line.rstrip("\n").split("\t")
            if len(fields) < 6:
                continue
            record = targets.get(fields[0].strip().lower())
            if record is None:
                continue
            applied.append({**record, "file": path.name, "wasLevel": fields[5]})
            fields[5] = record["to"]
            lines[index] = "\t".join(fields) + "\n"
            changed = True
        if changed and not args.dry_run:
            path.write_text("".join(lines), encoding="utf-8")
    if applied and not args.dry_run:
        with (EVIDENCE / "corrections-applied.jsonl").open("a", encoding="utf-8") as handle:
            for item in applied:
                handle.write(json.dumps({"appliedAt": "2026-11-02", "kind": "phrase", "id": item["id"],
                                         "item": item["item"], "file": item["file"],
                                         "from": item["from"], "to": item["to"],
                                         "source": item["source"],
                                         "appliedBy": "audit/rc10/tools/apply-phrase-corrections.py"},
                                        ensure_ascii=False) + "\n")
    print(json.dumps({"dryRun": args.dry_run, "written": len(applied), "rows": applied},
                     indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
