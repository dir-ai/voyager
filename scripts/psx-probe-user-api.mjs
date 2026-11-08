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
const cookie = `sb-psx-dev-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;

for (const path of ['/api/crm/runtime', '/api/me', '/api/auth/me', '/api/crm/organizzazioni?', '/api/config/ai-agents']) {
  const res = await fetch(`${env.PSX_WORKBENCH_BASE}${path}`, { headers: { cookie } });
  const text = await res.text();
  console.log(path, '->', res.status, text.replace(/\s+/g, ' ').slice(0, 220));
}
