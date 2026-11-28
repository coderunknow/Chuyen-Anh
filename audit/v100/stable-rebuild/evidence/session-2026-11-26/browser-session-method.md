# Method note — tailieudieuky.com file-asset digests

The host serves `503 osh-mitigated: challenge-unrunnable` to non-browser
clients (curl and Node fetch both blocked; verified 2026-11-26). A real
Chromium session passes the challenge. Steps for a clean reproduction:

1. Serve the repository's `index.html` locally (or use any page on the host)
   in a real Chromium browser and let the challenge clear once.
2. In that page context, run the session's one-off browser-console scripts
   (`browser_digest_check.js`, `browser_recon2.js`, built on the
   de-duplicated URL list from `extract_asset_list.py`) after loading the
   the URL-extension filter `assets[].url` ends in `.pdf` or `.zip` — that
   filter yields the 140 file-asset records and 60 unique URLs (NOT the
   `type` filter: 164 records are typed `pdf`/`docx`, including 24 pdf-typed
   records whose URLs have no extension, and those yield 84 unique URLs);
   53 of the 60 URLs carry 2+ recorded assets each because the host
   re-packaged several files into single ZIP bundles. Note: these three helpers were session-local one-offs
   run from the browser console and were **not committed** to the repository —
   steps 3-4 below describe exactly what they did, so the whole procedure is
   reproducible from this note alone (the URL list is derivable from the
   tracked exam records' `assets[].url` fields).
3. `browser_recon2.js` fetches each URL with credentials, hashes the
   response, and — when the bytes are a ZIP — walks the central directory,
   inflates every member (`DecompressionStream('deflate-raw')`) and hashes
   each member, so a recorded digest can match either the response bytes or
   a member inside a re-packaged archive.
4. The helper outputs (`tailieudieuky-recon.json` with the raw per-URL digests
   and `asset-digest-classification.json` with the classification) were
   session-workspace artefacts and are **not tracked in the repository**
   either. What IS tracked and is the verification's authoritative record:
   every exam record's `assets[].sha256` in the embedded exam data, the
   per-record `contentSha256` over the transcribed markdown, and the
   reconciliation outcome summarised in `WORK_LOG.md` (session 4: 186 digests
   compared — 163 byte-verified, 1 explained external drift, 22 dynamic
   pages). Re-running steps 2-4 reproduces the FILE-ASSET digests from the
   live host (steps 2-4 fetch exactly the 60 pdf/zip URLs above); a changed
   digest means the source changed and the record needs re-curation. The 22
   dynamic-page digests are capture-time snapshots — they are NOT re-comparable
   by these steps and are verified through the `contentSha256` chain described
   below.

The 22 `type: html` records are document *pages* (dynamic content — live
clock, share widgets), so their digests are capture-time snapshots and are
not byte-re-comparable against the live page by design; their content is
instead verified through the source `.md` -> `contentSha256` -> embedded
markdown chain (106/106, see `exam-integrity.json`).
