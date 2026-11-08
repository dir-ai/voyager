# NESTOR — AGENT ANATOMY (caso di studio, backend dev VOYAGER)

Identificativo: `custom-1793973474557-69d1` · creato 2026-11-06 · stato ATTIVO e primo in lista.

## Identity — VERIFIED
| Campo | Valore |
|---|---|
| id | custom-1793973474557-69d1 |
| name | Nestor |
| description | Maggiordomo di Voyager e super executive agent: GOAL LOOP, gestionali/ERP via API, RAG aziendale e memoria delle sessioni. |
| avatar | file (da resources/nestor.png, copiato server-side) |
| agent_id | 632f31d2 (aionrs "Aion CLI", internal, online, latency ~1ms) |
| sort_order | -18 (minimo del catalogo → primo nella picker) |
| enabled | true |
| prompts | "Esegui un giro del GOAL LOOP…", "Mostra l'inventario dei 10 componenti…" |
| origine | custom (creato via API bootstrap del fork, non preset) |

## Prompt & Rules — VERIFIED
- Rule per-locale (user_file): persona Nestor — italiano, maggiordomo/super executive agent, GOAL LOOP 5 step (delivery:status → 1 gap → vitest+tsc → commit/land → report breve), principi non negoziabili (PSX possiede AI Employees, Available ≠ Granted, mai segreti fuori vault, mai SYNCED senza read-back, richiestaId idempotente, mai PROD, STOP dopo 2 deploy falliti, OpenShell solo su autorizzazione esplicita).
- Encoding corretto (UTF-8, verificato read-back dopo fix mojibake).

## Execution Engine — VERIFIED
- aionrs: agent_source internal, skill_delivery injected, native dir .aionrs/skills, team_capable=true, modes default/auto_edit/yolo (current default), config_options {mode}. health: online.

## Skills — VERIFIED
- `defaults.skills.mode = 'auto'` → tutte le 27 del catalogo disponibili di default; capabilities default list vuota (non serve: auto).

## MCP & Tools — VERIFIED
- `defaults.mcps.mode = 'auto'` → server attivi: chrome-devtools, aionui-browser, memory, sequential-thinking, fetch, duckduckgo-search (6). Non incluso: aionui-image-generation (disabled a livello server).
- Tools nativi: fs completo, shell (open-file/show-item/open-external/check-tool), engine modes. Browser background = chrome-devtools (new_page background), a vista = aionui-browser.

## Defaults — VERIFIED (read-back)
model auto · permission auto · thought_level auto · skills auto · mcps auto → capacità agentiche complete senza restrizioni.

## Sessioni e memoria
- Sessioni VOYAGER: nessuna ancora (appena seminato). Cron GOAL LOOP attivo gira nell'app AionUi (sessione separata, non duplicata qui).
- Memoria: rule file + catalogo; long-term via MCP memory (knowledge-graph) quando usata.
- Resume: supportato dal motore aionrs (INFERRED da codice).

## Cron e workflow
- Nessun cron interno a Nestor in VOYAGER (il cron 15min vive nell'app AionUi). Estendibile via /api/cron/jobs.

## Relazioni
- Agente: 632f31d2. Nessun team registrato. Registry PSX: NON presente (import sospeso per discovery — decisione CLIENT RUNTIME). Mapping Capability Bridge: da creare a import avvenuto.

## Limiti di esportazione
- Nessun endpoint di export assistant: export = GET list + GET detail + rule read + avatar file.
- `bare:` non esportabili come identità.
- Segreti: nessuno nel catalogo Nestor (env MCP vuote). Nulla da sanitizzare.
- RAG aziendale: non parte del profilo (binding Workbench da progettare in Shell V2).
