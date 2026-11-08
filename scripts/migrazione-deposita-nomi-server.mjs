// RIDEPOSITA i transport_config con chiave_logica = nome server (lettera-34 punto 2)
import fs from 'node:fs';
import Database from 'bun:sqlite';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const rich = fs.readFileSync(new URL('.migrazione-richiesta-id.txt', import.meta.url), 'utf8').trim();
const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const s = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(s), 'utf8').toString('base64');
const db = new Database(process.env.APPDATA + '/AionUi/aionui/aionui-backend.db', { readonly: true });
for (const m of db.prepare('SELECT name, transport_config FROM mcp_servers WHERE deleted_at IS NULL').all()) {
  const r = await fetch('https://dev.psxworkbench.com/api/migrazione/segreto', {
    method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
    body: JSON.stringify({ richiestaId: rich, chiave_logica: m.name, valore: m.transport_config }),
  });
  const b = await r.json().catch(() => null);
  console.log(m.name, '→', r.status, b?.deposito ?? JSON.stringify(b));
}
