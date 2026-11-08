/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Renderer-side persistence for named project groups ("Move to project").
 *
 * Why localStorage instead of the server: the conversation UPDATE endpoint
 * (`conversation.update`) is served by the external aioncore binary, whose
 * `extra` merge behavior for *arbitrary* keys cannot be verified from this
 * repository (the pinned/pinned_at keys are handled server-side). To stay
 * web-host safe and avoid writing keys the backend may drop or reject, the
 * assignments live in localStorage:
 *
 *   aionui_project_groups → { version: 2, names: string[], assignments: { [conversationId]: projectName },
 *                             leads: { [projectName]: conversationId },
 *                             briefs: { [projectName]: markdown }, briefUpdatedAt: { [projectName]: number },
 *                             kits: { [projectName]: { currentStage, startedAt? } } }
 *
 * Only localStorage + CustomEvent/StorageEvent are used (no Electron APIs).
 * `extra.workspace` / `extra.custom_workspace` are NEVER touched — they are
 * the agent's working directory, not a grouping field.
 */

import { KIT_STAGE_COUNT } from './kitStages';

export const PROJECT_GROUPS_STORAGE_KEY = 'aionui_project_groups';
export const PROJECT_GROUPS_EVENT = 'aionui:project-groups-changed';

/** Hard limit for a user-chosen project name. */
export const PROJECT_NAME_MAX_LENGTH = 60;

export type ProjectGroupsData = {
  version: 2;
  /** All known project names (including projects whose conversations were all moved out). */
  names: string[];
  /** conversationId → project name */
  assignments: Record<string, string>;
  /** projectName → lead conversationId (opt-in; absent means "no lead"). */
  leads: Record<string, string>;
  /** projectName → project brief markdown (the project "DNA": requirements, blueprint, definition-of-done). */
  briefs: Record<string, string>;
  /** projectName → last brief edit timestamp (ms). */
  briefUpdatedAt: Record<string, number>;
  /** projectName → kit pipeline state (0 = not started; 1..KIT_STAGE_COUNT). */
  kits: Record<string, { currentStage: number; startedAt?: number }>;
  /** projectName → shared project settings (guidelines, UI guidelines, delivery, repo). */
  settings: Record<string, ProjectSettings>;
};

/** Shared, per-project instructions every member receives automatically. */
export type ProjectSettings = {
  /** Development guidelines (conventions, stack rules, do/don't). */
  guidelines?: string;
  /** UI guidelines (design system, layout rules, reference assets). */
  uiGuidelines?: string;
  /** How deliverables must be shipped. */
  delivery?: 'git' | 'workspace' | 'both';
  /** Repository URL (git remote or folder path). */
  repoUrl?: string;
};

type ProjectGroupsChangeDetail = {
  data: ProjectGroupsData;
};

const EMPTY_DATA: ProjectGroupsData = {
  version: 2,
  names: [],
  assignments: {},
  leads: {},
  briefs: {},
  briefUpdatedAt: {},
  kits: {},
  settings: {},
};

const emptyData = (): ProjectGroupsData => ({
  ...EMPTY_DATA,
  names: [],
  assignments: {},
  leads: {},
  briefs: {},
  briefUpdatedAt: {},
  kits: {},
  settings: {},
});

/** Trim + length-cap a user-provided project name; returns null when invalid. */
export const normalizeProjectName = (input: string): string | null => {
  const trimmed = (input ?? '').trim();
  if (!trimmed) return null;
  return trimmed.slice(0, PROJECT_NAME_MAX_LENGTH);
};

/**
 * Migration-safe parse + sanitize: unknown/corrupt shapes degrade to empty;
 * names are trimmed, deduplicated case-insensitively (first casing wins) and
 * ordered alphabetically; assignments pointing at unknown names re-add them.
 */
export const sanitizeProjectGroupsData = (raw: unknown): ProjectGroupsData => {
  if (!raw || typeof raw !== 'object') return emptyData();
  const obj = raw as Partial<ProjectGroupsData>;

  const seen = new Set<string>();
  const names: string[] = [];
  for (const name of Array.isArray(obj.names) ? obj.names : []) {
    if (typeof name !== 'string') continue;
    const normalized = normalizeProjectName(name);
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(normalized);
  }
  names.sort((a, b) => a.localeCompare(b));

  const assignments: Record<string, string> = {};
  if (obj.assignments && typeof obj.assignments === 'object') {
    for (const [conversationId, name] of Object.entries(obj.assignments)) {
      if (typeof conversationId !== 'string' || !conversationId) continue;
      if (typeof name !== 'string') continue;
      const normalized = normalizeProjectName(name);
      if (!normalized) continue;
      assignments[conversationId] = normalized;
      const key = normalized.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        names.push(normalized);
      }
    }
    names.sort((a, b) => a.localeCompare(b));
  }

  const leads: Record<string, string> = {};
  if (obj.leads && typeof obj.leads === 'object') {
    for (const [projectName, conversationId] of Object.entries(obj.leads)) {
      if (typeof projectName !== 'string' || !projectName) continue;
      if (typeof conversationId !== 'string' || !conversationId) continue;
      leads[projectName] = conversationId;
    }
  }

  const briefs: Record<string, string> = {};
  if (obj.briefs && typeof obj.briefs === 'object') {
    for (const [projectName, brief] of Object.entries(obj.briefs)) {
      if (typeof projectName !== 'string' || !projectName) continue;
      if (typeof brief !== 'string') continue;
      briefs[projectName] = brief;
    }
  }

  const briefUpdatedAt: Record<string, number> = {};
  if (obj.briefUpdatedAt && typeof obj.briefUpdatedAt === 'object') {
    for (const [projectName, ts] of Object.entries(obj.briefUpdatedAt)) {
      if (typeof projectName !== 'string' || !projectName) continue;
      if (typeof ts !== 'number' || !Number.isFinite(ts) || ts <= 0) continue;
      briefUpdatedAt[projectName] = ts;
    }
  }

  const kits: ProjectGroupsData['kits'] = {};
  if (obj.kits && typeof obj.kits === 'object') {
    for (const [projectName, kit] of Object.entries(obj.kits)) {
      if (typeof projectName !== 'string' || !projectName) continue;
      if (!kit || typeof kit !== 'object') continue;
      const stage = (kit as { currentStage?: unknown }).currentStage;
      if (typeof stage !== 'number' || !Number.isInteger(stage) || stage < 0) continue;
      const startedAt = (kit as { startedAt?: unknown }).startedAt;
      kits[projectName] =
        typeof startedAt === 'number' && Number.isFinite(startedAt) && startedAt > 0
          ? { currentStage: stage, startedAt }
          : { currentStage: stage };
    }
  }

  const settings: ProjectGroupsData['settings'] = {};
  if (obj.settings && typeof obj.settings === 'object') {
    for (const [projectName, value] of Object.entries(obj.settings)) {
      if (typeof projectName !== 'string' || !projectName) continue;
      if (!value || typeof value !== 'object') continue;
      const s = value as ProjectSettings;
      const clean: ProjectSettings = {};
      if (typeof s.guidelines === 'string') clean.guidelines = s.guidelines;
      if (typeof s.uiGuidelines === 'string') clean.uiGuidelines = s.uiGuidelines;
      if (s.delivery === 'git' || s.delivery === 'workspace' || s.delivery === 'both') clean.delivery = s.delivery;
      if (typeof s.repoUrl === 'string') clean.repoUrl = s.repoUrl;
      settings[projectName] = clean;
    }
  }

  return { version: 2, names, assignments, leads, briefs, briefUpdatedAt, kits, settings };
};

export const readProjectGroupsData = (): ProjectGroupsData => {
  if (typeof window === 'undefined') {
    return emptyData();
  }
  try {
    const stored = localStorage.getItem(PROJECT_GROUPS_STORAGE_KEY);
    if (!stored) return emptyData();
    return sanitizeProjectGroupsData(JSON.parse(stored));
  } catch {
    return emptyData();
  }
};

export const writeProjectGroupsData = (data: ProjectGroupsData): void => {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(PROJECT_GROUPS_STORAGE_KEY, JSON.stringify(sanitizeProjectGroupsData(data)));
  } catch {
    // storage full / unavailable: keep in-memory behavior only
  }
  dispatchProjectGroupsChange();
};

export const dispatchProjectGroupsChange = (): void => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent<ProjectGroupsChangeDetail>(PROJECT_GROUPS_EVENT));
};

/**
 * Assign a conversation to a project. Passing `null`/undefined removes the
 * assignment. The project name is registered in `names` when new (deduped
 * case-insensitively against existing names, first casing wins).
 */
export const moveConversationToProject = (conversationId: string, projectName: string | null): void => {
  if (!conversationId) return;
  const data = readProjectGroupsData();
  const normalized = projectName ? normalizeProjectName(projectName) : null;

  // If the conversation was the lead of its previous project and it moves
  // away (to another project or out entirely), clear that lead.
  const previousProject = data.assignments[conversationId];
  if (previousProject && normalized?.toLowerCase() !== previousProject.toLowerCase()) {
    const prevLead = Object.keys(data.leads).find((name) => name.toLowerCase() === previousProject.toLowerCase());
    if (prevLead && data.leads[prevLead] === conversationId) delete data.leads[prevLead];
  }

  if (!normalized) {
    delete data.assignments[conversationId];
  } else {
    const existing = data.names.find((name) => name.toLowerCase() === normalized.toLowerCase());
    const canonical = existing ?? normalized;
    if (!existing) data.names.push(canonical);
    data.assignments[conversationId] = canonical;
  }

  writeProjectGroupsData(data);
};

/** Remove a conversation from whatever project it belongs to (no-op if none). */
export const removeConversationFromProject = (conversationId: string): void => {
  moveConversationToProject(conversationId, null);
};

/** The project name a conversation belongs to, or null. */
export const getConversationProject = (conversationId: string, data?: ProjectGroupsData): string | null => {
  const d = data ?? readProjectGroupsData();
  return d.assignments[conversationId] ?? null;
};

/**
 * The lead conversation id of a project, or null.
 * Lazily clears a stale lead (lead left the project) as a side effect.
 */
export const getProjectLead = (projectName: string, data?: ProjectGroupsData): string | null => {
  if (!projectName) return null;
  const d = data ?? readProjectGroupsData();
  const key = projectName.toLowerCase();
  const canonical = Object.keys(d.leads).find((name) => name.toLowerCase() === key);
  if (!canonical) return null;
  const leadId = d.leads[canonical];
  if (!leadId) return null;
  // Stale lead: the conversation is no longer a member of the project.
  if (d.assignments[leadId]?.toLowerCase() !== key) {
    const fresh = readProjectGroupsData();
    if (fresh.leads[canonical]) {
      delete fresh.leads[canonical];
      writeProjectGroupsData(fresh);
    }
    return null;
  }
  return leadId;
};

/**
 * Designate the lead ("capocantiere") conversation of a project.
 * `conversationId` must already be a member of the project; passing null
 * removes the lead. Returns false when the member check fails (no change).
 */
export const setProjectLead = (projectName: string, conversationId: string | null): boolean => {
  if (!projectName) return false;
  const normalized = normalizeProjectName(projectName);
  if (!normalized) return false;

  const data = readProjectGroupsData();
  const canonical = data.names.find((name) => name.toLowerCase() === normalized.toLowerCase());
  if (!canonical) return false;

  if (conversationId === null) {
    const hadLead = Object.keys(data.leads).some((name) => name.toLowerCase() === canonical.toLowerCase());
    delete data.leads[canonical];
    if (hadLead) writeProjectGroupsData(data);
    return true;
  }

  // Lead must be a member of the project.
  if (data.assignments[conversationId]?.toLowerCase() !== canonical.toLowerCase()) return false;

  // Clear any other project whose lead pointed at the same conversation? No —
  // a conversation lives in exactly one project, so no cross-project cleanup
  // is needed; just overwrite the project's lead.
  data.leads[canonical] = conversationId;
  writeProjectGroupsData(data);
  return true;
};

/** Maximum project brief size, in bytes (UTF-8). */
export const PROJECT_BRIEF_MAX_LENGTH = 200 * 1024;

const findCanonical = (data: ProjectGroupsData, projectName: string): string | null =>
  data.names.find((name) => name.toLowerCase() === projectName.trim().toLowerCase()) ?? null;

/** The project brief markdown, or null when the project is unknown. Empty string = no brief yet. */
export const getProjectBrief = (projectName: string, data?: ProjectGroupsData): string | null => {
  if (!projectName) return null;
  const d = data ?? readProjectGroupsData();
  const canonical = findCanonical(d, projectName);
  return canonical ? (d.briefs[canonical] ?? '') : null;
};

/** Last brief edit timestamp (ms), or null. */
export const getProjectBriefUpdatedAt = (projectName: string, data?: ProjectGroupsData): number | null => {
  if (!projectName) return null;
  const d = data ?? readProjectGroupsData();
  const canonical = findCanonical(d, projectName);
  return canonical ? (d.briefUpdatedAt[canonical] ?? null) : null;
};

/**
 * Save the project brief. Rejects unknown projects and over-size briefs
 * (no silent truncation — the caller decides how to handle it).
 */
export const setProjectBrief = (projectName: string, brief: string): boolean => {
  if (!projectName || typeof brief !== 'string') return false;
  const data = readProjectGroupsData();
  const canonical = findCanonical(data, projectName);
  if (!canonical) return false;
  if (new TextEncoder().encode(brief).length > PROJECT_BRIEF_MAX_LENGTH) return false;
  data.briefs[canonical] = brief;
  data.briefUpdatedAt[canonical] = Date.now();
  writeProjectGroupsData(data);
  return true;
};

/** Kit pipeline stage of a project: 0 = not started, 1..KIT_STAGE_COUNT. */
export const getKitStage = (projectName: string, data?: ProjectGroupsData): number => {
  if (!projectName) return 0;
  const d = data ?? readProjectGroupsData();
  const canonical = findCanonical(d, projectName);
  return canonical ? (d.kits[canonical]?.currentStage ?? 0) : 0;
};

/** Kit start timestamp (ms), or null when the kit was never started. */
export const getKitStartedAt = (projectName: string, data?: ProjectGroupsData): number | null => {
  if (!projectName) return null;
  const d = data ?? readProjectGroupsData();
  const canonical = findCanonical(d, projectName);
  return canonical ? (d.kits[canonical]?.startedAt ?? null) : null;
};

/**
 * Move the kit pipeline to `stage` (1..KIT_STAGE_COUNT). `startedAt` is
 * stamped the first time the kit leaves stage 0.
 */
export const setKitStage = (projectName: string, stage: number): boolean => {
  if (!projectName || !Number.isInteger(stage) || stage < 1 || stage > KIT_STAGE_COUNT) return false;
  const data = readProjectGroupsData();
  const canonical = findCanonical(data, projectName);
  if (!canonical) return false;
  const previous = data.kits[canonical];
  data.kits[canonical] = {
    currentStage: stage,
    startedAt: previous?.startedAt ?? Date.now(),
  };
  writeProjectGroupsData(data);
  return true;
};

/** Reset only the kit pipeline (stage back to "not started"); keeps the brief, lead and membership. */
export const resetProjectKit = (projectName: string): boolean => {
  if (!projectName) return false;
  const data = readProjectGroupsData();
  const canonical = findCanonical(data, projectName);
  if (!canonical) return false;
  if (!data.kits[canonical]) return true;
  delete data.kits[canonical];
  writeProjectGroupsData(data);
  return true;
};

/** Full project content reset: brief + kit (membership and lead are kept — they have their own menus). */
export const resetProject = (projectName: string): boolean => {
  if (!projectName) return false;
  const data = readProjectGroupsData();
  const canonical = findCanonical(data, projectName);
  if (!canonical) return false;
  delete data.briefs[canonical];
  delete data.briefUpdatedAt[canonical];
  delete data.kits[canonical];
  writeProjectGroupsData(data);
  return true;
};

/**
 * Delete the whole project: its conversations return to the normal timeline
 * (no conversation is deleted), and the project's lead, brief, kit and
 * settings are discarded.
 */
export const deleteProject = (projectName: string): boolean => {
  if (!projectName) return false;
  const data = readProjectGroupsData();
  const canonical = findCanonical(data, projectName);
  if (!canonical) return false;
  data.names = data.names.filter((name) => name !== canonical);
  for (const [conversationId, project] of Object.entries(data.assignments)) {
    if (project.toLowerCase() === canonical.toLowerCase()) delete data.assignments[conversationId];
  }
  delete data.leads[canonical];
  delete data.briefs[canonical];
  delete data.briefUpdatedAt[canonical];
  delete data.kits[canonical];
  delete data.settings[canonical];
  writeProjectGroupsData(data);
  return true;
};

/** The shared project settings (guidelines / UI guidelines / delivery / repo), or empty defaults. */
export const getProjectSettings = (projectName: string, data?: ProjectGroupsData): ProjectSettings => {
  if (!projectName) return {};
  const d = data ?? readProjectGroupsData();
  const canonical = findCanonical(d, projectName);
  return canonical ? (d.settings[canonical] ?? {}) : {};
};

/** Save (merge) the shared project settings. Rejects unknown projects. */
export const setProjectSettings = (projectName: string, settings: ProjectSettings): boolean => {
  if (!projectName || !settings || typeof settings !== 'object') return false;
  const data = readProjectGroupsData();
  const canonical = findCanonical(data, projectName);
  if (!canonical) return false;
  const current = data.settings[canonical] ?? {};
  data.settings[canonical] = { ...current, ...settings };
  writeProjectGroupsData(data);
  return true;
};

/**
 * Compose the "--- PROJECT SETTINGS ---" block appended to kit kicks and
 * member broadcasts so every agent receives the shared instructions without
 * the user re-explaining them. Returns an empty string when nothing is set.
 */
export const buildProjectSettingsBlock = (projectName: string, data?: ProjectGroupsData): string => {
  const settings = getProjectSettings(projectName, data);
  const parts: string[] = [];
  if (settings.repoUrl) parts.push(`Repository: ${settings.repoUrl}`);
  if (settings.delivery) {
    const label =
      settings.delivery === 'git'
        ? 'commit to the repository'
        : settings.delivery === 'workspace'
          ? 'deliverable files in the workspace'
          : 'commit to the repository + deliverable files in the workspace';
    parts.push(`Delivery: ${label}`);
  }
  if (settings.guidelines) parts.push(`Development guidelines:\n${settings.guidelines}`);
  if (settings.uiGuidelines) parts.push(`UI guidelines:\n${settings.uiGuidelines}`);
  if (parts.length === 0) return '';
  return `\n\n--- PROJECT SETTINGS ---\n${parts.join('\n\n')}`;
};
