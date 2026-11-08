# PRD addendum — One Identity, Two Worlds (Ambassador → Super CEO)

> Status: ATTIVO (2026-11-06) · Estende `prd.md` (Voyager Dispatcher) · Mandato del Fondatore
> **Una sola identità Voyager, due mondi:** due **modalità dello stesso prodotto**, non due agenti separati. L'identità conversazionale è continua; configurazione e autorità dipendono dallo **stato reale della piattaforma risolto lato server**, mai da ciò che il modello suppone.

## 1. Le due modalità

| | **VOYAGER AMBASSADOR** (pre-accesso) | **VOYAGER SUPER CEO** (post-attivazione) |
|---|---|---|
| Contesto | VISITOR | COMPANY_ACTIVE |
| Obiettivo | Comprendere il visitatore, mostrare valore, accompagnarlo alla registrazione | Realizzare le richieste dell'imprenditore |
| Percorsi | Conversazione, ricerca pubblica, analisi preliminare, dimostrazione, proposta di configurazione, registrazione, onboarding | Risposta diretta, ricerca aziendale, workflow, tool calling, computer use, Agent Factory, Commander, Task Force, Developer Agent, automazioni autorizzate |
| Vietato | Strumenti aziendali protetti; dichiarare agenti/organizzazioni/servizi creati se non realmente attivati | Ricominciare a vendere l'abbonamento: il cliente è dentro la sua azienda digitale |

Mansionario Ambassador: Accoglienza · Discovery · Business Analysis · Solution Design · Education by Demonstration · Value Proposition (senza inventare benefici) · ROI Exploration (ipotesi esplicite) · Objection Handling · Onboarding Guidance · Relationship Memory · Handoff Continuity. Persuasione da competenza e valore, mai aggressiva o manipolativa.

Mansionario Super CEO: CEO operativo · Executive Assistant · Commercial Director · Business Analyst · Agent Manager · Execution Agent (strumenti, browser, computer use) · Task Force Leader · Capability Builder (Factory/Developer) · Knowledge User · Continuous Improvement Partner. **Non solo coordinatore: sa eseguire direttamente.**

## 2. I tre stati tecnici (risolti sul server)

- **STATO A — VISITOR**: non autenticato → Ambassador; capacità pubbliche/preliminari; nessuna identità aziendale.
- **STATO B — AUTHENTICATED/SETUP**: login ma organizzazione non operativa o Client Runtime non pronto → Voyager continua onboarding/setup con funzioni realmente autorizzate; NON si presenta come Super CEO operativo.
- **STATO C — COMPANY ACTIVE**: autenticato + organizzazione risolta + tenant attivo + Client Runtime disponibile + autorizzazioni verificate → Super CEO.

La risoluzione è **server-side**: non un parametro del browser, non una dichiarazione del modello.

## 3. Continuità

Il passaggio Ambassador → Super CEO non è un cambio di interlocutore. Personalità costante (cordiale, empatica, competente, intraprendente, multilingue, intuitiva, orientata al risultato); cambia l'insieme delle capacità autorizzate. Il lavoro preparato prima del login (prima proposta, contesto aziendale, primo processo scelto) viene associato all'utente autenticato **con passaggio verificato** e ripreso senza far ripetere nulla. Memoria personale progressiva e consentita (nome preferito, azienda, ruolo, lingue, obiettivi, preferenze di comunicazione, primo processo) — mai raccolta indiscriminata; niente caratteristiche psicologiche inventate.

## 4. Vincoli architetturali (dal mandato)

- Riutilizzare `registry_agent_id`, `ai_agents`, `agent_overrides` e il risolutore esistente; identità dell'agente nel corretto contesto organizzativo.
- **Non** creare un agente globale con accesso ai tenant; **non** modificare il controllo anti-IDOR di `parla` per accessi da visitatore; l'onboarding pre-organizzazione usa un ingresso con autorità adeguata **separato** dal percorso aziendale protetto.
- Verificare se PSX possiede già un percorso visitatore/onboarding conversazionale; non duplicare il ciclo agentico.
- Un solo motore conversazionale comune con contesto/capacità/configurazione diversi; selezione modalità server-side; nessuna informazione di autorizzazione nel prompt che debba venire dal database.

## 5. Prove di accettazione (V1–V12)

V1 visitatore anonimo senza dati privati · V2 discovery su sito pubblico di prova · V3 prima proposta senza dichiarare agenti già attivi · V4 registrazione con associazione della sessione preliminare · V5 setup incompleto senza poteri aziendali · V6 Company Active con identità e organizzazione corrette · V7 continuità del lavoro preparato · V8 prima esecuzione con strumento reale autorizzato · V9 primo agente via Agent Factory con cancello di approvazione · V10 isolamento (self-claim di organizzazione negato) · V11 cambio di stato su login/logout/revoca · V12 memoria nel corretto contesto personale/aziendale.

## 6. Incrementi e stato attuale

| Incr | Contenuto | Stato |
|---|---|---|
| **F1** | Discovery: mappa percorso pubblico/aziendale | ✅ eseguita (sotto) |
| **F2** | Identity Resolver server-side (VISITOR/SETUP/COMPANY_ACTIVE) | ⛔ oltre boundary locale — codice PSX non presente nei repo locali (`parla`, `ai_agents`, `registry_agent_id`); richiesta contratto già in coda (10 contratti attesi da CLIENT RUNTIME) |
| **F3** | Ambassador: accoglienza collegata al ciclo agentico + strumenti pubblici consentiti | ⏳ dipende da F2 (ingresso visitatore PSX) |
| **F4** | Setup Transition: contesto preservato fra registrazione/login/organizzazione | ⏳ dipende da F2 |
| **F5** | Super CEO: identità aziendale reale + capacità autorizzate | ⏳ dipende da F2 |
| **F6** | Continuity: follow-up e correzioni | ⏳ dipende da F2 |
| **F7** | Factory: preparazione e attivazione agenti | ⏳ dipende da F2 |
| **F8** | E2E: ingresso→registrazione→configurazione→prima operazione | ⏳ dipende da F5 |

### F1 — Risultato discovery (2026-11-06)

- **Client (AionUi-fork, `feat/project-groups`)**: pagina di ingresso `packages/desktop/src/renderer/pages/guid/`; selezione assistente in `hooks/useGuidAssistantSelection.ts` (`pickDefaultAssistantSelectionKey`), persistenza `guid.lastAssistantId`. **✅ Incremento implementato (commit `6d8ba7b`)**: il client si apre con l'assistente **"Voyager"** già selezionato e pronto (match per nome canonico, nessun ID hardcoded; fallback alla catena precedente se assente). Requisito §9 soddisfato lato client.
- **Server (PSX System)**: `parla`, `ai_agents`, `registry_agent_id`, `agent_overrides`, anti-IDOR, Tool Album, Organization/Agent Factory, memoria, Voice Runtime — **non presenti in locale** (`C:\dev` contiene solo AionUi-fork, offmarket [probe/analysis], voyager-test). Ogni modifica server-side (F2–F7) è oltre boundary: serve contratto con la sessione PSX, come da boundary contract.
- **Assistente live configurato** in AionUi: "Voyager" (`custom-1793954495081-95c9`, sort_order 0, prompt Super CEO consolidato).
