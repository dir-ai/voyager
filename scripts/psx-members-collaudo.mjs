// Collaudo firme confermate CLIENT RUNTIME: members / revoke / accept(metodo errato atteso 405 su GET-by-token POST).
import { readFileSync } from 'node:fs';

const envTxt = readFileSync('C:/dev/AionUi-fork/.voyager-company.local.env', 'utf8');
const env = {};
for (const line of envTxt.split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}
const WB = env.PSX_WORKBENCH_BASE;
const SUPA = env.SUPABASE_URL;
const ANON = env.SUPABASE_ANON_KEY;
const EMAIL = env.VOYAGER_TEST_USER;
const PASS = env.VOYAGER_TEST_PASSWORD;
const ORG = process.argv[2] || 'a0878014-45a0-4b40-9183-2e4a6a09e9b1';

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', apikey: ANON },
  body: JSON.stringify({ email: EMAIL, password: PASS, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const j = await r.json();
if (!j.access_token) { console.log('LOGIN FAIL', r.status); process.exit(1); }
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(j)).toString('base64');
const H = { cookie, apikey: ANON, 'content-type': 'application/json' };

// 1) GET members
const g = await fetch(`${WB}/api/org/members?organization_id=${ORG}`, { headers: H });
console.log('GET members', g.status, JSON.stringify((await g.json().catch(() => ({})))).slice(0, 400));

// 2) create invite (per testare revoke) — admin only; test user potrebbe non essere admin
const ci = await fetch(`${WB}/api/org/invite`, {
  method: 'POST', headers: H,
  body: JSON.stringify({ organization_id: ORG, email: `revoke-probe-${Date.now()}@psxworkbench.com`, role: 'member' }),
});
const cj = await ci.json().catch(() => ({}));
console.log('POST invite', ci.status, JSON.stringify(cj).slice(0, 300));
if (ci.status === 201 && cj.invite?.id) {
  const del = await fetch(`${WB}/api/org/invite?id=${cj.invite.id}`, { method: 'DELETE', headers: H });
  console.log('DELETE invite(revoke)', del.status, JSON.stringify(await del.json().catch(() => ({}))).slice(0, 200));
}
// 3) accept con token falso → atteso 404/410 (non 405): conferma rotta esiste
const fa = await fetch(`${WB}/api/org/invite/fake-token-probe/accept`, { method: 'POST', headers: H });
console.log('POST accept(fake)', fa.status, JSON.stringify(await fa.json().catch(() => ({}))).slice(0, 200));
