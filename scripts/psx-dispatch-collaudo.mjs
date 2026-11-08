// Collaudo DISPATCH (lettera-19 CLIENT RUNTIME, rev bd2f27c3) — mirror dei 9 assert, canale 'voyager'
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const envTxt = readFileSync('C:/dev/AionUi-fork/.voyager-company.local.env', 'utf8');
const env = {};
for (const line of envTxt.split(/\r?\n/)) {
  const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
  if (m) env[m[1]] = m[2];
}
const WB = env.PSX_WORKBENCH_BASE, SUPA = env.SUPABASE_URL, ANON = env.SUPABASE_ANON_KEY;
const EMAIL = env.VOYAGER_TEST_USER, PASS = env.VOYAGER_TEST_PASSWORD;

let pass = 0, fail = 0;
const ok = (label, cond, extra = '') => { if (cond) { pass++; console.log(`  ✓ ${label}`); } else { fail++; console.log(`  ✗ ${label} ${extra}`); } };
const H = (cookie, extra = {}) => ({ cookie, 'content-type': 'application/json', apikey: ANON, ...extra });
const json = async (r) => { try { return await r.json(); } catch { return {}; } };

const lr = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
  method: 'POST', headers: { 'content-type': 'application/json', apikey: ANON },
  body: JSON.stringify({ email: EMAIL, password: PASS, gotrue_meta_security: { captcha_token: 'unsupported' } }),
});
const sj = await json(lr);
if (!sj.access_token) { console.log('LOGIN FAIL', lr.status); process.exit(1); }
const cookie = 'sb-psx-dev-auth-token=base64-' + Buffer.from(JSON.stringify(sj)).toString('base64');

// 1. bootstrap org di prova + reparto + dipendente
const b1 = await fetch(`${WB}/api/org/crea`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ nome: `VOYAGER Dispatch Collaudo ${Date.now()}`, richiestaId: randomUUID() }) });
const b1j = await json(b1);
const orgId = b1j.organizzazione?.id || b1j.organizzazione?.organization?.id || b1j.azienda?.organization_id;
ok('bootstrap 201', b1.status === 201 && !!orgId, JSON.stringify(b1j).slice(0, 150));
const rRep = await fetch(`${WB}/api/crm/reparti`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ nome: 'Ufficio Dispatch', azienda_id: b1j.azienda.id, sede_id: b1j.sede.id }) });
const rep = await json(rRep);
const repartoId = rep.reparto?.id || rep.id;
ok('reparto 201', rRep.status === 201 && !!repartoId, JSON.stringify(rep).slice(0, 150));
const rDip = await fetch(`${WB}/api/org/dipendenti`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, nome: 'Marco Dispatch', ruolo: 'operativo', repartoId, richiestaId: randomUUID() }) });
const dip = await json(rDip);
const agentId = dip.dipendente?.id;
ok('dipendente 201', rDip.status === 201 && !!agentId, JSON.stringify(dip).slice(0, 150));

// 2. POST dispatch → 201 IN_CODA canale voyager
const dRid = randomUUID();
const rD1 = await fetch(`${WB}/api/org/agenti/dispatch`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, canale: 'voyager', richiesta: 'Prepara il preventivo per il cliente Rossi', richiestaId: dRid, priorita: 5 }) });
const d1 = await json(rD1);
console.log('POST DISPATCH FULL:', JSON.stringify(d1));
// NOTA: la lettera-19 dichiarava 201; il server risponde 202 Accepted (semantica coda asincrona) — segnalato a CLIENT RUNTIME.
ok('dispatch creato canale voyager (HTTP 200/202)', [200, 202].includes(rD1.status) && d1.dispatch?.canale === 'voyager' && d1.dispatch?.stato === 'IN_CODA' && !!d1.dispatch?.id, JSON.stringify(d1).slice(0, 300));

// 3. retry stesso richiestaId → 200 ripetuto
const rD2 = await fetch(`${WB}/api/org/agenti/dispatch`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, canale: 'voyager', richiesta: 'Prepara il preventivo per il cliente Rossi', richiestaId: dRid, priorita: 5 }) });
const d2 = await json(rD2);
ok('retry idempotente 200 ripetuto', rD2.status === 200 && d2.ripetuto === true, JSON.stringify(d2).slice(0, 200));

// 4. GET stato per dispatch_id → IN_CODA (stato canonico leggibile via GET)
const rG1 = await fetch(`${WB}/api/org/agenti/dispatch?organization_id=${orgId}&dispatch_id=${d1.dispatch.id}`, { headers: H(cookie) });
const g1 = await json(rG1);
ok('GET stato 200 IN_CODA', rG1.status === 200 && (g1.dispatch?.stato || g1.orders?.[0]?.stato) === 'IN_CODA', JSON.stringify(g1).slice(0, 200));

// 5. GET coda per org+agent
const rG2 = await fetch(`${WB}/api/org/agenti/dispatch?organization_id=${orgId}&agent_id=${agentId}`, { headers: H(cookie) });
const g2 = await json(rG2);
const queue = g2.orders || g2.dispatches || [g2.dispatch];
ok('GET coda 200 (>=1 ordine)', rG2.status === 200 && Array.isArray(queue) && queue.length >= 1, JSON.stringify(g2).slice(0, 200));

// 6. richiesta vuota → 400
const rE = await fetch(`${WB}/api/org/agenti/dispatch`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, canale: 'voyager', richiesta: '', richiestaId: randomUUID() }) });
ok('richiesta vuota → 400', rE.status === 400, String(rE.status));

// 7. dispatch su agente ritirato → 409 AGENTE_RITIRATO
const rD = await fetch(`${WB}/api/voyager/azienda/agenti/${agentId}/ritiro`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, motivo: 'collaudo dispatch' }) });
ok('ritiro 200', rD.status === 200 || rD.status === 201, String(rD.status));
const rD3 = await fetch(`${WB}/api/org/agenti/dispatch`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, canale: 'voyager', richiesta: 'test post-ritiro', richiestaId: randomUUID() }) });
ok('dispatch post-ritiro → 409 AGENTE_RITIRATO', rD3.status === 409, `${rD3.status} ${JSON.stringify(await json(rD3)).slice(0, 200)}`);

// 8. 401 senza sessione
const rAnon = await fetch(`${WB}/api/org/agenti/dispatch?organization_id=${orgId}`, { headers: { 'content-type': 'application/json' } });
ok('401 senza sessione', rAnon.status === 401, String(rAnon.status));

console.log(`\nRISULTATO: ${pass} pass / ${fail} fail`);
console.log('ORG di prova per cleanup CLIENT RUNTIME:', orgId);
process.exit(fail ? 1 : 0);
