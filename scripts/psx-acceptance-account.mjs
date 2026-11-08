import fs from 'node:fs';

const envPath = 'C:/dev/AionUi-fork/.voyager-company.local.env';
const env = Object.fromEntries(
  fs.readFileSync(envPath, 'utf8').split(/\r?\n/).filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }),
);
const WB = 'https://dev.psxworkbench.com';
const SB = 'https://supabase.psxworkbench.com';
const OURS = 'a0878014-77ce-4057-b855-cb3f7175a790';
const OTHER = 'fe0db974-0000-0000-0000-000000000000'; // altra org (canary) — attesa 404
let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('PASS', name, extra); } else { fail++; console.log('FAIL', name, extra); } };

const cookieOf = (session) => `sb-psx-dev-auth-token=base64-${Buffer.from(JSON.stringify(session)).toString('base64')}`;

// 1) LOGIN
const login = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD }),
});
const s1 = await login.json();
ok('login', login.ok && !!s1.access_token);
let cookie = cookieOf(s1);

// 2) SELECT ORG
const orgsRes = await fetch(`${WB}/api/user/orgs`, { headers: { cookie } });
const orgs = await orgsRes.json();
const list = Array.isArray(orgs) ? orgs : orgs.orgs ?? orgs.organizzazioni ?? [];
ok('orgs list', orgsRes.ok && list.length > 0, JSON.stringify(list).slice(0, 120));

// 3) READ ACCOUNT
const meRes = await fetch(`${WB}/api/me`, { headers: { cookie } });
const me = await meRes.json();
ok('me read', meRes.ok && !!me.userId && me.email === env.VOYAGER_TEST_USER, `${me.platformRole} orgIds=${me.orgIds?.length}`);

// 4) READ RUNTIME (own org)
const rtRes = await fetch(`${WB}/api/crm/runtime?organization_id=${OURS}`, { headers: { cookie } });
ok('runtime own org', rtRes.ok, `${(await rtRes.text()).length}B`);

// 5) CROSS-TENANT NEGATO
const rtCross = await fetch(`${WB}/api/crm/runtime?organization_id=${OTHER}`, { headers: { cookie } });
ok('cross-tenant denied (404 anti-enum)', rtCross.status === 404 || rtCross.status === 403, `status=${rtCross.status}`);

// 6) REFRESH (grant refresh_token)
const rf = await fetch(`${SB}/auth/v1/token?grant_type=refresh_token`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ refresh_token: s1.refresh_token }),
});
const s2 = await rf.json();
ok('refresh', rf.ok && !!s2.access_token && s2.access_token !== s1.access_token);
cookie = cookieOf(s2);

// 7) READ con sessione rinnovata
const rt2 = await fetch(`${WB}/api/crm/runtime?organization_id=${OURS}`, { headers: { cookie } });
ok('read after refresh', rt2.ok);

// 8) SESSIONE SCADUTA/REVOCATA — token inventato
const bad = await fetch(`${WB}/api/crm/runtime?organization_id=${OURS}`, { headers: { cookie: cookieOf({ ...s2, access_token: 'x'.repeat(40) }) } });
ok('invalid token rejected', bad.status === 401 || bad.status === 403, `status=${bad.status}`);

// 9) LOGOUT (revoca provider)
const lo = await fetch(`${SB}/auth/v1/logout`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${s2.access_token}`, 'content-type': 'application/json' },
});
ok('logout', lo.ok || lo.status === 204, `status=${lo.status}`);

// 10) token revocato dopo logout
const after = await fetch(`${WB}/api/crm/runtime?organization_id=${OURS}`, { headers: { cookie } });
ok('token dead after logout', [401, 403].includes(after.status), `status=${after.status}`);

// 11) RESTORE — nuovo login
const login2 = await fetch(`${SB}/auth/v1/token?grant_type=password`, {
  method: 'POST',
  headers: { apikey: env.SUPABASE_ANON_KEY, 'content-type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD }),
});
ok('re-login (restore path)', login2.ok);

console.log(`\n${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);
