// Collaudo Capability Bridge v1 — mirror dei 12 assert CLIENT RUNTIME
// (prova-mapping-collaudo.ts). Solo superfici cliente, session cookie, DEV.
// Flusso: login collaudo → bootstrap org di prova → reparto → dipendente (agente PSX)
// → POST mapping (201 SYNC_PENDING) → retry idempotente (200 ripetuto)
// → 409 (richiesta diversa, stesso org+agent+provider)
// → PATCH conferma (read-back) → SYNCED → GET status → PATCH dipendente
// → ritiro → GET (agente is_active:false) → cleanup org shell.
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

// 1. bootstrap org di prova
const rid1 = randomUUID();
const b1 = await fetch(`${WB}/api/org/crea`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ nome: `VOYAGER Bridge Collaudo ${Date.now()}`, richiestaId: rid1 }) });
const b1j = await json(b1);
ok('bootstrap 201 + org/sede/azienda', b1.status === 201 && b1j.azienda?.id && b1j.sede?.id, JSON.stringify(b1j).slice(0, 200));
const orgId = b1j.organizzazione?.id || b1j.organizzazione?.organization?.id || b1j.azienda?.organization_id;
console.log('   org:', orgId);

// 2. reparto (superficie cliente /api/crm/reparti, come createReparto)
const rRep = await fetch(`${WB}/api/crm/reparti`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ nome: 'Ufficio Bridge', azienda_id: b1j.azienda.id, sede_id: b1j.sede.id }) });
const rep = await json(rRep);
const repartoId = rep.reparto?.id || rep.id;
ok('reparto creato', rRep.status === 201 && !!repartoId, JSON.stringify(rep).slice(0, 200));

// 3. dipendente = AI Employee canonico
const dRid = randomUUID();
const rDip = await fetch(`${WB}/api/org/dipendenti`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, nome: 'Sara Bridge', ruolo: 'responsabile commerciale', repartoId, richiestaId: dRid }) });
const dip = await json(rDip);
const agentId = dip.dipendente?.id;
ok('dipendente 201 (agente PSX creato)', rDip.status === 201 && !!agentId, JSON.stringify(dip).slice(0, 200));

// 4. POST mapping → 201 SYNC_PENDING
const mRid = randomUUID();
const rM1 = await fetch(`${WB}/api/org/agenti/mapping`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, executionProvider: 'aionui', richiestaId: mRid }) });
const m1 = await json(rM1);
ok('POST mapping 201 SYNC_PENDING', rM1.status === 201 && m1.mapping?.sync_status === 'SYNC_PENDING', JSON.stringify(m1).slice(0, 300));

// 5. retry stesso richiestaId → 200 ripetuto:true
const rM2 = await fetch(`${WB}/api/org/agenti/mapping`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, executionProvider: 'aionui', richiestaId: mRid }) });
const m2 = await json(rM2);
ok('retry idempotente 200 ripetuto', rM2.status === 200 && m2.ripetuto === true, JSON.stringify(m2).slice(0, 200));

// 6. 409: stesso org+agent+provider, richiesta DIVERSA
const rM3 = await fetch(`${WB}/api/org/agenti/mapping`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, executionProvider: 'aionui', richiestaId: randomUUID() }) });
ok('409 provider duplicato', rM3.status === 409, String(rM3.status));

// 7. PATCH conferma con read-back → SYNCED
const rC1 = await fetch(`${WB}/api/org/agenti/mapping`, { method: 'PATCH', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, executionProvider: 'aionui', richiestaId: mRid, providerAssistantId: 'voyager-assist-prova-1', configurationVersion: 1 }) });
const c1 = await json(rC1);
ok('PATCH conferma → SYNCED', rC1.status === 200 && c1.mapping?.sync_status === 'SYNCED' && c1.mapping?.provider_assistant_id === 'voyager-assist-prova-1', JSON.stringify(c1).slice(0, 300));

// 8. GET status → mapping SYNCED + agente presente
const rG1 = await fetch(`${WB}/api/org/agenti/mapping?organization_id=${orgId}&agent_id=${agentId}`, { headers: H(cookie) });
const g1 = await json(rG1);
ok('GET status 200 SYNCED + config effettiva', rG1.status === 200 && g1.mappings?.[0]?.sync_status === 'SYNCED' && g1.agente?.is_active === true, JSON.stringify(g1).slice(0, 300));

// 9. PATCH dipendente (Update AI Employee)
const rU = await fetch(`${WB}/api/org/dipendenti`, { method: 'PATCH', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, nome: 'Sara Bridge Aggiornata', ruolo: 'commercial senior', model: 'gpt-4.1-mini', temperature: 0.4, expertise: ['preventivi', 'italiano', 'inglese'] }) });
const u = await json(rU);
ok('PATCH dipendente 200 campi aggiornati', rU.status === 200 && u.dipendente?.nome === 'Sara Bridge Aggiornata', JSON.stringify(u).slice(0, 200));

// 10. PATCH con campo invalido → 400
const rU2 = await fetch(`${WB}/api/org/dipendenti`, { method: 'PATCH', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, temperature: 5 }) });
ok('PATCH dipendente campo invalido → 400', rU2.status === 400, String(rU2.status));

// 11. ritiro → SYNC_FAILED (PSX vince). Il body canonico: organization_id + motivo (zod Required).
const rD = await fetch(`${WB}/api/voyager/azienda/agenti/${agentId}/ritiro`, { method: 'POST', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, motivo: 'collaudo capability bridge' }) });
const d = await json(rD);
ok('ritiro 200', rD.status === 200 || rD.status === 201, `${rD.status} ${JSON.stringify(d).slice(0, 200)}`);

// 11b. re-PATCH post-ritiro: il read-back server-side vede is_active:false → SYNC_FAILED (PSX vince)
const rC2 = await fetch(`${WB}/api/org/agenti/mapping`, { method: 'PATCH', headers: H(cookie), body: JSON.stringify({ organizationId: orgId, agentId, executionProvider: 'aionui', richiestaId: mRid, providerAssistantId: 'voyager-assist-prova-1', configurationVersion: 1 }) });
const c2 = await json(rC2);
ok('re-PATCH post-ritiro → SYNC_FAILED riflessa', rC2.status === 200 && c2.mapping?.sync_status === 'SYNC_FAILED', JSON.stringify(c2).slice(0, 200));

// 11c. GET status conferma: agente is_active:false + mapping SYNC_FAILED
const rG2 = await fetch(`${WB}/api/org/agenti/mapping?organization_id=${orgId}&agent_id=${agentId}`, { headers: H(cookie) });
const g2 = await json(rG2);
ok('GET post-ritiro: is_active:false + mapping SYNC_FAILED', g2.agente?.is_active === false && g2.mappings?.[0]?.sync_status === 'SYNC_FAILED', JSON.stringify(g2).slice(0, 300));

// 12. (ritirato sopra) — nessun duplicato


// 13. senza cookie → 401
const rAnon = await fetch(`${WB}/api/org/agenti/mapping?organization_id=${orgId}`, { headers: { 'content-type': 'application/json' } });
ok('401 senza sessione', rAnon.status === 401, String(rAnon.status));

console.log(`\nRISULTATO: ${pass} pass / ${fail} fail`);
// cleanup: contenuto org rimosso (shell resta per audit, cleanup è di CLIENT RUNTIME)
console.log('ORG di prova per cleanup CLIENT RUNTIME:', orgId, b1j.organizzazione?.nome || '');
process.exit(fail ? 1 : 0);
