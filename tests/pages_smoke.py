#!/usr/bin/env python3
"""Live probe for the published application.

`scripts/deploy_gate.py` decides *whether* GitHub Pages may deploy. This script
answers the next question: did the bytes that Pages now serves come from the
release we think they did?

It is deliberately dumb, and it is deliberately not part of the commit gate:

    python tests/pages_smoke.py

Assertions
  1. the site answers `200` with an HTML content type;
  2. the page declares the version named in `DEPLOY_HOLD` (the tag the gate is
     holding for), so a held or stale deploy is visible;
  3. the page is the single-file application: it carries its embedded
     vocabulary, phrase bank and exam archive;
  4. rc5 behaviour is actually shipped: the mask that rc3/rc4 used is gone, and
     the preference controls that replaced it are present.

The development sandbox cannot resolve `github.io`, so this runs from
`.github/workflows/pages-smoke.yml` on a GitHub runner.
"""

from __future__ import annotations

import os
import pathlib
import re
import sys
import urllib.error
import urllib.request

DEFAULT_SITE = "https://coderunknow.github.io/Chuyen-Anh/"
DEFAULT_HOLD_FILE = "DEPLOY_HOLD"

failures: list[str] = []


def fail(message: str) -> None:
    failures.append(message)
    print(f"FAIL {message}")
    print(f"::error::{message}")


def main() -> int:
    # Read the environment here rather than at import time: the tests point the
    # probe at a local server and at a fixture hold file.
    site = os.environ.get("PAGES_URL", DEFAULT_SITE)
    hold_file = os.environ.get("DEPLOY_HOLD_FILE", DEFAULT_HOLD_FILE)
    try:
        hold = pathlib.Path(hold_file).read_text(encoding="utf-8")
    except OSError as error:
        fail(f"cannot read {hold_file}: {error}")
        return 1
    version = None
    for line in hold.splitlines():
        match = re.search(r"v\d+\.\d+\.\d+(?:-[a-z]+\d+)?", line)
        if match:
            version = match.group(0)
            break
    override = os.environ.get("EXPECTED_VERSION", "").strip()
    if override:
        if not re.fullmatch(r"v\d+\.\d+\.\d+(?:-[a-z]+\d+)?", override):
            fail(f"invalid EXPECTED_VERSION override: {override!r}")
            return 1
        version = override
    if not version:
        fail(f"no version tag found in {hold_file} and no EXPECTED_VERSION supplied")
        return 1

    print(f"site: {site}")
    print(f"expected served version: {version}" + (f" (EXPECTED_VERSION; hold file names {hold_file})" if override else f" (from {hold_file})"))

    request = urllib.request.Request(site, method="GET")
    for attempt in range(3):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                status = response.status
                content_type = response.headers.get("content-type", "")
                body = response.read().decode("utf-8", "replace")
            break
        except urllib.error.HTTPError as error:
            print(f"attempt {attempt + 1}: HTTP {error.code}")
            if attempt == 2:
                fail(f"the site answered HTTP {error.code}")
                return 1
        except Exception as error:  # noqa: BLE001 - any transport failure is a failure
            print(f"attempt {attempt + 1}: {error}")
            if attempt == 2:
                fail(f"the site could not be fetched: {error}")
                return 1
    else:  # pragma: no cover - the loop always breaks or returns
        return 1

    print(f"HTTP {status}, {len(body)} bytes, content-type {content_type or '(none)'}")

    if status != 200:
        fail(f"expected HTTP 200, got {status}")
    if "text/html" not in content_type.lower():
        fail(f"expected an HTML content type, got {content_type!r}")

    if f"'{version}'" not in body and f'"{version}"' not in body:
        fail(f"the served page does not declare version {version}")
    else:
        print(f"PASS version: the page declares {version}")

    for marker, label in (
        ('<script id="vocabulary-data"', "embedded vocabulary"),
        ('<script id="phrase-data"', "embedded phrase bank"),
        ('<script id="exam-data"', "embedded exam archive"),
        ('<script type="module" id="app-script"', "application module"),
    ):
        if marker not in body:
            fail(f"the served page is missing its {label}")
        else:
            print(f"PASS {label}")

    # rc5 removed the mask and everything that implemented it; a served page that
    # still carries any of it is an old build. The control ids themselves are
    # generated at render time (`id="${prefix}-${mode}"`), so the file is checked
    # for the source markers rather than for rendered ids.
    for marker, label in (
        ("\u2022\u2022\u2022\u2022\u2022", "the rc4 five-dot mask"),
        ("MASKED_MEANING", "the mask constant"),
        ("revealedMeanings", "the per-row reveal set"),
        ("data-reveal-meaning", "the per-word reveal attribute"),
    ):
        if marker in body:
            fail(f"the served page still contains {label}")
        else:
            print(f"PASS no {label}")

    if version.startswith("v1.0.0-rc6"):
        for marker, label in (
            ("EXAM_SCORING_RULE_VERSION", "the rc6 scoring rule"),
            ("exam-history-export", "the rc6 exam-history export"),
            ("answerKeySchemaVersion", "the rc6 answer-key schema"),
            ("Trọng tâm phiên học", "the session-focus control"),
        ):
            if marker not in body:
                fail(f"the served page is missing {label}")
            else:
                print(f"PASS {label}")

    if version.startswith("v1.0.0-rc7"):
        # rc7 keeps every rc6 marker above (this branch repeats them so a
        # served rc7 page is checked for both releases' surfaces) and adds
        # the answer-leakage guards rc7 exists for.
        for marker, label in (
            ("EXAM_SCORING_RULE_VERSION", "the rc6 scoring rule"),
            ("exam-history-export", "the rc6 exam-history export"),
            ("answerKeySchemaVersion", "the rc6 answer-key schema"),
            ("Trọng tâm phiên học", "the session-focus control"),
            ("maskAnswerInPrompt", "the rc7 answer-masking guard"),
            ("usableClozeExample", "the rc7 cloze guard"),
            ("handOffForDisplay", "the rc7 hand-off guard"),
        ):
            if marker not in body:
                fail(f"the served page is missing {label}")
            else:
                print(f"PASS {label}")

    for marker, label in (
        ("previewStageVisible", "the preview-stage predicate"),
        ("vocab-list--no-gloss", "the no-gloss list layout"),
        ('data-meanings="', "the meaning segmented control"),
        ('id="telemetry-send"', "the diagnostics send button"),
    ):
        if marker not in body:
            fail(f"the served page is missing {label}")
        else:
            print(f"PASS {label}")

    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print(f" - {failure}")
        return 1
    print("\npages probe passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
