import { spawn } from 'node:child_process';
const message = `GOAL LOOP VOYAGER — cabling/testing/collaudo/correction (ripeti finché goal raggiunto)

Repo: C:\\dev\\AionUi-fork. Esegui questo ciclo a ogni attivazione:

1. CABLING CHECK: verifica attivo il cablaggio VOYAGER↔PSX — bootstrap canonico (POST /api/org/crea con richiestaId idempotente), lettura runtime (GET /api/crm/runtime e /api/v1/runtime su org a0878014), Account/Team V1, gate sessioni su login (lock prima del login, unlock dopo). Se un pezzo è rotto/regresso → correggi.
2. TESTING/COLLAUDO: esegui i collaudi client-side (scripts/psx-bootstrap-collaudo.mjs con utente collaudo, scripts/psx-check-cutover.mjs, scripts/cdp-session-gate.cjs se app dev attiva). typecheck bunx tsc --noEmit. Registra esiti.
3. CORRECTION: per ogni esito negativo, fix in repo (contratto-prima: la UI non chiama MAI CT1400 direttamente; usa la superficie cliente), typecheck, riavvia dev se serve, riverifica, commit.
4. AGENT SYNC: controlla se CLIENT RUNTIME (f0a60710) ha consegnato il contratto Department & Employee (message in sessione o lettere recenti). Se arrivato → implementa creazione agenti sincronizzata con psxworkbench (reparti+dipendenti org-scoped idempotenti) e binding agente↔reparto, poi collauda (owner OK / member denied / cross-tenant denied / retry / concurrency). Se NON arrivato e non hai già sollecitato nell'ultima ora → invia UN sollecito con scripts/send-session-message.mjs (messaggio in scripts/tmp-message-to-runtime-session.md → f0a60710).
5. UTENTI REPARTI: verifica contratto inviti/membri umani tenant; se arrivato → implementa gestione utenti dei reparti (invite, ruoli, tenant isolation); altrimenti incluso nel sollecito del punto 4.
6. SYNC CHECK: se c'è risposta da CLIENT RUNTIME, integrala; verifica che il cutover CT1400 regga (200 su /api/crm/runtime della nostra org).
7. REPORT: se tutto verde e nessun contratto nuovo → NON disturbare l'utente (solo riepilogo breve in chat). Se qualcosa è rotto o nuovo → esegui e informa.

REGOLE VINCOLANTI: mai mutation senza contratto; mai chiavi segrete in chiaro; read-before-write; commit dopo ogni fix verificato; non toccare l'installazione di produzione AionUi.`;
const payload = JSON.stringify({
  name: 'VOYAGER goal loop (15 min)',
  schedule: '*/15 * * * *',
  schedule_description: 'ogni 15 minuti',
  message,
});
const child = spawn(process.env.AIONUI_HELPER_BIN, ['config', 'cron', 'current', 'create'], { shell: true, stdio: ['pipe', 'inherit', 'inherit'] });
child.stdin.write(payload);
child.stdin.end();
