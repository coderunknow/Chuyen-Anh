#!/usr/bin/env python3
"""Independent exam-corpus integrity probe (fresh code, 2026-11-26 session).

Not derived from the repository's own audit scripts. Checks, per the mission:
  A. embedded exam-data records <-> De-chuyen-Anh-vao-10 source .md (sha256 + body)
  B. answerKey numbers <-> "Question N" occurrences in the embedded markdown
  C. cross-paper passage leakage: normalized long text blocks appearing in >1 paper
  D. per-paper question counts and catalogue totals
Prints a JSON verdict to stdout; exit 1 when any check fails.
"""
import hashlib
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

REPO = Path(__file__).resolve().parents[5]  # repo root: session-2026-11-26/ -> evidence -> stable-rebuild -> v100 -> audit -> repo
html = (REPO / 'index.html').read_text(encoding='utf-8')
m = re.search(r'<script id="exam-data" type="application/json">\s*(.*?)\s*</script>', html, re.S)
papers = json.loads(m.group(1))
problems = []
notes = {}

# ---- A: source .md <-> embedded record ------------------------------------
# Contract (scripts/exams/embed_archive.py): each source .md carries YAML front
# matter; the transcription BODY (after the closing '---') is what gets embedded
# and hashed. This probe verifies that contract independently.
hash_ok = 0
for p in papers:
    rel = p['id'] + '.md'
    src = REPO / 'De-chuyen-Anh-vao-10' / rel
    if not src.exists():
        problems.append(f"A: source file missing for {p['id']}: {rel}")
        continue
    text = src.read_text(encoding='utf-8')
    fm = re.match(r'\A---\n[\s\S]*?\n---\n([\s\S]*)\Z', text)
    if not fm:
        problems.append(f"A: source file has no front matter for {p['id']}")
        continue
    body = fm.group(1)
    if hashlib.sha256(body.encode('utf-8')).hexdigest() != p['contentSha256']:
        problems.append(f"A: contentSha256 mismatch for {p['id']}")
        continue
    if body != (p.get('markdown') or ''):
        problems.append(f"A: embedded markdown body differs from source file for {p['id']}")
        continue
    hash_ok += 1
notes['A_sourceHashAndBodyMatch'] = f'{hash_ok}/{len(papers)}'

# ---- B: answerKey <-> parsed questions (app parser as oracle) ---------------
# Numbering is per-section (duplicate display numbers are legitimate); the
# stable identifier is questionId. Alignment of parsed questions to answerKey
# entries is measured by RUNNING probe_question_alignment.mjs (fresh logic,
# app parser as oracle) and recording its real output — the fixed "0 failures"
# string this block used to print was never measured (CodeRabbit 2026-11-27).
alignment = None
try:
    completed = subprocess.run(
        ['node', str(Path(__file__).resolve().parent / 'probe_question_alignment.mjs')],
        capture_output=True, text=True, timeout=300,
    )
    alignment = json.loads(completed.stdout)
    notes['B_alignmentProbe'] = {
        'papers': alignment.get('papers'),
        'questions': alignment.get('totalQuestions'),
        'uniqueIds': alignment.get('uniqueQuestionIds'),
        'failureCount': alignment.get('failureCount'),
        'exitCode': completed.returncode,
        'failures': alignment.get('failures', [])[:10],
    }
    if completed.returncode != 0 or alignment.get('failureCount'):
        problems.append(f"B: question<->key alignment probe failed ({alignment.get('failureCount')} failures, exit {completed.returncode})")
    if alignment.get('papers') != 106 or alignment.get('totalQuestions') != 6708:
        problems.append(f"B: alignment probe totals off ({alignment.get('papers')} papers / {alignment.get('totalQuestions')} questions)")
except FileNotFoundError:
    problems.append('B: node unavailable — probe_question_alignment.mjs could not run; alignment NOT verified')
except (subprocess.TimeoutExpired, json.JSONDecodeError) as e:
    problems.append(f'B: alignment probe output unreadable ({type(e).__name__}); alignment NOT verified')

# ---- C: cross-paper passage leakage ----------------------------------------
def norm_blocks(text):
    """Long prose blocks (>= 350 chars), whitespace/case-normalised."""
    blocks = []
    for raw in re.split(r'\n\s*\n', text):
        t = re.sub(r'[#*`|>_]', ' ', raw)
        t = re.sub(r'\s+', ' ', t).strip().lower()
        if len(t) >= 350 and not re.match(r'^(trang|page|question|đơn vị|năm thi)', t):
            blocks.append(t)
    return blocks

owner = {}
passage_dupes = []
for p in papers:
    for b in norm_blocks(p.get('markdown') or ''):
        key = b[:400]
        if key in owner and owner[key] != p['id']:
            passage_dupes.append([owner[key], p['id'], b[:90]])
        else:
            owner.setdefault(key, p['id'])
for a, bid, sample in passage_dupes[:12]:
    problems.append(f"C: passage block shared by {a} and {bid}: {sample}...")
notes['C_crossPaperPassageDupes'] = len(passage_dupes)

# ---- D: totals ---------------------------------------------------------------
total_q = sum(len(p.get('answerKey') or []) for p in papers)
notes['D_papers'] = len(papers)
notes['D_answerKeyEntries'] = total_q

print(json.dumps({'notes': notes, 'problems': problems[:60], 'problemCount': len(problems)},
                 ensure_ascii=False, indent=1))
sys.exit(1 if problems else 0)
