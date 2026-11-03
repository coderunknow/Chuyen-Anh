#!/usr/bin/env python3
"""rc10 — apply corrections that have a PRIMARY attestation to the seed set.

Only rows whose correction is supported by a publisher page (see
evidence/reference-attestations.jsonl, decision "correct") are written. Rows in
the frozen dev4 ledger (ids 1–913) are never touched: their corrections stay in
the log as `correct_pending_ledger` until the ledger revision exists.

Two further dispositions are recorded instead of written:
  frozen_ledger      id <= 913 — the dev4 audit ledger pins those rows.
  below_study_scope  the reference says A1/A2, but the seed set (and therefore
                     the study surface) is deliberately B1–C2. The row keeps its
                     label and the attestation is reported; rewriting it would
                     silently widen a scope the project decided against.
  blocked            evidence/correction-blocks.jsonl records a reason not to
                     apply a correction yet (for example the level change would
                     trigger a curation rule and archive the row). Blocks are
                     append-only and name the exact row and the next step.

The seed TSV is the single source of truth for ids 914+, so the level is changed
there and `scripts/expand_vocabulary.py` re-materialises the Markdown table. Run
with --dry-run to see the intended edits without writing.

  python3 audit/rc10/tools/apply-attested-corrections.py --dry-run
  python3 audit/rc10/tools/apply-attested-corrections.py
"""
import argparse
import json
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[3]
EVIDENCE = ROOT / "audit" / "rc10" / "evidence"
SEEDS = ROOT / "data" / "vocab-seed"
STUDY_SCOPE = ("B1", "B2", "C1", "C2")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    attestations = [json.loads(line) for line in
                    (EVIDENCE / "reference-attestations.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    blocks_path = EVIDENCE / "correction-blocks.jsonl"
    # A block is only a block while it is unresolved: records that carry a
    # `resolution` were fixed and their correction is applied like any other.
    blocked = set()
    if blocks_path.exists():
        for line in blocks_path.read_text(encoding="utf-8").splitlines():
            if not line.strip():
                continue
            record = json.loads(line)
            if not record.get("resolution"):
                blocked.add(record["id"])
    targets = [record for record in attestations
               if record["decision"] == "correct" and not record["ledgerFrozen"] and record["id"] not in blocked]
    if not targets:
        print("no primary-attested corrections to apply")
        return 0

    below_scope = [{"id": record["id"], "item": record["item"], "pos": record["pos"],
                    "storedLevel": record["storedLevel"], "referenceLabel": record["referenceLabel"]}
                   for record in targets if record["newLevel"] not in STUDY_SCOPE]
    targets = [record for record in targets if record["newLevel"] in STUDY_SCOPE]
    wanted = {(record["item"].strip().lower(), record["pos"]): record for record in targets}
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
            key = (fields[0].strip().lower(), fields[1].strip())
            record = wanted.get(key)
            if record is None or record["id"] in {item["id"] for item in applied}:
                continue
            old = fields[3]
            fields[3] = record["newLevel"]
            lines[index] = "\t".join(fields) + "\n"
            changed = True
            applied.append({"id": record["id"], "item": fields[0], "pos": fields[1],
                            "file": path.name, "from": old, "to": record["newLevel"],
                            "evidence": record["entryUrl"]})
        if changed and not args.dry_run:
            path.write_text("".join(lines), encoding="utf-8")

    for record in targets:
        key = (record["item"].strip().lower(), record["pos"])
        if not any(item["id"] == record["id"] for item in applied):
            missing.append({"id": record["id"], "item": record["item"], "pos": record["pos"]})

    if applied and not args.dry_run:
        # Append-only history of what this tool changed, so a later run that finds
        # the seed already corrected can still prove when and why it changed.
        log = EVIDENCE / "corrections-applied.jsonl"
        with log.open("a", encoding="utf-8") as handle:
            for item in applied:
                handle.write(json.dumps({
                    "appliedAt": "2026-11-02", "kind": "vocabulary", "id": item["id"],
                    "item": item["item"], "pos": item["pos"], "file": item["file"],
                    "from": item["from"], "to": item["to"], "evidence": item["evidence"],
                    "appliedBy": "audit/rc10/tools/apply-attested-corrections.py",
                }, ensure_ascii=False) + "\n")

    report = {"dryRun": args.dry_run, "written": len(applied), "appliedRows": applied,
              "belowStudyScope": below_scope, "blockedIds": sorted(blocked), "notFoundInSeeds": missing}
    print(json.dumps(report, indent=2, ensure_ascii=False))
    return 0 if not missing else 1


if __name__ == "__main__":
    raise SystemExit(main())
