// verifica stato dell'ordine dispatch creato dal collaudo
import { readFileSync } from 'node:fs';
const envTxt = readFileSync('C:/dev/AionUi-fork/.voyager-company.local.env', 'utf8');
const env = {};
for (const line of envTxt.split(/\r?\n/)) { const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim()); if (m) env[m[1]] = m[2]; }
const SUPA = env.SUPABASE_URL, ANON = env.SUPABASE_ANON_KEY;
const lr = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { 'content-type': 'application/json', apikey: ANON }, body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }) });
const sj = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(sj)).toString('base64');
const r = await fetch(`${env.PSX_WORKBENCH_BASE}/api/org/agenti/dispatch?organization_id=670d7dd5-2084-4b87-9f76-476d37b339b3`, { headers: { cookie, apikey: ANON } });
console.log(r.status, JSON.stringify(await r.json(), null, 1).slice(0, 800));
