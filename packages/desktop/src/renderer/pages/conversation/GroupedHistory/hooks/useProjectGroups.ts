/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';

import {
  PROJECT_GROUPS_EVENT,
  PROJECT_GROUPS_STORAGE_KEY,
  readProjectGroupsData,
  setProjectLead,
  type ProjectGroupsData,
} from '../utils/projectStorage';

/**
 * Reactive view of the named project-group assignments stored in
 * localStorage (see projectStorage.ts). Re-renders when the in-app custom
 * event fires (after a move/remove) or when another tab/window changes the
 * key. Callers must treat the returned object as read-only.
 */
export const useProjectGroups = (): {
  names: string[];
  assignments: Record<string, string>;
  leads: Record<string, string>;
  briefs: Record<string, string>;
  kits: Record<string, { currentStage: number; startedAt?: number }>;
  refresh: () => void;
} => {
  const [data, setData] = useState<ProjectGroupsData>(() => readProjectGroupsData());

  const refresh = useCallback(() => {
    setData(readProjectGroupsData());
  }, []);

  useEffect(() => {
    const handleChange = () => setData(readProjectGroupsData());
    const handleStorage = (event: StorageEvent) => {
      if (event.key === PROJECT_GROUPS_STORAGE_KEY) setData(readProjectGroupsData());
    };

    window.addEventListener(PROJECT_GROUPS_EVENT, handleChange as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      window.removeEventListener(PROJECT_GROUPS_EVENT, handleChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, []);

  return {
    names: data.names,
    assignments: data.assignments,
    leads: data.leads,
    briefs: data.briefs,
    kits: data.kits,
    refresh,
  };
};

/**
 * Reactive helper for designating a project lead. Returns a callback that
 * performs the (validated) write via projectStorage; the change event makes
 * every useProjectGroups consumer refresh.
 */
export const useSetProjectLead = (): ((projectName: string, conversationId: string | null) => boolean) => {
  return useCallback(
    (projectName: string, conversationId: string | null) => setProjectLead(projectName, conversationId),
    []
  );
};
