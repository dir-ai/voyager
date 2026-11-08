/**
 * VOYAGER Company Edition — Workbench session service.
 *
 * Unica fonte di autenticazione utente per la Company Edition: la sessione
 * Supabase/Workbench (contratto PSX). NON è un user registry: l'identità,
 * l'organizzazione e i ruoli sono autorità PSX; qui conserviamo solo la
 * sessione (cifrata via Electron safeStorage nel main process) e lo stato
 * UI non autoritativo (organizzazione selezionata).
 *
 * Separazione netta (§5 del contratto di coordinamento): questa persistenza
 * NON ha nulla a che fare con la memoria conversazionale di aioncore.
 * Password mai salvate. Service key mai toccate da questo modulo.
 */

import { emitter } from '@/renderer/utils/emitter';
import { buildWorkbenchSessionCookie, getSupabaseAnonKey, type UserOrg, type WorkbenchSession } from '@/renderer/services/companyContract';

const SUPABASE_URL = 'https://supabase.psxworkbench.com';
const WORKBENCH_BASE_URL = 'https://dev.psxworkbench.com';
const CURRENT_ORG_KEY = 'voyager_current_org';
export const WORKBENCH_SESSION_EVENT = 'voyager:workbench-session-changed';
export const WORKBENCH_ORG_EVENT = 'voyager:workbench-org-changed';

export interface WorkbenchIdentity {
  email: string | null;
  userId: string | null;
  platformRole: string | null;
  orgIds: string[];
}

interface ElectronSessionApi {
  get: () => Promise<string | null>;
  set: (value: string) => Promise<boolean>;
  clear: () => Promise<boolean>;
}

function sessionApi(): ElectronSessionApi | null {
  if (typeof window === 'undefined') return null;
  const api = (window as { electronAPI?: { voyagerSession?: ElectronSessionApi } }).electronAPI;
  return api?.voyagerSession ?? null;
}

export type SessionStatus = 'checking' | 'authenticated' | 'unauthenticated';

interface SessionState {
  status: SessionStatus;
  session: WorkbenchSession | null;
}

let state: SessionState = { status: 'checking', session: null };
const listeners = new Set<() => void>();
let refreshTimer: ReturnType<typeof setTimeout> | null = null;

function setState(next: Partial<SessionState>): void {
  state = { ...state, ...next };
  listeners.forEach((l) => l());
  emitter.emit(WORKBENCH_SESSION_EVENT, state.status);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getState(): SessionState {
  return state;
}

function sessionCookie(session: WorkbenchSession): string {
  return buildWorkbenchSessionCookie(session);
}

/** Expires_in seconds → absolute expiry timestamp (ms). */
function expiresAt(session: WorkbenchSession): number {
  return (session.expires_at ? session.expires_at * 1000 : Date.now() + (session.expires_in ?? 3600) * 1000);
}

function scheduleRefresh(session: WorkbenchSession): void {
  if (refreshTimer) clearTimeout(refreshTimer);
  const delay = Math.max(expiresAt(session) - Date.now() - 5 * 60 * 1000, 30 * 1000);
  refreshTimer = setTimeout((): void => {
    void refreshSession().catch((): void => undefined);
  }, delay);
}

/** Silent refresh via grant_type=refresh_token. Returns true on success. */
export async function refreshSession(): Promise<boolean> {
  const current = getState().session;
  if (!current?.refresh_token) return false;
  try {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
      method: 'POST',
      headers: { apikey: getSupabaseAnonKey(), 'content-type': 'application/json' },
      body: JSON.stringify({ refresh_token: current.refresh_token }),
    });
    if (!res.ok) {
      // Refresh rejected → treat as revoked/expired.
      await clearSession(false);
      return false;
    }
    const next = (await res.json()) as WorkbenchSession;
    setState({ session: next });
    await persist(next);
    scheduleRefresh(next);
    return true;
  } catch {
    return false;
  }
}

async function persist(session: WorkbenchSession): Promise<void> {
  const api = sessionApi();
  if (!api) return; // web-host runtime: memory-only session (no encryption available)
  await api.set(JSON.stringify(session));
}

/** Login with the PSX-supported password grant. Password is never persisted. */
export async function loginWorkbenchSession(email: string, password: string): Promise<void> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: getSupabaseAnonKey(), 'content-type': 'application/json' },
    body: JSON.stringify({ email, password, gotrue_meta_security: { captcha_token: 'unsupported' } }),
  });
  if (!res.ok) throw new Error('login_failed');
  const session = (await res.json()) as WorkbenchSession;
  setState({ status: 'authenticated', session });
  await persist(session);
  scheduleRefresh(session);
}

/** Restore persisted session at app start; refreshes if close to expiry. */
export async function restoreWorkbenchSession(): Promise<void> {
  const api = sessionApi();
  const raw = (await api?.get()) ?? null;
  if (!raw) {
    setState({ status: 'unauthenticated', session: null });
    return;
  }
  try {
    const session = JSON.parse(raw) as WorkbenchSession;
    setState({ session });
    if (expiresAt(session) - Date.now() < 10 * 60 * 1000) {
      const ok = await refreshSession();
      setState({ status: ok ? 'authenticated' : 'unauthenticated' });
      return;
    }
    setState({ status: 'authenticated' });
    scheduleRefresh(session);
  } catch {
    await clearSession(false);
  }
}

/** Logout: revoke server-side where supported, then always clear local state. */
export async function logoutWorkbenchSession(): Promise<void> {
  const current = getState().session;
  if (current?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: { apikey: getSupabaseAnonKey(), Authorization: `Bearer ${current.access_token}`, 'content-type': 'application/json' },
      });
    } catch {
      // provider revocation best-effort; local state is cleared regardless
    }
  }
  await clearSession(true);
}

async function clearSession(emit: boolean): Promise<void> {
  if (refreshTimer) clearTimeout(refreshTimer);
  refreshTimer = null;
  const api = sessionApi();
  await api?.clear().catch((): void => undefined);
  setState({ status: 'unauthenticated', session: null });
  if (emit) emitter.emit(WORKBENCH_ORG_EVENT, null);
}

/** Cookie header value for direct Workbench API calls. */
export function workbenchCookieHeader(): string | null {
  const session = getState().session;
  return session ? sessionCookie(session) : null;
}

// Restore the persisted session once at renderer bootstrap — NOT only when the
// Account page opens (that left status stuck on 'checking' at app start, which
// broke the sessions auth gate and the persisted-login experience).
let bootstrapped = false;
export function bootstrapWorkbenchSession(): void {
  if (bootstrapped) return;
  bootstrapped = true;
  void restoreWorkbenchSession();
}

// ── Active organization (non-authoritative UI state) ──────────────────────────

export function getActiveOrgId(): string | null {
  try {
    return localStorage.getItem(CURRENT_ORG_KEY);
  } catch {
    return null;
  }
}

/** Switch org: invalidates cached runtime/team context (tenant isolation). */
export async function setActiveOrg(org: UserOrg | null): Promise<void> {
  try {
    if (org) localStorage.setItem(CURRENT_ORG_KEY, org.id);
    else localStorage.removeItem(CURRENT_ORG_KEY);
  } catch {
    /* storage unavailable */
  }
  emitter.emit(WORKBENCH_ORG_EVENT, org?.id ?? null);
}

export function getWorkbenchSessionState(): SessionState {
  return state;
}

export { subscribe as subscribeWorkbenchSession, getState as getWorkbenchSessionStateInternal, WORKBENCH_BASE_URL, SUPABASE_URL };

// Renderer bootstrap: restore the persisted session as soon as this module is
// first imported (any page) so the auth gate reflects the real login state.
bootstrapWorkbenchSession();
