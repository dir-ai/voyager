import { describe, expect, it } from 'vitest';

import type { TChatConversation } from '@/common/config/storage';

import { buildGroupedHistory, getConversationProjectGroup, resolveBroadcastRecipients } from './groupingHelpers';

const makeConversation = (overrides: Partial<TChatConversation> & { id: string }): TChatConversation =>
  ({
    name: `Conversation ${overrides.id}`,
    created_at: 0,
    modified_at: 0,
    base_model: 'test-model',
    ...overrides,
  }) as unknown as TChatConversation;

const identityT = (key: string) => key;

describe('getConversationProjectGroup', () => {
  it('returns the assigned project name', () => {
    const conv = makeConversation({ id: 'c1' });
    expect(getConversationProjectGroup(conv, { c1: 'Apollo' })).toBe('Apollo');
  });

  it('returns null for unassigned conversations or missing map', () => {
    const conv = makeConversation({ id: 'c1' });
    expect(getConversationProjectGroup(conv)).toBeNull();
    expect(getConversationProjectGroup(conv, {})).toBeNull();
  });

  it('treats blank/whitespace assignments as no group', () => {
    const conv = makeConversation({ id: 'c1' });
    expect(getConversationProjectGroup(conv, { c1: '   ' })).toBeNull();
    expect(getConversationProjectGroup(conv, { c1: '' })).toBeNull();
  });
});

describe('buildGroupedHistory project groups', () => {
  it('groups assigned conversations into named project groups, removed from timeline', () => {
    const assigned = makeConversation({ id: 'a1', modified_at: 200 });
    const otherAssigned = makeConversation({ id: 'a2', modified_at: 100 });
    const free = makeConversation({ id: 'f1', modified_at: 300 });

    const result = buildGroupedHistory([assigned, otherAssigned, free], identityT, {
      a1: 'Apollo',
      a2: 'Apollo',
    });

    expect(result.projectGroups).toHaveLength(1);
    expect(result.projectGroups[0].name).toBe('Apollo');
    expect(result.projectGroups[0].conversations.map((c) => c.id)).toEqual(['a1', 'a2']);

    // Assigned conversations must not appear in timeline sections
    const timelineIds = result.timelineSections.flatMap((section) =>
      section.items.map((item) => (item.type === 'conversation' ? item.conversation.id : ''))
    );
    expect(timelineIds).not.toContain('a1');
    expect(timelineIds).not.toContain('a2');
    expect(timelineIds).toContain('f1');
  });

  it('renders multiple groups, newest-activity first', () => {
    const newer = makeConversation({ id: 'n1', modified_at: 500 });
    const older = makeConversation({ id: 'o1', modified_at: 100 });
    const result = buildGroupedHistory([newer, older], identityT, { n1: 'Zeta', o1: 'Alpha' });

    expect(result.projectGroups.map((g) => g.name)).toEqual(['Zeta', 'Alpha']);
  });

  it('keeps pinned conversations in the pinned section even when assigned', () => {
    const pinned = makeConversation({ id: 'p1', modified_at: 50, extra: { pinned: true } });
    const result = buildGroupedHistory([pinned], identityT, { p1: 'Apollo' });

    expect(result.projectGroups).toHaveLength(0);
    expect(result.pinnedConversations.map((c) => c.id)).toEqual(['p1']);
  });

  it('ignores blank, whitespace-only and missing assignments', () => {
    const a = makeConversation({ id: 'a' });
    const b = makeConversation({ id: 'b' });
    const result = buildGroupedHistory([a, b], identityT, { a: '  ', b: '' });

    expect(result.projectGroups).toHaveLength(0);
    const timelineIds = result.timelineSections.flatMap((section) =>
      section.items.map((item) => (item.type === 'conversation' ? item.conversation.id : ''))
    );
    expect(timelineIds).toEqual(expect.arrayContaining(['a', 'b']));
  });

  it('produces no project groups when no assignments are given', () => {
    const conv = makeConversation({ id: 'c1' });
    const result = buildGroupedHistory([conv], identityT);
    expect(result.projectGroups).toEqual([]);
  });
});

describe('resolveBroadcastRecipients', () => {
  const members = [makeConversation({ id: 'm1' }), makeConversation({ id: 'm2' }), makeConversation({ id: 'm3' })];

  it("returns all member ids for 'all'", () => {
    expect(resolveBroadcastRecipients(members, 'all')).toEqual(['m1', 'm2', 'm3']);
  });

  it('returns an empty list when there are no members', () => {
    expect(resolveBroadcastRecipients([], 'all')).toEqual([]);
    expect(resolveBroadcastRecipients([], ['m1'])).toEqual([]);
  });

  it('restricts the selection to actual members and dedupes, preserving member order', () => {
    expect(resolveBroadcastRecipients(members, ['m3', 'm1', 'm1', 'ghost'])).toEqual(['m1', 'm3']);
  });

  it('returns an empty list when nothing valid is selected', () => {
    expect(resolveBroadcastRecipients(members, ['ghost'])).toEqual([]);
    expect(resolveBroadcastRecipients(members, [])).toEqual([]);
  });
});
