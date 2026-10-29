'use strict';

/**
 * Contract tests for the telemetry ingestion endpoint (api/telemetry.js).
 *
 * The function is the only server-side component of this project, so its whole
 * behaviour is pinned here: who may call it, what it accepts, what it stores,
 * and what it refuses to store. `fetch` is replaced with a recorder, so the
 * suite never leaves the machine and never needs a Supabase project.
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const handler = require(path.join(root, 'api', 'telemetry.js'));

const APP_ORIGIN = 'https://coderunknow.github.io';
const VALID_VERSION = 'v1.0.0-rc5';

function response() {
  const headers = {};
  return {
    statusCode: 0,
    body: '',
    setHeader(name, value) { headers[name.toLowerCase()] = value; },
    getHeader(name) { return headers[name.toLowerCase()]; },
    end(body) { this.body = body ? String(body) : ''; this.payload = this.body ? JSON.parse(this.body) : null; }
  };
}

function event(overrides = {}) {
  return { at: '2026-10-29T05:00:00.000Z', kind: 'boot', name: 'start', ...overrides };
}

function payload(overrides = {}) {
  return {
    contract: 1,
    appVersion: VALID_VERSION,
    environment: { language: 'vi', theme: 'light', viewport: 'mobile', reducedMotion: false, interface: 'modern' },
    events: [event()],
    ...overrides
  };
}

// Installs a fetch stub for the duration of one call and returns what it saw.
async function invoke(request, upstream = { status: 'ok', id: 'row-1' }) {
  const calls = [];
  const original = global.fetch;
  global.fetch = async (url, init) => {
    calls.push({ url, init, body: JSON.parse(init.body) });
    if (upstream instanceof Error) throw upstream;
    return {
      ok: upstream.status === 'http-error' ? false : true,
      status: upstream.httpStatus || 200,
      json: async () => upstream.body ?? upstream
    };
  };
  const res = response();
  try {
    await handler(request, res);
  } finally {
    global.fetch = original;
  }
  return { res, calls };
}

function request(method, body, { origin = APP_ORIGIN, type = 'application/json', headers = {} } = {}) {
  return {
    method,
    headers: { origin, 'content-type': type, 'x-forwarded-for': '203.0.113.7', ...headers },
    body
  };
}

process.env.SUPABASE_URL = 'https://example.supabase.co';
process.env.SUPABASE_SECRET_KEY = 'test-key-not-a-real-secret';
process.env.TELEMETRY_IP_SALT = 'test-salt';

test('preflight answers 204 and echoes only the published origin', async () => {
  const res = response();
  await handler(request('OPTIONS', null, { headers: { 'access-control-request-method': 'POST' } }), res);
  assert.equal(res.statusCode, 204);
  assert.equal(res.getHeader('access-control-allow-origin'), APP_ORIGIN);
  assert.equal(res.getHeader('access-control-allow-methods'), 'POST, OPTIONS');
  assert.equal(res.getHeader('vary'), 'Origin');

  const other = response();
  await handler(request('OPTIONS', null, { origin: 'https://evil.example' }), other);
  assert.equal(other.getHeader('access-control-allow-origin'), APP_ORIGIN,
    'an unknown origin is never echoed back');
});

test('a copy opened from disk (Origin: null) and local development are allowed', async () => {
  for (const origin of ['null', 'http://localhost:8000', 'http://127.0.0.1:8000']) {
    const { res } = await invoke(request('POST', payload(), { origin }));
    assert.equal(res.statusCode, 202, `${origin} may send`);
  }
});

test('a foreign origin is refused before the body is read', async () => {
  const { res, calls } = await invoke(request('POST', payload(), { origin: 'https://evil.example' }));
  assert.equal(res.statusCode, 403);
  assert.equal(res.payload.error, 'origin-not-allowed');
  assert.equal(calls.length, 0, 'nothing is forwarded upstream');
});

test('only POST with a JSON body is accepted', async () => {
  const get = response();
  await handler(request('GET', null), get);
  assert.equal(get.statusCode, 405);
  assert.equal(get.getHeader('allow'), 'POST, OPTIONS');

  const form = response();
  await handler(request('POST', payload(), { type: 'application/x-www-form-urlencoded' }), form);
  assert.equal(form.statusCode, 415);
});

test('oversized, malformed and unknown-contract bodies are rejected', async () => {
  const big = response();
  await handler(request('POST', payload(), { headers: { 'content-length': '40000' } }), big);
  assert.equal(big.statusCode, 413);
  assert.equal(big.payload.error, 'payload-too-large');

  const broken = response();
  await handler(request('POST', '{"contract":1,'), broken);
  assert.equal(broken.statusCode, 400);
  assert.equal(broken.payload.error, 'invalid-json');

  const contract = response();
  await handler(request('POST', payload({ contract: 2 })), contract);
  assert.equal(contract.statusCode, 400);
  assert.equal(contract.payload.error, 'unsupported-contract');

  const version = response();
  await handler(request('POST', payload({ appVersion: 'rc5' })), version);
  assert.equal(version.statusCode, 400);
  assert.equal(version.payload.error, 'bad-app-version');

  const many = response();
  await handler(request('POST', payload({ events: Array.from({ length: 51 }, () => event()) })), many);
  assert.equal(many.statusCode, 413);
  assert.equal(many.payload.error, 'too-many-events');
});

test('the stored payload is rebuilt: unknown fields, kinds and counters are dropped', async () => {
  const { res, calls } = await invoke(request('POST', {
    contract: 1,
    appVersion: VALID_VERSION,
    // Everything below is either not part of the contract or actively unwanted.
    email: 'learner@example.com',
    progress: { 1: { correct: 3 } },
    environment: {
      language: 'vi',
      theme: 'banana',
      viewport: 'mobile',
      reducedMotion: true,
      interface: 'modern',
      timezone: 'Asia/Ho_Chi_Minh',
      userAgent: 'Mozilla/5.0'
    },
    events: [
      { at: '2026-10-29T05:00:00.000Z', kind: 'session-start', name: 'Study_Mode' },
      { at: '2026-10-29T05:00:01.000Z', kind: 'not-a-kind' },
      { at: 'not a date', kind: 'boot' },
      {
        at: '2026-10-29T05:00:02.000Z',
        kind: 'error',
        note: 'JSON.parse failed on "some learner text" <a@b.co>',
        counters: { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6, g: 7 }
      },
      { at: '2026-10-29T05:00:03.000Z', kind: 'settings', counters: { 'bad key': 1, ok: 2.345 } }
    ]
  }));

  assert.equal(res.statusCode, 202);
  assert.equal(calls.length, 1);
  const sent = calls[0].body.payload;
  assert.deepEqual(Object.keys(sent).sort(), ['appVersion', 'contract', 'environment', 'events', 'product']);
  assert.equal(sent.product, 'Chuyen-Anh');
  assert.equal(sent.events.length, 3, 'unknown kinds and unparsable timestamps are dropped');
  assert.equal(sent.events[0].name, undefined, 'a name that is not a token is dropped');
  // Quotes end the note, so the learner's own words never travel.
  assert.equal(sent.events[1].note.includes('some learner text'), false);
  assert.equal(sent.events[1].note.includes('@'), false, 'an address inside a note is redacted');
  assert.equal(Object.keys(sent.events[1].counters).length, 6, 'at most six counters survive');
  assert.deepEqual(sent.events[2].counters, { ok: 2.35 }, 'unrounded and badly keyed counters are dropped');
  assert.deepEqual(sent.environment, {
    language: 'vi', viewport: 'mobile', reducedMotion: true, interface: 'modern'
  }, 'the environment is an allowlist: an unknown theme, timezone and user agent are dropped');
  assert.equal(JSON.stringify(sent).includes('learner@example.com'), false);
  assert.equal(JSON.stringify(sent).includes('Asia/Ho_Chi_Minh'), false);
  assert.equal(JSON.stringify(sent).includes('Mozilla/5.0'), false);
});

test('a rejected theme falls back to no value at all', async () => {
  const { calls } = await invoke(request('POST', payload({ environment: { language: 'vi', theme: 'banana' } })));
  assert.equal('theme' in calls[0].body.payload.environment, false);
});

test('the rate-limit key is a salted hash, never the address', async () => {
  const { calls } = await invoke(request('POST', payload()));
  const key = calls[0].body.client_key;
  assert.match(key, /^[0-9a-f]{32}$/);
  assert.equal(key.includes('203.0.113.7'), false);

  const missing = await invoke(request('POST', payload(), { headers: { 'x-forwarded-for': '' } }));
  assert.equal(missing.calls[0].body.client_key, null, 'no address, no key — the database decides');
});

test('upstream outcomes map to documented status codes', async () => {
  const ok = await invoke(request('POST', payload()), { status: 'ok', id: 'row-9' });
  assert.equal(ok.res.statusCode, 202);
  assert.deepEqual(ok.res.payload, { ok: true, id: 'row-9' });

  const limited = await invoke(request('POST', payload()), { status: 'rate_limited' });
  assert.equal(limited.res.statusCode, 429);
  assert.equal(limited.res.getHeader('retry-after'), '600');
  assert.equal(limited.res.payload.error, 'rate-limited');

  const invalid = await invoke(request('POST', payload()), { status: 'invalid', reason: 'too-many-events' });
  assert.equal(invalid.res.statusCode, 400);
  assert.equal(invalid.res.payload.reason, 'too-many-events');

  const broken = await invoke(request('POST', payload()), new Error('network down'));
  assert.equal(broken.res.statusCode, 503);
  assert.equal(broken.res.payload.error, 'service-unavailable');

  const http = await invoke(request('POST', payload()), { status: 'http-error', httpStatus: 500 });
  assert.equal(http.res.statusCode, 503);
});

test('an unconfigured deployment refuses to accept reports', async () => {
  const saved = process.env.SUPABASE_SECRET_KEY;
  delete process.env.SUPABASE_SECRET_KEY;
  try {
    const { res, calls } = await invoke(request('POST', payload()));
    assert.equal(res.statusCode, 503);
    assert.equal(calls.length, 0, 'no upstream call without credentials');
  } finally {
    process.env.SUPABASE_SECRET_KEY = saved;
  }
});

test('service errors never describe how the deployment is wired', async () => {
  const { res } = await invoke(request('POST', payload()), { status: 'unconfigured' });
  const text = JSON.stringify(res.payload);
  for (const leak of ['supabase', 'SUPABASE', 'env', 'key', 'stack']) {
    assert.equal(text.includes(leak), false, `the error body must not mention ${leak}`);
  }
});

test('the endpoint kind list matches the one the application records', () => {
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  const declared = html.match(/export const TELEMETRY_KINDS = Object\.freeze\(\[([^\]]+)\]\)/);
  assert.ok(declared, 'index.html declares its event kinds');
  const clientKinds = declared[1].split(',').map(value => value.trim().replace(/^'|'$/g, '')).filter(Boolean);
  assert.deepEqual([...handler.KINDS].sort(), clientKinds.sort(),
    'the client and the endpoint must accept exactly the same kinds');
  assert.equal(handler.MAX_BODY_BYTES, 16384);
  assert.equal(handler.MAX_EVENTS, 50);
  assert.equal(String(handler.DEFAULT_ORIGINS[0]), APP_ORIGIN);
});

test('no credential is ever shipped in the application or in this repository copy', () => {
  const files = ['index.html', 'api/telemetry.js'];
  for (const name of files) {
    const text = readFileSync(path.join(root, name), 'utf8');
    assert.equal(/eyJhbGciOi/.test(text), false, `${name} carries no JWT`);
    assert.equal(/sb_secret_|sb_publishable_/.test(text), false, `${name} carries no Supabase key`);
    assert.equal(/service_role/.test(text), false, `${name} names no privileged role`);
  }
});
