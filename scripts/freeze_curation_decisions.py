#!/usr/bin/env python3
"""Freeze the curated vocabulary map into explicit per-row decisions.

The curation map states rules in terms of CEFR level. Applying those rules to live
tags couples two independent decisions: what a word's level is, and whether it is
in the learning deck. This script breaks the coupling.

It writes `docs/vocabulary-curation-decisions.json`: one record per row that is
outside the deck, naming the row ID, the word, the category, the exact rule that
proposed it and the reason. After that file exists, `vocabulary_curation` applies
*those* decisions and reports any rule that newly matches a row as a proposal for
review instead of acting on it — so correcting a CEFR level can never silently
add a word to, or remove it from, a learner's deck.

    python scripts/freeze_curation_decisions.py --check   # fail if the file is stale
    python scripts/freeze_curation_decisions.py          # write / extend the file
    python scripts/freeze_curation_decisions.py --accept-new   # also freeze new proposals

Without `--accept-new`, a rule that newly matches a row is an error: deck
membership is a curation decision, so it must be taken deliberately.
"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))

from learned_vocabulary import parse_table  # noqa: E402
from vocabulary_curation import (  # noqa: E402
    DECISIONS_PATH, SPEC_PATH, load_frozen, load_spec, matched_rows,
)
from audit_vocabulary_quality import seed_origin_map  # noqa: E402

NOTE = ("Curation decisions are frozen per row ID. They record a judgement about "
        "exam value, taken once and reviewed on purpose, and they travel "
        "independently of the row's CEFR tag: correcting a level never moves a "
        "row into or out of the learner's deck.")


def build(rows, spec, accept_new: bool):
    frozen = load_frozen()
    derived, problems = matched_rows(rows, spec, seed_origin_map())
    proposals = []
    for decision in derived.values():
        row_id = str(decision["id"])
        if frozen and row_id in frozen:
            continue
        proposals.append({
            "id": row_id,
            "word": decision["word"],
            "category": decision["category"],
            "reason": decision["reason"],
        })
    proposals.sort(key=lambda item: int(item["id"]))
    if problems:
        raise SystemExit("curation map problems: " + "; ".join(problems[:20]))
    if not frozen:
        decisions = proposals
        new = []
    else:
        kept = [dict(record) for record in frozen.values()]
        new = proposals if accept_new else []
        decisions = kept + new
    decisions.sort(key=lambda item: int(item["id"]))
    return decisions, proposals, new


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if the frozen file is stale")
    parser.add_argument("--accept-new", action="store_true",
                        help="freeze rows that a rule newly proposes (a deliberate curation act)")
    args = parser.parse_args(argv)

    rows = parse_table(ROOT / "Learned_Vocabulary_List.md")
    spec = load_spec(SPEC_PATH)
    decisions, proposals, new = build(rows, spec, args.accept_new)
    document = {
        "version": 1,
        "frozenAt": "2026-11-02",
        "generatedBy": "scripts/freeze_curation_decisions.py",
        "note": NOTE,
        "counts": {category: sum(1 for item in decisions if item["category"] == category)
                   for category in sorted({item["category"] for item in decisions})},
        "decisions": decisions,
    }
    rendered = json.dumps(document, ensure_ascii=False, indent=2) + "\n"

    if args.check:
        if not DECISIONS_PATH.exists():
            print("docs/vocabulary-curation-decisions.json is missing; run the script", file=sys.stderr)
            return 1
        if DECISIONS_PATH.read_text(encoding="utf-8") != rendered:
            print(f"Stale: {DECISIONS_PATH.name} ({len(decisions)} frozen decisions, "
                  f"{len(proposals) - len(new)} proposal(s) unfrozen)", file=sys.stderr)
            return 1
        print(f"Frozen curation decisions are current: {len(decisions)} archived rows.")
        return 0

    if proposals and not args.accept_new and DECISIONS_PATH.exists():
        print(f"{len(proposals)} row(s) newly match a curation rule and are NOT frozen, so "
              f"nothing happened to them. Review and re-run with --accept-new to archive them:",
              file=sys.stderr)
        for item in proposals[:20]:
            print(f"  id {item['id']} {item['word']} -> {item['category']} ({item['reason']})",
                  file=sys.stderr)
        return 1

    DECISIONS_PATH.write_text(rendered, encoding="utf-8")
    print(f"Wrote {len(decisions)} frozen curation decisions ({len(new)} newly accepted) "
          f"to {DECISIONS_PATH.relative_to(ROOT)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
