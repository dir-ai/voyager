/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useState } from 'react';

/**
 * VOYAGER edition switch: the same codebase renders as 'coding' (projects and
 * developer workspaces) or 'company' (organization mode: departments, org
 * context inherited from the PSX runtime). Purely renderer-side persistence,
 * following the projectStorage.ts pattern (localStorage + change event).
 */

export const VOYAGER_EDITION_STORAGE_KEY = 'voyager_edition';
export const VOYAGER_EDITION_EVENT = 'voyager:edition-changed';

export type VoyagerEdition = 'coding' | 'company';

const EDITIONS = new Set<VoyagerEdition>(['coding', 'company']);

export const getVoyagerEdition = (): VoyagerEdition => {
  if (typeof window === 'undefined') return 'coding';
  try {
    const raw = localStorage.getItem(VOYAGER_EDITION_STORAGE_KEY);
    return EDITIONS.has(raw as VoyagerEdition) ? (raw as VoyagerEdition) : 'coding';
  } catch {
    return 'coding';
  }
};

export const setVoyagerEdition = (edition: VoyagerEdition): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(VOYAGER_EDITION_STORAGE_KEY, edition);
  } catch {
    // ignore quota/availability errors
  }
  window.dispatchEvent(new CustomEvent(VOYAGER_EDITION_EVENT));
};

/**
 * Sidebar section label for the named-group area: "Projects" in coding
 * edition, "Departments" in company edition. Storage keys and behavior stay
 * identical across editions — this is a semantic/label switch.
 */
export const getSectionLabelKey = (edition: VoyagerEdition): string =>
  edition === 'company' ? 'conversation.history.departmentsSection' : 'conversation.history.projectsSection';

export const useVoyagerEdition = (): { edition: VoyagerEdition; setEdition: (edition: VoyagerEdition) => void } => {
  const [edition, setEditionState] = useState<VoyagerEdition>(() => getVoyagerEdition());

  useEffect(() => {
    const onChange = () => setEditionState(getVoyagerEdition());
    const onStorage = (event: StorageEvent) => {
      if (event.key === VOYAGER_EDITION_STORAGE_KEY) setEditionState(getVoyagerEdition());
    };
    window.addEventListener(VOYAGER_EDITION_EVENT, onChange as EventListener);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(VOYAGER_EDITION_EVENT, onChange as EventListener);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  const setEdition = useCallback((next: VoyagerEdition) => setVoyagerEdition(next), []);
  return { edition, setEdition };
};
