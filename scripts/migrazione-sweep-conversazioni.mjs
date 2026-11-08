// GO UNICO (A-54): sweep idempotente completo dello snapshot fresco.
// Una POST per riga: ripetuto/registrato = coperta; 400 CONVERSAZIONE_DIVERSA_STESSA_CHIAVE
// = presente ma con point-in-time precedente (nessuna mutazione, si documenta).
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

const riepilogo = { ripetuto: 0, registrato: 0, diversa: 0, altroErrore: 0 };
for (const riga of righe) {
  const carico = { organizationId: ORG, conversazioni: [riga] };
  const canon = JSON.stringify(carico, Object.keys(carico).sort());
  const pkt = {
    schema_version: 'migrazione-1',
    richiestaId: rich,
    tipo_blocco: 'conversazioni',
    hash_sha256: crypto.createHash('sha256').update(canon).digest('hex'),
    carico,
  };
  const r = await fetch(`${BASE}/api/migrazione/blocco`, {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify(pkt),
  });
  const b = await r.json().catch(() => null);
  let esito = 'altroErrore';
  if (r.status === 200) esito = b?.ripetuti ? 'ripetuto' : 'registrato';
  else if (JSON.stringify(b || {}).includes('CONVERSAZIONE_DIVERSA_STESSA_CHIAVE')) esito = 'diversa';
  riepilogo[esito]++;
  if (esito !== 'ripetuto') console.log(`${esito.toUpperCase()} ${riga.chiave} (${riga.messages.length} msg): ${r.status} ${JSON.stringify(b).slice(0, 220)}`);
}
console.log('RIEPILOGO:', JSON.stringify(riepilogo), 'su', righe.length, 'righe');
