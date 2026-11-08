// GO UNICO (A-54): parti di continuazione per conversazioni cresciute durante la finestra
// di migrazione. La chiave <id>-p2 esiste sul server con canone vecchio (piu' corta) e il
// contratto non prevede aggiornamento; la crescita e' append puro, quindi la coda di
// messaggi dopo la lunghezza vecchia viene inviata come nuova parte sequenziale <id>-p3.
// Ricostruzione server-side: p1 + p2(vecchio) + p3 = conversazione completa e contigua.
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

// [idBase, lunghezzaVecchiaP2] — dalla sonda: 2820 e 2679
const CONTINUAZIONI = [
  ['6100e885', 2820],
  ['5e5794ab', 2679],
];

const righe = fs.readFileSync(new URL('migrazione-out/blocco-3-conversazioni.jsonl', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const perChiave = new Map(righe.map((r) => [r.chiave, r]));

for (const [id, vecLen] of CONTINUAZIONI) {
  const p2 = perChiave.get(`${id}-p2`);
  if (!p2) { console.log(`${id}-p2: assente dallo snapshot fresco`); continue; }
  const coda = p2.messages.slice(vecLen);
  if (!coda.length) { console.log(`${id}-p3: nessun messaggio nuovo`); continue; }
  const riga = { ...p2, chiave: `${id}-p3`, messages: coda };
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
  console.log(`${id}-p3 (${coda.length} msg, continua dopo ${vecLen}): HTTP ${r.status} ${JSON.stringify(b).slice(0, 300)}`);
}
