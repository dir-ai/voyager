// VOYAGER migrazione — avvia + stato (collaudo client). Idempotente per richiestaId.
// Usage: bun scripts/migrazione-avvia-check.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const BASE = 'https://dev.psxworkbench.com';
const anon = env.VITE_SUPABASE_ANON_KEY;

const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
if (!lr.ok) { console.log('login:', lr.status); process.exit(1); }
const s = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(s), 'utf8').toString('base64');

// richiestaId DETERMINISTICO (idempotenza across-run): derivato da utente+origine
const rich = () => crypto.randomUUID();
const richiestaId = process.env.MIGRAZIONE_RICHIESTA_ID || rich();
const origine = 'voyager-old-client-aionui';
fs.writeFileSync(new URL('../scripts/.migrazione-richiesta-id.txt', import.meta.url), richiestaId, 'utf8');

const r1 = await fetch(`${BASE}/api/migrazione/avvia`, {
  method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ richiestaId, origineDichiarata: origine }),
});
console.log('avvia:', r1.status, JSON.stringify(await r1.json().catch(() => ({}))).slice(0, 200));

const r2 = await fetch(`${BASE}/api/migrazione/avvia`, {
  method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ richiestaId, origineDichiarata: origine }),
});
console.log('avvia (retry):', r2.status, '— atteso 200 ripetuta');

const r3 = await fetch(`${BASE}/api/migrazione/${richiestaId}`, { headers: { cookie } });
console.log('stato:', r3.status, JSON.stringify(await r3.json().catch(() => ({}))).slice(0, 300));

// cross-user: anon cookie (nessuno) → atteso 404
const r4 = await fetch(`${BASE}/api/migrazione/${richiestaId}`);
console.log('stato senza cookie:', r4.status, '— atteso 404');
console.log('richiestaId salvato in scripts/.migrazione-richiesta-id.txt:', richiestaId);
