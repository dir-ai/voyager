// VOYAGER goal-loop check: bearer control-plane + member runtime readback.
// Usage: node scripts/psx-loop-check.mjs [anonKey]
// Exits 0 if all green, 1 otherwise.
import fs from 'node:fs';

const env = Object.fromEntries(
  fs.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/)
    .map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2])
    .filter(Boolean),
);
const anon = process.argv[2] || env.VITE_SUPABASE_ANON_KEY;
const key = env.PSX_API_KEY;
const org = 'a0878014-77ce-4057-b855-cb3f7175a790';
let ok = true;

// 1) Bearer control-plane read
const r1 = await fetch(`https://dev.psxworkbench.com/api/v1/runtime?organization_id=${org}`, {
  headers: { Authorization: `Bearer ${key}` },
});
console.log('bearer /api/v1/runtime:', r1.status);
ok &&= r1.status === 200;

// 2) Member session readback (cutover)
const lr = await fetch(`${env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
if (!lr.ok) { console.log('login collaudo:', lr.status); process.exit(1); }
const session = await lr.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
const r2 = await fetch(`https://dev.psxworkbench.com/api/crm/runtime?organization_id=${org}`, { headers: { cookie } });
console.log('member /api/crm/runtime:', r2.status);
ok &&= r2.status === 200;

process.exit(ok ? 0 : 1);
