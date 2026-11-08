// GO UNICO (A-54): delta di crescita per conversazioni "whole" migrate con snapshot precedente.
// Il contratto non aggiorna una chiave esistente; la crescita e' append puro, quindi la coda
// dopo la lunghezza gia' sul server viene inviata come parte sequenziale <id>-p2.
// Ricostruzione: <id> (base, point-in-time precedente) + <id>-p2 (coda) = conversazione completa.
// NB: per le conversazioni spezzate (p1/p2/p3) la continuazione e' gia' stata inviata come -p3.
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

// [idBase, lunghezzaGiaSulServer] — dai dettagli CONVERSAZIONE_DIVERSA_STESSA_CHIAVE dello sweep
// (formato "gia' migrata con contenuto diverso (N vs M messaggi)" -> N = sul server)
const DELTA = [
  ['794aa937', 1952], ['da87d56c', 2221], ['466e7e95', 2119], ['4cf63c3d', 1340],
  ['40fc2a49', 445], ['985a28de', 1306], ['79211f96', 60], ['7df0ded6', 957],
  ['a430da01', 4353], ['a2073403', 1297], ['852d0db4', 539], ['5ebf4f3d', 111],
];

const righe = fs.readFileSync(new URL('migrazione-out/blocco-3-conversazioni.jsonl', import.meta.url), 'utf8')
  .split('\n').filter((l) => l.trim()).map((l) => JSON.parse(l));
const perChiave = new Map(righe.map((r) => [r.chiave, r]));

let totCoda = 0;
for (const [id, sulServer] of DELTA) {
  const base = perChiave.get(id);
  if (!base) { console.log(`${id}: assente dallo snapshot fresco`); continue; }
  const coda = base.messages.slice(sulServer);
  if (!coda.length) { console.log(`${id}-p2: nessun messaggio nuovo`); continue; }
  totCoda += coda.length;
  const riga = { ...base, chiave: `${id}-p2`, messages: coda };
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
  console.log(`${id}-p2 (+${coda.length} msg dopo ${sulServer}): HTTP ${r.status} ${JSON.stringify(b).slice(0, 220)}`);
}
console.log('TOTALE messaggi di coda inviati:', totCoda);
