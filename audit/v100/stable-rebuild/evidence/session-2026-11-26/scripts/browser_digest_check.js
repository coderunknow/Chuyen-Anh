// Re-created reproduction helper (round-8) — browser_console paste-in.
// Behavior per browser-session-method.md step 3: fetch each URL WITH session
// credentials on the exam-host page and hash the response bytes (SHA-256).
// This file is a faithful re-creation written from the documented behavior,
// NOT the original session code (which was never committed).
//
// Usage: while logged in on a page of the exam host, open DevTools -> Console
// and paste this file's contents; it returns a JSON string you can copy out.
async function digestOf(buffer) {
  const bytes = new Uint8Array(buffer);
  const hex = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hex)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function browserDigestCheck(urls) {
  const out = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      const buf = await res.arrayBuffer();
      out.push({ url, status: res.status, bytes: buf.byteLength, sha256: await digestOf(buf) });
    } catch (err) {
      out.push({ url, error: String(err) });
    }
  }
  return JSON.stringify({ contract: 1, generatedBy: 'browser_digest_check.js (re-creation)', results: out }, null, 1);
}
// expects `urls` to be set (e.g. from extract_asset_list.py --json) or extracts
// them from the page's own embedded exam records when running on the app origin.
