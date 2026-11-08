/**
 * VOYAGER Company Edition — session sync verso il runtime cliente (contratto
 * /api/vibe, superficie cliente, collaudato live 9/9 da CLIENT RUNTIME).
 *
 * Per ogni conversazione locale (aioncore) creiamo una sessione runtime
 * (per account+org, tenant-isolated) e ne salviamo la cronologia con MERGE
 * server: la lista canonica completa dei messaggi, idempotente per message_id.
 * Il server conserva i propri messaggi (agenti/automazioni) e unisce i nostri.
 */

import { ipcBridge } from '@/common';
import type { TChatConversation } from '@/common/config/storage';
import { createVibeSession, saveVibeChatHistory, type VibeMessage } from './companyContract';
import { getWorkbenchSessionState } from './workbenchSession';

const MAP_KEY = 'voyager_vibe_session_map';
type MapEntry = { vibeSessionId: string; orgId: string; syncedAt: number; lastCount: number };
type SessionMap = Record<string, MapEntry>;

const readMap = (): SessionMap => {
  try {
    return JSON.parse(localStorage.getItem(MAP_KEY) || '{}') as SessionMap;
  } catch {
    return {};
  }
};

const writeMap = (map: SessionMap): void => {
  try {
    localStorage.setItem(MAP_KEY, JSON.stringify(map));
  } catch {
    // storage pieno/corrotto: la sync riparte da zero senza rompere la UI
  }
};

const toVibeMessage = (m: {
  id?: string;
  role?: string;
  content?: unknown;
  created_at?: string | number;
}): VibeMessage | null => {
  if (!m.id || !m.role) return null;
  const content =
    typeof m.content === 'string'
      ? m.content
      : m.content === undefined || m.content === null
        ? ''
        : JSON.stringify(m.content);
  const ts = m.created_at;
  return {
    id: m.id,
    role: m.role,
    content,
    timestamp: typeof ts === 'number' ? new Date(ts).toISOString() : ts || new Date().toISOString(),
  };
};

const SYNC_BATCH = 40; // conversazioni per passata
const MESSAGE_LIMIT = 80; // messaggi recenti per conversazione

export interface SyncOutcome {
  synced: number;
  failed: number;
}

/**
 * Sincronizza le conversazioni locali verso il runtime cliente.
 * Chiamare SOLO con sessione autenticata e org attiva; altrimenti no-op.
 */
export async function syncConversationsToRuntime(orgId: string, conversations: TChatConversation[]): Promise<SyncOutcome> {
  const state = getWorkbenchSessionState();
  if (state.status !== 'authenticated' || !state.session || !orgId) return { synced: 0, failed: 0 };
  const session = state.session;
  const map = readMap();
  let synced = 0;
  let failed = 0;
  for (const conv of conversations.slice(0, SYNC_BATCH)) {
    try {
      let entry = map[conv.id];
      if (!entry || entry.orgId !== orgId) {
        const vibe = await createVibeSession(session, orgId, conv.name || 'Sessione');
        entry = { vibeSessionId: vibe.id, orgId, syncedAt: 0, lastCount: 0 };
        map[conv.id] = entry;
        writeMap(map);
      }
      const page = await ipcBridge.database.getConversationMessages.invoke({
        conversation_id: conv.id,
        limit: MESSAGE_LIMIT,
        content_mode: 'full',
      });
      const raw = page.items || [];
      const messages = raw.map(toVibeMessage).filter((m): m is VibeMessage => m !== null);
      // Sync solo se qualcosa è cambiato (numero di messaggi locale), per non
      // pompare inutilmente la rete a ogni refresh della lista.
      if (messages.length === 0 || (entry.lastCount === messages.length && Date.now() - entry.syncedAt < 10 * 60 * 1000)) {
        continue;
      }
      await saveVibeChatHistory(session, orgId, entry.vibeSessionId, messages);
      entry.syncedAt = Date.now();
      entry.lastCount = messages.length;
      map[conv.id] = entry;
      writeMap(map);
      synced += 1;
    } catch {
      failed += 1;
    }
  }
  return { synced, failed };
}
