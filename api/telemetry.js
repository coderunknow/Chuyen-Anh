'use strict';

/**
 * Chuyên Anh — remote diagnostics ingestion endpoint.
 *
 * POST /api/telemetry
 * Flow: index.html → this Vercel function → Supabase Postgres
 *       (public.telemetry_ingest → schema `telemetry`).
 *
 * Deployed with `npx vercel deploy --prod` or the Vercel dashboard from this
 * directory; the function has no npm dependencies, so the deployment only
 * contains this file.
 *
 * The function never reads the database directly: the only privileged object it
 * can reach is the single SECURITY DEFINER function created by
 * supabase/migrations/20261029_telemetry_ingest.sql, which validates the payload
 * again, enforces the rate limits and stores the row.
 *
 * Privacy rules this file has to keep:
 *   * the stored payload is rebuilt here from validated fields only — nothing
 *     the client sends is copied through verbatim;
 *   * a request is accepted only from the published application origin, the
 *     documented local-development origins, or a `file://` copy (Origin: null);
 *   * no request body, header or IP address is ever written to the logs.
 *
 * Environment variables (Vercel → Project → Settings → Environment Variables):
 *   SUPABASE_URL          https://<project-ref>.supabase.co
 *   SUPABASE_SECRET_KEY   service-role key — server-side only, never shipped
 *   TELEMETRY_IP_SALT     random salt for the coarse rate-limit key
 *   TELEMETRY_ORIGINS     optional comma-separated override of the allowlist
 */

const crypto = require('node:crypto');

const DEFAULT_ORIGINS = [
  'https://coderunknow.github.io',
  'http://localhost:8000',
  'http://127.0.0.1:8000',
  'http://localhost:3000',
  'http://127.0.0.1:3000'
];
// A copy of index.html opened straight from disk sends `Origin: null`.
const NULL_ORIGIN = 'null';

const MAX_BODY_BYTES = 16384;
const MAX_EVENTS = 50;
const MAX_COUNTERS = 6;
const MAX_NOTE = 120;
const UPSTREAM_TIMEOUT_MS = 5000;

// Must stay in sync with TELEMETRY_KINDS in index.html.
const KINDS = Object.freeze([
  'boot', 'session-start', 'session-end', 'search-open', 'backup', 'exam-practice', 'error', 'settings'
]);
const TOKEN = /^[a-z0-9][a-z0-9._-]{0,39}$/;
const VERSION = /^v\d+\.\d+\.\d+(-[a-z]+\d+)?$/;
const QUOTE = /["'`«»“”‘’]/;
const EMAIL = /[\w.+-]+@[\w-]+\.[\w.-]+/g;
const LANGUAGE_VALUES = new Set(['vi', 'en']);
const THEME_VALUES = new Set(['system', 'light', 'dark']);
const VIEWPORT_VALUES = new Set(['mobile', 'tablet', 'desktop']);

function allowedOrigins() {
  const configured = String(process.env.TELEMETRY_ORIGINS || '')
    .split(',').map((value) => value.trim()).filter(Boolean);
  return configured.length ? configured : DEFAULT_ORIGINS;
}

function corsHeaders(origin) {
  const allowed = Boolean(origin) && (origin === NULL_ORIGIN || allowedOrigins().includes(origin));
  return {
    'Access-Control-Allow-Origin': allowed ? origin : 'https://coderunknow.github.io',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type',
    'Access-Control-Max-Age': '600',
    Vary: 'Origin'
  };
}

function send(res, status, payload, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  for (const name of Object.keys(headers)) res.setHeader(name, headers[name]);
  res.end(JSON.stringify(payload));
}

function scrub(value, maxLength = MAX_NOTE) {
  let text = String(value == null ? '' : value).replace(/[\u0000-\u001f\u007f]/g, ' ');
  text = text.split(QUOTE)[0];
  text = text.replace(EMAIL, '…').replace(/\s+/g, ' ').trim();
  return text.length > maxLength ? `${text.slice(0, maxLength - 1)}…` : text;
}

function sanitizeEvent(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const kind = String(value.kind == null ? '' : value.kind);
  if (!KINDS.includes(kind)) return null;
  const at = typeof value.at === 'string' && Number.isFinite(Date.parse(value.at))
    ? new Date(Date.parse(value.at)).toISOString()
    : null;
  if (!at) return null;
  const event = { at: at, kind: kind };
  if (TOKEN.test(String(value.name == null ? '' : value.name))) event.name = String(value.name);
  const counters = value.counters && typeof value.counters === 'object' && !Array.isArray(value.counters)
    ? Object.entries(value.counters)
    : [];
  const kept = {};
  for (let i = 0; i < counters.length; i += 1) {
    const key = counters[i][0];
    const raw = counters[i][1];
    if (!TOKEN.test(key)) continue;
    const number = Number(raw);
    if (!Number.isFinite(number) || Math.abs(number) > 1e9) continue;
    kept[key] = Math.round(number * 100) / 100;
    if (Object.keys(kept).length >= MAX_COUNTERS) break;
  }
  if (Object.keys(kept).length) event.counters = kept;
  const note = scrub(value.note);
  if (note) event.note = note;
  return event;
}

/**
 * Rebuild the payload that will be stored. Anything the client sends beyond
 * these fields is dropped, however well formed it looks.
 */
function buildStoredPayload(body) {
  const appVersion = scrub(body.appVersion, 40);
  if (!VERSION.test(appVersion)) return { error: 'bad-app-version' };
  const events = Array.isArray(body.events) ? body.events.map(sanitizeEvent).filter(Boolean) : null;
  if (!events) return { error: 'events-not-array' };
  if (events.length > MAX_EVENTS) return { error: 'too-many-events' };
  const source = body.environment && typeof body.environment === 'object' && !Array.isArray(body.environment)
    ? body.environment
    : {};
  const environment = {};
  if (LANGUAGE_VALUES.has(source.language)) environment.language = source.language;
  if (THEME_VALUES.has(source.theme)) environment.theme = source.theme;
  if (VIEWPORT_VALUES.has(source.viewport)) environment.viewport = source.viewport;
  if (typeof source.reducedMotion === 'boolean') environment.reducedMotion = source.reducedMotion;
  if (typeof source.interface === 'string' && /^(classic|modern)$/.test(source.interface)) {
    environment.interface = source.interface;
  }
  return {
    payload: { contract: 1, product: 'Chuyen-Anh', appVersion: appVersion, events: events, environment: environment }
  };
}

const MIN_SALT_LENGTH = 16;
const FORBIDDEN_SALTS = new Set([
  'chuyen-anh-telemetry',
  'changeme',
  'default',
  'secret',
  'telemetry-salt',
  'test-salt'
]);

function validIpSalt() {
  const salt = String(process.env.TELEMETRY_IP_SALT || '').trim();
  if (salt.length < MIN_SALT_LENGTH) return null;
  if (FORBIDDEN_SALTS.has(salt.toLowerCase())) return null;
  return salt;
}

function extractClientIp(req) {
  // Prefer platform-overwrite headers that clients cannot spoof on Vercel/reverse proxies.
  const vercelFwd = String(req.headers['x-vercel-forwarded-for'] || '').split(',')[0].trim();
  if (vercelFwd) return vercelFwd;
  const realIp = String(req.headers['x-real-ip'] || '').trim();
  if (realIp) return realIp;
  // Standard reverse proxies append the connecting peer to the end of X-Forwarded-For;
  // reading index 0 trusts client-injected prefixes when no edge header stripped them.
  const xffParts = String(req.headers['x-forwarded-for'] || '')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (xffParts.length) return xffParts[xffParts.length - 1];
  return String(req.socket?.remoteAddress || '').trim();
}

function clientKey(req) {
  const salt = validIpSalt();
  if (!salt) return null;
  const address = extractClientIp(req);
  if (!address) return null;
  // A truncated HMAC is enough to separate clients inside one ten-minute
  // window. It is not a device identifier: it changes when the salt changes and
  // it never leaves the rate-limit table.
  return crypto.createHmac('sha256', salt).update(address).digest('hex').slice(0, 32);
}

// The deployment is a plain Node service (app.js) rather than a directory of
// serverless functions, so whether `req.body` has already been parsed depends
// on the runtime and on how the request is routed. rc5 shipped a handler that
// trusted `req.body` and answered `400 invalid-body` to its own client in
// production, which is exactly the failure the live probe exists to catch. The
// handler therefore reads the stream itself when nothing has parsed the body.
function readStream(req) {
  return new Promise(resolve => {
    let size = 0;
    let settled = false;
    const chunks = [];
    const finish = value => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    req.on('data', chunk => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      size += buffer.length;
      if (size > MAX_BODY_BYTES) {
        // Stop reading as soon as the cap is passed: the point of the limit is
        // to bound the work, not just the stored result.
        finish({ tooLarge: true });
        if (typeof req.destroy === 'function') req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => finish({ text: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', () => finish({ unreadable: true }));
  });
}

async function measureBody(req) {
  const length = Number(req.headers['content-length']);
  if (Number.isFinite(length) && length > MAX_BODY_BYTES) return { tooLarge: true };
  let body = req.body;
  if (body === undefined || body === null) {
    const read = await readStream(req);
    if (read.tooLarge) return { tooLarge: true };
    if (read.unreadable) return { invalidJson: true };
    if (read.text.trim() === '') return { value: null, size: 0 };
    body = read.text;
  }
  if (Buffer.isBuffer(body)) body = body.toString('utf8');
  const text = typeof body === 'string' ? body : JSON.stringify(body);
  if (Buffer.byteLength(text, 'utf8') > MAX_BODY_BYTES) return { tooLarge: true };
  if (typeof body === 'string') {
    try {
      return { value: JSON.parse(text), size: Buffer.byteLength(text, 'utf8') };
    } catch (error) {
      return { invalidJson: true };
    }
  }
  return { value: body, size: Buffer.byteLength(text, 'utf8') };
}

async function callIngest(payload, key) {
  const base = String(process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const secret = String(process.env.SUPABASE_SECRET_KEY || '');
  if (!base || !secret || !validIpSalt()) return { status: 'unconfigured' };
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, UPSTREAM_TIMEOUT_MS);
  try {
    const response = await fetch(`${base}/rest/v1/rpc/telemetry_ingest`, {
      method: 'POST',
      headers: {
        apikey: secret,
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({ payload: payload, client_key: key }),
      signal: controller.signal
    });
    if (!response.ok) return { status: 'upstream-error', code: response.status };
    const result = await response.json();
    // PostgREST returns a scalar-returning RPC's jsonb as-is.
    const value = Array.isArray(result) ? result[0] : result;
    if (value && typeof value === 'object' && typeof value.status === 'string') return value;
    return { status: 'upstream-error', code: 0 };
  } catch (error) {
    return { status: 'upstream-error', code: 0 };
  } finally {
    clearTimeout(timer);
  }
}

module.exports = async function handler(req, res) {
  const origin = req.headers.origin || req.headers.Origin;
  const headers = corsHeaders(origin);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    for (const name of Object.keys(headers)) res.setHeader(name, headers[name]);
    res.end();
    return;
  }

  if (origin && origin !== NULL_ORIGIN && !allowedOrigins().includes(origin)) {
    send(res, 403, { ok: false, error: 'origin-not-allowed' }, headers);
    return;
  }

  if (req.method !== 'POST') {
    send(res, 405, { ok: false, error: 'method-not-allowed' }, Object.assign({ Allow: 'POST, OPTIONS' }, headers));
    return;
  }

  const type = String(req.headers['content-type'] || '');
  if (!type.toLowerCase().startsWith('application/json')) {
    send(res, 415, { ok: false, error: 'unsupported-content-type' }, headers);
    return;
  }

  const measured = await measureBody(req);
  if (measured.tooLarge) {
    send(res, 413, { ok: false, error: 'payload-too-large' }, headers);
    return;
  }
  if (measured.invalidJson) {
    send(res, 400, { ok: false, error: 'invalid-json' }, headers);
    return;
  }
  const body = measured.value;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    send(res, 400, { ok: false, error: 'invalid-body' }, headers);
    return;
  }
  if (Number(body.contract) !== 1) {
    send(res, 400, { ok: false, error: 'unsupported-contract' }, headers);
    return;
  }

  const built = buildStoredPayload(body);
  if (built.error) {
    send(res, built.error === 'too-many-events' ? 413 : 400, { ok: false, error: built.error }, headers);
    return;
  }

  const result = await callIngest(built.payload, clientKey(req));
  if (result.status === 'ok') {
    send(res, 202, { ok: true, id: typeof result.id === 'string' ? result.id : undefined }, headers);
    return;
  }
  if (result.status === 'rate_limited') {
    send(
      res,
      429,
      { ok: false, error: 'rate-limited', retryAfterSeconds: 600 },
      Object.assign({ 'Retry-After': '600' }, headers)
    );
    return;
  }
  if (result.status === 'invalid') {
    // Short machine token chosen by the database, never the rejected value.
    send(res, 400, { ok: false, error: 'rejected', reason: scrub(result.reason, 40) }, headers);
    return;
  }
  // Unconfigured and unreachable are reported alike on purpose: the learner is
  // told the service is unavailable, not how the deployment is wired.
  send(res, 503, { ok: false, error: 'service-unavailable' }, headers);
};

// Exported for the static/unit contract tests.
module.exports.KINDS = KINDS;
module.exports.DEFAULT_ORIGINS = DEFAULT_ORIGINS;
module.exports.MAX_BODY_BYTES = MAX_BODY_BYTES;
module.exports.MAX_EVENTS = MAX_EVENTS;
module.exports.sanitizeEvent = sanitizeEvent;
module.exports.buildStoredPayload = buildStoredPayload;
module.exports.allowedOrigins = allowedOrigins;
