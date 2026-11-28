# Method note — tailieudieuky.com file-asset digests

The host serves `503 osh-mitigated: challenge-unrunnable` to non-browser
clients (curl and Node fetch both blocked; verified 2026-11-26). A real
Chromium session passes the challenge. Steps for a clean reproduction:

1. Serve the repository's `index.html` locally (or use any page on the host)
   in a real Chromium browser and let the challenge clear once.
2. In that page context, run the browser-console helpers
   (`scripts/browser_digest_check.js`, `scripts/browser_recon2.js`, built on
   the de-duplicated URL list from `scripts/extract_asset_list.py` — committed
   alongside this note as faithful RE-CREATIONS of the session one-offs) after
   loading the
   the URL-extension filter `assets[].url` ends in `.pdf` or `.zip` — that
   filter yields the 140 file-asset records and 60 unique URLs (NOT the
   `type` filter: 164 records are typed `pdf`/`docx`, including 24 pdf-typed
   records whose URLs have no extension, and those yield 84 unique URLs);
   53 of the 60 URLs carry 2+ recorded assets each because the host
   re-packaged several files into single ZIP bundles. The original session
   helpers were console one-offs and were never saved; runnable re-creations
   now live in `scripts/` next to this note (`extract_asset_list.py` —
   verified to reproduce the 140/60/53 counts from the tracked
   `selection.json`; the two `.js` files follow steps 3-4 exactly), so the
   whole procedure is runnable from a clean checkout (the URL list is also
   derivable from the tracked exam records' `assets[].url` fields).
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
not byte-re-comparable against the live page by design. The
source `.md` -> `contentSha256` -> embedded markdown chain (106/106, see
`exam-integrity.json`) proves these 22 stored transcriptions are INTERNALLY
intact — the shipped page matches its recorded capture-time digest — but it
does NOT verify them against the external HTML source, which was never
byte-compared for dynamic pages; treat the 22 as unverified against their
live source unless a separate comparison is performed.
