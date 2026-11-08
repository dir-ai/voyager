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
const token = '7818a75410e83d34508fd8ae266c5006042744b2d0d6933c1fb47bcd7e7fe6cf';
const post = (p, b) => fetch('https://dev.psxworkbench.com' + p, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, ...(b ? { body: JSON.stringify(b) } : {}) });
const res1 = await post(`/api/org/invite/${token}`);
console.log('POST /api/org/invite/:token:', res1.status, JSON.stringify(await res1.json().catch(() => ({}))).slice(0, 300));
// DELETE: forse con body
const del = await fetch('https://dev.psxworkbench.com/api/org/invite', { method: 'DELETE', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ organization_id: 'a0878014-77ce-4057-b855-cb3f7175a790', invite_id: '7dc37705-23f9-4eaa-b76f-8b541219f02a' }) });
console.log('DELETE body:', del.status, JSON.stringify(await del.json().catch(() => ({}))).slice(0, 200));
