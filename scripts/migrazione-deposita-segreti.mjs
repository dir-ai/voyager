// VOYAGER migrazione — deposito segreti nel vault PSX (lettera-30) + blocco 'provider'.
// I valori NEMAI stampati; vanno solo al vault via HTTPS. Usage: bun scripts/migrazione-deposita-segreti.mjs
import fs from 'node:fs';
import Database from 'bun:sqlite';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const BASE = 'https://dev.psxworkbench.com';
const rich = fs.readFileSync(new URL('.migrazione-richiesta-id.txt', import.meta.url), 'utf8').trim();
const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
if (!lr.ok) { console.log('login:', lr.status); process.exit(1); }
const s = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(s), 'utf8').toString('base64');

const post = async (path, body) => {
  const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return [r.status, await r.json().catch(() => null)];
};

// ── 1) Depositi vault ──
const db = new Database(process.env.APPDATA + '/AionUi/aionui/aionui-backend.db', { readonly: true });
const mcpRows = db.prepare('SELECT name, transport_config FROM mcp_servers WHERE deleted_at IS NULL').all();
const deposits = [];
for (const m of mcpRows) {
  const slug = m.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
  deposits.push({ chiave_logica: `mcp-${slug}-transport-config`, valore: m.transport_config });
}
// chiave PSX provider: presente in chiaro nell'env del MCP image-gen (AIONUI_IMG_API_KEY)
const imgCfg = JSON.parse(mcpRows.find((m) => m.name === 'aionui-image-generation')?.transport_config || '{}');
const psxKey = imgCfg.env?.AIONUI_IMG_API_KEY;
if (psxKey) deposits.push({ chiave_logica: 'provider-psx-api-key', valore: psxKey });

const refs = {};
for (const d of deposits) {
  const [st, b] = await post('/api/migrazione/segreto', { richiestaId: rich, chiave_logica: d.chiave_logica, valore: d.valore });
  const ref = b?.vault_ref;
  console.log(`deposito ${d.chiave_logica}: ${st} ${ref ? 'registrato/ripetuto' : JSON.stringify(b)}`);
  if (ref) refs[d.chiave_logica] = ref;
}

// ── 2) GET elenco (read-back senza valori) ──
const gr = await fetch(`${BASE}/api/migrazione/segreto?richiestaId=${rich}`, { headers: { cookie } });
const gb = await gr.json().catch(() => null);
console.log('elenco segreti:', gr.status, JSON.stringify(gb)?.slice(0, 500));

// ── 3) Blocco 'provider' con solo vault_ref verificati ──
const providers = [];
if (refs['provider-psx-api-key']) {
  const p = db.prepare("SELECT * FROM providers WHERE name='PSX'").get();
  providers.push({
    nome: p.name,
    tipo: 'openai-compatibile',
    api_key_vault_ref: refs['provider-psx-api-key'],
    base_url: p.base_url,
    modello: JSON.parse(p.models || '[]')[0] || null,
  });
}
// provider con chiave NON estraibile dal vecchio keystore: NON nel blocco (nessun ref finto)
console.log('provider nel blocco:', providers.map((p) => p.nome).join(', ') || '(nessuno)');
if (providers.length) {
  const carico = { organizationId: env.VOYAGER_ORG_ID || 'a0878014-77ce-4057-b855-cb3f7175a790', providers };
  const crypto = await import('node:crypto');
  const pacchetto = {
    schema_version: 'migrazione-1',
    richiestaId: rich,
    tipo_blocco: 'provider',
    hash_sha256: crypto.createHash('sha256').update(JSON.stringify(carico, Object.keys(carico).sort())).digest('hex'),
    carico,
  };
  const [st, b] = await post('/api/migrazione/blocco', pacchetto);
  console.log('blocco provider:', st, JSON.stringify(b)?.slice(0, 600));
}

const st2 = await fetch(`${BASE}/api/migrazione/${rich}`, { headers: { cookie } });
const sb = await st2.json().catch(() => ({}));
console.log('stato:', st2.status, JSON.stringify(sb?.stato?.blocchi ?? sb.stato).slice(0, 500));
