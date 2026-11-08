import fs from 'node:fs';

const envPath = 'C:/dev/AionUi-fork/.voyager-company.local.env';
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const email = 'voyager.collaudo@psxworkbench.com';
const password = 'V0yager!Collaudo2026';

const login = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const session = await login.json();
if (!session.access_token) { console.log('LOGIN FAIL', JSON.stringify(session).slice(0, 300)); process.exit(1); }
const cookie = `sb-psx-dev-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;
console.log('login OK, org user:', session.user?.email);

const keyRes = await fetch(`${env.PSX_WORKBENCH_BASE}/api/crm/chiavi`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie },
  body: JSON.stringify({ nome: 'voyager-company-collaudo-v1', kind: 'service', scopes: ['runtime.compose'] }),
});
const keyText = await keyRes.text();
console.log('chiavi status:', keyRes.status);
console.log(keyText.slice(0, 500));

const orgRes = await fetch(`${env.PSX_WORKBENCH_BASE}/api/crm/organizzazioni`, {
  headers: { cookie },
});
const orgText = await orgRes.text();
console.log('orgs status:', orgRes.status);
console.log(orgText.slice(0, 400));
