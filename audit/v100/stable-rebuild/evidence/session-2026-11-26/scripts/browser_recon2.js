// Re-created reproduction helper (round-8) — browser_console paste-in.
// Behavior per browser-session-method.md steps 3-4: digest each fetched URL,
// and when the bytes are a ZIP (PK\x03\x04) walk the central directory, inflate
// every member with DecompressionStream('deflate-raw') and hash each member,
// so a recorded digest can match either the response bytes or a member inside
// a re-packaged archive. Faithful re-creation, NOT the original session code.
async function sha256Hex(bytes) {
  const hex = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(hex)].map(b => b.toString(16).padStart(2, '0')).join('');
}
async function inflateRaw(compressed, uncompressedSize) {
  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf.slice(0, uncompressedSize));
}
async function walkZip(bytes) {
  const view = new DataView(bytes.buffer);
  const members = [];
  // central directory: signature PK\x05\x06 (EOCD) locates the entry list
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0 && eocd < 0; i -= 1) {
    if (view.getUint32(i, true) === 0x06054b50) eocd = i;
  }
  if (eocd < 0) return members;
  const count = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) break;
    const method = view.getUint16(offset + 10, true);
    const size = view.getUint32(offset + 24, true);
    const nameLen = view.getUint16(offset + 28, true);
    const extraLen = view.getUint16(offset + 30, true);
    const commentLen = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const name = new TextDecoder().decode(new Uint8Array(bytes.buffer, offset + 46, nameLen));
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    const raw = bytes.subarray(dataStart, dataStart + size);
    const memberBytes = method === 0 ? raw : await inflateRaw(raw, size);
    members.push({ name, method, size, sha256: await sha256Hex(memberBytes) });
    offset += 46 + nameLen + extraLen + commentLen;
  }
  return members;
}
async function browserRecon2(urls) {
  const out = [];
  for (const url of urls) {
    try {
      const res = await fetch(url, { credentials: 'include' });
      const buf = new Uint8Array(await res.arrayBuffer());
      const entry = { url, status: res.status, bytes: buf.byteLength, responseSha256: await sha256Hex(buf) };
      if (buf[0] === 0x50 && buf[1] === 0x4b) entry.members = await walkZip(buf);
      out.push(entry);
    } catch (err) {
      out.push({ url, error: String(err) });
    }
  }
  return JSON.stringify({ contract: 1, generatedBy: 'browser_recon2.js (re-creation)', results: out }, null, 1);
}
// paste into the console of a logged-in page of the exam host, then call
// browserRecon2(urls) with the URL list from extract_asset_list.py --json.
