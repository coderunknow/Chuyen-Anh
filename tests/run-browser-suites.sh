#!/usr/bin/env bash
# Run the two real-browser regression suites one after another.
#
# Why a wrapper:
#   * the suites are sequential on purpose — on a small runner two browser
#     instances at once have segfaulted (2-CPU VM: "Target page, context or
#     browser has been closed"), and a crashed browser is not a test result;
#   * the browser executable has to be found once and exported, so CI, a laptop
#     and the optional @sparticuz/chromium fallback all use the same entry point;
#   * no dependency is added to the app: `playwright-core` is installed by the
#     caller (CI job or a developer) and `index.html` never sees it.
#
# Usage:
#   npm install --no-save --package-lock=false playwright-core@1.55.1 axe-core@4.14.0
#   BROWSER_ENGINE=chromium BROWSER_EXECUTABLE=/usr/bin/google-chrome tests/run-browser-suites.sh
#
# Without BROWSER_EXECUTABLE on chromium, the suites fall back to @sparticuz/chromium
# or Playwright's installed browser binary.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
root="$(dirname "$here")"
cd "$root"

if ! node -e "require('playwright-core')" >/dev/null 2>&1; then
  echo "playwright-core is not installed." >&2
  echo "Run: npm install --no-save --package-lock=false playwright-core@1.55.1" >&2
  exit 1
fi

export BROWSER_ENGINE="${BROWSER_ENGINE:-chromium}"

if [ "$BROWSER_ENGINE" = "chromium" ] && [ -z "${BROWSER_EXECUTABLE:-}" ]; then
  for candidate in google-chrome google-chrome-stable chromium chromium-browser chrome; do
    if path="$(command -v "$candidate" 2>/dev/null)"; then
      export BROWSER_EXECUTABLE="$path"
      break
    fi
  done
fi

if [ -n "${BROWSER_EXECUTABLE:-}" ]; then
  echo "browser ($BROWSER_ENGINE): $BROWSER_EXECUTABLE"
else
  echo "browser ($BROWSER_ENGINE): Playwright / @sparticuz/chromium fallback"
fi

suites=("tests/browser-learning.cjs" "tests/browser-exams.cjs")
for suite in "${suites[@]}"; do
  echo "---- $suite ($BROWSER_ENGINE)"
  if [ "${GITHUB_ACTIONS:-}" = "true" ]; then
    echo "::group::$suite ($BROWSER_ENGINE)"
    node --trace-deprecation "$suite"
    echo "::endgroup::"
  else
    node --trace-deprecation "$suite"
  fi
done

echo "both browser suites passed on $BROWSER_ENGINE, run sequentially"
