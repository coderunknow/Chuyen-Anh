#!/usr/bin/env python3
"""Hold Pages until the exact application version is published in its release channel.

This is an additional gate, not a replacement for DEPLOY_HOLD. The deploy
workflow permits its explicit manual force override for both gates.
"""
from __future__ import annotations

import datetime
import json
import os
import pathlib
import re
import subprocess

ROOT = pathlib.Path(__file__).resolve().parents[1]
VERSION = re.compile(r'v\d+\.\d+\.\d+(?:-(?:dev|beta|rc)\d+)?\Z')
DECLARATION = re.compile(r'^\s*export\s+const\s+APP_VERSION\s*=\s*[\'"]([^\'"]+)[\'"]\s*;', re.MULTILINE)
TIMEOUT = 15


def app_version(path: pathlib.Path) -> str | None:
    try:
        matches = DECLARATION.findall(path.read_text(encoding='utf-8'))
    except (OSError, UnicodeError):
        return None
    return matches[0] if len(matches) == 1 and VERSION.fullmatch(matches[0]) else None


def release_is_published(version: str, repo: str) -> bool:
    if not VERSION.fullmatch(version or '') or not re.fullmatch(r'[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+', repo or ''):
        return False
    try:
        result = subprocess.run(['gh', 'api', f'repos/{repo}/releases/tags/{version}'],
                                text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
                                check=False, timeout=TIMEOUT)
        if result.returncode != 0:
            return False
        payload = json.loads(result.stdout)
        if not isinstance(payload, dict):
            return False
        published = payload.get('published_at')
        if not isinstance(published, str):
            return False
        timestamp = datetime.datetime.fromisoformat(published.replace('Z', '+00:00'))
        if timestamp.tzinfo is None:
            return False
        return (payload.get('tag_name') == version and payload.get('draft') is False
                and payload.get('prerelease') is ('-' in version))
    except (OSError, subprocess.TimeoutExpired, ValueError, TypeError):
        return False


def main() -> int:
    force = os.environ.get('FORCE_DEPLOY', '').strip().lower() in {'1', 'true', 'yes'}
    version = app_version(ROOT / 'index.html')
    allowed = force or bool(version and release_is_published(version, os.environ.get('GITHUB_REPOSITORY', '')))
    reason = 'manual force override' if force else (f'exact release {version} published in the correct channel' if allowed else f'application release {version or "unknown"} not verified; held')
    print(f'app-release gate: deploy={str(allowed).lower()} ({reason})')
    if os.environ.get('GITHUB_OUTPUT'):
        with open(os.environ['GITHUB_OUTPUT'], 'a', encoding='utf-8') as output:
            output.write(f'deploy={str(allowed).lower()}\n')
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
