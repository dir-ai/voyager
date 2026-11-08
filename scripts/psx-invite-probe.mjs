// Sonda contratto inviti umani (/api/org/invite) — superficie cliente
import fs from 'node:fs';
const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const r = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const session = await r.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
const org = 'a0878014-77ce-4057-b855-cb3f7175a790';
const post = (p, b, method = 'POST') => fetch('https://dev.psxworkbench.com' + p, { method, headers: { cookie, 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });

// crea invito
const r1 = await post('/api/org/invite', { organization_id: org, email: 'collaboratore-prova@psxworkbench.com', role: 'member' });
const b1 = await r1.json();
console.log('invite POST:', r1.status, JSON.stringify(b1).slice(0, 400));
const token = b1.invite?.token || b1.token;

// elenco inviti
const r2 = await fetch(`https://dev.psxworkbench.com/api/org/invite?organization_id=${org}`, { headers: { cookie } });
console.log('invite GET:', r2.status, JSON.stringify(await r2.json().catch(() => ({}))).slice(0, 300));

// lettura invito per token (senza accettare)
if (token) {
  const r3 = await fetch(`https://dev.psxworkbench.com/api/org/invite/${token}`, { headers: { cookie } });
  console.log('invite by token:', r3.status, JSON.stringify(await r3.json().catch(() => ({}))).slice(0, 300));
} else {
  console.log('no token in response — accept flow non testato');
}
