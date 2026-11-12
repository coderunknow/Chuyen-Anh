#!/usr/bin/env python3
"""Build and safely attach the established HTML/ZIP artifacts for GitHub releases."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import pathlib
import re
import shutil
import subprocess
import sys
import tempfile
import zipfile

ROOT = pathlib.Path(__file__).resolve().parents[1]
FILES = ("index.html", "README.md", "LICENSE")

# Prereleases retain their existing pattern. Only the explicitly targeted stable
# version is newly accepted; arbitrary stable refs remain rejected.
TAG_RE = re.compile(r"^v\d+\.\d+\.\d+-(?:dev|beta|rc)\d+$")


def is_supported_tag(tag: str) -> bool:
    return tag == "v1.0.0" or bool(TAG_RE.fullmatch(tag or ""))


def is_prerelease_tag(tag: str) -> bool:
    return bool(TAG_RE.fullmatch(tag or ""))


def release_create_command(tag: str) -> list[str]:
    if not is_supported_tag(tag):
        raise ValueError(f"Unsupported release tag: {tag}")
    command = ["gh", "release", "create", tag, "--draft"]
    if is_prerelease_tag(tag):
        command.append("--prerelease")
    return command + ["--title", f"Chuyên Anh {tag}", "--notes", release_notes(tag)]


def run(args: list[str], *, cwd: pathlib.Path = ROOT, capture: bool = False) -> str:
    """Run a subprocess from the repository root and return its stdout when asked."""
    result = subprocess.run(args, cwd=cwd, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ""


def sha(path: pathlib.Path) -> str:
    """Lowercase hex SHA-256 of a file, streamed so a 28 MB index.html is not held twice."""
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def release_for(tag: str) -> dict | None:
    """The release record for a tag, or None when no release exists."""
    result = subprocess.run(["gh", "release", "view", tag, "--json", "tagName,isDraft,isPrerelease,assets"],
                            cwd=ROOT, text=True, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL)
    return json.loads(result.stdout) if result.returncode == 0 else None


def test_source(source: pathlib.Path) -> None:
    """Run the same content-integrity and logic tests against this tag's tree."""
    run([sys.executable, "scripts/build_vocabulary.py", "--check"], cwd=source)
    run([sys.executable, "scripts/validate_vocab.py"], cwd=source)
    run([sys.executable, "scripts/embed_vocabulary.py", "--check"], cwd=source)
    if (source / "scripts/exams/embed_archive.py").exists():
        run(["node", "scripts/exams/build_answer_keys.mjs", "--check"], cwd=source)
        if (source / "scripts/exams/verify_curated_keys.mjs").exists():
            run(["node", "scripts/exams/verify_curated_keys.mjs"], cwd=source)
        run(["node", "scripts/exams/audit_rendering.mjs", "--check"], cwd=source)
        run([sys.executable, "scripts/exams/embed_archive.py", "--check"], cwd=source)
    if (source / "tests").exists():
        run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"], cwd=source)
        if (source / "tests/static-app.test.js").exists():
            node_suites = ["tests/static-app.test.js", "tests/exam-scoring.test.js"]
            # Older tags predate the later suites: only run files this tree actually
            # contains, because `node --test` fails on a path that does not exist and
            # that would make a historical tag impossible to re-check.
            for extra in ("tests/exam-anomalies.test.js", "tests/rc10-cefr.test.js", "tests/v100-senses.test.js",
                          "tests/telemetry-api.test.js", "tests/exam-exempt-rubric.test.js",
                          "tests/core-invariants.test.js", "tests/exam-persistence.test.js"):
                if (source / extra).exists():
                    node_suites.append(extra)
            run(["node", "--test", *node_suites], cwd=source)


def write_manifest(artifacts: dict[str, pathlib.Path], manifest_path: pathlib.Path) -> None:
    """Write a sha256sum-compatible manifest covering the published artifacts.

    The manifest lists only the HTML and ZIP deliverables so `sha256sum -c` on the
    downloaded pair verifies the release package without extra bookkeeping.
    """
    deliverables = [name for name in artifacts if not name.endswith("-checksums.txt")]
    lines = [f"{sha(artifacts[name])}  {name}" for name in deliverables]
    manifest_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def verify_zip_contract(zip_path: pathlib.Path, extracted: pathlib.Path) -> None:
    """The ZIP must unpack to exactly the three root files with byte-identical contents."""
    with zipfile.ZipFile(zip_path) as bundle:
        if bundle.testzip() is not None or bundle.namelist() != list(FILES):
            raise RuntimeError(f"ZIP validation failed for {zip_path.name}")
        for name in FILES:
            if bundle.read(name) != (extracted / name).read_bytes():
                raise RuntimeError(f"ZIP content mismatch for {zip_path.name}: {name}")


def build(tag: str, commit: str, temp: pathlib.Path) -> dict[str, pathlib.Path]:
    """Materialise `commit` and build the HTML/ZIP/checksum artifacts for `tag` in `temp`."""
    extracted = temp / "source"
    extracted.mkdir()
    archive = subprocess.Popen(["git", "archive", commit], cwd=ROOT, stdout=subprocess.PIPE)
    assert archive.stdout is not None
    # Extract git archive without trusting external archive paths. Explicitly
    # close the pipe and reap the child even if validation/extraction raises.
    import inspect
    import tarfile
    supports_filter = "filter" in inspect.signature(tarfile.TarFile.extract).parameters
    try:
        with archive.stdout as archive_stream:
            with tarfile.open(fileobj=archive_stream, mode="r|*") as tar:
                for member in tar:
                    target = (extracted / member.name).resolve()
                    if extracted.resolve() not in target.parents and target != extracted.resolve():
                        raise RuntimeError(f"Unsafe path in git archive: {member.name}")
                    if member.issym() or member.islnk() or not (member.isfile() or member.isdir()):
                        raise RuntimeError(f"Unexpected archive member type: {member.name}")
                    if supports_filter:
                        tar.extract(member, extracted, filter="data")
                    else:
                        tar.extract(member, extracted)
    finally:
        archive_status = archive.wait()
    if archive_status != 0:
        raise RuntimeError(f"git archive failed for {tag}")
    if tag == "v1.0.0":
        # A stable package must contain the version it purports to release.
        app = (extracted / "index.html").read_text(encoding="utf-8")
        declarations = re.findall(r"^\s*export\s+const\s+APP_VERSION\s*=\s*['\"]([^'\"]+)['\"]\s*;", app, re.MULTILINE)
        if declarations != [tag]:
            raise RuntimeError(f"Application version does not match stable tag {tag}")
    test_source(extracted)

    html_name = f"chuyen-anh-{tag}.html"
    zip_name = f"chuyen-anh-{tag}.zip"
    manifest_name = f"chuyen-anh-{tag}-checksums.txt"
    html_path = temp / html_name
    zip_path = temp / zip_name
    manifest_path = temp / manifest_name
    shutil.copyfile(extracted / "index.html", html_path)
    with zipfile.ZipFile(zip_path, "w", compression=zipfile.ZIP_DEFLATED) as bundle:
        for name in FILES:
            if tag == "v1.0.0":
                # Avoid local timezone, extraction timestamps and umask affecting ZIP bytes.
                info = zipfile.ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
                info.create_system = 3
                info.external_attr = 0o100644 << 16
                info.compress_type = zipfile.ZIP_DEFLATED
                bundle.writestr(info, (extracted / name).read_bytes())
            else:
                # Preserve historical prerelease backfill byte contracts.
                bundle.write(extracted / name, arcname=name)
    verify_zip_contract(zip_path, extracted)
    if html_path.read_bytes() != (extracted / "index.html").read_bytes():
        raise RuntimeError(f"HTML content mismatch for {tag}")
    artifacts = {html_name: html_path, zip_name: zip_path}
    write_manifest(artifacts, manifest_path)
    artifacts[manifest_name] = manifest_path
    print(f"{tag}: html sha256={sha(html_path)}; zip sha256={sha(zip_path)}; "
          f"manifest sha256={sha(manifest_path)}", flush=True)
    return artifacts


def release_notes(tag: str) -> str:
    """The release body: what the assets are and how to verify them."""
    return (
        f"Automated {'prerelease' if is_prerelease_tag(tag) else 'stable release'} draft for `{tag}`, built from the tagged commit by "
        "`scripts/release_artifacts.py`.\n\n"
        f"- `chuyen-anh-{tag}.html` is byte-identical to `index.html` at the tag.\n"
        f"- `chuyen-anh-{tag}.zip` unpacks to exactly `index.html`, `README.md`, `LICENSE` "
        "at the archive root.\n"
        f"- `chuyen-anh-{tag}-checksums.txt` lists SHA-256 digests for the HTML and ZIP.\n\n"
        "Verify a download with:\n\n"
        "```\n"
        f"sha256sum -c chuyen-anh-{tag}-checksums.txt\n"
        "```\n\n"
        "Review the attached assets, then publish this draft explicitly."
    )


def process(tag: str, *, future: bool = False) -> None:
    """Verify one release and attach any missing artifact; never replaces an asset."""
    # Confirm the release's tag association; use the immutable resolved tag commit for all work.
    release = release_for(tag)
    if release is None:
        if not future:
            raise RuntimeError(f"No GitHub release exists for {tag}; refusing to create one during backfill")
        commit = run(["git", "rev-parse", f"{tag}^{{commit}}"], capture=True)
    else:
        if release.get("tagName") != tag:
            raise RuntimeError(f"Release/tag association mismatch for {tag}")
        if is_supported_tag(tag) and release.get("isPrerelease") is not is_prerelease_tag(tag):
            raise RuntimeError(f"Release channel mismatch for {tag}")
        commit = run(["git", "rev-parse", f"{tag}^{{commit}}"], capture=True)

    # Tag must exist remotely and GitHub must resolve it to the same commit.
    remote = json.loads(run(["gh", "api", f"repos/{os.environ['GH_REPO']}/commits/{tag}"], capture=True))
    if remote["sha"] != commit:
        raise RuntimeError(f"GitHub tag {tag} resolves to {remote['sha']}, local fetched tag resolves to {commit}")

    with tempfile.TemporaryDirectory(prefix="release-assets-") as directory:
        temp = pathlib.Path(directory)
        artifacts = build(tag, commit, temp)
        if release is None:
            run(release_create_command(tag))
            release = release_for(tag)
            if (release is None or release.get("tagName") != tag or not release.get("isDraft")
                    or release.get("isPrerelease") is not is_prerelease_tag(tag)):
                raise RuntimeError(f"Could not verify draft release creation for {tag}")
        existing = {asset["name"] for asset in release.get("assets", [])}
        upload: list[str] = []
        for name, path in artifacts.items():
            if name not in existing:
                upload.append(str(path))
                continue
            download_dir = temp / "existing"
            download_dir.mkdir(exist_ok=True)
            run(["gh", "release", "download", tag, "--pattern", name, "--dir", str(download_dir)])
            downloaded_path = download_dir / name
            if not downloaded_path.exists():
                raise RuntimeError(f"Expected existing asset could not be downloaded: {name}")
            if sha(downloaded_path) != sha(path):
                raise RuntimeError(f"Asset {name} exists with different content; refusing to replace it")
        if upload:
            run(["gh", "release", "upload", tag, *upload])
        # Assert names and digests after upload and ensure the release state did not change.
        final = release_for(tag)
        if final is None:
            raise RuntimeError(f"Release disappeared after upload: {tag}")
        final_assets = {asset["name"] for asset in final.get("assets", [])}
        for name in artifacts:
            if name not in final_assets:
                raise RuntimeError(f"Asset missing after upload: {name}")
        if release is not None and (final["isDraft"] != release["isDraft"] or final["isPrerelease"] != release["isPrerelease"]):
            raise RuntimeError(f"Release state changed unexpectedly for {tag}")
        # When GitHub reports a digest, it must match the built artifact.
        for asset in final.get("assets", []):
            digest = asset.get("digest")
            if asset.get("name") in artifacts and digest:
                expected = f"sha256:{sha(artifacts[asset['name']])}"
                if digest != expected:
                    raise RuntimeError(f"Asset {asset['name']} digest {digest} != built {expected}")
        # "Upload accepted" is not success: re-download every expected asset from
        # GitHub and compare its bytes with the artifacts built above.
        verify_dir = temp / "verify"
        verify_dir.mkdir()
        run(["gh", "release", "download", tag, "--dir", str(verify_dir)])
        for name, path in artifacts.items():
            downloaded = verify_dir / name
            if not downloaded.exists():
                raise RuntimeError(f"Asset missing from post-upload download: {name}")
            if sha(downloaded) != sha(path):
                raise RuntimeError(f"Asset {name} differs from the built artifact after upload")
        print(f"Verified release {tag}: {commit}; draft={final['isDraft']}; prerelease={final['isPrerelease']}; "
              f"assets={sorted(final_assets)}", flush=True)


def main() -> None:
    push_tag = os.environ.get("PUSH_TAG", "").strip()
    requested = os.environ.get("INPUT_TAG", "").strip()
    if push_tag:
        if not is_supported_tag(push_tag):
            raise RuntimeError(f"Unexpected tag push: {push_tag}")
        process(push_tag, future=True)
    elif requested:
        process(requested)
    else:
        releases = json.loads(run(["gh", "api", "repos/{owner}/{repo}/releases?per_page=100"], capture=True))
        for release in releases:
            process(release["tag_name"])


def cli(argv=None):
    """Parse arguments before any release work happens.

    The script had no argument parser, so `--help` was ignored and the module went
    straight to `main()`: it read `PUSH_TAG`/`INPUT_TAG`, could call `gh release
    create --draft` and could upload assets. `--help` is now a query that exits 0
    without touching a release, and unknown arguments are refused instead of being
    silently ignored (D75). `main()` keeps its environment-driven behaviour for the
    workflow and the tests.
    """
    parser = argparse.ArgumentParser(
        prog='release_artifacts.py',
        description='Build and attach the release artifacts for a tag. Driven by the '
                    'PUSH_TAG / INPUT_TAG environment variables; with neither set it walks '
                    'the existing releases. There is no dry-run mode.')
    parser.parse_args(argv)
    main()


if __name__ == "__main__":
    try:
        cli()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
