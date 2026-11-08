/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  moveConversationToProject,
  PROJECT_GROUPS_EVENT,
  PROJECT_GROUPS_STORAGE_KEY,
  getConversationProject,
  getProjectLead,
  normalizeProjectName,
  setProjectLead,
} from '@/renderer/pages/conversation/GroupedHistory/utils/projectStorage';

class MemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string) {
    return this.map.has(key) ? this.map.get(key)! : null;
  }
  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }
  removeItem(key: string) {
    this.map.delete(key);
  }
  clear() {
    this.map.clear();
  }
}

const windowMock = {
  localStorage: new MemoryStorage(),
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
};

vi.stubGlobal('window', windowMock);
vi.stubGlobal('localStorage', windowMock.localStorage);

describe('projectStorage lead support', () => {
  beforeEach(() => {
    windowMock.localStorage.clear();
    windowMock.dispatchEvent.mockClear();
  });

  it('normalizeProjectName trims, limits length and returns null for blank input', () => {
    expect(normalizeProjectName('  Apollo  ')).toBe('Apollo');
    expect(normalizeProjectName('')).toBeNull();
    expect(normalizeProjectName('   ')).toBeNull();
  });

  it('setProjectLead requires an existing project and a member conversation', () => {
    moveConversationToProject('c1', 'Apollo');

    // No such project
    expect(setProjectLead('Unknown', 'c1')).toBe(false);
    // Not a member
    expect(setProjectLead('Apollo', 'ghost')).toBe(false);

    expect(setProjectLead('apollo', 'c1')).toBe(true); // case-insensitive project match
    expect(getProjectLead('Apollo')).toBe('c1');
  });

  it('clears the lead with null and tolerates repeated clears', () => {
    moveConversationToProject('c1', 'Apollo');
    setProjectLead('Apollo', 'c1');
    expect(setProjectLead('Apollo', null)).toBe(true);
    expect(getProjectLead('Apollo')).toBeNull();
    expect(setProjectLead('Apollo', null)).toBe(true);
    expect(getProjectLead('Apollo')).toBeNull();
  });

  it('lazily clears a stale lead whose conversation left the project', () => {
    moveConversationToProject('c1', 'Apollo');
    setProjectLead('Apollo', 'c1');

    // Member leaves the project (moved out) — lead must be dropped.
    moveConversationToProject('c1', null);
    expect(getProjectLead('Apollo')).toBeNull();
  });

  it('clears the lead when the member is moved to another project', () => {
    moveConversationToProject('c1', 'Apollo');
    moveConversationToProject('c2', 'Apollo');
    setProjectLead('Apollo', 'c1');

    moveConversationToProject('c1', 'Zeus');
    expect(getProjectLead('Apollo')).toBeNull();
    // The other member can become the lead after the old one left.
    expect(setProjectLead('Apollo', 'c2')).toBe(true);
    expect(getConversationProject('c2')).toBe('Apollo');
  });

  it('emits a change event after a successful lead write', () => {
    moveConversationToProject('c1', 'Apollo');
    setProjectLead('Apollo', 'c1');
    expect(windowMock.dispatchEvent).toHaveBeenCalledWith(expect.objectContaining({ type: PROJECT_GROUPS_EVENT }));

    // Failed writes emit nothing new
    windowMock.dispatchEvent.mockClear();
    setProjectLead('Apollo', 'ghost');
    expect(windowMock.dispatchEvent).not.toHaveBeenCalled();
  });

  it('stores leads in the same localStorage blob as assignments', () => {
    moveConversationToProject('c1', 'Apollo');
    setProjectLead('Apollo', 'c1');
    const raw = JSON.parse(windowMock.localStorage.getItem(PROJECT_GROUPS_STORAGE_KEY)!);
    expect(raw.leads).toEqual({ Apollo: 'c1' });
  });
});
