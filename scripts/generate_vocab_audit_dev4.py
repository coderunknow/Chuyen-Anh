#!/usr/bin/env python3
"""Retired dev4 audit generator.

This historical generator incorrectly promoted structurally valid rows to
"verified-compat" and could restore paraphrased excerpts as dictionary
evidence. It is intentionally non-generative so it cannot overwrite the
corrected dev4 evidence ledger. Use the source-led dev5 audit generator for the
current report, or inspect docs/vocabulary-audit-dev4.json as a historical
corrected ledger.
"""
import sys

MESSAGE = (
    "The dev4 audit generator is retired and will not write report files. "
    "Its historical implementation could recreate unsupported verification "
    "claims. Use `python scripts/generate_vocab_audit_dev5.py` for the current "
    "source-led report, or `python scripts/generate_vocab_audit_dev5.py --check` "
    "to validate it."
)

if __name__ == "__main__":
    print(MESSAGE, file=sys.stderr)
    raise SystemExit(2)
