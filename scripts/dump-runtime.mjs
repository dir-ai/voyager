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
const res = await fetch('https://dev.psxworkbench.com/api/crm/runtime?organization_id=667465a0-334a-4e69-82a6-c88bbaab88ef', { headers: { cookie } });
const b = await res.json();
const walk = (o, pre, depth) => {
  if (depth > 4 || !o || typeof o !== 'object') return;
  for (const k of Object.keys(o)) {
    const v = o[k];
    if (Array.isArray(v)) { if (v.length) console.log(pre + k, `[${v.length}]`, JSON.stringify(v[0]).slice(0, 130)); }
    else if (v && typeof v === 'object') walk(v, pre + k + '.', depth + 1);
  }
};
console.log('top keys:', Object.keys(b).join(','));
walk(b, '', 0);
