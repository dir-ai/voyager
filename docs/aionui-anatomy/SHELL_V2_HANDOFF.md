# SHELL_V2_HANDOFF — AionUi → PSX Workbench
**FASE 1 — Unified Anatomy Blueprint** · VOYAGER (a430da01) → CLIENT RUNTIME (f0a60710) · 2026-11-06

## Scopo
Consegnare a PSX l'inventario anatomico completo degli agenti AionUi per la progettazione della **PSX Unified Agent Shell V2** (direttiva titolare: contenitore unico — ogni agente esiste una volta sola, in PSX; aioncore = harness di esecuzione).

## Artefatti consegnati (commit `a97a4cf`, repo `C:\dev\AionUi-fork\docs\aionui-anatomy\`)
1. **AIONUI_AGENT_ANATOMY_REPORT.md** — architettura a due livelli:
   - **Agent** = il motore (catalogo: ~44 engine/agent-definition, tra cui general-purpose, team-lead, butler)
   - **Assistant** = la persona (identità + modello + prompt + permessi + skills + MCP; **30 nel dev locale**)
   - **L'Assistant è l'unità di export verso PSX** — il candidato diretto per l'entità canonica dell'AI Employee PSX
2. **AIONUI_AGENT_CAPABILITIES.json** — cataloghi macchina-leggibili: skills (27), MCP servers (7+), tools nativi, ManagedAgents. Schema stabile per il mapping Available ≠ Granted.
3. **NESTOR_AGENT_ANATOMY.md** — caso di studio: il maggiordomo a piena capacità (skills/MCP/permessi/thought/modello tutti in auto, riallineamento al boot). È il prototipo di Shell V2 "piena".

## Proposal: campi Shell V2 (da ratificare)
| Campo | Origine aioncore | Nota |
| --- | --- | --- |
| identity (nome, descrizione, avatar) | assistant record | canonico PSX |
| model/provider + temperature | assistant | segreti mai in Shell |
| systemPrompt | assistant | |
| skills abilitate | capability catalog (27) | lista + versione |
| MCP servers | mcp config (7+) | solo riferimenti, segreti in vault |
| permissions/thought mode | AssistantDefaultsRequest auto|'manual'|'forbidden' | |
| execution loop (cron/goal loop, sessioni) | aioncore runtime | harness-side |
| memory config | per-agente | punto B del titolare, in attesa |
| device/effetto capability | computer-use | canale /effetto separato |

## Regole non negoziabili (riconfermate)
- PSX Agent Registry = UNICO registro canonico; mapping 1:1 persistente (agent_execution_mapping, tenant-scoped, UNIQUE org+agent+provider)
- SYNC_PENDING → PATCH confirm con read-back server-side → SYNCED | SYNC_FAILED (PSX vince)
- Idempotenza per richiestaId; nessun segreto fuori vault; mai sync successo senza read-back
- Import agenti aioncore esistenti: richiesta nella lettera-24 (batch/singolo, dedup, proiezione 1:1)

## Cosa aspettiamo da PSX (FASE 2)
1. Contratto **Agent Import/Registration** (per gli assistenti aioncore esistenti)
2. Contratto **Shell V2** (schema esteso sopra)
3. Decisioni sulle domande A-D della lettera-24

— PROJECT AION, VOYAGER
