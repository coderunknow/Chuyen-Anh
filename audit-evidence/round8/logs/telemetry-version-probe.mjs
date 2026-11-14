// Disproves the only way the RC11 identity could have caused the telemetry smoke
// failure at 711257a: a version problem is a 400 'bad-app-version', never a 503,
// and v1.0.0-rc11 is accepted exactly like v1.0.0.
// Run: node audit-evidence/round8/logs/telemetry-version-probe.mjs
import { createRequire } from 'node:module';
const require = createRequire('/home/user/Chuyen-Anh/');
process.env.SUPABASE_URL = 'https://example.test';
process.env.SUPABASE_SECRET_KEY = 'k';
process.env.TELEMETRY_IP_SALT = 'a'.repeat(32);
const mod = require('/home/user/Chuyen-Anh/api/telemetry.js');
const handler = mod.default || mod;
global.fetch = async (url, opts) => {
  const v = JSON.parse(opts.body).payload.appVersion;
  return /^v[0-9]+\.[0-9]+\.[0-9]+(-[a-z]+[0-9]+)?$/.test(v)
    ? { ok: true, status: 200, json: async () => ({ status: 'ok', id: 'row-1' }) }
    : { ok: true, status: 200, json: async () => ({ status: 'invalid', reason: 'bad-app-version' }) };
};
const run = async (appVersion) => {
  let out = null;
  const res = { statusCode: 0, setHeader() {}, end(b) { out = JSON.parse(b); } };
  await handler({ method: 'POST', headers: { origin: 'https://coderunknow.github.io', 'x-forwarded-for': '1.2.3.4', 'content-type': 'application/json' },
    body: { contract: 1, appVersion, environment: {}, events: [{ at: new Date().toISOString(), kind: 'boot', name: 'smoke' }] } }, res);
  console.log(String(appVersion).padEnd(14), '->', res.statusCode, JSON.stringify(out).slice(0, 50));
};
await run('v1.0.0-rc11');
await run('v1.0.0');
await run('rc5');
