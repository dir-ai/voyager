// VOYAGER migrazione — invio BLOCCO 3 (conversazioni): tipo 'conversazioni' (lettera-32),
// carico = {organizationId, conversazioni:[{chiave, title?, messages:[{role, content, timestamp?}]}]},
// batch 25 righe/POST, hash della SOLA parte, idempotenza per chiave.
// Usage: bun scripts/migrazione-invia-blocco3.mjs
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

const righe = fs.readFileSync(new URL('migrazione-out/blocco-3-conversazioni.jsonl', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const BATCH = Number(process.env.MIGRAZIONE_BATCH || 25);
const parts = [];
for (let i = 0; i < righe.length; i += BATCH) {
  const slice = righe.slice(i, i + BATCH);
  const pIdx = String(Math.floor(i / BATCH) + 1).padStart(4, '0');
  const carico = { organizationId: ORG, conversazioni: slice };
  const canon = JSON.stringify(carico, Object.keys(carico).sort());
  parts.push({
    schema_version: 'migrazione-1',
    richiestaId: rich, // BASE; chiave di ogni conversazione è in riga
    tipo_blocco: 'conversazioni',
    hash_sha256: crypto.createHash('sha256').update(canon).digest('hex'),
    carico,
  });
}
console.log(`parti: ${parts.length} (${righe.length} righe, batch ${BATCH})`);

let ok = 0, fail = 0;
for (const p of parts) {
  const r = await fetch(`${BASE}/api/migrazione/blocco`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(p),
  });
  const b = await r.json().catch(() => null);
  const esito = r.status === 200 || r.status === 201 ? 'OK' : 'FAIL';
  if (esito === 'OK') ok++; else fail++;
  console.log(`${p.richiestaId}: ${r.status} ${esito}`, esito === 'FAIL' ? JSON.stringify(b)?.slice(0, 500) : '');
  if (esito === 'FAIL' && fail === 1) break; // prima parte fallita: stop, diagnosticare
}

const st = await fetch(`${BASE}/api/migrazione/${rich}`, { headers: { cookie } });
const sb = await st.json().catch(() => ({}));
console.log('stato:', st.status, JSON.stringify(sb?.stato?.blocchi ?? sb.stato).slice(0, 400));
