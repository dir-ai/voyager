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
vi.stubGlobal('window', { dispatchEvent: vi.fn() });

import {
  getSectionLabelKey,
  getVoyagerEdition,
  setVoyagerEdition,
  VOYAGER_EDITION_EVENT,
  VOYAGER_EDITION_STORAGE_KEY,
} from './voyagerEdition';

beforeEach(() => {
  store.clear();
});

describe('voyagerEdition', () => {
  it('defaults to coding', () => {
    expect(getVoyagerEdition()).toBe('coding');
  });

  it('persists and reads back the chosen edition', () => {
    setVoyagerEdition('company');
    expect(store.get(VOYAGER_EDITION_STORAGE_KEY)).toBe('company');
    expect(getVoyagerEdition()).toBe('company');
  });

  it('dispatches a change event on set', () => {
    setVoyagerEdition('company');
    expect(vi.mocked(window.dispatchEvent).mock.calls[0][0].type).toBe(VOYAGER_EDITION_EVENT);
  });

  it('falls back to coding on invalid stored values', () => {
    store.set(VOYAGER_EDITION_STORAGE_KEY, 'enterprise');
    expect(getVoyagerEdition()).toBe('coding');
  });

  it('maps the section label per edition', () => {
    expect(getSectionLabelKey('coding')).toContain('projectsSection');
    expect(getSectionLabelKey('company')).toContain('departmentsSection');
  });
});
