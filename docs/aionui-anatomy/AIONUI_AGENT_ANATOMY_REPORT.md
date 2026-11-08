# AIONUI/VOYAGER — AGENT ANATOMY REPORT

Fonti: fork `C:\dev\AionUi-fork` (branch feat/project-groups, incl. commit 770ef1e/3ec8211), API live backend dev `http://127.0.0.1:51721` (aioncore), DB cataloghi.
Convenzioni: **VERIFIED** = letto da API live o codice; **INFERRED** = dedotto da codice senza prova runtime; **UNAVAILABLE** = assente nel motore.

## 0. Architettura a due livelli (fondamentale)
- **Agent (ManagedAgent, ~44 voci nel catalogo, 8 visibili)** = motore di esecuzione: processo CLI/runtime (aionrs=Aion CLI interno, Claude Code, Codex, Copilot, Droid, Kimi, OpenClaw, Grok Build) + custom. Ha model/mode/env, NON ha personalità. VERIFIED.
- **Assistant (30 nel catalogo dev)** = la PERSONA che incapsula un agent: nome, avatar, regole, skills/MCP defaults. È l'unità di export verso PSX. VERIFIED.
- Conversazione = assistant (+ team) → agent process → tool/MCP. Un assistant può essere `bare:<agentId>` (auto-generato, l'agente nudo) o custom/preset.

## 1. Identity (Assistant)
- Campi reali (Assistant): `id` (custom-<ts>-<rand> | `bare:<agentId>` | preset-slug), `name`, `description`, `avatar` (path file COPIATO server-side in dir avatar), `agent_id` → ManagedAgent, `sort_order` (int, ordine picker), `enabled` (bool), `prompts`+`recommended_prompts`, `capabilities` {default_skill_ids[], custom_skill_names[], default_disabled_builtin_skill_ids[]}, `enabled_skills`, `agent` {id,type}, `rules` {content, storage_mode:'user_file'}. VERIFIED (GET /api/assistants, GET /api/assistants/{id}).
- Assistente detail aggiunge `defaults` e `rules`. `bare:` non eliminabili. VERIFIED.
- Origini: bare (auto), preset built-in (word-creator, cowork…), custom (utente/API). Assistants marketplace = skill "aionui-config" + import API. VERIFIED.

## 2. Prompt & Rules
- Assistant rule: file per-assistente per locale, `POST /api/skills/assistant-rule/write` {assistant_id, locale?, content}, `POST .../read`. Storage: user_file (fuori DB). VERIFIED.
- Builtin rules/skills: `/api/skills/builtin-rule`, `/api/skills/builtin-skill`. VERIFIED.
- Override chain (INFERRED da codice): agent system → assistant rule → prompt per-conversazione. Assistant `prompts` = prompt suggeriti, non system prompt.

## 3. Execution Engine
- ManagedAgent: {id, name, icon, agent_type, agent_source (internal/custom), enabled, installed, native_skills_dirs ['.aionrs/skills'], skill_delivery {mode:'injected'}, behavior_policy {supports_side_question, self_identity_sticky, session_load_via_meta_field, supports_team}, available_modes [default, auto_edit, yolo] (yolo_id), config_options, status online + last_check latency, team_capable, has_command_override, env_override_key_count}. VERIFIED.
- Custom agents: `/api/agents/custom` CRUD + `try-connect` + `refresh`; provider health-check `/api/agents/provider-health-check`. VERIFIED (endpoint).
- Provider/model: `/api/providers` CRUD, fetch-models, detect-protocol; bedrock test. Per-assistant `defaults.model {mode: fixed|auto, value}`. VERIFIED.

## 4. Skills
- Catalogo dev: 27 skill (officecli* family, morph-ppt/3d, mermaid, aionui-webui-setup/public, aionui-troubleshooting, aionui-config, skill-creator, session-message, cron, conversation-create, story-roleplay, moltbook, pdf, openclaw-setup, xiaohongshu/x/weixin recruiter). VERIFIED.
- Delivery: `materialize-for-agent` (per-agent), dirs: user_skills_dir + builtin_skills_dir; native dirs per engine (.aionrs/skills). Import: `/api/skills/import` (da file/market/external paths), scan, detect-external, import-history, import-limits. Market enable/disable. VERIFIED (endpoint).
- Abilitazione per-assistente: capabilities.default_skill_ids + custom_skill_names + default_disabled_builtin_skill_ids; oppure `defaults.skills {mode:'auto'}` = tutte. Nestor usa 'auto'. VERIFIED.

## 5. MCP
- IMcpServer {id `mcp_*`, name, description, transport {type:'stdio',command,args,env} | sse/http, enabled, last_test_status, builtin}. CRUD `/api/mcp/servers`; toggle; test-connection (ritorna tools); import da config di altri agent (`/api/mcp/agent-configs` → claude/codex ecc.), OAuth per remote. VERIFIED.
- Catalogo dev: chrome-devtools (browser automation), aionui-browser (browser integrato), aionui-image-generation (spento), + aggiunti: memory, sequential-thinking, fetch (uvx), duckduckgo-search (uvx). Tutti enabled, test connection OK. VERIFIED.
- Per-assistente: `defaults.mcps {mode:'auto'}` = tutti i server enabled. Nestor in auto. VERIFIED.
- Segreti: env nel transport (mai in catalogo pubblico); nessun vault nativo. VERIFIED.

## 6. Tools (nativi motore)
- fs: dir/read/write/metadata/content/copy/reveal/open-system/image-base64/fetch-remote-image. shell: open-file, show-item-in-folder, open-external, check-tool-installed, open-folder-with. VERIFIED (ipcBridge fs/shell).
- Browser/computer-use: SOLO via MCP. Sandbox: non vista (nessun endpoint sandbox); isolamento = workspace per-conversazione + permission mode + YOLO flag. VERIFIED assenza / sandbox INFERRED.

## 7. Sub-agents / Team Mode
- `/api/teams/*`: create/update/remove, slots agents (add/remove/rename/model/attach), mailbox, tasks, runs (accept/cancel/pause per slot), session (ensure/stop/mode), config-options, run-state, activity, per-agent runtime restart e context reset. Eventi WS: agentSpawned, mailboxChanged, childTurn*, run*, taskChanged… VERIFIED.
- Harness: tool Spawn (sub-agent) disponibile agli agenti in sessione. VERIFIED (skill/tooling).

## 8. Scheduler
- `/api/cron/jobs` CRUD (ICronJob), notifiche cron, job = prompt schedulato su conversazione esistente o nuova. retry/state gestiti dal backend (stato interno, API di lista). VERIFIED endpoint; retry INFERRED.

## 9. Memory
- Persistenza: regole assistant, skills files, cron, DB SQLite (assistants, conversations, sessions). Resume: engine respawn "resuming the session" (codice comment). Team context reset esplicito. Nessun vector store nativo. VERIFIED/INFERRED come indicato.
- Memoria long-term esterna: via MCP memory (aggiunta) o PSX-side.

## 10. Sessions
- Conversazioni: `/api/conversations` create/clone/active-count, archive/delete con cascade team, sidebar groups/projects. Messaggi con allegati ChatFileRef. VERIFIED (endpoint + tipi).

## 11. Knowledge
- Allegati/workspace file + `/api/document/convert` + preview office (ppt/word/excel). RAG aziendale: NON in AionUi (sta nel Workbench PSX, brain.chat). UNAVAILABLE lato motore, VERIFIED per assenza endpoint.

## 12. Channels
- Desktop Electron; WebUI (skill aionui-webui-setup/public); **channel plugins** (piattaforme esterne): `/api/channel/plugins` enable/disable/test, pairing approve/reject, authorized users, active sessions, settings sync. VERIFIED.
- Remote agents: `/api/remote-agents` CRUD + test-connection. VERIFIED.

## 13. Security
- Permission mode per-assistente (auto/fixed) + engine modes (default/auto_edit/YOLO). check-tool-installed. Extensions: permissions + risk-level API. Channel: pairing gate + revoke. MCP OAuth. Env override count sul agent. VERIFIED.
- Sandbox OS: UNAVAILABLE.

## 14. Lifecycle
- Assistant: create/read/update(PUT)/state(PATCH)/import; niente DELETE esplicito visto nell'API superfice (vedi ipcBridge); niente EXPORT nativo → export = letture API (dove serve la Shell PSX). VERIFIED limiti.
- Skills/MCP/Extensions/Hub: install/update/uninstall. Teams/conversations: archive/delete/restore. VERIFIED.

## 15. Observability
- Agent: status/latency/last_check. Extensions: agent-activity snapshot. Providers health-check. Cron notifiche. Conversation active-count. Plugin status. VERIFIED (endpoint). Audit trail centralizzato: UNAVAILABLE (log engine locali).

## Trappole notate
- Il toggle MCP può chiudere la connessione prima della risposta (bug cosmetico); lo stato va letto con re-GET.
- Encoding UTF-8 nelle write via HTTP: PowerShell/Get-Content senza -Encoding UTF8 corrompe gli accenti (doppia encode). Roba da client, non da backend.
- `bare:` assistants rigenerati dal sistema: non usarli come identità persistenti per l'import PSX.
- 403 su assistenti generated: NON aggirabile modificando DB interni — rispettato.
