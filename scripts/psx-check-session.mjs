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
if (!session.access_token) { console.log('LOGIN FAIL'); process.exit(1); }
const cookie = `sb-psx-dev-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;

// refresh token check + expires
console.log('session expires_in:', session.expires_in, 'expires_at:', new Date((session.expires_at || 0) * 1000).toISOString());
const orgs = await (await fetch('https://dev.psxworkbench.com/api/user/orgs', { headers: { cookie } })).json();
console.log('orgs:', JSON.stringify(orgs).slice(0, 300));
