/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import { getActivityTime } from '@/renderer/utils/chat/timeline';
import { getWorkspaceDisplayName } from '@/renderer/utils/workspace/workspace';
import { getWorkspaceUpdateTime } from '@/renderer/utils/workspace/workspaceHistory';

import type { GroupedHistoryResult, ProjectGroup, TimelineItem, TimelineSection } from '../types';
import { getConversationSortOrder } from './sortOrderHelpers';

/**
 * Resolve the named project group a conversation belongs to (renderer-side
 * storage; see `projectStorage.ts`). Blank/whitespace assignments are ignored.
 */
export const getConversationProjectGroup = (
  conversation: TChatConversation,
  assignments?: Record<string, string>
): string | null => {
  if (!assignments) return null;
  const name = assignments[conversation.id];
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  return trimmed ? trimmed : null;
};

export const isConversationPinned = (conversation: TChatConversation): boolean => {
  const extra = conversation.extra as { pinned?: boolean } | undefined;
  return Boolean(extra?.pinned);
};

export const getConversationPinnedAt = (conversation: TChatConversation): number => {
  const extra = conversation.extra as { pinned_at?: number } | undefined;
  if (typeof extra?.pinned_at === 'number') {
    return extra.pinned_at;
  }
  return 0;
};

export const groupConversationsByWorkspace = (
  conversations: TChatConversation[],
  t: (key: string) => string
): TimelineSection[] => {
  const allWorkspaceGroups = new Map<string, TChatConversation[]>();
  const withoutWorkspaceConvs: TChatConversation[] = [];

  conversations.forEach((conv) => {
    const workspace = conv.extra?.workspace;
    const custom_workspace = conv.extra?.custom_workspace;

    if (custom_workspace && workspace) {
      if (!allWorkspaceGroups.has(workspace)) {
        allWorkspaceGroups.set(workspace, []);
      }
      allWorkspaceGroups.get(workspace)!.push(conv);
    } else {
      withoutWorkspaceConvs.push(conv);
    }
  });

  const items: TimelineItem[] = [];

  allWorkspaceGroups.forEach((convList, workspace) => {
    const sortedConvs = [...convList].toSorted((a, b) => getActivityTime(b) - getActivityTime(a));
    const latestConversationTime = getActivityTime(sortedConvs[0]);
    const updateTime = getWorkspaceUpdateTime(workspace);
    const time = Math.max(updateTime, latestConversationTime);
    items.push({
      type: 'workspace',
      time,
      workspaceGroup: {
        workspace,
        // This grouping path only sees custom (user-chosen) workspaces —
        // non-custom conversations end up in `withoutWorkspaceConvs` above
        // and never reach this helper. Passing `false` is therefore correct
        // without consulting `extra.is_temporary_workspace` per-row.
        display_name: getWorkspaceDisplayName(workspace, false, t),
        conversations: sortedConvs,
      },
    });
  });

  withoutWorkspaceConvs.forEach((conv) => {
    items.push({
      type: 'conversation',
      time: getActivityTime(conv),
      conversation: conv,
    });
  });

  items.sort((a, b) => b.time - a.time);

  if (items.length === 0) return [];

  return [
    {
      timeline: t('conversation.history.recents'),
      items,
    },
  ];
};

/** Check whether a conversation belongs to a team (should be hidden from sidebar). */
const isTeamConversation = (conversation: TChatConversation): boolean => {
  const extra = conversation.extra as { team_id?: string; teamId?: string } | undefined;
  return Boolean(extra?.team_id || extra?.teamId);
};

export const buildGroupedHistory = (
  conversations: TChatConversation[],
  t: (key: string) => string,
  projectAssignments?: Record<string, string>
): GroupedHistoryResult => {
  // Filter out team-owned conversations; they are only visible via the Teams panel
  const visibleConversations = conversations.filter((conv) => !isTeamConversation(conv));

  const pinnedConversations = visibleConversations
    .filter((conversation) => isConversationPinned(conversation))
    .toSorted((a, b) => {
      const orderA = getConversationSortOrder(a);
      const orderB = getConversationSortOrder(b);
      if (orderA !== undefined && orderB !== undefined) return orderA - orderB;
      if (orderA !== undefined) return -1;
      if (orderB !== undefined) return 1;
      return getConversationPinnedAt(b) - getConversationPinnedAt(a);
    });

  const normalConversations = visibleConversations.filter((conversation) => !isConversationPinned(conversation));

  // Named project groups: conversations assigned via "Move to project" render
  // as collapsible named groups instead of the timeline. Pinned conversations
  // keep their pinned-section precedence and are never duplicated here.
  const projectGroups: ProjectGroup[] = [];
  const groupedIds = new Set<string>();
  if (projectAssignments) {
    const byProject = new Map<string, TChatConversation[]>();
    normalConversations.forEach((conv) => {
      const project = getConversationProjectGroup(conv, projectAssignments);
      if (!project) return;
      groupedIds.add(conv.id);
      if (!byProject.has(project)) byProject.set(project, []);
      byProject.get(project)!.push(conv);
    });
    byProject.forEach((convList, name) => {
      projectGroups.push({
        name,
        conversations: [...convList].toSorted((a, b) => getActivityTime(b) - getActivityTime(a)),
      });
    });
    projectGroups.sort((a, b) => {
      const timeDiff = getActivityTime(b.conversations[0]) - getActivityTime(a.conversations[0]);
      if (timeDiff !== 0) return timeDiff;
      return a.name.localeCompare(b.name);
    });
  }

  const timelineConversations = normalConversations.filter((conv) => !groupedIds.has(conv.id));

  return {
    pinnedConversations,
    projectGroups,
    timelineSections: groupConversationsByWorkspace(timelineConversations, t),
  };
};

/**
 * Resolve the recipients of a project broadcast. `selected` is either the
 * literal string 'all' (every member) or an explicit list of member ids.
 * The result is always restricted to actual project members and deduped,
 * preserving member order.
 */
export const resolveBroadcastRecipients = (members: TChatConversation[], selected: 'all' | string[]): string[] => {
  const memberIds = members.map((m) => m.id);
  if (selected === 'all') return memberIds;
  const wanted = new Set(selected);
  return memberIds.filter((id) => wanted.has(id));
};
