// VOYAGER migrazione — invio BLOCCO 4 (capacita). Lettera-33: derivazione AUTOMATICA
// dal config_originale degli assistenti importati → carico = {organizationId} SOLO.
// Usage: bun scripts/migrazione-invia-blocco4.mjs
import fs from 'node:fs';
import crypto from 'node:crypto';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const BASE = 'https://dev.psxworkbench.com';
const ORG = env.VOYAGER_ORG_ID || 'a0878014-77ce-4057-b855-cb3f7175a790';
const rich = fs.readFileSync(new URL('.migrazione-richiesta-id.txt', import.meta.url), 'utf8').trim();
const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
if (!lr.ok) { console.log('login:', lr.status); process.exit(1); }
const s = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(s), 'utf8').toString('base64');

const pkt = null; // lettera-33: nessun pacchetto da file, carico minimale
const carico = { organizationId: ORG };
const canon = JSON.stringify(carico, Object.keys(carico).sort());
const pacchetto = {
  schema_version: 'migrazione-1',
  richiestaId: rich,
  tipo_blocco: 'capacita',
  hash_sha256: crypto.createHash('sha256').update(canon).digest('hex'),
  carico,
};

const r = await fetch(`${BASE}/api/migrazione/blocco`, {
  method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify(pacchetto),
});
const body = await r.json().catch(() => null);
console.log('blocco capacita:', r.status, JSON.stringify(body)?.slice(0, 800));

const st = await fetch(`${BASE}/api/migrazione/${rich}`, { headers: { cookie } });
const sb = await st.json().catch(() => ({}));
console.log('stato:', st.status, JSON.stringify(sb?.stato?.blocchi ?? sb.stato).slice(0, 400));
