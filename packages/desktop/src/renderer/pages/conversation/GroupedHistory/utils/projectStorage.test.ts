import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();
const localStorageStub: Storage = {
  get length() {
    return store.size;
  },
  clear: () => store.clear(),
  getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
  key: (index: number) => Array.from(store.keys())[index] ?? null,
  removeItem: (key: string) => void store.delete(key),
  setItem: (key: string, value: string) => void store.set(key, value),
};

vi.stubGlobal('localStorage', localStorageStub);
// readProjectGroupsData/writeProjectGroupsData gate on `window` (web-host safe),
// so provide a minimal window whose event dispatch is a no-op spy.
vi.stubGlobal('window', { dispatchEvent: vi.fn() });

import {
  getKitStage,
  getKitStartedAt,
  getProjectBrief,
  getProjectBriefUpdatedAt,
  getProjectLead,
  moveConversationToProject,
  normalizeProjectName,
  removeConversationFromProject,
  resetProject,
  resetProjectKit,
  setKitStage,
  setProjectBrief,
  setProjectLead,
} from './projectStorage';
import { KIT_STAGE_COUNT } from './kitStages';

beforeEach(() => {
  store.clear();
});

describe('project lead', () => {
  it('starts with no lead and normalizes the project name', () => {
    expect(getProjectLead('  Web App  ')).toBe(null);
    expect(normalizeProjectName('  Web App  ')).toBe('Web App');
  });

  it('setProjectLead accepts a member and persists the lead per project', () => {
    moveConversationToProject('c1', 'Web App');
    expect(setProjectLead('Web App', 'c1')).toBe(true);
    expect(getProjectLead('Web App')).toBe('c1');
    // Lead is scoped per project, not global.
    expect(getProjectLead('Other')).toBe(null);
  });

  it('setProjectLead rejects non-members', () => {
    moveConversationToProject('c1', 'Web App');
    expect(setProjectLead('Web App', 'not-a-member')).toBe(false);
    expect(getProjectLead('Web App')).toBe(null);
    expect(setProjectLead('Missing Project', 'c1')).toBe(false);
  });

  it('setProjectLead(null) clears the lead', () => {
    moveConversationToProject('c1', 'Web App');
    setProjectLead('Web App', 'c1');
    expect(setProjectLead('Web App', null)).toBe(true);
    expect(getProjectLead('Web App')).toBe(null);
  });

  it('clears the lead when the lead conversation leaves the project', () => {
    moveConversationToProject('c1', 'Web App');
    setProjectLead('Web App', 'c1');
    removeConversationFromProject('c1');
    expect(getProjectLead('Web App')).toBe(null);
  });

  it('moving the lead to another project clears the stale lead', () => {
    moveConversationToProject('c1', 'Web App');
    setProjectLead('Web App', 'c1');
    moveConversationToProject('c1', 'Other');
    expect(getProjectLead('Web App')).toBe(null);
    expect(getProjectLead('Other')).toBe(null);
  });
});

describe('project brief', () => {
  it('returns empty string for a known project and null for an unknown one', () => {
    moveConversationToProject('c1', 'Web App');
    expect(getProjectBrief('Web App')).toBe('');
    expect(getProjectBrief('Missing')).toBe(null);
  });

  it('persists and round-trips the brief (case-insensitive)', () => {
    moveConversationToProject('c1', 'Web App');
    expect(setProjectBrief('web app', '# Requirements\n- fast')).toBe(true);
    expect(getProjectBrief('WEB APP')).toBe('# Requirements\n- fast');
    expect(getProjectBriefUpdatedAt('Web App')).toBeGreaterThan(0);
  });

  it('rejects over-size briefs without writing', () => {
    moveConversationToProject('c1', 'Web App');
    const huge = 'x'.repeat(201 * 1024);
    expect(setProjectBrief('Web App', huge)).toBe(false);
    expect(getProjectBrief('Web App')).toBe('');
    expect(getProjectBriefUpdatedAt('Web App')).toBe(null);
  });
});

describe('project kit pipeline', () => {
  it('starts at stage 0 (not started)', () => {
    moveConversationToProject('c1', 'Web App');
    expect(getKitStage('Web App')).toBe(0);
    expect(getKitStartedAt('Web App')).toBe(null);
  });

  it('accepts valid stages and stamps startedAt on first start', () => {
    moveConversationToProject('c1', 'Web App');
    expect(setKitStage('Web App', 1)).toBe(true);
    const startedAt = getKitStartedAt('Web App');
    expect(startedAt).toBeGreaterThan(0);
    expect(getKitStage('Web App')).toBe(1);
    // Advancing keeps the original startedAt.
    expect(setKitStage('web app', KIT_STAGE_COUNT)).toBe(true);
    expect(getKitStartedAt('Web App')).toBe(startedAt);
  });

  it('rejects invalid stages and unknown projects', () => {
    moveConversationToProject('c1', 'Web App');
    expect(setKitStage('Web App', 0)).toBe(false);
    expect(setKitStage('Web App', KIT_STAGE_COUNT + 1)).toBe(false);
    expect(setKitStage('Web App', 1.5)).toBe(false);
    expect(setKitStage('Missing', 1)).toBe(false);
    expect(getKitStage('Web App')).toBe(0);
  });

  it('resetProjectKit clears only the kit', () => {
    moveConversationToProject('c1', 'Web App');
    setProjectLead('Web App', 'c1');
    setProjectBrief('Web App', 'dna');
    setKitStage('Web App', 3);
    expect(resetProjectKit('Web App')).toBe(true);
    expect(getKitStage('Web App')).toBe(0);
    expect(getProjectBrief('Web App')).toBe('dna');
    expect(getProjectLead('Web App')).toBe('c1');
  });
});

describe('resetProject', () => {
  it('clears brief and kit but keeps membership and lead', () => {
    moveConversationToProject('c1', 'Web App');
    setProjectLead('Web App', 'c1');
    setProjectBrief('Web App', 'dna');
    setKitStage('Web App', 2);
    expect(resetProject('Web App')).toBe(true);
    expect(getProjectBrief('Web App')).toBe('');
    expect(getKitStage('Web App')).toBe(0);
    expect(getProjectLead('Web App')).toBe('c1');
  });
});
