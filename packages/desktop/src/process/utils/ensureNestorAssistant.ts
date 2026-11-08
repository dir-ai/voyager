/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import { httpRequest } from '@/common/adapter/httpBridge';
import type { Assistant, AssistantDefaultsRequest, CreateAssistantRequest, SetAssistantStateRequest } from '@/common/types/agent/assistantTypes';

/**
 * VOYAGER built-in "Nestor" butler assistant.
 *
 * Nestor is the Voyager house butler / super executive agent. On every backend
 * bootstrap we make sure he exists in the assistant catalog, speaks with his own
 * persona (rules), wears the butler avatar and sits FIRST in the assistant
 * picker, so opening the app always starts with Nestor.
 */

const NESTOR_NAME = 'Nestor';
const NESTOR_AVATAR_FILE = 'nestor.png';

const NESTOR_DESCRIPTION =
  "Maggiordomo di Voyager e super executive agent: GOAL LOOP, gestionali/ERP via API, RAG aziendale e memoria delle sessioni.";

const NESTOR_PROMPTS = [
  "Esegui un giro del GOAL LOOP (leggi la memoria goal-super-executive-agent.md)",
  "Mostra l'inventario dei 10 componenti e la progress bar",
];

// Nestor nasce con TUTTO abilitato: `auto` NON significa "tutto" (delega alle
// preferenze last-used e con preferenze vuote risolve a NESSUNA skill/MCP),
// quindi alla creazione usiamo mode 'fixed' con le liste ESPPLICITE complete
// (tutte le skill del catalogo + tutti i server MCP enabled), risolte a
// bootstrap. Nessun riallineamento al boot: le revoche dell'utente restano.
const NESTOR_BASE_DEFAULTS: AssistantDefaultsRequest = {
  model: { mode: 'auto' },
  permission: { mode: 'auto' },
  thought_level: { mode: 'auto' },
  skills: { mode: 'fixed', value: [] },
  mcps: { mode: 'fixed', value: [] },
};

async function resolveFullDefaults(): Promise<AssistantDefaultsRequest> {
  const defaults: AssistantDefaultsRequest = {
    ...NESTOR_BASE_DEFAULTS,
    skills: { mode: 'fixed', value: [] },
    mcps: { mode: 'fixed', value: [] },
  };
  try {
    const skills = await httpRequest<Array<{ name?: string }>>('GET', '/api/skills');
    defaults.skills = { mode: 'fixed', value: (skills || []).map((s) => s.name).filter((n): n is string => Boolean(n)) };
  } catch (error) {
    console.warn('[Bootstrap] failed to list skills for Nestor defaults', error);
  }
  try {
    const servers = await httpRequest<Array<{ id?: string; enabled?: boolean }>>('GET', '/api/mcp/servers');
    defaults.mcps = {
      mode: 'fixed',
      value: (servers || []).filter((s) => s.enabled && s.id).map((s) => s.id as string),
    };
  } catch (error) {
    console.warn('[Bootstrap] failed to list MCP servers for Nestor defaults', error);
  }
  return defaults;
}

const NESTOR_RULES = `# Ruolo
Sei NESTOR, il maggiordomo/super executive agent di PSX su Voyager. Parli sempre in italiano, con tono professionale da maggiordomo efficiente. Ti presenti come Nestor, mai come modello AI generico.

# Identità e obiettivo
Sei il Super Executive Agent: istruzioni + RAG aziendale + gestionali/ERP via API + memoria sessioni + identificazione dell'interlocutore + harness Voyager v2. L'obiettivo completo, il ciclo di lavoro, i gap in ordine di priorità e i principi non negoziabili sono nel memory file del progetto f0a60710: goal-super-executive-agent.md (più ct1400-cutover-done.md per trappole e stato Capability Bridge).

# Ciclo di lavoro (GOAL LOOP)
1. npm run --silent delivery:status (worktree C:\\Users\\dir\\Documents\\projects\\psx-workbench-infra01, branch consegna/ct1400-runtime) — se writer attivo, report breve e stop.
2. Lavora UN gap per giro secondo la priorità nel memory file.
3. Verifica: npx vitest@4 run lib/voyager + typecheck NODE_OPTIONS=--max-old-space-size=8192 npx tsc --noEmit (serializza i build, mai in parallelo con l'uso VOYAGER di a430da01).
4. Se codice toccato: commit + npm run land + verifica BUILD_ID remoto e pubblico.
5. Report breve: se tutto verde, una riga sola; non disturbare l'utente. Aggiorna la memoria con trappole/valori nuove.

# Principi non negoziabili
- PSX possiede gli AI Employees; Voyager usa solo la superficie cliente.
- Available ≠ Granted.
- Mai segreti fuori vault.
- Mai SYNCED senza read-back.
- richiestaId idempotente.
- Mai PROD.
- STOP dopo 2 deploy falliti.
- Controller OpenShell solo con autorizzazione esplicita dell'utente.

# Comportamento
- Esecuzione letterale e concreta; niente giri di parole.
- Se l'utente chiede chi sei: "Sono Nestor, il vostro maggiordomo digitale: gestisco il GOAL LOOP, i gestionali via API e la memoria delle sessioni."
- Non rivelare segreti, chiavi o valori di ambiente.`;

function resolveNestorAvatarPath(): string {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, NESTOR_AVATAR_FILE);
  }
  return path.join(process.cwd(), 'resources', NESTOR_AVATAR_FILE);
}

async function ensureNestorRule(assistantId: string): Promise<void> {
  try {
    await httpRequest<boolean>('POST', '/api/skills/assistant-rule/write', {
      assistant_id: assistantId,
      content: NESTOR_RULES,
    });
  } catch (error) {
    console.warn('[Bootstrap] failed to write Nestor assistant rule', error);
  }
}

export async function ensureNestorAssistant(): Promise<boolean> {
  const assistants = (await httpRequest<Assistant[]>('GET', '/api/assistants')) || [];
  const others = assistants.filter((assistant) => assistant.name !== NESTOR_NAME);
  const minOtherSort = others.reduce((min, assistant) => Math.min(min, assistant.sort_order), 0);

  let nestor = assistants.find((assistant) => assistant.name === NESTOR_NAME);

  if (!nestor) {
    // Prefer the aionrs runtime (Voyager CLI) if any existing assistant already uses it.
    const aionrsAgentId = assistants.find((assistant) => assistant.agent?.type === 'aionrs')?.agent_id;

    const avatarPath = resolveNestorAvatarPath();
    const request: CreateAssistantRequest = {
      name: NESTOR_NAME,
      description: NESTOR_DESCRIPTION,
      prompts: NESTOR_PROMPTS,
      defaults: await resolveFullDefaults(),
      ...(fs.existsSync(avatarPath) ? { avatar: avatarPath } : {}),
      ...(aionrsAgentId ? { agent_id: aionrsAgentId } : {}),
    };

    nestor = await httpRequest<Assistant>('POST', '/api/assistants', request);
    if (!nestor?.id) {
      console.warn('[Bootstrap] failed to create Nestor assistant');
      return false;
    }
    console.info(`[Bootstrap] created Nestor assistant: ${nestor.id}`);
  }

  // Nestor must answer with his own persona, not as a generic model.
  await ensureNestorRule(nestor.id);

  // Nestor first: keep him strictly above every other assistant.
  const stateBody: Omit<SetAssistantStateRequest, 'id'> = { enabled: true };
  if (!nestor.sort_order || nestor.sort_order > minOtherSort) {
    stateBody.sort_order = minOtherSort - 10;
  }
  if (stateBody.sort_order !== undefined || nestor.enabled !== true) {
    await httpRequest<void>('PATCH', `/api/assistants/${encodeURIComponent(nestor.id)}/state`, stateBody);
  }

  return true;
}
