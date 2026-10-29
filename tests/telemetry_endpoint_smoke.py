#!/usr/bin/env python3
"""Live probes for the deployed telemetry endpoint.

This is the only check that exercises the real chain
    index.html → Vercel function → Supabase Postgres
because it talks to the deployed function over HTTPS. It is *not* part of the
unit suite (that would make CI depend on a live deployment); it runs from
`.github/workflows/telemetry-smoke.yml` on demand, or by hand:

    python tests/telemetry_endpoint_smoke.py

Every probe asserts a documented status code, so a change in the endpoint's
behaviour shows up as a named failure rather than a silent success. One valid
report is stored per run; it carries no learner data and is deleted by the
90-day retention policy like any other row.
"""

from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request

ENDPOINT = os.environ.get("TELEMETRY_ENDPOINT", "https://chuyen-anh-telemetry.vercel.app/api/telemetry")
APP_ORIGIN = "https://coderunknow.github.io"
VERSION = os.environ.get("TELEMETRY_SMOKE_APP_VERSION", "v1.0.0-rc5")

failures: list[str] = []


def call(method: str, *, body: bytes | None = None, headers: dict[str, str] | None = None) -> tuple[int, dict, dict]:
    request = urllib.request.Request(ENDPOINT, data=body, method=method)
    for key, value in (headers or {}).items():
        request.add_header(key, value)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8", "replace")
            payload = json.loads(raw) if raw.strip().startswith("{") else {"raw": raw}
            return response.status, payload, dict(response.headers)
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", "replace")
        try:
            payload = json.loads(raw) if raw.strip().startswith("{") else {"raw": raw}
        except json.JSONDecodeError:
            payload = {"raw": raw[:200]}
        return error.code, payload, dict(error.headers or {})


def expect(name: str, status: int, expected: int, payload: dict) -> None:
    ok = status == expected
    line = f"{'PASS' if ok else 'FAIL'} {name}: HTTP {status} (expected {expected}) {json.dumps(payload)[:160]}"
    print(line)
    if not ok:
        print(f"::error::{line}")
    if not ok:
        failures.append(f"{name}: got {status}, expected {expected}")


def report(events=None, **overrides) -> bytes:
    body = {
        "contract": 1,
        "appVersion": VERSION,
        "environment": {"language": "vi", "theme": "system", "viewport": "mobile", "reducedMotion": False, "interface": "modern"},
        "events": events if events is not None else [
            {"at": time.strftime("%Y-%m-%dT%H:%M:%S.000Z", time.gmtime()), "kind": "boot", "name": "smoke"}
        ]
    }
    body.update(overrides)
    return json.dumps(body).encode("utf-8")


JSON_HEADERS = {"Content-Type": "application/json", "Origin": APP_ORIGIN}


def main() -> int:
    print(f"endpoint: {ENDPOINT}")

    status, payload, headers = call("OPTIONS", headers={"Origin": APP_ORIGIN, "Access-Control-Request-Method": "POST"})
    expect("preflight", status, 204, payload)
    allow = {key.lower(): value for key, value in headers.items()}.get("access-control-allow-origin")
    if allow != APP_ORIGIN:
        failures.append(f"preflight: Access-Control-Allow-Origin was {allow!r}")
        print(f"FAIL preflight: Access-Control-Allow-Origin {allow!r}")

    status, payload, _ = call("POST", body=report(), headers=JSON_HEADERS)
    expect("valid report", status, 202, payload)
    stored_id = payload.get("id")
    if not isinstance(stored_id, str) or len(stored_id) < 8:
        failures.append("valid report: no row id returned")
        print("FAIL valid report: response carried no row id")
    else:
        print(f"     stored id: {stored_id}")

    status, payload, _ = call("POST", body=report(), headers={**JSON_HEADERS, "Origin": "https://evil.example"})
    expect("foreign origin", status, 403, payload)

    status, payload, _ = call("POST", body=report(contract=2), headers=JSON_HEADERS)
    expect("unsupported contract", status, 400, payload)

    status, payload, _ = call("POST", body=report(appVersion="rc5"), headers=JSON_HEADERS)
    expect("bad app version", status, 400, payload)

    status, payload, _ = call("POST", body=report(events=[{"at": "2026-10-29T05:00:00.000Z", "kind": "boot"}] * 51),
                              headers=JSON_HEADERS)
    expect("too many events", status, 413, payload)

    status, payload, _ = call("POST", body=b'{"contract":1,', headers=JSON_HEADERS)
    expect("malformed json", status, 400, payload)

    status, payload, _ = call("POST", body=b"x" * 20000, headers=JSON_HEADERS)
    expect("oversized body", status, 413, payload)

    status, payload, _ = call("GET", headers={"Origin": APP_ORIGIN})
    expect("method not allowed", status, 405, payload)

    if failures:
        print("\nFAILURES:")
        for failure in failures:
            print(f" - {failure}")
            # GitHub renders this as an annotation, which is the only failure
            # detail readable from CI tooling that cannot download the raw log.
            print(f"::error::{failure}")
        return 1
    print("\nall endpoint probes passed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
