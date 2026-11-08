import fs from 'node:fs';

const envPath = 'C:/dev/AionUi-fork/.voyager-company.local.env';
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const login = await fetch('https://supabase.psxworkbench.com/auth/v1/token?grant_type=password', {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD }),
});
const session = await login.json();
const cookie = `sb-psx-dev-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;

const res = await fetch('https://dev.psxworkbench.com/api/crm/runtime?organization_id=a0878014-77ce-4057-b855-cb3f7175a790', { headers: { cookie } });
const body = await res.json().catch(() => ({}));
console.log('runtime via session ->', res.status);
console.log(JSON.stringify(body).replace(/\s+/g, ' ').slice(0, 400));
