#!/usr/bin/env python3
"""Apply the sense-level CEFR model (scripts/cefr_senses.py) to data/vocabulary.json.

Deterministic and reversible: the `senses` field is fully derived from the bank
row plus the pinned reference snapshots in audit/v100/refs/, so re-running always
reproduces the same bytes, and deleting the field restores the legacy shape (the
runtime falls back to the headword-level `level:*` tag). Entry IDs, words,
meanings, tags, sources and every other field are never touched here.

Usage:
    python scripts/build_senses.py           # rewrite data/vocabulary.json in place
    python scripts/build_senses.py --check   # fail if the committed JSON is stale
    python scripts/build_senses.py --report  # also write the machine-readable audit
"""
from __future__ import annotations

import argparse
import json
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from cefr_senses import (  # noqa: E402
    CEFR_LEVELS,
    CONFIDENCE_LEVELS,
    EVIDENCE_CLASSES,
    References,
    classify_entry,
    validate_senses,
)

DEFAULT_JSON = ROOT / "data" / "vocabulary.json"
AUDIT_JSON = ROOT / "audit" / "v100" / "evidence" / "cefr-sense-audit.json"


def build_senses(data: list[dict], refs: References) -> tuple[list[dict], list[dict]]:
    result: list[dict] = []
    audit: list[dict] = []
    for entry in data:
        if not isinstance(entry, dict) or not isinstance(entry.get("id"), str):
            raise ValueError("vocabulary JSON contains an entry without a string id")
        senses = classify_entry(entry, refs)
        errors = validate_senses({**entry, "senses": senses})
        if errors:
            raise ValueError("; ".join(errors))
        new_entry = dict(entry)
        new_entry["senses"] = senses
        result.append(new_entry)
        legacy = next((t.split(":", 1)[1] for t in entry.get("tags", []) if isinstance(t, str) and t.startswith("level:")), None)
        audit.append({
            "id": entry["id"],
            "word": entry.get("word", ""),
            "pos": entry.get("pos", ""),
            "legacyLevelTag": legacy or "UNCLASSIFIED",
            "senseCount": len(senses),
            "senses": [
                {
                    "senseId": s["senseId"],
                    "label": s.get("label", ""),
                    "cefr": s["cefr"],
                    "evidence": s["evidence"],
                    "confidence": s["confidence"],
                    "needsIndependentValidation": s["needsIndependentValidation"],
                    "sources": [src["ref"] for src in s["sources"]],
                    "locators": [src.get("locator", "") for src in s["sources"]],
                }
                for s in senses
            ],
        })
    return result, audit


def summarize(audit: list[dict]) -> dict:
    by_level: Counter = Counter()
    by_evidence: Counter = Counter()
    by_confidence: Counter = Counter()
    multi = 0
    needs_validation = 0
    unresolved = 0
    for row in audit:
        if row["senseCount"] > 1:
            multi += 1
        for s in row["senses"]:
            by_level[s["cefr"]] += 1
            by_evidence[s["evidence"]] += 1
            by_confidence[s["confidence"]] += 1
            if s["needsIndependentValidation"]:
                needs_validation += 1
            if s["cefr"] == "UNCLASSIFIED":
                unresolved += 1
    return {
        "entries": len(audit),
        "senses": sum(r["senseCount"] for r in audit),
        "multiSenseEntries": multi,
        "byLevel": {lv: by_level.get(lv, 0) for lv in list(CEFR_LEVELS) + ["UNCLASSIFIED"]},
        "byEvidence": {ev: by_evidence.get(ev, 0) for ev in EVIDENCE_CLASSES},
        "byConfidence": {c: by_confidence.get(c, 0) for c in CONFIDENCE_LEVELS},
        "needsIndependentValidation": needs_validation,
        "unresolvedSenses": unresolved,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true")
    parser.add_argument("--report", action="store_true", help="also write the audit JSON")
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    args = parser.parse_args()

    refs = References()
    data = json.loads(args.json.read_text(encoding="utf-8"))
    if not isinstance(data, list):
        print("vocabulary JSON must be an array", file=sys.stderr)
        return 1
    expected, audit = build_senses(data, refs)
    serialized = json.dumps(expected, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        if args.json.read_text(encoding="utf-8") != serialized:
            print("vocabulary.json senses are out of sync; run python scripts/build_senses.py", file=sys.stderr)
            return 1
        summary = summarize(audit)
        print(f"senses in sync: {summary['entries']} entries, {summary['senses']} senses "
              f"({summary['multiSenseEntries']} multi-sense), unresolved={summary['unresolvedSenses']}")
        return 0

    args.json.write_text(serialized, encoding="utf-8")
    summary = summarize(audit)
    if args.report:
        AUDIT_JSON.parent.mkdir(parents=True, exist_ok=True)
        payload = {"schemaVersion": 1, "generatedBy": "scripts/build_senses.py", "summary": summary, "entries": audit}
        AUDIT_JSON.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"wrote senses for {summary['entries']} entries ({summary['senses']} senses, "
          f"{summary['multiSenseEntries']} multi-sense) to {args.json.relative_to(ROOT)}")
    print(json.dumps(summary, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
