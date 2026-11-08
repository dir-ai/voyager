/**
 * PSX Agent Capability Bridge — lato Voyager (v1).
 *
 * NON è una nuova Agent Shell e NON possiede l'identità dell'agente:
 * PSX Workbench possiede gli AI Employees (Agent Registry + Employee Shell).
 * Questo servizio collega ogni agente PSX (dipendente) all'esecutore
 * aioncore tramite il mapping governato da PSX (agent_execution_mapping).
 *
 * Ciclo canonico (lettera Capability Bridge v1, follow-up CLIENT RUNTIME):
 *   register (POST) → SYNC_PENDING
 *   → istanziazione locale aioncore (quando disponibile)
 *   → PATCH conferma SOLO DOPO che la config locale corrisponde a quella PSX
 *     (il read-back server-side la verifica: PSX vince) → SYNCED
 *   → polling GET (contratto 10, member-safe) per lo stato
 *
 * Recovery: la richiestaId è persistita per (org, agent, provider); re-POST/PATCH
 * con la STESSA richiestaId non duplica la riga (riga ripetuta, poi conferma).
 */
import {
  confirmAgentMapping,
  enqueueAgentDispatch,
  listAgentMappings,
  registerAgentMapping,
  type AgentMapping,
  type DispatchOrder,
  type WorkbenchSession,
} from './companyContract';
import { newRichiestaId } from './companyContract';

export const BRIDGE_PROVIDER = 'aionui';

// NOTE DI CONTRATTO (CLIENT RUNTIME, follow-up Capability Bridge v1):
// - Grant di uno strumento: POST /api/voyager/azienda/agenti/[id]/strumenti con body
//   { organizationId, toolKey } — SENZA organizationId il server risponde 400.
// - Esecuzione strumento governata: POST /api/agents/esecuzione (motore avviaELavora,
//   broker proposte/approva, gateEsecuzione tenant-scoped) — NON il canale
//   /api/workforce/voyager/effetto, che è per gli effetti su dispositivo (computer-use,
//   consenso monouso). Su DEV il controller di esecuzione fisico non gira ancora
//   (TEST E = BLOCKED-INFRA): il chip SYNCED qui deriva dal read-back di configurazione,
//   non da un'esecuzione.

const BRIDGE_MAP_KEY = 'voyager_agent_bridge_richiesta_map';

type BridgeRequestMap = Record<string, { richiestaId: string; providerAssistantId?: string; orgId: string; syncedAt?: string }>;

function bridgeKey(organizationId: string, agentId: string, provider = BRIDGE_PROVIDER): string {
  return `${organizationId}::${agentId}::${provider}`;
}

function loadMap(): BridgeRequestMap {
  try {
    return JSON.parse(localStorage.getItem(BRIDGE_MAP_KEY) || '{}') as BridgeRequestMap;
  } catch {
    return {};
  }
}

function saveMap(map: BridgeRequestMap): void {
  try {
    localStorage.setItem(BRIDGE_MAP_KEY, JSON.stringify(map));
  } catch {
    // storage pieno/non disponibile: il mapping resta comunque PSX-side
  }
}

/** Stato corrente del mapping (polling contratto 10, member-safe). */
export async function getBridgeStatus(session: WorkbenchSession, organizationId: string, agentId: string): Promise<AgentMapping | null> {
  const { mappings } = await listAgentMappings(session, { organizationId, agentId, executionProvider: BRIDGE_PROVIDER });
  return mappings[0] || null;
}

/**
 * Registra (o ripete) il mapping per un agente PSX. SYNC_PENDING finché la
 * conferma con read-back non riesce. Mai chiamare la conferma prima che la
 * config locale esista davvero (vincolo CLIENT RUNTIME, punto a).
 */
export async function registerBridgeMapping(
  session: WorkbenchSession,
  organizationId: string,
  agentId: string,
  providerAssistantId?: string,
): Promise<AgentMapping> {
  const map = loadMap();
  const key = bridgeKey(organizationId, agentId);
  let entry = map[key];
  if (!entry || entry.orgId !== organizationId) {
    entry = { richiestaId: crypto.randomUUID(), providerAssistantId, orgId: organizationId };
    map[key] = entry;
    saveMap(map);
  }
  const { ripetuto, mapping } = await registerAgentMapping(session, {
    organizationId,
    agentId,
    executionProvider: BRIDGE_PROVIDER,
    providerAssistantId: providerAssistantId || entry.providerAssistantId,
    richiestaId: entry.richiestaId,
  });
  if (providerAssistantId) entry.providerAssistantId = providerAssistantId;
  if (mapping.sync_status === 'SYNCED') entry.syncedAt = new Date().toISOString();
  saveMap(map);
  void ripetuto; // ripetuto=true = recovery naturale, nessun duplicato
  return mapping;
}

/**
 * Conferma il mapping con read-back server-side: da chiamare SOLO dopo aver
 * istanziato l'assistente aioncore (providerAssistantId applicato di fatto).
 * Se l'agente PSX è ritirato il server riflette SYNC_FAILED (PSX vince).
 */
export async function confirmBridgeMapping(
  session: WorkbenchSession,
  organizationId: string,
  agentId: string,
  providerAssistantId: string,
  configurationVersion?: number,
): Promise<AgentMapping> {
  const map = loadMap();
  const key = bridgeKey(organizationId, agentId);
  const entry = map[key];
  const richiestaId = entry?.richiestaId || crypto.randomUUID();
  if (!entry) {
    map[key] = { richiestaId, providerAssistantId, orgId: organizationId };
    saveMap(map);
  }
  const mapping = await confirmAgentMapping(session, {
    organizationId,
    agentId,
    executionProvider: BRIDGE_PROVIDER,
    richiestaId,
    providerAssistantId,
    configurationVersion,
  });
  const merged = loadMap();
  if (merged[key]) {
    merged[key].providerAssistantId = providerAssistantId;
    if (mapping.sync_status === 'SYNCED') merged[key].syncedAt = new Date().toISOString();
    saveMap(merged);
  }
  return mapping;
}

// ─── GARRISON DISPATCH (lettera-19, punto A) ─────────────────────────────────
// Ogni richiesta che arriva a un AI Employee THROUGH Voyager viene ACCODATA
// alla caserma PSX (POST /api/org/agenti/dispatch, canale 'voyager') invece di
// chiamare l'esecuzione direttamente: la caserma è l'unico punto di ingresso
// degli ordini — coda durabile, idempotente per richiestaId, audita.
// Idempotenza: NUOVA richiesta → NUOVA richiestaId (UUID v4 client-generated);
// RETRY della stessa richiesta → STESSA richiestaId (il caller la ripassa o la
// ricava dalla mappa locale per conversazione).

export interface GarrisonDispatchRequest {
  organizationId: string;
  agentId: string;
  /** Testo dell'ordine (1–8000). */
  richiesta: string;
  /** Chi chiama dal canale Voyager (opzionale). */
  interlocutore?: Record<string, unknown>;
  /** Passa la STESSA richiestaId per un retry; se assente ne viene generata una nuova. */
  richiestaId?: string;
  /** 1–9, default 5; 1 = urgente. */
  priorita?: number;
}

/**
 * Accoda un ordine alla caserma del Garrison. Mutazione GOVERNATA dal runtime
 * PSX: l'esecuzione resta sempre lato PSX (ONE PATH RULE — avviaELavora),
 * Available ≠ Granted incluso. 409 = agente ritirato (non prende ordini).
 */
export async function dispatchAgentRequest(
  session: WorkbenchSession,
  req: GarrisonDispatchRequest,
): Promise<{ ripetuto: boolean; order: DispatchOrder }> {
  const richiestaId = req.richiestaId || newRichiestaId();
  const { ripetuto, dispatch } = await enqueueAgentDispatch(session, {
    organizationId: req.organizationId,
    agentId: req.agentId,
    richiesta: req.richiesta,
    ...(req.interlocutore ? { interlocutore: req.interlocutore } : {}),
    richiestaId,
    ...(req.priorita !== undefined ? { priorita: req.priorita } : {}),
  });
  return { ripetuto, order: dispatch };
}
