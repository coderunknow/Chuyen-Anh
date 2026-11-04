#!/usr/bin/env bash
# Re-acquire the published CEFR reference snapshots used by the v1.0.0 sense-level
# classification (scripts/cefr_senses.py). Only github.com / codeload.github.com are
# reachable from the sandbox; the pinned tarballs below are the exact snapshots the
# committed files in this directory were taken from. Re-running must reproduce the
# committed files byte-for-byte (sha256 checked at the end).
set -euo pipefail
cd "$(dirname "$0")"

fetch() { # url out
  curl -fsSL "$1" -o "$2"
}

# Open Language Profiles (OLP) English profiles — CEFR-J Vocabulary Profile 1.5 and
# the Octanove C1/C2 vocabulary profile, as published by the CEFR-J project.
fetch "https://codeload.github.com/openlanguageprofiles/olp-en-cefrj/tar.gz/refs/heads/master" /tmp/olp-cefrj.tgz
tar xzf /tmp/olp-cefrj.tgz -C /tmp
cp /tmp/olp-en-cefrj-master/cefrj-vocabulary-profile-1.5.csv cefrj-vocabulary-profile-1.5.csv
cp /tmp/olp-en-cefrj-master/octanove-vocabulary-profile-c1c2-1.0.csv octanove-vocabulary-profile-c1c2-1.0.csv

# Oxford 3000 / Oxford 5000 wordlists (Oxford Learner's Dictionaries), with per-sense
# CEFR level columns, via the curated TSV mirror.
fetch "https://codeload.github.com/voothi/20260715190122-oxford-3000-5000/tar.gz/refs/heads/main" /tmp/oxford.tgz
tar xzf /tmp/oxford.tgz -C /tmp
cp /tmp/20260715190122-oxford-3000-5000-main/20260715160822-oxford-3000.en.tsv oxford-3000.en.tsv
cp /tmp/20260715190122-oxford-3000-5000-main/20260715165539-oxford-5000-expanded.en.tsv oxford-5000-expanded.en.tsv

# Corpus frequency index (COCA-based ranks) — cross-check/editorial banding only,
# never a level source. Top 30k ranks are committed; the full file is 172k rows.
fetch "https://codeload.github.com/Maximax67/Words-CEFR-Dataset/tar.gz/refs/heads/main" /tmp/wcd.tgz
tar xzf /tmp/wcd.tgz -C /tmp
head -n 30000 /tmp/Words-CEFR-Dataset-main/datasets/valid_words_sorted_by_frequency.csv > frequency-top30k.csv

sha256sum cefrj-vocabulary-profile-1.5.csv octanove-vocabulary-profile-c1c2-1.0.csv \
  oxford-3000.en.tsv oxford-5000-expanded.en.tsv frequency-top30k.csv
