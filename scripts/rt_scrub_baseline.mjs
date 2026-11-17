// D-SR3 baseline reproduction: secret-shaped strings survive telemetry note scrubbing.
// Runs the SHIPPED scrub functions (client module from index.html, server api/telemetry.js)
// against adversarial note payloads and prints exactly what would be stored.
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);

const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const appSource = html.match(/<script type="module" id="app-script">([\s\S]*?)<\/script>/)[1];
const app = await import(`data:text/javascript;base64,${Buffer.from(appSource).toString('base64')}`);
const { scrubTelemetryText, sanitizeTelemetryEvent } = app;
const api = require(fileURLToPath(new URL('../api/telemetry.js', import.meta.url)));

const samples = [
  ['github PAT', 'Uncaught Error: request failed with token ghp_0123456789abcdefghijklmnopqrstuvwxyz in headers'],
  ['openai-style key', 'upload failed using sk-proj-9f8e7d6c5b4a3210feedcba9876543210 at retry 2'],
  ['bearer header', 'network error: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.disallowed'],
  ['URL with credentials', 'could not reach https://learner:s3cretpass@private.example.com/api'],
  ['email (control)', 'mail me at learner@example.com please'],
  ['quoted learner text (control)', 'Import failed: "my-secret-note" rejected'],
  ['script payload', 'error near <script>alert(1)</script> printed'],
];

console.log('=== CLIENT scrubTelemetryText (shipped) ===');
for (const [label, text] of samples) {
  console.log(`${label}: ${JSON.stringify(scrubTelemetryText(text))}`);
}
console.log('=== SERVER scrub via sanitizeEvent note (shipped) ===');
for (const [label, text] of samples) {
  const ev = api.sanitizeEvent({ kind: 'error', at: '2026-11-17T00:00:00.000Z', name: 'uncaught', note: text });
  console.log(`${label}: ${JSON.stringify(ev.note)}`);
}
console.log('=== prototype-pollution counter key (both) ===');
const evC = sanitizeTelemetryEvent({ kind: 'error', at: '2026-11-17T00:00:00.000Z', name: 'x', counters: { __proto__: 1, constructor: 2, turns: 3 } });
console.log('client counters:', JSON.stringify(evC.counters));
const evS = api.sanitizeEvent({ kind: 'error', at: '2026-11-17T00:00:00.000Z', name: 'x', counters: { __proto__: 1, constructor: 2, turns: 3 } });
console.log('server counters:', JSON.stringify(evS.counters));
