// Collaudo client-side Department & Employee (lettera-7): reparto scoping + dipendente idempotente
const SUPA = 'https://supabase.psxworkbench.com';
const anon = process.argv[2];
const env = Object.fromEntries(
  (await import('node:fs')).default.readFileSync(new URL('../.voyager-company.local.env', import.meta.url), 'utf8')
    .split(/\r?\n/).map((l) => l.match(/^([A-Z0-9_]+)=(.*)$/) && [RegExp.$1, RegExp.$2]).filter(Boolean),
);
const r = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { apikey: anon, 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: env.VOYAGER_TEST_USER, password: env.VOYAGER_TEST_PASSWORD, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const session = await r.json();
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(session), 'utf8').toString('base64');
const post = (p, b) => fetch('https://dev.psxworkbench.com' + p, { method: 'POST', headers: { cookie, 'Content-Type': 'application/json' }, body: JSON.stringify(b) });

// 1) bootstrap org di test
const nome = 'VOYAGER Dipendente Collaudo ' + Date.now();
const r1 = await post('/api/org/crea', { nome, richiestaId: crypto.randomUUID(), sede: { nome: 'Sede principale' } });
const b1 = await r1.json();
console.log('bootstrap:', r1.status, 'org:', b1.organizzazione?.id);
const orgId = b1.organizzazione.id;

// 2) reparto — verifica scoping
const r2 = await post('/api/crm/reparti', { nome: 'Marketing Collaudo', sede_id: b1.sede.id, azienda_id: b1.azienda.id });
const b2 = await r2.json();
console.log('reparto:', r2.status, JSON.stringify(b2).slice(0, 200));
if (r2.status !== 200 && r2.status !== 201) process.exit(1);

// 3) dipendente (idempotente)
const richiestaId = crypto.randomUUID();
const r3 = await post('/api/org/dipendenti', { organizationId: orgId, nome: 'Sara Marketing', ruolo: 'operatore', repartoId: b2.reparto ? b2.reparto.id : b2.id, richiestaId });
const b3 = await r3.json();
console.log('dipendente:', r3.status, JSON.stringify(b3).slice(0, 200));
if (r3.status !== 200 && r3.status !== 201) process.exit(1);
const r4 = await post('/api/org/dipendenti', { organizationId: orgId, nome: 'Sara Marketing', ruolo: 'operatore', repartoId: b2.reparto ? b2.reparto.id : b2.id, richiestaId });
const b4 = await r4.json();
console.log('dipendente retry:', r4.status, 'ripetuto=', b4.ripetuto);

// 4) read-back runtime: reparto+dipendente nell'org di test?
const r5 = await fetch(`https://dev.psxworkbench.com/api/crm/runtime?organization_id=${orgId}`, { headers: { cookie } });
const b5 = await r5.json();
const rt = b5.runtime || b5;
const conf = rt.identitaEStruttura?.configurato || {};
console.log('readback:', r5.status, 'reparti:', JSON.stringify(conf.reparti || []).slice(0, 150), 'dipendenti:', JSON.stringify((conf.dipendenti?.configurato || conf.dipendenti || [])).slice(0, 200));
console.log('TEST-ORG left for cleanup:', orgId, nome);
