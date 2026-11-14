#!/usr/bin/env bash
# Re-acquire the published CEFR reference snapshots used by the v1.0.0 sense-level
# classification (scripts/cefr_senses.py). Only github.com / codeload.github.com are
# reachable from the sandbox; the immutable commit SHAs below are the exact snapshots
# the committed files in this directory were taken from. Acquired files are verified
# against fixed SHA-256 digests in a staging directory before replacing the committed
# snapshots, preserving byte-for-byte reproduction.
set -euo pipefail
cd "$(dirname "$0")"

OLP_SHA="d4e45b75b38f27b30dfc5c44d8c571aec7e7092f"
OXFORD_SHA="9596732954b9c4db9a6c999ff0291dabefce6d24"
WCD_SHA="c05858cf109efbc81775d86908a873ca54fa85ff"

STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT

fetch() { # url out
  curl -fsSL "$1" -o "$2"
}

# Open Language Profiles (OLP) English profiles — CEFR-J Vocabulary Profile 1.5 and
# the Octanove C1/C2 vocabulary profile, as published by the CEFR-J project.
fetch "https://codeload.github.com/openlanguageprofiles/olp-en-cefrj/tar.gz/${OLP_SHA}" "$STAGE/olp-cefrj.tgz"
tar xzf "$STAGE/olp-cefrj.tgz" -C "$STAGE"
cp "$STAGE/olp-en-cefrj-${OLP_SHA}/cefrj-vocabulary-profile-1.5.csv" "$STAGE/cefrj-vocabulary-profile-1.5.csv"
cp "$STAGE/olp-en-cefrj-${OLP_SHA}/octanove-vocabulary-profile-c1c2-1.0.csv" "$STAGE/octanove-vocabulary-profile-c1c2-1.0.csv"

# Oxford 3000 / Oxford 5000 wordlists (Oxford Learner's Dictionaries), with per-sense
# CEFR level columns, via the curated TSV mirror.
fetch "https://codeload.github.com/voothi/20260715190122-oxford-3000-5000/tar.gz/${OXFORD_SHA}" "$STAGE/oxford.tgz"
tar xzf "$STAGE/oxford.tgz" -C "$STAGE"
cp "$STAGE/20260715190122-oxford-3000-5000-${OXFORD_SHA}/20260715160822-oxford-3000.en.tsv" "$STAGE/oxford-3000.en.tsv"
cp "$STAGE/20260715190122-oxford-3000-5000-${OXFORD_SHA}/20260715165539-oxford-5000-expanded.en.tsv" "$STAGE/oxford-5000-expanded.en.tsv"

# Corpus frequency index (COCA-based ranks) — cross-check/editorial banding only,
# never a level source. Top 30k ranks are committed; the full file is 172k rows.
fetch "https://codeload.github.com/Maximax67/Words-CEFR-Dataset/tar.gz/${WCD_SHA}" "$STAGE/wcd.tgz"
tar xzf "$STAGE/wcd.tgz" -C "$STAGE"
head -n 30000 "$STAGE/Words-CEFR-Dataset-${WCD_SHA}/datasets/valid_words_sorted_by_frequency.csv" > "$STAGE/frequency-top30k.csv"
cp "cambridge-evp-verified.tsv" "$STAGE/cambridge-evp-verified.tsv"

(
  cd "$STAGE"
  sha256sum -c - <<'SHA256'
b0dd3c635f1c9a4fdf1490c7e5b7c48e8bbe55b652ad0c9860a95f98e10ae498  cefrj-vocabulary-profile-1.5.csv
18c33a407f2f89f7b8de9671c6d45fe3ea0bce45e7d2d7dcaab48d73e0f7b380  octanove-vocabulary-profile-c1c2-1.0.csv
1a2b9dca943a3664dea37d2c2b0104418ff77e1ec7b1b56b4b9028d404f5b2b9  oxford-3000.en.tsv
177027432999f79304eeaabc33328764d1b8ff048f021b0afe7c065fc4df83d9  oxford-5000-expanded.en.tsv
9f19d2701d5d59c837c69be22edf44c83af5425c0801a473868d3bb29c1cdb27  frequency-top30k.csv
cf4327ffc401a6a88bd5a040af24ff504fc8827f97c64784c612740b873fb083  cambridge-evp-verified.tsv
SHA256
)

for f in cefrj-vocabulary-profile-1.5.csv octanove-vocabulary-profile-c1c2-1.0.csv \
         oxford-3000.en.tsv oxford-5000-expanded.en.tsv frequency-top30k.csv; do
  mv "$STAGE/$f" "$f"
done
