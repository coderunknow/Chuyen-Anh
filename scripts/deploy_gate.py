#!/usr/bin/env python3
"""Decide whether the GitHub Pages deploy may run while a deploy hold is active.

A release procedure can require that a merge to `main` does not publish
GitHub Pages before the tagged prerelease assets have been built and verified.
The `DEPLOY_HOLD` marker names the release that must be published first; once
that release is published the gate opens for this and every later push, so the
marker does not need to be deleted for normal deployments to resume. A manual
dispatch can force a deploy for maintainers who deliberately override the hold.
"""
from __future__ import annotations

import argparse
import os
import pathlib
import re
import subprocess
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
HOLD_FILE = 'DEPLOY_HOLD'
TAG_RE = re.compile(r'^[A-Za-z0-9][A-Za-z0-9._-]*$')
# The gate asks GitHub about one release tag; a hung or misbehaving `gh` must
# not hang the deploy job until the runner's outer timeout. Bounded, and a
# timeout counts as 'missing' so the deploy stays held.
RELEASE_STATUS_TIMEOUT_SEC = 15


def read_hold(root: pathlib.Path = ROOT) -> tuple[bool, str | None]:
    """Return (has_hold, tag). `tag` is None for a missing or unreadable marker.

    An unreadable marker counts as a hold: deploying past it would silently
    break the release ordering the marker exists to enforce.
    """
    path = root / HOLD_FILE
    if not path.exists():
        return False, None
    try:
        lines = path.read_text(encoding='utf-8').splitlines()
    except OSError:
        return True, None
    for line in lines:
        text = line.strip()
        if not text or text.startswith('#'):
            continue
        return True, (text if TAG_RE.match(text) else None)
    return True, None


def release_status(tag: str, repo: str) -> str:
    """Return 'published', 'draft', or 'missing' for the named GitHub release.

    Every failure mode — a non-zero exit, unparseable output, a missing field,
    an unreachable GitHub, or a `gh` call that exceeds
    RELEASE_STATUS_TIMEOUT_SEC — resolves to 'missing', which holds the deploy.
    """
    try:
        result = subprocess.run(
            ['gh', 'api', f'repos/{repo}/releases/tags/{tag}'],
            text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL,
            check=False, timeout=RELEASE_STATUS_TIMEOUT_SEC)
    except (subprocess.TimeoutExpired, OSError):
        return 'missing'
    if result.returncode != 0:
        return 'missing'
    try:
        import json
        payload = json.loads(result.stdout)
    except ValueError:
        return 'missing'
    # `gh api` returns the REST field names (draft/prerelease), not the
    # camelCase names used by `gh release view --json`. Missing/type-mismatched
    # state is not proof of a published prerelease, so fail closed.
    draft = payload.get('draft')
    prerelease = payload.get('prerelease')
    if not isinstance(draft, bool) or not isinstance(prerelease, bool):
        return 'missing'
    if draft:
        return 'draft'
    if not prerelease:
        return 'not-prerelease'
    return 'published'


def decide_deploy(*, has_hold: bool, hold_tag: str | None, status: str, force: bool) -> tuple[bool, str]:
    if force:
        return True, 'deploy forced by workflow dispatch'
    if not has_hold:
        return True, 'no deploy hold marker'
    if not hold_tag:
        return False, 'deploy hold marker is unreadable; deployment held'
    if status == 'published':
        return True, f'release {hold_tag} is published'
    return False, f'release {hold_tag} is {status}; deployment held'


def main() -> int:
    parser = argparse.ArgumentParser(description='Evaluate the DEPLOY_HOLD gate for the Pages deploy job.')
    parser.add_argument('--repo', default=os.environ.get('GITHUB_REPOSITORY', ''),
                        help='owner/name of the GitHub repository')
    parser.add_argument('--force', action='store_true',
                        default=os.environ.get('FORCE_DEPLOY', '').strip().lower() in {'1', 'true', 'yes'})
    parser.add_argument('--root', type=pathlib.Path, default=ROOT)
    args = parser.parse_args()

    has_hold, hold_tag = read_hold(args.root)
    status = 'missing'
    if has_hold and hold_tag and args.repo:
        status = release_status(hold_tag, args.repo)
    deploy, reason = decide_deploy(has_hold=has_hold, hold_tag=hold_tag, status=status, force=args.force)

    print(f'deploy-hold gate: deploy={str(deploy).lower()} ({reason})')
    output = os.environ.get('GITHUB_OUTPUT')
    if output:
        with open(output, 'a', encoding='utf-8') as handle:
            handle.write(f'deploy={str(deploy).lower()}\n')
            handle.write(f'reason={reason}\n')
    return 0


if __name__ == '__main__':
    sys.exit(main())
