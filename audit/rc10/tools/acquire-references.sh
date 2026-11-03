#!/usr/bin/env bash
# rc10 — acquire the reference sources at pinned versions.
#
# The sandbox allowlists egress to github.com, codeload.github.com, api.github.com,
# registry.npmjs.org and pypi.org. Publisher sites (dictionary.cambridge.org,
# oxfordlearnersdictionaries.com, cental.uclouvain.be) are not reachable from a
# shell, which is why the publisher data used here is the material transcribed
# through the fetch tool plus the open releases below. Everything is pinned by
# commit and verified by sha256 so a rerun is reproducible and tamper-evident.
#
# Sources and their standing in this audit:
#   Oxford 3000/5000  — publisher word list (Oxford University Press), CEFR A1–C1.
#                       Accessed here as a third-party TSV transcription; its
#                       fidelity is measured against primary entries (95.5%).
#   OLP CEFR-J 1.5    — CEFR-J vocabulary profile, Tono Laboratory (TUFS), free
#                       with citation. Published, citable, lemma+POS+level, A1–B2.
#   OLP Octanove C1/C2— Octanove Vocabulary Profile, CC BY-SA 4.0. C1–C2 coverage
#                       that no A1–B1 list provides.
#   cefrpy 1.0.3      — frequency-derived reconstruction of CEFR-J; cross-check only.
set -euo pipefail

DEST="${1:-/tmp/refs}"
mkdir -p "$DEST"

OXFORD_COMMIT=9596732954b9c4db9a6c999ff0291dabefce6d24
OLP_COMMIT=d4e45b75b38f27b30dfc5c44d8c571aec7e7092f

fetch_repo() {
  local url="$1" commit="$2" dir="$3"
  if [ ! -d "$DEST/$dir/.git" ]; then
    git clone -q "$url" "$DEST/$dir"
    git -C "$DEST/$dir" fetch -q origin "$commit" || true
  fi
  git -C "$DEST/$dir" checkout -q "$commit"
}

fetch_repo https://github.com/voothi/20260715190122-oxford-3000-5000.git "$OXFORD_COMMIT" oxford
fetch_repo https://github.com/openlanguageprofiles/olp-en-cefrj.git "$OLP_COMMIT" olp

check() {
  local file="$1" want="$2" got
  got=$(sha256sum "$file" | cut -d' ' -f1)
  if [ "$got" != "$want" ]; then
    echo "sha256 mismatch for $file" >&2
    echo "  expected $want" >&2
    echo "  got      $got" >&2
    exit 1
  fi
  echo "ok $(basename "$file")"
}

check "$DEST/oxford/20260715160822-oxford-3000.en.tsv" 1a2b9dca943a3664dea37d2c2b0104418ff77e1ec7b1b56b4b9028d404f5b2b9
check "$DEST/oxford/20260715165539-oxford-5000-expanded.en.tsv" 177027432999f79304eeaabc33328764d1b8ff048f021b0afe7c065fc4df83d9
check "$DEST/olp/cefrj-vocabulary-profile-1.5.csv" b0dd3c635f1c9a4fdf1490c7e5b7c48e8bbe55b652ad0c9860a95f98e10ae498
check "$DEST/olp/octanove-vocabulary-profile-c1c2-1.0.csv" 18c33a407f2f89f7b8de9671c6d45fe3ea0bce45e7d2d7dcaab48d73e0f7b380

if [ ! -f "$DEST/cefrpy/data.bin" ]; then
  mkdir -p "$DEST/cefrpy" /tmp/pdl
  pip download -q --no-deps --no-binary :all: -d /tmp/pdl cefrpy==1.0.3
  tar xzf /tmp/pdl/cefrpy-1.0.3.tar.gz -C "$DEST/cefrpy" --strip-components=1
fi
check "$DEST/cefrpy/src/cefrpy/data.bin" 21866e2f58a859ca5d62d402c850729ef0919b0ff673384fd6d1437bdc9f6a38

echo "references ready in $DEST"
