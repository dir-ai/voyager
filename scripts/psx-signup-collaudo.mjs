import fs from 'node:fs';

const envPath = 'C:/dev/AionUi-fork/.voyager-company.local.env';
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);

const email = process.argv[2];
const password = process.argv[3];
if (!email || !password) { console.error('usage: node psx-signup-collaudo.mjs <email> <password>'); process.exit(1); }

const res = await fetch(`${env.SUPABASE_URL}/auth/v1/signup`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email, password }),
});
const text = await res.text();
console.log('signup status:', res.status);
console.log(text.slice(0, 600));

if (res.ok) {
  const session = JSON.parse(text);
  const provision = await fetch(`${env.PSX_WORKBENCH_BASE}/api/auth/provision`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: `sb-psx-dev-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}` },
    body: JSON.stringify({ companyName: 'VOYAGER Collaudo', fullName: 'Voyager Collaudo', username: 'voyager-collaudo' }),
  });
  const ptext = await provision.text();
  console.log('provision status:', provision.status);
  console.log(ptext.slice(0, 800));
}
