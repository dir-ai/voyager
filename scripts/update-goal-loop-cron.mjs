import { spawn } from 'node:child_process';
const helper = process.env.AIONUI_HELPER_BIN;

function run(args, payload) {
  return new Promise((resolve) => {
    const p = spawn(helper, args, { shell: true });
    p.stdin.write(payload); p.stdin.end();
    let out = '', err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (c) => resolve({ code: c, out: out + err }));
  });
}

const message = `GOAL LOOP VOYAGER — cabling/testing/collaudo/correction (ripeti finché goal raggiunto)

GOAL SUPERIORE (direttiva utente, vincolante): costruire il MIGLIOR MATRIMONIO AL MONDO tra PSX Workbench e Voyager/AionUi — perfetta armonia e sintonia, cucita su misura per i titolari di aziende e organizzazioni. Usare l'intelligenza propria per generare la versione perfetta; modifiche proprie ammesse SOLO se migliorano la coerenza architetturale e rispettano i vincoli (mai violare i contratti, mai registri paralleli, mai identità duplicate). Ogni ciclo non è solo bug-fixing: valuta l'esperienza d'uso del titolare (fluidità, coerenza linguistica, zero attriti, tutto ciò che serve a un titolare per gestire la sua azienda: org, reparti, dipendenti AI, inviti, sessioni) e proponi/migliora dove opportuno.

PRINCIPIO NON NEGOZIABILE: PSX Workbench possiede gli AI Employees (Agent Registry + Employee Shell unici canonici). Voyager li crea/configura/utilizza SOLO via CLIENT RUNTIME. AionUi/aioncore aggiunge capacità (execution loop, MCP, skills, orchestration, sessioni). Mapping persistente governato da PSX; Available ≠ Granted; mai segreti fuori vault; mai dichiarare sync successo senza read-back.

Repo: C:\\dev\\AionUi-fork. Esegui questo ciclo a ogni attivazione:

1. CABLING CHECK: verifica cablaggio VOYAGER↔PSX — bootstrap canonico (POST /api/org/crea con richiestaId idempotente), lettura runtime (GET /api/crm/runtime e /api/v1/runtime su org a0878014-77ce-4057-b855-cb3f7175a790), Account/Team V1, gate sessioni su login, inviti (create/list/by-token/accept/revoke) e membri (GET /api/org/members). Se un pezzo è rotto/regresso → correggi. SUPERFICI CHIUSE (non ritestare ogni ciclo, solo smoke check se il codice è cambiato): bootstrap, reparti, dipendenti, vibe sessions, inviti/accept/revoke/members (certificate end-to-end da CLIENT RUNTIME, ultima: accept 7/7 rev 7c90cb2e).
2. TESTING/COLLAUDO: collaudi client-side per le superfici NUOVE o modificate; typecheck bunx tsc --noEmit -p tsconfig.json (da repo root, con bunx). Registra esiti.
3. CORRECTION: per ogni esito negativo, fix in repo (contratto-prima: la UI non chiama MAI CT1400 direttamente; usa la superficie cliente), typecheck, riavvia dev se serve, riverifica, commit.
4. AGENT SYNC / AI EMPLOYEES: direttiva utente AI Employee Shell + Capability Bridge consegnata e inoltrata (dipendenze D1-D6). Se CLIENT RUNTIME (f0a60710) consegna i 10 contratti AI Employee (Create/Update/List AI Employee, Get Shell, Bind to Department, Assign/Revoke Capability, Register Execution Provider Mapping, Get Effective Config, Disable/Revoke, Get Sync Status) → implementa: UI creazione agente (raccolta→proposta→approvazione→API canonica→read-back→conferma), mapping persistente tenant-scoped, capability Available/Granted, e collauda TEST A-F (creazione da Voyager, modifica da Workbench, persistenza, isolamento, esecuzione reale, recovery). Se NON arrivati e non hai già sollecitato nell'ultima ora → invia UN sollecito con scripts/send-session-message.mjs (messaggio in scripts/tmp-message-to-runtime-session.md → f0a60710).
5. ESPERIENZA TITOLARE (matrimonio perfetto): valuta ogni ciclo se l'UX founder/titolare è fluida e coerente (founder journey, Team page, sessioni, navigazione) e proponi MIGLIORAMENTI PROPRI mirati — solo piccoli e sicuri senza contratto (UI, testi, flussi), mai mutation su superfici runtime non contrattate.
6. SYNC CHECK: se c'è risposta da CLIENT RUNTIME, integrala (lettere recenti: accept 7/7 — inviti CHIUSI; R1-R8 baseline confermata; contratti AI Employee attesi); verifica che il cutover CT1400 regga (200 su /api/v1/runtime bearer e /api/crm/runtime member).
7. REPORT: se tutto verde e nessun contratto nuovo → NON disturbare l'utente (solo riepilogo breve in chat). Se qualcosa è rotto o nuovo → esegui e informa.

REGOLE VINCOLANTI: mai mutation senza contratto; mai chiavi segrete in chiaro; read-before-write; commit dopo ogni fix verificato; non toccare l'installazione di produzione AionUi; R1-R8 baseline operativa confermata da entrambe le sessioni.`;

const del = await run(['config', 'cron', 'current', 'delete'], JSON.stringify({ job_id: 'cron_01a1adce-996a-7631-9263-f972d10070e0' }));
console.log('DELETE', del.code, del.out.slice(0, 200));

const create = await run(['config', 'cron', 'current', 'create'], JSON.stringify({
  name: 'VOYAGER goal loop (15 min)',
  schedule: '*/15 * * * *',
  schedule_description: 'ogni 15 minuti',
  message,
}));
console.log('CREATE', create.code, create.out.slice(0, 300));
