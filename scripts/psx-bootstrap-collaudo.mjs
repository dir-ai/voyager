// End-to-end client-side collaudo of POST /api/org/crea contract (same path as in-app service)
// Usage: node psx-bootstrap-collaudo.mjs <email> <password> <orgname>
const SUPA = 'https://supabase.psxworkbench.com';
const ANON = process.env.VOYAGER_SUPA_ANON || (() => { throw new Error('anon key required'); })();
const [email, pass, orgName] = process.argv.slice(2);
const COOKIE_NAME = 'sb-psx-dev-auth-token';

const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email, password: pass, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
if (!r.ok) { console.error('LOGIN FAIL', r.status, await r.text()); process.exit(1); }
const session = await r.json();
const cookieVal = 'base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
const cookie = `${COOKIE_NAME}=${cookieVal}`;
console.log('login ok, user', session.user?.id);

const richiestaId = crypto.randomUUID();
const sede = { nome: 'Sede principale', citta: 'Collaudo' };
const t0 = Date.now();
const res = await fetch('https://dev.psxworkbench.com/api/org/crea', {
  method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ nome: orgName, richiestaId, sede }),
});
const body = await res.json().catch(() => ({}));
console.log('CREATE', res.status, JSON.stringify(body).slice(0, 400), `${Date.now() - t0}ms`);
if (res.status !== 201) process.exit(2);

// retry same richiestaId -> 200 ripetuta true
const t1 = Date.now();
const res2 = await fetch('https://dev.psxworkbench.com/api/org/crea', {
  method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ nome: orgName, richiestaId, sede }),
});
const b2 = await res2.json();
console.log('RETRY', res2.status, 'ripetuta=', b2.ripetuta, 'sameOrg=', b2.organizzazione?.id === body.organizzazione.id, `${Date.now() - t1}ms`);

// duplicate name, different richiestaId -> 409
const res3 = await fetch('https://dev.psxworkbench.com/api/org/crea', {
  method: 'POST', headers: { cookie, 'Content-Type': 'application/json' },
  body: JSON.stringify({ nome: orgName, richiestaId: crypto.randomUUID(), sede }),
});
const b3 = await res3.json();
console.log('OMONIMA', res3.status, b3.error?.code, 'esistenti=', (b3.error?.esistenti || []).length);

// read-back member runtime
const orgId = body.organizzazione.id;
const res4 = await fetch(`https://dev.psxworkbench.com/api/crm/runtime?organization_id=${orgId}`, { headers: { cookie } });
const b4 = await res4.json().catch(() => ({}));
console.log('READBACK', res4.status, 'aziende=', b4?.identitaEStruttura?.configurato?.aziende?.length ?? 'n/a', 'sedi=', b4?.identitaEStruttura?.configurato?.sedi?.length ?? 'n/a');

// not authenticated
const res5 = await fetch('https://dev.psxworkbench.com/api/org/crea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'X', richiestaId: crypto.randomUUID() }) });
console.log('NOAUTH', res5.status);
// bad UUID
const res6 = await fetch('https://dev.psxworkbench.com/api/org/crea', { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify({ nome: 'X', richiestaId: 'not-a-uuid' }) });
const b6 = await res6.json();
console.log('BADUUID', res6.status, b6.error?.code, b6.error?.campo);
console.log('ORG CREATED (leave for PSX cleanup):', orgId, orgName);
