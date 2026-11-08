/**
 * VOYAGER Company Edition — backend contract adapter.
 *
 * Contratti REALI consegnati da CLIENT RUNTIME (dev.psxworkbench.com):
 *  - Contract C (lettura): GET /api/v1/runtime (Bearer psxk_) + GET /api/crm/runtime (sessione membro).
 *  - Bootstrap canonico: POST /api/org/crea (solo-sessione, SOLO POST) — org + Primary
 *    Company + SHARED runtime + Main Site, transazionale, idempotente per richiestaId.
 *
 * Ancora MOCK: proposta reparti/dipendenti (mockDepartmentsForSector) — in attesa del
 * contratto Department & Employee. Nessuna seconda fonte di verità: la conferma arriva
 * SEMPRE dal read-back del runtime PSX.
 */

/** Deprecato: tutte le mutation sono REALI (bootstrap + Department & Employee). */
export const COMPANY_CONTRACT_MOCK = false;
/** Contratto bootstrap canonico consegnato e collaudato da CLIENT RUNTIME (rev e29e1c54). */
export const BOOTSTRAP_CONTRACT_REAL = true;

/** Fixture dimostrativa per l'header organizzazione — sostituita dai dati PSX al read-back. */
export const MOCK_CURRENT_ORG = { name: 'VOYAGER Collaudo (demo)' } as const;

// ─── REAL READ-ONLY CLIENT (Contract C — Runtime Status / composition) ────────
// GET /api/v1/runtime — autenticazione via API key applicativa (Bearer psxk_…),
// la chiave stessa è il gate d'ambito: vede SOLO la propria organizzazione.
// Sola lettura: nessuna mutation. Contratto verificato live (200) su DEV.
// Nota sicurezza: la chiave NON va cablata nel bundle — passa da settings/bridge.

export interface PsxRuntimeArea<T> {
  stato: string;
  configurato: T;
  provenienza: string[];
  proprieta: string;
  gap: unknown;
  salute: unknown;
}

export interface PsxSede {
  id: string;
  nome: string;
  citta?: string;
  orari?: string;
  reparti?: string | unknown[];
}

export interface PsxAzienda {
  id: string;
  nome: string;
  ragioneSociale?: string | null;
  settore?: string | null;
  sedi: PsxSede[];
}

export interface PsxDipendente {
  id?: string;
  code: string;
  nome: string;
  ruolo: string;
  reparto: string;
  dominio?: string;
  attivo: boolean;
  canali?: string[];
}

export interface PsxRuntimeSnapshot {
  organizationId: string;
  compostoIl: string;
  identitaEStruttura: PsxRuntimeArea<{
    organizationId: string;
    nome: string;
    slug: string;
    aziende: PsxAzienda[];
    totali: { aziende: number; sedi: number; reparti: number };
  }>;
  dipendenti: PsxRuntimeArea<PsxDipendente[]>;
  /** Aree restituite dal runtime, tipizzazione libera per uso progressivo. */
  connessioni?: PsxRuntimeArea<unknown>;
  capacita?: PsxRuntimeArea<unknown>;
  politiche?: PsxRuntimeArea<unknown>;
  canali?: PsxRuntimeArea<unknown>;
  conoscenza?: PsxRuntimeArea<unknown>;
  casi?: PsxRuntimeArea<unknown>;
  inferenza?: PsxRuntimeArea<unknown>;
  riassunto?: unknown;
  prontezza?: unknown;
}

export interface PsxRuntimeFetchConfig {
  baseUrl: string;
  apiKey: string;
}

export class PsxRuntimeError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

/** Contract C — sola lettura. Errori previsti: 403 no_organization / scope mancante, 502 composizione. */
export async function fetchCompanyRuntime(config: PsxRuntimeFetchConfig): Promise<PsxRuntimeSnapshot> {
  let response: Response;
  try {
    response = await fetch(`${config.baseUrl.replace(/\/$/, '')}/api/v1/runtime`, {
      method: 'GET',
      headers: { Authorization: `Bearer ${config.apiKey}` },
    });
  } catch (error) {
    throw new PsxRuntimeError('NETWORK', String(error), 0);
  }
  if (response.status === 403) {
    const body = await response.json().catch(() => ({}) as Record<string, unknown>);
    const code = String((body as { code?: string; error?: string }).code || (body as { error?: string }).error || 'forbidden');
    throw new PsxRuntimeError(code, code === 'no_organization' ? 'Chiave non legata a un\'organizzazione' : 'Scope o permesso mancante', 403);
  }
  if (response.status === 502) {
    const body = await response.json().catch(() => ({}) as Record<string, unknown>);
    throw new PsxRuntimeError(String((body as { codice?: string; code?: string }).codice || (body as { code?: string }).code || 'COMPOSITION_ERROR'), 'Composizione runtime non disponibile', 502);
  }
  if (!response.ok) {
    throw new PsxRuntimeError('UNEXPECTED', `HTTP ${response.status}`, response.status);
  }
  const payload = (await response.json()) as { ok: boolean; runtime: PsxRuntimeSnapshot };
  if (!payload.ok || !payload.runtime) {
    throw new PsxRuntimeError('BAD_PAYLOAD', 'Risposta runtime malformata', 200);
  }
  return payload.runtime;
}

/** Costruzione del cookie di sessione Workbench (per il futuro client auth — contratto A/B). */
export function buildWorkbenchSessionCookie(session: unknown, cookieName = 'sb-psx-dev-auth-token'): string {
  const encoded = btoa(unescape(encodeURIComponent(JSON.stringify(session))));
  return `${cookieName}=base64-${encoded}`;
}

// ─── SESSION CLIENT (Contract Fase 1 — superficie cliente) ───────────────────
// Login Supabase grant_type=password → cookie sb-psx-dev-auth-token → API
// org-scoped della superficie cliente. Le sessioni restano LATO CLIENT: mai
// passate all'LLM o al backend agenti (regola §5 del contratto di coordinamento).

export interface WorkbenchSession {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
  user?: { id?: string; email?: string };
}

export interface UserOrg {
  id: string;
  name: string;
  role?: string;
}

export interface Reparto {
  id: string;
  nome?: string;
  nome_reparto?: string;
  [key: string]: unknown;
}

export class PsxSessionError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number,
  ) {
    super(message);
  }
}

function psxBaseUrl(): string {
  // DEV collaudo. In produzione la base arriva dalla config/distribuzione.
  return 'https://dev.psxworkbench.com';
}

/** Login programmatico titolare (grant_type=password). Solo su input esplicito dell'utente. */
export async function loginWorkbench(email: string, password: string): Promise<WorkbenchSession> {
  const res = await fetch(`${psxBaseUrl().replace('https://dev.psxworkbench.com', 'https://supabase.psxworkbench.com')}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', apikey: getSupabaseAnonKey() },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || !body.access_token) {
    throw new PsxSessionError('LOGIN_FAILED', `Login Workbench fallito (HTTP ${res.status})`, res.status);
  }
  return body as unknown as WorkbenchSession;
}

let cachedAnonKey: string | null = null;
/**
 * PUBLIC Supabase anon key (public by design — client-side contract). Source of
 * truth: injected at build/dev time by electron.vite.config.ts from the
 * git-ignored .voyager-company.local.env. Secrets (service keys, psxk_ keys)
 * are NEVER handled here.
 */
export function getSupabaseAnonKey(): string {
  if (cachedAnonKey) return cachedAnonKey;
  const w = window as unknown as { __VOYAGER_PSX_ANON_KEY__?: string };
  const env = (import.meta as unknown as { env?: { VITE_SUPABASE_ANON_KEY?: string } }).env;
  cachedAnonKey = w.__VOYAGER_PSX_ANON_KEY__ ?? env?.VITE_SUPABASE_ANON_KEY ?? '';
  return cachedAnonKey;
}
export function setSupabaseAnonKey(key: string): void {
  cachedAnonKey = key;
}

function sessionHeaders(session: WorkbenchSession): HeadersInit {
  return { 'content-type': 'application/json', cookie: buildWorkbenchSessionCookie(session) };
}

async function sessionFetch(session: WorkbenchSession, path: string, init?: RequestInit): Promise<Response> {
  const res = await fetch(`${psxBaseUrl()}${path}`, {
    ...init,
    headers: { ...sessionHeaders(session), ...(init?.headers as Record<string, string>) },
  });
  if (res.status === 403) {
    const body = await res.json().catch(() => ({}) as Record<string, unknown>);
    throw new PsxSessionError(String(body.code || 'forbidden'), String(body.error || 'Permesso negato'), 403);
  }
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  return res;
}

/** Fetch autenticato per le superfici cliente — usato anche dalla pagina Join. */
export { sessionFetch };

/** Elenco delle org dell'utente — UI "seleziona la tua azienda". */
export async function listUserOrgs(session: WorkbenchSession): Promise<UserOrg[]> {
  const res = await sessionFetch(session, '/api/user/orgs');
  const body = (await res.json().catch(() => ({}))) as { orgs?: UserOrg[] } | UserOrg[];
  const orgs = Array.isArray(body) ? body : body.orgs;
  return (orgs || []) as UserOrg[];
}

export async function listAziende(session: WorkbenchSession): Promise<unknown[]> {
  const res = await sessionFetch(session, '/api/crm/aziende');
  const body: unknown = await res.json().catch((): unknown[] => []);
  return (Array.isArray(body) ? body : (body as { aziende?: unknown[] }).aziende || []) as unknown[];
}

export async function listSedi(session: WorkbenchSession): Promise<unknown[]> {
  const res = await sessionFetch(session, '/api/crm/sedi');
  const body: unknown = await res.json().catch((): unknown[] => []);
  return (Array.isArray(body) ? body : (body as { sedi?: unknown[] }).sedi || []) as unknown[];
}

export async function listReparti(session: WorkbenchSession): Promise<Reparto[]> {
  const res = await sessionFetch(session, '/api/crm/reparti');
  const body: unknown = await res.json().catch((): unknown[] => []);
  return (Array.isArray(body) ? body : (body as { reparti?: Reparto[] }).reparti || []) as Reparto[];
}

/** Contract C via sessione (superficie membro, apertura consegnata da CLIENT RUNTIME). Sola lettura. */
export async function fetchOrgRuntimeViaSession(session: WorkbenchSession, organizationId: string): Promise<PsxRuntimeSnapshot> {
  const res = await sessionFetch(session, `/api/crm/runtime?organization_id=${encodeURIComponent(organizationId)}`);
  if (!res.ok) throw new PsxSessionError('runtime_read_failed', `Lettura runtime fallita (HTTP ${res.status})`, res.status);
  const payload = (await res.json()) as { runtime: PsxRuntimeSnapshot };
  return payload.runtime;
}

/**
 * Contract B (Fase 1) — creazione reparto. MUTATION GOVERNATA: chiamare SOLO
 * dopo approvazione esplicita dell'utente nella UI (Authorized Apply).
 */
export async function createReparto(
  session: WorkbenchSession,
  payload: { nome: string; descrizione?: string; azienda_id?: string; sede_id?: string },
): Promise<Reparto> {
  const res = await sessionFetch(session, '/api/crm/reparti', { method: 'POST', body: JSON.stringify(payload) });
  if (res.status === 409) throw new PsxSessionError('duplicate', 'Reparto già esistente', 409);
  if (!res.ok) throw new PsxSessionError('create_failed', `Creazione reparto fallita (HTTP ${res.status})`, res.status);
  return (await res.json()) as Reparto;
}

export interface CompanyFacts {
  name: string;
  sector: string;
  headquarters: string;
  website: string;
  description: string;
}

export interface EmployeeProposal {
  /** Display name shown in the UI — MUST map to a canonical PSX record once contracts land. */
  displayName: string;
  role: string;
  specialty: string;
  /** Canonical runtime agent code (agenti[].code) chosen at apply time — mocked for now. */
  agentCode: string | null;
}

export interface DepartmentProposal {
  name: string;
  purpose: string;
  employees: EmployeeProposal[];
}

export interface OrganizationProposal {
  facts: CompanyFacts;
  departments: DepartmentProposal[];
}

export interface ApplyOutcome {
  mock: boolean;
  message: string;
}

// ─── DIPENDENTI (contratto Department & Employee, lettera-7, deploy seq 139) ───
// GET /api/org/dipendenti?organization_id= — sessione membro dell'org → elenco.
// POST /api/org/dipendenti — solo admin/owner dell'org; idempotente per richiestaId.
// «Dipendente» = agente AI legato a UN reparto (reparto_id); nasce già legato.
export const DEPARTMENT_EMPLOYEE_CONTRACT_REAL = true;

export interface Dipendente {
  id: string;
  code: string;
  nome: string;
  ruolo: string;
  reparto_id: string;
}

export async function listDipendenti(session: WorkbenchSession, organizationId: string): Promise<Dipendente[]> {
  const res = await sessionFetch(session, `/api/org/dipendenti?organization_id=${encodeURIComponent(organizationId)}`);
  if (!res.ok) throw new PsxSessionError('dipendenti_read_failed', `Lettura dipendenti fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { ok?: boolean; dipendenti?: Dipendente[] };
  return body.dipendenti || [];
}

export interface CreateDipendenteRequest {
  organizationId: string;
  nome: string;
  ruolo?: string;
  repartoId: string;
  /** UUID v4 client-generated — idempotency key (retry/doppio click → stesso dipendente). */
  richiestaId: string;
}

/** MUTATION GOVERNATA: solo admin/owner dell'org; chiamare dopo approvazione esplicita in UI. */
export async function createDipendente(session: WorkbenchSession, req: CreateDipendenteRequest): Promise<{ ripetuto: boolean; dipendente: Dipendente }> {
  const nome = req.nome.trim();
  if (!nome || nome.length > 120) throw new PsxSessionError('CAMPO_NON_VALIDO', 'nome: mancante o troppo lungo (1–120)', 400);
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.richiestaId)) {
    throw new PsxSessionError('CAMPO_NON_VALIDO', 'richiestaId deve essere un UUID v4', 400);
  }
  const res = await fetch(`${psxBaseUrl()}/api/org/dipendenti`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({
      organizationId: req.organizationId,
      nome,
      ...(req.ruolo ? { ruolo: req.ruolo } : {}),
      repartoId: req.repartoId,
      richiestaId: req.richiestaId,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean; ripetuto?: boolean; dipendente?: Dipendente;
    error?: { code?: string; campo?: string; motivo?: string };
  };
  if (res.status === 400) throw new PsxSessionError(body.error?.code || 'CAMPO_NON_VALIDO', `${body.error?.campo || 'campo'}: ${body.error?.motivo || 'non valido'}`, 400);
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (res.status === 403) throw new PsxSessionError('NEGATO', 'Solo admin/owner dell\'organizzazione possono creare dipendenti', 403);
  if (res.status === 404) throw new PsxSessionError('reparto_non_trovato', 'Reparto inesistente o di un\'altra organizzazione', 404);
  if (res.status === 502) throw new PsxSessionError('ERRORE_DIPENDENTE', 'Creazione dipendente fallita (fail-closed)', 502);
  if (!res.ok || !body.ok || !body.dipendente) throw new PsxSessionError('UNEXPECTED', `Creazione dipendente fallita (HTTP ${res.status})`, res.status);
  return { ripetuto: Boolean(body.ripetuto), dipendente: body.dipendente };
}

// ─── CAPABILITY BRIDGE v1 (contratti verbatim CLIENT RUNTIME, rev a291774a) ───
// PSX possiede gli AI Employees (Agent Registry + Employee Shell). Il mapping
// execution-provider è GOVERNATO DA PSX (tabella agent_execution_mapping,
// tenant-scoped, UNIQUE org+agent+provider, UNIQUE richiesta_id). Stati:
// SYNC_PENDING → (PATCH con read-back server-side) → SYNCED | SYNC_FAILED.
// Recupero da SYNC_FAILED: re-POST/PATCH con la STESSA richiestaId.
export const AGENT_BRIDGE_CONTRACT_REAL = true;

export type AgentMappingStatus = 'SYNC_PENDING' | 'SYNCED' | 'SYNC_FAILED';

export interface AgentMapping {
  id: string;
  organization_id: string;
  agent_id: string;
  execution_provider: string;
  provider_assistant_id: string | null;
  provider_instance_id: string | null;
  configuration_version: number;
  sync_status: AgentMappingStatus;
  last_synced_at: string | null;
  last_error: string | null;
  richiesta_id: string;
}

function parsePsxError(res: Response, body: { ok?: boolean; error?: { code?: string; message?: string; motivo?: string } }): PsxSessionError {
  const code = body.error?.code || 'UNEXPECTED';
  const motivo = body.error?.motivo || body.error?.message || `HTTP ${res.status}`;
  return new PsxSessionError(code, motivo, res.status);
}

/** Contratto 2 — Update AI Employee: PATCH parziale, idempotente by-nature (no richiestaId). */
export async function updateDipendente(
  session: WorkbenchSession,
  req: {
    organizationId: string;
    agentId: string;
    nome?: string;
    ruolo?: string;
    repartoId?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    expertise?: string[];
  },
): Promise<Dipendente> {
  const { organizationId, agentId, ...campi } = req;
  if (campi.temperature !== undefined && (campi.temperature < 0 || campi.temperature > 2)) {
    throw new PsxSessionError('CAMPO_NON_VALIDO', 'temperature: 0..2', 400);
  }
  const res = await fetch(`${psxBaseUrl()}/api/org/dipendenti`, {
    method: 'PATCH',
    headers: sessionHeaders(session),
    body: JSON.stringify({ organizationId, agentId, ...campi }),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; dipendente?: Dipendente; error?: { code?: string; motivo?: string } };
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (!res.ok || !body.ok || !body.dipendente) throw parsePsxError(res, body);
  return body.dipendente;
}

/** Contratto 7 — Register Execution Provider Mapping. sync_status è SERVER-SET (SYNC_PENDING): mai accettato dal client. */
export async function registerAgentMapping(
  session: WorkbenchSession,
  req: { organizationId: string; agentId: string; executionProvider: string; providerAssistantId?: string; providerInstanceId?: string; richiestaId: string },
): Promise<{ ripetuto: boolean; mapping: AgentMapping }> {
  const res = await fetch(`${psxBaseUrl()}/api/org/agenti/mapping`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({
      organizationId: req.organizationId,
      agentId: req.agentId,
      executionProvider: req.executionProvider,
      ...(req.providerAssistantId ? { providerAssistantId: req.providerAssistantId } : {}),
      ...(req.providerInstanceId ? { providerInstanceId: req.providerInstanceId } : {}),
      richiestaId: req.richiestaId,
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; ripetuto?: boolean; mapping?: AgentMapping; error?: { code?: string; motivo?: string } };
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (!res.ok || !body.ok || !body.mapping) throw parsePsxError(res, body);
  return { ripetuto: Boolean(body.ripetuto), mapping: body.mapping };
}

/** Contratto 8 (conferma) — PATCH con READ-BACK server-side della config effettiva PSX.
 * Se l'agente PSX è attivo → SYNCED; se ritirato → SYNC_FAILED (risposta comunque 200). */
export async function confirmAgentMapping(
  session: WorkbenchSession,
  req: { organizationId: string; agentId: string; executionProvider: string; richiestaId: string; providerAssistantId: string; providerInstanceId?: string; configurationVersion?: number },
): Promise<AgentMapping> {
  const res = await fetch(`${psxBaseUrl()}/api/org/agenti/mapping`, {
    method: 'PATCH',
    headers: sessionHeaders(session),
    body: JSON.stringify({
      organizationId: req.organizationId,
      agentId: req.agentId,
      executionProvider: req.executionProvider,
      richiestaId: req.richiestaId,
      providerAssistantId: req.providerAssistantId,
      ...(req.providerInstanceId ? { providerInstanceId: req.providerInstanceId } : {}),
      ...(req.configurationVersion ? { configurationVersion: req.configurationVersion } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; mapping?: AgentMapping; error?: { code?: string; motivo?: string } };
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (!res.ok || !body.ok || !body.mapping) throw parsePsxError(res, body);
  return body.mapping;
}

/** Contratto 9 — Disable/Revoke AI Employee. Body canonico: organizationId + motivo (entrambi obbligatori, motivo finisce nell'audit). */
export async function retireDipendente(
  session: WorkbenchSession,
  req: { organizationId: string; agentId: string; motivo: string },
): Promise<void> {
  const res = await fetch(`${psxBaseUrl()}/api/voyager/azienda/agenti/${encodeURIComponent(req.agentId)}/ritiro`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({ organizationId: req.organizationId, motivo: req.motivo }),
  });
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; motivo?: string } };
  if (!res.ok) throw parsePsxError(res, body);
}

/** Contratto 10 — Get Sync Status + Effective Config. `agente` presente solo se agentId è passato. */
export async function listAgentMappings(
  session: WorkbenchSession,
  req: { organizationId: string; agentId?: string; executionProvider?: string },
): Promise<{ mappings: AgentMapping[]; agente: Record<string, unknown> | null }> {
  const q = new URLSearchParams({ organization_id: req.organizationId });
  if (req.agentId) q.set('agent_id', req.agentId);
  if (req.executionProvider) q.set('execution_provider', req.executionProvider);
  const res = await sessionFetch(session, `/api/org/agenti/mapping?${q.toString()}`);
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; mappings?: AgentMapping[]; agente?: Record<string, unknown> | null; error?: { code?: string; motivo?: string } };
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (!res.ok || !body.ok) throw parsePsxError(res, body);
  return { mappings: body.mappings || [], agente: body.agente ?? null };
}

// ─── SESSION SYNC (contratto /api/vibe, superficie cliente, collaudato 9/9) ───
// Le sessioni VOYAGER sono memorizzate nel runtime cliente per account+org,
// tenant-isolated. Il messaggio è { id, role, content, timestamp }; l'ORDINE
// della lista inviata è il riordino canonico; il merge server conserva i
// propri messaggi (flagged delServer) e unisce i nostri — re-POST idempotente.
export const VIBE_SESSION_SYNC_CONTRACT_REAL = true;

export interface VibeSession {
  id: string;
  title: string;
  pinned?: boolean;
  created_at?: string;
}

export async function createVibeSession(session: WorkbenchSession, organizationId: string, title: string): Promise<VibeSession> {
  const res = await fetch(`${psxBaseUrl()}/api/vibe/sessions`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({ organizationId, title: title.slice(0, 120) || 'Sessione' }),
  });
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (!res.ok) throw new PsxSessionError('vibe_create_failed', `Creazione sessione runtime fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { session?: VibeSession };
  if (!body.session) throw new PsxSessionError('UNEXPECTED', 'Risposta creazione sessione runtime malformata', res.status);
  return body.session;
}

export async function listVibeSessions(session: WorkbenchSession, organizationId: string): Promise<VibeSession[]> {
  const res = await sessionFetch(session, `/api/vibe/sessions?organizationId=${encodeURIComponent(organizationId)}`);
  if (!res.ok) throw new PsxSessionError('vibe_list_failed', `Lettura sessioni runtime fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { sessions?: VibeSession[] };
  return body.sessions || [];
}

export async function deleteVibeSession(session: WorkbenchSession, organizationId: string, sessionId: string): Promise<void> {
  const res = await fetch(`${psxBaseUrl()}/api/vibe/sessions?sessionId=${encodeURIComponent(sessionId)}&organizationId=${encodeURIComponent(organizationId)}`, {
    method: 'DELETE',
    headers: sessionHeaders(session),
  });
  if (!res.ok && res.status !== 404) {
    throw new PsxSessionError('vibe_delete_failed', `Cancellazione sessione runtime fallita (HTTP ${res.status})`, res.status);
  }
}

export interface VibeMessage {
  id: string;
  role: string;
  content: string;
  timestamp: string;
}

/**
 * SALVA con MERGE server: inviamo la LISTA CANONICA COMPLETA dei messaggi;
 * il server conserva i propri e unisce i nostri. Idempotente per message_id.
 */
export async function saveVibeChatHistory(session: WorkbenchSession, organizationId: string, sessionId: string, messages: VibeMessage[]): Promise<void> {
  const res = await fetch(`${psxBaseUrl()}/api/vibe/chat-history`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({ organizationId, sessionId, messages }),
  });
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (!res.ok) throw new PsxSessionError('vibe_save_failed', `Salvataggio cronologia runtime fallito (HTTP ${res.status})`, res.status);
}

export async function getVibeChatHistory(session: WorkbenchSession, organizationId: string, sessionId: string): Promise<VibeMessage[]> {
  const res = await sessionFetch(session, `/api/vibe/chat-history?organizationId=${encodeURIComponent(organizationId)}&sessionId=${encodeURIComponent(sessionId)}`);
  if (!res.ok) throw new PsxSessionError('vibe_read_failed', `Lettura cronologia runtime fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { messages?: VibeMessage[] };
  return body.messages || [];
}

// ─── INVITI MEMBRI UMANI (superficie cliente, org-scoped) ───
// POST /api/org/invite {organization_id, email, role} — solo admin/owner.
// GET /api/org/invite?organization_id= — elenco inviti pendenti dell'org.
// GET /api/org/invite/:token — lettura pubblica dell'invito (org_name, email, role).
// POST /api/org/invite/{token}/accept — accept con sessione dell'invitato (firma confermata CLIENT RUNTIME).
// DELETE /api/org/invite?id= — revoke (gate admin dell'org dell'invite).
export interface OrgInvite {
  id: string;
  email: string;
  role: string;
  token?: string;
  expires_at?: string;
  created_at?: string;
  invited_by?: string;
}

export async function createOrgInvite(session: WorkbenchSession, organizationId: string, email: string, role: 'member' | 'admin'): Promise<{ invite: OrgInvite; portalUrl?: string }> {
  const res = await fetch(`${psxBaseUrl()}/api/org/invite`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({ organization_id: organizationId, email: email.trim().toLowerCase(), role }),
  });
  const body = (await res.json().catch(() => ({}))) as { invite?: OrgInvite; portal_url?: string; error?: { code?: string; motivo?: string } };
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (res.status === 403) throw new PsxSessionError('NEGATO', 'Solo admin/owner possono invitare membri', 403);
  if (res.status === 400) throw new PsxSessionError(body.error?.code || 'CAMPO_NON_VALIDO', body.error?.motivo || 'Email o ruolo non validi', 400);
  if (res.status === 409) throw new PsxSessionError('GIA_INVITATO', 'Email già invitata o già membro', 409);
  if (!res.ok || !body.invite) throw new PsxSessionError('UNEXPECTED', `Creazione invito fallita (HTTP ${res.status})`, res.status);
  return { invite: body.invite, portalUrl: body.portal_url };
}

export async function listOrgInvites(session: WorkbenchSession, organizationId: string): Promise<OrgInvite[]> {
  const res = await sessionFetch(session, `/api/org/invite?organization_id=${encodeURIComponent(organizationId)}`);
  if (!res.ok) throw new PsxSessionError('invite_list_failed', `Lettura inviti fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { invites?: OrgInvite[] };
  return body.invites || [];
}

export async function getOrgInviteByToken(session: WorkbenchSession | null, token: string): Promise<OrgInvite | null> {
  const headers = session ? sessionHeaders(session) : { 'Content-Type': 'application/json' };
  const res = await fetch(`${psxBaseUrl()}/api/org/invite/${encodeURIComponent(token)}`, { headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new PsxSessionError('invite_read_failed', `Lettura invito fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { invite?: OrgInvite };
  return body.invite || null;
}

// POST /api/org/invite/{token}/accept — sessione cookie dell'invitato, nessun body.
// 404 INVITE_NOT_FOUND · 410 INVITE_REVOKED/USED/EXPIRED · 403 EMAIL_MISMATCH · 200 {success, organization_id, org_name, role}
export interface InviteAcceptResult {
  organizationId: string;
  orgName: string;
  role: string;
}

export async function acceptOrgInvite(session: WorkbenchSession, token: string): Promise<InviteAcceptResult> {
  const res = await fetch(`${psxBaseUrl()}/api/org/invite/${encodeURIComponent(token)}/accept`, {
    method: 'POST',
    headers: sessionHeaders(session),
  });
  const body = (await res.json().catch(() => ({}))) as { success?: boolean; organization_id?: string; org_name?: string; role?: string; error?: { code?: string; motivo?: string } };
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta: accedi per accettare l\u2019invito', 401);
  if (res.status === 403) throw new PsxSessionError('EMAIL_MISMATCH', body.error?.motivo || 'L\u2019account autenticato non corrisponde all\u2019email dell\u2019invito', 403);
  if (res.status === 404) throw new PsxSessionError('INVITE_NOT_FOUND', 'Invito non trovato', 404);
  if (res.status === 410) throw new PsxSessionError(body.error?.code || 'INVITE_EXPIRED', body.error?.motivo || 'Invito scaduto, revocato o gi\u00e0 usato', 410);
  if (!res.ok || !body.success || !body.organization_id) throw new PsxSessionError('UNEXPECTED', `Accept fallito (HTTP ${res.status})`, res.status);
  return { organizationId: body.organization_id!, orgName: body.org_name || '', role: body.role || 'member' };
}

// DELETE /api/org/invite?id=<invite_id> — revoke (gate admin dell'org dell'invite).
// 200 {success} · 404 inesistente · 409 INVITE_USED/INVITE_REVOKED
export async function revokeOrgInvite(session: WorkbenchSession, inviteId: string): Promise<void> {
  const res = await sessionFetch(session, `/api/org/invite?id=${encodeURIComponent(inviteId)}`, { method: 'DELETE' });
  if (res.status === 404) throw new PsxSessionError('INVITE_NOT_FOUND', 'Invito non trovato', 404);
  if (res.status === 409) {
    const body = (await res.json().catch(() => ({}))) as { error?: { code?: string; motivo?: string } };
    throw new PsxSessionError(body.error?.code || 'INVITE_REVOKED', body.error?.motivo || 'Invito gi\u00e0 accettato o gi\u00e0 revocato', 409);
  }
  if (!res.ok) throw new PsxSessionError('UNEXPECTED', `Revoke fallita (HTTP ${res.status})`, res.status);
}

// ─── MEMBRI UMANI (GET /api/org/members?organization_id=, snake_case) ───
export interface OrgMember {
  user_id: string;
  role: string;
  created_at?: string;
  email?: string;
  full_name?: string;
  avatar_url?: string;
}

export async function listOrgMembers(session: WorkbenchSession, organizationId: string): Promise<OrgMember[]> {
  const res = await sessionFetch(session, `/api/org/members?organization_id=${encodeURIComponent(organizationId)}`);
  if (res.status === 403) throw new PsxSessionError('NEGATO', 'Solo membri dell\u2019organizzazione possono vedere la lista membri', 403);
  if (!res.ok) throw new PsxSessionError('members_list_failed', `Lettura membri fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json()) as { members?: OrgMember[]; data?: OrgMember[] };
  return body.members || body.data || [];
}

// ─── BOOTSTRAP CANONICO (contratto consegnato da CLIENT RUNTIME, rev e29e1c54) ─
// POST /api/org/crea — solo-sessione (cookie Supabase), SOLO POST.
// Catena canonica: RPC create_shared_organization_runtime (org + Primary Company +
// SHARED runtime, transazionale, idempotente per richiestaId) + owner membership
// del chiamante + Main Site.

export interface BootstrapSede {
  nome: string;
  citta?: string;
  indirizzo?: string;
  cap?: string;
  paese?: string;
}

export interface BootstrapRequest {
  /** 1–120 caratteri — la Primary Company prende lo stesso nome. */
  nome: string;
  /** Opzionale; se assente: "Sede principale". */
  sede?: BootstrapSede;
}

export interface BootstrapResult {
  ripetuta: boolean;
  organizzazione: { id: string; nome: string; slug: string };
  azienda: { id: string; nome: string };
  sede: { id: string; nome: string; principale: boolean };
  runtime: {
    runtime_id: string;
    organization_id: string;
    isolation_mode: string;
    provisioning_state: string;
    health_state: unknown;
  };
}

/** 409 ORGANIZZAZIONE_OMONIMA — nessun auto-aggancio: la UI chiede un nome diverso o fa scegliere. */
export class OrganizzazioneOmonimaError extends Error {
  constructor(
    public readonly nome: string,
    public readonly esistenti: { id: string; nome: string }[],
  ) {
    super(`Esiste già un'organizzazione con nome "${nome}"`);
  }
}

export function newRichiestaId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  // Fallback RFC4122 v4 per ambienti senza randomUUID
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Bootstrap canonico. MUTATION GOVERNATA: chiamare SOLO dopo approvazione esplicita
 * dell'utente nella UI (Authorized Apply). Idempotente: ritrasmettere lo STESSO
 * richiestaId è sempre sicuro (retry, doppio click, crash/restart del wizard).
 */
export async function createOrganizationBootstrap(
  session: WorkbenchSession,
  richiestaId: string,
  req: BootstrapRequest,
): Promise<BootstrapResult> {
  const nome = req.nome.trim();
  if (!nome || nome.length > 120) {
    throw new PsxSessionError('CAMPO_NON_VALIDO', 'Nome organizzazione mancante o troppo lungo (1–120)', 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(richiestaId)) {
    throw new PsxSessionError('CAMPO_NON_VALIDO', 'richiestaId deve essere un UUID v4', 400);
  }
  const res = await fetch(`${psxBaseUrl()}/api/org/crea`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({ nome, richiestaId, ...(req.sede ? { sede: req.sede } : {}) }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    ripetuta?: boolean;
    organizzazione?: BootstrapResult['organizzazione'];
    azienda?: BootstrapResult['azienda'];
    sede?: BootstrapResult['sede'];
    runtime?: BootstrapResult['runtime'];
    error?: { code?: string; tipo?: string; campo?: string; motivo?: string; nome?: string; esistenti?: { id: string; nome: string }[] };
  };
  if (res.status === 409) {
    const err = body.error || {};
    throw new OrganizzazioneOmonimaError(String(err.nome ?? nome), Array.isArray(err.esistenti) ? err.esistenti : []);
  }
  if (res.status === 400) {
    const err = body.error || {};
    throw new PsxSessionError(String(err.code || 'CAMPO_NON_VALIDO'), `${err.campo || 'campo'}: ${err.motivo || 'non valido'}`, 400);
  }
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (res.status === 502) throw new PsxSessionError('ERRORE_BOOTSTRAP', 'Bootstrap fallito (fail-closed: nulla di parziale esposto)', 502);
  if (!res.ok || !body.ok || !body.organizzazione) {
    throw new PsxSessionError('UNEXPECTED', `Bootstrap fallito (HTTP ${res.status})`, res.status);
  }
  return {
    ripetuta: Boolean(body.ripetuta),
    organizzazione: body.organizzazione,
    azienda: body.azienda as BootstrapResult['azienda'],
    sede: body.sede as BootstrapResult['sede'],
    runtime: body.runtime as BootstrapResult['runtime'],
  };
}

// ─── GARRISON / DISPATCH (lettera-19, rev bd2f27c3, seq 149; lettera-21 chiarimenti) ──
// La caserma è l'UNICO punto di ingresso degli ordini verso gli AI Employees:
// coda durabile, idempotente per richiestaId (client-generated UUID v4), audita.
// Stati: IN_CODA → PRESO_IN_CARICO → FINITA | FALLITA (last_error, tentativi;
// FALLITA è riprendibile). Available ≠ Granted lo decide il servizio avviaELavora.
// Lettera-21 (ufficiale): 202 = ordine nuovo, 200 ripetuto:true (refuso 201 nella 19).
// Il worker è di PSX (lib/voyager/dispatch-worker.ts, battito ~60s): VOYAGER NON
// CONSUMA LA CODA — solo ACCODA (POST canale 'voyager') e LEGGE (GET pura lettura).
// PRESO_IN_CARICO è segnato dal worker PSX con claim condizionale; mai mutato da noi.
export const DISPATCH_CONTRACT_REAL = true;

export type DispatchChannel = 'voyager' | 'workbench' | 'api' | 'webhook' | 'cron' | 'email';
export type DispatchStatus = 'IN_CODA' | 'PRESO_IN_CARICO' | 'FINITA' | 'FALLITA';

export interface DispatchOrder {
  id: string;
  organization_id: string;
  agent_id: string;
  canale: DispatchChannel;
  richiesta: string;
  interlocutore?: unknown;
  richiesta_id: string;
  priorita?: number;
  stato: DispatchStatus;
  eventi?: unknown;
  risultato?: unknown;
  last_error?: string | null;
  tentativi?: number;
  created_at?: string;
  updated_at?: string;
}

export interface EnqueueDispatchRequest {
  organizationId: string;
  agentId: string;
  /** Testo dell'ordine: 1–8000 caratteri. */
  richiesta: string;
  /** Chi chiama dal canale (opzionale, jsonb libero). */
  interlocutore?: Record<string, unknown>;
  /** UUID v4 generato dal CLIENT — chiave di idempotenza: stesso richiestaId → STESSO ordine. */
  richiestaId: string;
  /** 1–9, default 5; 1 = urgente. */
  priorita?: number;
}

/** 202 nuovo ordine · 200 ripetuto:true (stesso richiestaId, mai doppio lavoro) · 400 campo non valido · 404 NEGATO (anti-enumerazione) · 409 NEGATO (agente ritirato). */
export async function enqueueAgentDispatch(
  session: WorkbenchSession,
  req: EnqueueDispatchRequest,
): Promise<{ ripetuto: boolean; dispatch: DispatchOrder }> {
  const richiesta = req.richiesta;
  if (!richiesta || richiesta.length > 8000) {
    throw new PsxSessionError('CAMPO_NON_VALIDO', 'richiesta: mancante o troppo lunga (1–8000)', 400);
  }
  if (req.priorita !== undefined && (req.priorita < 1 || req.priorita > 9)) {
    throw new PsxSessionError('CAMPO_NON_VALIDO', 'priorita: 1–9', 400);
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(req.richiestaId)) {
    throw new PsxSessionError('CAMPO_NON_VALIDO', 'richiestaId deve essere un UUID v4', 400);
  }
  const res = await fetch(`${psxBaseUrl()}/api/org/agenti/dispatch`, {
    method: 'POST',
    headers: sessionHeaders(session),
    body: JSON.stringify({
      organizationId: req.organizationId,
      agentId: req.agentId,
      canale: 'voyager' as const,
      richiesta,
      ...(req.interlocutore ? { interlocutore: req.interlocutore } : {}),
      richiestaId: req.richiestaId,
      ...(req.priorita !== undefined ? { priorita: req.priorita } : {}),
    }),
  });
  const body = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    ripetuto?: boolean;
    dispatch?: DispatchOrder;
    error?: { code?: string; campo?: string; motivo?: string };
  };
  if (res.status === 400) throw new PsxSessionError(body.error?.code || 'CAMPO_NON_VALIDO', `${body.error?.campo || 'campo'}: ${body.error?.motivo || 'non valido'}`, 400);
  if (res.status === 401) throw new PsxSessionError('unauthenticated', 'Sessione scaduta', 401);
  if (res.status === 404) throw new PsxSessionError('NEGATO', body.error?.motivo || 'Agente non disponibile', 404);
  if (res.status === 409) throw new PsxSessionError('NEGATO', body.error?.motivo || 'Agente ritirato: non prende ordini', 409);
  if (!res.ok || !body.ok || !body.dispatch) throw new PsxSessionError('UNEXPECTED', `Dispatch fallito (HTTP ${res.status})`, res.status);
  return { ripetuto: Boolean(body.ripetuto), dispatch: body.dispatch };
}

/** Stato di un ordine: GET /api/org/agenti/dispatch?organization_id=&dispatch_id= */
export async function getAgentDispatch(session: WorkbenchSession, organizationId: string, dispatchId: string): Promise<DispatchOrder> {
  const res = await sessionFetch(session, `/api/org/agenti/dispatch?organization_id=${encodeURIComponent(organizationId)}&dispatch_id=${encodeURIComponent(dispatchId)}`);
  if (!res.ok) throw new PsxSessionError('dispatch_read_failed', `Lettura ordine fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json().catch(() => ({}))) as { dispatch?: DispatchOrder };
  if (!body.dispatch) throw new PsxSessionError('UNEXPECTED', 'Risposta stato ordine malformata', res.status);
  return body.dispatch;
}

/** Coda della caserma (tenant-scoped): filtri opzionali agent_id / stato / limite. */
export async function listAgentDispatchOrders(
  session: WorkbenchSession,
  req: { organizationId: string; agentId?: string; stato?: DispatchStatus; limite?: number },
): Promise<DispatchOrder[]> {
  const q = new URLSearchParams({ organization_id: req.organizationId });
  if (req.agentId) q.set('agent_id', req.agentId);
  if (req.stato) q.set('stato', req.stato);
  if (req.limite !== undefined) q.set('limite', String(req.limite));
  const res = await sessionFetch(session, `/api/org/agenti/dispatch?${q.toString()}`);
  if (!res.ok) throw new PsxSessionError('dispatch_list_failed', `Lettura coda fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json().catch(() => ({}))) as { dispatches?: DispatchOrder[]; orders?: DispatchOrder[] };
  return body.dispatches || body.orders || [];
}

// ─── DISTRIBUZIONE / UPDATE CHECK (lettera-25 + risposte A-C, deploy seq 209) ──
// GET /api/voyager/distribuzione/latest?canale=stable con cookie PSX (auth obbligatoria).
// Contratto risposta: { ok, manifest: { canale, versione, nome_file, sha256, size_bytes,
// firmato, pubblicato_at, download_url } }. download_url è SEMPRE null finché il canale
// binario governato non è attivo (il binario vive in storage box, mai in repo/vault).
// 404 NESSUNA_RELEASE = canale vuoto → restare sulla versione corrente (nessun errore).
export const DISTRIBUZIONE_CONTRACT_REAL = true;

export interface DistribuzioneManifest {
  canale: string;
  versione: string;
  nome_file: string;
  sha256: string;
  size_bytes: number;
  firmato: boolean;
  pubblicato_at: string | null;
  download_url: string | null;
}

export async function checkDistribuzioneUpdate(session: WorkbenchSession, canale = 'stable'): Promise<DistribuzioneManifest | null> {
  const res = await sessionFetch(session, `/api/voyager/distribuzione/latest?canale=${encodeURIComponent(canale)}`);
  if (res.status === 404) return null; // nessuna release sul canale: versione corrente va bene
  if (!res.ok) throw new PsxSessionError('distribuzione_read_failed', `Lettura manifest fallita (HTTP ${res.status})`, res.status);
  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; manifest?: DistribuzioneManifest };
  return body.ok && body.manifest ? body.manifest : null;
}

/** Confronto semver semplice (major.minor.patch, ignora prerelease a parità di numeri). */
export function isVersionNewer(current: string, candidate: string): boolean {
  const num = (v: string): [number, number, number] => {
    const m = /^(\d+)\.(\d+)\.(\d+)/.exec(v.trim());
    return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : [0, 0, 0];
  };
  const [a, b, c] = num(current);
  const [x, y, z] = num(candidate);
  if (x !== a) return x > a;
  if (y !== b) return y > b;
  return z > c;
}

/** Mock departments "alla regola d'arte" per settore — fixture per la presentazione UI. */
export function mockDepartmentsForSector(sector: string): DepartmentProposal[] {
  const s = sector.toLowerCase();
  if (s.includes('edil') || s.includes('costruz')) {
    return [
      {
        name: 'Cantieri',
        purpose: 'Gestione dei cantieri e coordination dei lavori',
        employees: [
          { displayName: 'Paolo', role: 'Direttore di cantiere', specialty: 'Pianificazione lavori e sicurezza', agentCode: null },
          { displayName: 'Sara', role: 'Preventivista', specialty: 'Calcolo preventivi e capitolati', agentCode: null },
        ],
      },
      {
        name: 'Ufficio tecnico',
        purpose: 'Progetti, misure e materiali',
        employees: [
          { displayName: 'Luca', role: 'Tecnico', specialty: 'Disegni e distinte materiali', agentCode: null },
        ],
      },
      {
        name: 'Amministrazione',
        purpose: 'Fatture, scadenze e documenti',
        employees: [
          { displayName: 'Anna', role: 'Amministrazione', specialty: 'Fatturazione e scadenze', agentCode: null },
        ],
      },
    ];
  }
  if (s.includes('marketing') || s.includes('agenzia') || s.includes('comunicaz')) {
    return [
      {
        name: 'Campagne',
        purpose: 'Google Ads e campagne a pagamento',
        employees: [
          { displayName: 'Marco', role: 'Ads Manager', specialty: 'Google Ads e budget', agentCode: null },
        ],
      },
      {
        name: 'Contenuti',
        purpose: 'Post social e contenuti editoriali',
        employees: [
          { displayName: 'Sara', role: 'Social Media Manager', specialty: 'Calendario editoriale e post', agentCode: null },
        ],
      },
      {
        name: 'Amministrazione',
        purpose: 'Fatture, scadenze e documenti',
        employees: [
          { displayName: 'Anna', role: 'Amministrazione', specialty: 'Fatturazione e scadenze', agentCode: null },
        ],
      },
    ];
  }
  // Settore generico
  return [
    {
      name: 'Operazioni',
      purpose: 'Il cuore dell’attività: consegna di prodotti e servizi',
      employees: [
        { displayName: 'Paolo', role: 'Responsabile operativo', specialty: 'Organizzazione del lavoro', agentCode: null },
      ],
    },
    {
      name: 'Commerciale',
      purpose: 'Clienti, preventivi e canali',
      employees: [
        { displayName: 'Marco', role: 'Commerciale', specialty: 'Preventivi e follow-up clienti', agentCode: null },
        { displayName: 'Sara', role: 'Social e messaggi', specialty: 'WhatsApp, email e social', agentCode: null },
      ],
    },
    {
      name: 'Amministrazione',
      purpose: 'Fatture, scadenze e documenti',
      employees: [
        { displayName: 'Anna', role: 'Amministrazione', specialty: 'Fatturazione e scadenze', agentCode: null },
      ],
    },
  ];
}
