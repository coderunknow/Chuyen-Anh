#!/usr/bin/env python3
"""Build and safely attach the established HTML/ZIP artifacts for GitHub releases."""
from __future__ import annotations

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

# This workflow only ever builds prerelease drafts, so a pushed tag must use the
# repository's prerelease naming scheme: vMAJOR.MINOR.PATCH-<dev|beta|rc>N.
# `v1.0.0-beta1` is a supported tag; a final release or an arbitrary ref is not.
# Refusing unknown refs keeps a mistyped tag from creating or mutating a release.
TAG_RE = re.compile(r"^v\d+\.\d+\.\d+-(?:dev|beta|rc)\d+$")


def is_supported_tag(tag: str) -> bool:
    return bool(TAG_RE.match(tag or ""))


def run(args: list[str], *, cwd: pathlib.Path = ROOT, capture: bool = False) -> str:
    result = subprocess.run(args, cwd=cwd, check=True, text=True,
                            stdout=subprocess.PIPE if capture else None)
    return result.stdout.strip() if capture else ""


def sha(path: pathlib.Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(block)
    return h.hexdigest()


def release_for(tag: str) -> dict | None:
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
        run(["node", "scripts/exams/audit_rendering.mjs", "--check"], cwd=source)
        run([sys.executable, "scripts/exams/embed_archive.py", "--check"], cwd=source)
    if (source / "tests").exists():
        run([sys.executable, "-m", "unittest", "discover", "-s", "tests", "-p", "test_*.py"], cwd=source)
        if (source / "tests/static-app.test.js").exists():
            run(["node", "--test", "tests/static-app.test.js", "tests/exam-scoring.test.js"], cwd=source)


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
    extracted = temp / "source"
    extracted.mkdir()
    archive = subprocess.Popen(["git", "archive", commit], cwd=ROOT, stdout=subprocess.PIPE)
    assert archive.stdout is not None
    # Extract git archive without trusting external archive paths. Explicitly
    # close the pipe and reap the child even if validation/extraction raises.
    import tarfile
    try:
        with archive.stdout as archive_stream:
            with tarfile.open(fileobj=archive_stream, mode="r|*") as tar:
                for member in tar:
                    target = (extracted / member.name).resolve()
                    if extracted.resolve() not in target.parents and target != extracted.resolve():
                        raise RuntimeError(f"Unsafe path in git archive: {member.name}")
                    if member.issym() or member.islnk() or not (member.isfile() or member.isdir()):
                        raise RuntimeError(f"Unexpected archive member type: {member.name}")
                    tar.extract(member, extracted)
    finally:
        archive_status = archive.wait()
    if archive_status != 0:
        raise RuntimeError(f"git archive failed for {tag}")
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
    return (
        f"Automated prerelease draft for `{tag}`, built from the tagged commit by "
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
    # Confirm the release's tag association; use the immutable resolved tag commit for all work.
    release = release_for(tag)
    if release is None:
        if not future:
            raise RuntimeError(f"No GitHub release exists for {tag}; refusing to create one during backfill")
        commit = run(["git", "rev-parse", f"{tag}^{{commit}}"], capture=True)
    else:
        if release.get("tagName") != tag:
            raise RuntimeError(f"Release/tag association mismatch for {tag}")
        commit = run(["git", "rev-parse", f"{tag}^{{commit}}"], capture=True)

    # Tag must exist remotely and GitHub must resolve it to the same commit.
    remote = json.loads(run(["gh", "api", f"repos/{os.environ['GH_REPO']}/commits/{tag}"], capture=True))
    if remote["sha"] != commit:
        raise RuntimeError(f"GitHub tag {tag} resolves to {remote['sha']}, local fetched tag resolves to {commit}")

    with tempfile.TemporaryDirectory(prefix="release-assets-") as directory:
        temp = pathlib.Path(directory)
        artifacts = build(tag, commit, temp)
        if release is None:
            run(["gh", "release", "create", tag, "--draft", "--prerelease", "--title", f"Chuyên Anh {tag}",
                 "--notes", release_notes(tag)])
            release = release_for(tag)
            if release is None or release.get("tagName") != tag or not release.get("isDraft"):
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


if __name__ == "__main__":
    try:
        main()
    except Exception as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        raise
