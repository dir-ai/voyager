/**
 * React binding for the Workbench session service (Company Edition).
 */

import { useSyncExternalStore } from 'react';
import { getWorkbenchSessionState, subscribeWorkbenchSession } from '@/renderer/services/workbenchSession';

export function useWorkbenchSession() {
  return useSyncExternalStore(subscribeWorkbenchSession, getWorkbenchSessionState, getWorkbenchSessionState);
}
