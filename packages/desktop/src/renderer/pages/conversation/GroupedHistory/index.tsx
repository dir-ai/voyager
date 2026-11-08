/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { TChatConversation } from '@/common/config/storage';
import AionModal from '@/renderer/components/base/AionModal';
import { useLayoutContext } from '@/renderer/hooks/context/LayoutContext';
import { useCronJobsMap } from '@/renderer/pages/cron';
import { restrictToVerticalAxis } from '@/renderer/utils/ui/dndModifiers';
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Button, Dropdown, Empty, Input, Menu, Message, Modal, Tooltip } from '@arco-design/web-react';
import {
  CheckOne,
  Communication,
  Delete,
  EditOne,
  AllApplication,
  FolderClose,
  Lock,
  MoreOne,
  PlayOne,
  Plus,
  Refresh,
  Right,
  SettingTwo,
} from '@icon-park/react';
import classNames from 'classnames';
import React, { useCallback, useEffect, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router-dom';

import WorkspaceCollapse from '../components/WorkspaceCollapse';
import ConversationRow from './ConversationRow';
import BriefModal from './components/BriefModal';
import { KitPipeline } from './components/KitPipeline';
import MoveToProjectModal from './components/MoveToProjectModal';
import ProjectSettingsModal from './components/ProjectSettingsModal';
import LeadProjectModal from './components/LeadProjectModal';
import BroadcastModal from './components/BroadcastModal';
import SortableConversationRow from './SortableConversationRow';
import { useBatchSelection } from './hooks/useBatchSelection';
import { useConversationActions } from './hooks/useConversationActions';
import { useConversations, projectGroupExpansionKey } from './hooks/useConversations';
import { useDragAndDrop } from './hooks/useDragAndDrop';
import { useProjectGroups, useSetProjectLead } from './hooks/useProjectGroups';
import { useCrossSessionMessageEnabled } from '@/renderer/hooks/chat/useCrossSessionMessageEnabled';
import { ipcBridge } from '@/common';
import { emitter } from '@/renderer/utils/emitter';
import { getSectionLabelKey, useVoyagerEdition } from '@/renderer/services/voyagerEdition';
import { MOCK_CURRENT_ORG } from '@/renderer/services/companyContract';
import { buildStageKickMessage } from './utils/kitStages';
import { deleteProject, resetProjectKit, setKitStage, buildProjectSettingsBlock } from './utils/projectStorage';
import type { ConversationRowProps, WorkspaceGroupedHistoryProps } from './types';

const WorkspaceGroupedHistory: React.FC<WorkspaceGroupedHistoryProps> = ({
  onSessionClick,
  collapsed = false,
  tooltipEnabled = false,
  batchMode = false,
  onBatchModeChange,
  afterPinnedContent,
}) => {
  const { id } = useParams();
  const { t } = useTranslation();
  const navigate = useNavigate();
  const layout = useLayoutContext();
  const isMobile = layout?.isMobile ?? false;
  const { getJobStatus, markAsRead, setActiveConversation } = useCronJobsMap();

  const {
    conversations,
    sessionsLocked,
    isConversationGenerating,
    isConversationWaitingConfirmation,
    hasCompletionUnread,
    isManualUnread,
    markManualUnread,
    clearManualUnread,
    expandedWorkspaces,
    pinnedConversations,
    projectGroups: namedProjectGroups,
    timelineSections,
    handleToggleWorkspace,
    collapsedSections,
    toggleSection,
  } = useConversations();

  const SectionLabel = useCallback(
    ({ sectionKey, label, trailing }: { sectionKey: string; label: string; trailing?: React.ReactNode }) => {
      const isCollapsed = collapsedSections.has(sectionKey);
      return (
        <div
          className='group/label sider-section-label flex items-center px-12px h-28px select-none sticky top-0 z-10 mt-8px cursor-pointer'
          onClick={() => toggleSection(sectionKey)}
        >
          <span className='text-14px text-t-tertiary sider-section-title group-hover/label:text-t-primary transition-colors font-[500] leading-none'>
            {label}
          </span>
          <span className='ms-2px flex items-center justify-center opacity-0 group-hover/label:opacity-100 transition-opacity text-t-tertiary shrink-0'>
            <Right
              theme='outline'
              size={12}
              className={classNames('transition-transform duration-150', { 'rotate-90': !isCollapsed })}
            />
          </span>
          {trailing && (
            <div className='ms-auto' onClick={(e) => e.stopPropagation()}>
              {trailing}
            </div>
          )}
        </div>
      );
    },
    [collapsedSections, toggleSection]
  );

  // Sync active conversation ref when route changes (for URL navigation)
  // This doesn't trigger state update, avoiding double render
  useEffect(() => {
    if (id) {
      setActiveConversation(id);
    }
  }, [id, setActiveConversation]);

  const {
    selectedConversationIds,
    setSelectedConversationIds,
    selectedCount,
    allSelected,
    toggleSelectedConversation,
    handleToggleSelectAll,
  } = useBatchSelection(batchMode, conversations);

  const {
    renameModalVisible,
    renameModalName,
    setRenameModalName,
    renameLoading,
    dropdownVisibleId,
    handleConversationClick,
    handleArchive,
    handleBatchArchive,
    handleEditStart,
    handleRenameConfirm,
    handleRenameCancel,
    handleTogglePin,
    handleMenuVisibleChange,
    handleOpenMenu,
    handleToggleManualUnread,
    handleCreateCronTask,
    handleArchiveProject,
    archiveProjectTarget,
    archiveProjectLoading,
    handleArchiveProjectCancel,
    handleArchiveProjectConfirm,
    moveToProjectTarget,
    handleMoveToProjectStart,
    handleMoveToProjectCancel,
    handleMoveToProjectConfirm,
    handleRemoveFromProject,
  } = useConversationActions({
    batchMode,
    onSessionClick,
    onBatchModeChange,
    selectedConversationIds,
    setSelectedConversationIds,
    toggleSelectedConversation,
    markAsRead,
    markManualUnread,
    clearManualUnread,
    isManualUnread,
  });

  const { sensors, handleDragEnd, isDragEnabled } = useDragAndDrop({
    pinnedConversations,
    batchMode,
    collapsed,
  });

  // Fork-lineage badge support: resolve a parent conversation's display name
  // from the already-loaded sidebar list (no extra fetch; unresolved = the
  // parent was deleted or not loaded → the badge falls back to a generic tip).
  const conversationNameById = useMemo(() => {
    const map = new Map<string, string>();
    for (const conversation of conversations) {
      map.set(conversation.id, conversation.name);
    }
    return map;
  }, [conversations]);
  const resolveConversationName = useCallback(
    (conversationId: string) => conversationNameById.get(conversationId),
    [conversationNameById]
  );

  const getConversationRowProps = useCallback(
    (conversation: TChatConversation): ConversationRowProps => ({
      conversation,
      isGenerating: isConversationGenerating(conversation.id),
      isWaitingConfirmation: isConversationWaitingConfirmation(conversation.id),
      hasUnread: hasCompletionUnread(conversation.id) || isManualUnread(conversation.id),
      isManualUnread: isManualUnread(conversation.id),
      collapsed,
      tooltipEnabled,
      batchMode,
      checked: selectedConversationIds.has(conversation.id),
      selected: id === conversation.id,
      menuVisible: dropdownVisibleId !== null && dropdownVisibleId === conversation.id,
      onToggleChecked: toggleSelectedConversation,
      onConversationClick: handleConversationClick,
      onOpenMenu: handleOpenMenu,
      onMenuVisibleChange: handleMenuVisibleChange,
      onEditStart: handleEditStart,
      onMoveToProject: handleMoveToProjectStart,
      onCreateCronTask: handleCreateCronTask,
      onArchive: handleArchive,
      onTogglePin: handleTogglePin,
      onToggleManualUnread: handleToggleManualUnread,
      getJobStatus,
      resolveConversationName,
    }),
    [
      collapsed,
      tooltipEnabled,
      batchMode,
      isConversationGenerating,
      isConversationWaitingConfirmation,
      hasCompletionUnread,
      isManualUnread,
      selectedConversationIds,
      id,
      dropdownVisibleId,
      toggleSelectedConversation,
      handleConversationClick,
      handleOpenMenu,
      handleMenuVisibleChange,
      handleEditStart,
      handleMoveToProjectStart,
      handleCreateCronTask,
      handleArchive,
      handleTogglePin,
      handleToggleManualUnread,
      getJobStatus,
      resolveConversationName,
    ]
  );

  const renderConversation = (conversation: TChatConversation, dimIcon = false, isProjectLead = false) => {
    const rowProps = getConversationRowProps(conversation);
    return <ConversationRow key={conversation.id} {...rowProps} dimIcon={dimIcon} isProjectLead={isProjectLead} />;
  };

  // Collect all sortable IDs for the pinned section
  const pinnedIds = useMemo(() => pinnedConversations.map((c) => c.id), [pinnedConversations]);

  // Named project groups ("Move to project") — collapsible, renderer-side storage.
  // The stored names list keeps projects alive even when they currently hold no
  // conversations (e.g. right after creating one).
  const {
    names: storedProjectNames,
    leads: storedProjectLeads,
    briefs: projectBriefs,
    kits: projectKits,
  } = useProjectGroups();
  const { edition } = useVoyagerEdition();
  const setProjectLeadById = useSetProjectLead();
  const crossSessionEnabled = useCrossSessionMessageEnabled();
  // Phase 2: per-project lead designation + manual "message members" broadcast.
  // Phase 3: per-project brief (the "DNA") + kit pipeline. All opt-in from the
  // group header menu; nothing is routed automatically.
  const [leadModalProject, setLeadModalProject] = React.useState<string | null>(null);
  const [broadcastModalProject, setBroadcastModalProject] = React.useState<string | null>(null);
  const [briefModalProject, setBriefModalProject] = React.useState<string | null>(null);
  const [settingsModalProject, setSettingsModalProject] = React.useState<string | null>(null);
  const [kitBusyProject, setKitBusyProject] = React.useState<string | null>(null);

  const getProjectLeadId = useCallback(
    (projectName: string): string | null => {
      const key = projectName.toLowerCase();
      const canonical = Object.keys(storedProjectLeads).find((name) => name.toLowerCase() === key);
      return canonical ? storedProjectLeads[canonical] : null;
    },
    [storedProjectLeads]
  );
  const getProjectKitStage = useCallback(
    (projectName: string): number => {
      const key = projectName.toLowerCase();
      const canonical = Object.keys(projectKits).find((name) => name.toLowerCase() === key);
      return canonical ? (projectKits[canonical]?.currentStage ?? 0) : 0;
    },
    [projectKits]
  );
  const getProjectBriefText = useCallback(
    (projectName: string): string => {
      const key = projectName.toLowerCase();
      const canonical = Object.keys(projectBriefs).find((name) => name.toLowerCase() === key);
      return canonical ? (projectBriefs[canonical] ?? '') : '';
    },
    [projectBriefs]
  );

  // Phase 3: kick the current kit stage — deliver the stage instruction plus
  // the project brief to the lead conversation as a direct message (its agent
  // is woken like on any normal message). The stage advances on send; a human
  // reviews the results before kicking the next stage.
  const handleRunNextStage = useCallback(
    async (projectName: string) => {
      if (kitBusyProject) return;
      const leadId = getProjectLeadId(projectName);
      if (!leadId) {
        Message.warning(t('conversation.history.noLeadForKit'));
        setLeadModalProject(projectName);
        return;
      }
      setKitBusyProject(projectName);
      try {
        const wasStarted = getProjectKitStage(projectName) > 0;
        const stage = wasStarted ? Math.min(getProjectKitStage(projectName) + 1, 6) : 1;
        const message =
          buildStageKickMessage({
            stageIndex: stage,
            projectName,
            brief: getProjectBriefText(projectName),
            t,
          }) + buildProjectSettingsBlock(projectName);
        await ipcBridge.conversation.sendMessage.invoke({
          input: message,
          conversation_id: leadId,
        });
        setKitStage(projectName, stage);
        Message.success(t(wasStarted ? 'conversation.history.stageAdvanced' : 'conversation.history.kitStarted'));
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        Message.error(reason || t('conversation.history.deliveryFailed'));
      } finally {
        setKitBusyProject(null);
      }
    },
    [kitBusyProject, getProjectLeadId, getProjectKitStage, getProjectBriefText, t]
  );

  const handleResetKit = useCallback(
    (projectName: string) => {
      resetProjectKit(projectName);
      Message.success(t('conversation.history.kitReset'));
    },
    [t]
  );

  // Delete the whole project: conversations return to the timeline, the
  // project's lead/brief/kit/settings are discarded. Confirm first.
  const handleDeleteProject = useCallback(
    (projectName: string) => {
      Modal.confirm({
        title: t('conversation.history.confirmDeleteProject', { project: projectName }),
        content: t('conversation.history.deleteProjectHint'),
        okText: t('conversation.history.deleteProject'),
        cancelText: t('common.close'),
        onOk: () => {
          const ok = deleteProject(projectName);
          if (ok) {
            emitter.emit('chat.history.refresh');
            Message.success(t('conversation.history.projectDeleted'));
          }
        },
      });
    },
    [t]
  );
  const projectModalNames = useMemo(() => {
    const seen = new Set<string>();
    const merged: string[] = [];
    for (const name of [...namedProjectGroups.map((group) => group.name), ...storedProjectNames]) {
      const key = name.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(name);
    }
    return merged.sort((a, b) => a.localeCompare(b));
  }, [namedProjectGroups, storedProjectNames]);

  const handleRemoveFromProjectFromModal = useCallback(() => {
    if (moveToProjectTarget) handleRemoveFromProject(moveToProjectTarget);
  }, [moveToProjectTarget, handleRemoveFromProject]);

  // Codex-style split: project folders (workspaces) on top, free conversations below.
  // Projects section: collect all workspace groups across timeline sections, ordered by recency.
  const projectGroups = useMemo(() => {
    const seen = new Set<string>();
    const groups: Array<{ workspace: string; displayName: string; conversations: TChatConversation[] }> = [];
    for (const section of timelineSections) {
      for (const item of section.items) {
        if (item.type === 'workspace' && item.workspaceGroup && !seen.has(item.workspaceGroup.workspace)) {
          seen.add(item.workspaceGroup.workspace);
          groups.push({
            workspace: item.workspaceGroup.workspace,
            displayName: item.workspaceGroup.display_name,
            conversations: item.workspaceGroup.conversations,
          });
        }
      }
    }
    return groups;
  }, [timelineSections]);

  // Conversations section: keep timeline grouping (today/yesterday/...) but only show non-workspace conversations.
  const conversationOnlySections = useMemo(
    () =>
      timelineSections
        .map((section) => ({
          ...section,
          items: section.items.filter((item) => item.type === 'conversation' && item.conversation),
        }))
        .filter((section) => section.items.length > 0),
    [timelineSections]
  );

  // Auth gate: sessions are visible only after Workbench login.
  if (sessionsLocked) {
    return (
      <>
        {afterPinnedContent}
        <div className='py-40px px-16px flex flex-col items-center gap-12px'>
          <div className='w-56px h-56px rd-50% bg-fill-2 flex items-center justify-center'>
            <Lock theme='outline' size='26' className='text-t-tertiary' />
          </div>
          <div className='text-14px font-medium text-t-secondary'>{t('company.sessions.lockedTitle')}</div>
          <div className='text-12px text-t-tertiary text-center leading-18px'>
            {t('company.sessions.lockedSubtitle')}
          </div>
          <Button type='primary' size='small' onClick={() => void navigate('/settings/account')}>
            {t('company.sessions.signInCta')}
          </Button>
        </div>
      </>
    );
  }

  if (timelineSections.length === 0 && pinnedConversations.length === 0 && namedProjectGroups.length === 0) {
    return (
      <>
        {afterPinnedContent}
        <div className='py-48px flex-center'>
          <Empty description={t('conversation.history.noHistory')} />
        </div>
      </>
    );
  }

  return (
    <>
      <Modal
        title={t('conversation.history.renameTitle')}
        visible={renameModalVisible}
        onOk={handleRenameConfirm}
        onCancel={handleRenameCancel}
        okText={t('conversation.history.saveName')}
        cancelText={t('conversation.history.cancelEdit')}
        confirmLoading={renameLoading}
        okButtonProps={{ disabled: !renameModalName.trim() }}
        style={{ borderRadius: '12px' }}
        alignCenter
        getPopupContainer={() => document.body}
      >
        <Input
          autoFocus
          value={renameModalName}
          onChange={setRenameModalName}
          onPressEnter={handleRenameConfirm}
          placeholder={t('conversation.history.renamePlaceholder')}
          allowClear
        />
      </Modal>

      {batchMode && !collapsed && (
        <div className='px-12px pb-8px pt-2px sticky top-0 z-20 bg-[var(--bg-2)]'>
          <div className='rd-8px bg-fill-1 p-10px flex flex-col gap-8px border border-solid border-[rgba(var(--primary-6),0.08)]'>
            <div className='text-12px leading-18px text-t-secondary'>
              {t('conversation.history.selectedCount', { count: selectedCount })}
            </div>
            <div className='grid grid-cols-2 gap-6px'>
              <Button
                className='!w-full !justify-center !min-w-0 !h-30px !px-8px !text-12px whitespace-nowrap'
                size='mini'
                type='secondary'
                onClick={handleToggleSelectAll}
              >
                {allSelected ? t('common.cancel') : t('conversation.history.selectAll')}
              </Button>
              <Button
                className='!w-full !justify-center !min-w-0 !h-30px !px-8px !text-12px whitespace-nowrap'
                size='mini'
                type='primary'
                onClick={handleBatchArchive}
              >
                {t('conversation.history.batchArchive')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 归档项目确认弹窗 — 使用项目自家 AionModal + 圆角线框按钮（归档为非危险态，用主色） */}
      <AionModal
        visible={archiveProjectTarget !== null}
        style={{ width: '400px' }}
        header={{
          title: t('conversation.history.archiveProjectTitle'),
          showClose: true,
          style: { borderBottom: 'none' },
        }}
        onCancel={handleArchiveProjectCancel}
        footer={
          <div className='flex justify-end gap-12px pt-16px'>
            <button
              type='button'
              className='px-24px py-8px rounded-20px text-14px font-medium transition-all'
              style={{
                border: '1px solid var(--color-border-2)',
                backgroundColor: 'var(--color-fill-2)',
                color: 'var(--color-text-1)',
                cursor: archiveProjectLoading ? 'not-allowed' : 'pointer',
                opacity: archiveProjectLoading ? 0.55 : 1,
              }}
              onMouseEnter={(event) => {
                if (!archiveProjectLoading) event.currentTarget.style.backgroundColor = 'var(--color-fill-3)';
              }}
              onMouseLeave={(event) => {
                if (!archiveProjectLoading) event.currentTarget.style.backgroundColor = 'var(--color-fill-2)';
              }}
              onClick={handleArchiveProjectCancel}
              disabled={archiveProjectLoading}
            >
              {t('common.cancel')}
            </button>
            <button
              type='button'
              className='px-24px py-8px rounded-20px text-14px font-medium transition-all'
              style={{
                border: '1px solid rgb(var(--primary-6))',
                backgroundColor: 'transparent',
                color: 'rgb(var(--primary-6))',
                cursor: archiveProjectLoading ? 'not-allowed' : 'pointer',
                opacity: archiveProjectLoading ? 0.55 : 1,
              }}
              onMouseEnter={(event) => {
                if (!archiveProjectLoading) {
                  event.currentTarget.style.backgroundColor = 'rgba(var(--primary-6), 0.08)';
                }
              }}
              onMouseLeave={(event) => {
                if (!archiveProjectLoading) event.currentTarget.style.backgroundColor = 'transparent';
              }}
              onClick={() => void handleArchiveProjectConfirm()}
              disabled={archiveProjectLoading}
            >
              {archiveProjectLoading ? t('conversation.history.archiving') : t('conversation.history.archiveProject')}
            </button>
          </div>
        }
      >
        <div className='text-14px leading-22px text-t-secondary'>
          {t('conversation.history.archiveProjectConfirm', {
            name: archiveProjectTarget?.name ?? '',
            count: archiveProjectTarget?.conversations.length ?? 0,
          })}
        </div>
      </AionModal>

      <MoveToProjectModal
        visible={moveToProjectTarget !== null}
        conversationName={moveToProjectTarget?.name ?? ''}
        currentProject={
          moveToProjectTarget
            ? (namedProjectGroups.find((g) => g.conversations.some((c) => c.id === moveToProjectTarget.id))?.name ??
              null)
            : null
        }
        existingNames={projectModalNames}
        onMove={handleMoveToProjectConfirm}
        onRemove={handleRemoveFromProjectFromModal}
        onClose={handleMoveToProjectCancel}
      />

      <LeadProjectModal
        visible={leadModalProject !== null}
        projectName={leadModalProject ?? ''}
        members={namedProjectGroups.find((g) => g.name === leadModalProject)?.conversations ?? []}
        currentLead={leadModalProject ? getProjectLeadId(leadModalProject) : null}
        onSelect={(conversationId) => {
          if (leadModalProject) setProjectLeadById(leadModalProject, conversationId);
          setLeadModalProject(null);
        }}
        onClose={() => setLeadModalProject(null)}
      />

      <BroadcastModal
        visible={broadcastModalProject !== null}
        projectName={broadcastModalProject ?? ''}
        members={namedProjectGroups.find((g) => g.name === broadcastModalProject)?.conversations ?? []}
        leadId={broadcastModalProject ? getProjectLeadId(broadcastModalProject) : null}
        onClose={() => setBroadcastModalProject(null)}
      />

      <BriefModal
        visible={briefModalProject !== null}
        projectName={briefModalProject ?? ''}
        brief={briefModalProject ? getProjectBriefText(briefModalProject) : ''}
        onClose={() => setBriefModalProject(null)}
      />

      <ProjectSettingsModal
        visible={settingsModalProject !== null}
        projectName={settingsModalProject ?? ''}
        onClose={() => setSettingsModalProject(null)}
      />

      <div>
        {/* L1: Pinned section */}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          {pinnedConversations.length > 0 && (
            <div className='min-w-0'>
              {!collapsed && <SectionLabel sectionKey='pinned' label={t('conversation.history.pinnedSection')} />}
              {!collapsedSections.has('pinned') && (
                <SortableContext items={pinnedIds} strategy={verticalListSortingStrategy}>
                  <div className='min-w-0'>
                    {pinnedConversations.map((conversation) => {
                      const props = getConversationRowProps(conversation);
                      return isDragEnabled ? (
                        <SortableConversationRow key={conversation.id} {...props} />
                      ) : (
                        <ConversationRow key={conversation.id} {...props} />
                      );
                    })}
                  </div>
                </SortableContext>
              )}
            </div>
          )}
        </DndContext>

        {/* Slot 由父级（Sider）填入：例如 Team / CronJob sections，位于「置顶」之后、「项目」之前 */}
        {afterPinnedContent}

        {/* L1: Projects section — named project groups + workspace folders, peer to conversations */}
        {(projectGroups.length > 0 || namedProjectGroups.length > 0) && (
          <div className='min-w-0'>
            {!collapsed && edition === 'company' && (
              <div className='flex items-center gap-6px px-10px py-2px text-11px text-t-tertiary' title={t('company.home.orgFixtureHint')}>
                <span className='font-medium text-t-secondary'>{MOCK_CURRENT_ORG.name}</span>
                <span>·</span>
                <span>{t(getSectionLabelKey(edition))}</span>
              </div>
            )}
            {!collapsed && edition !== 'company' && <SectionLabel sectionKey='projects' label={t(getSectionLabelKey(edition))} />}
            {!collapsedSections.has('projects') &&
              namedProjectGroups.map((group) => {
                const expansionKey = projectGroupExpansionKey(group.name);
                const leadId = getProjectLeadId(group.name);
                const kitStage = getProjectKitStage(group.name);
                const hasBrief = Boolean(getProjectBriefText(group.name));
                const namedProjectMenu = (
                  <Menu
                    onClickMenuItem={(key) => {
                      if (key === 'setLead') {
                        setLeadModalProject(group.name);
                      } else if (key === 'messageMembers') {
                        setBroadcastModalProject(group.name);
                      } else if (key === 'editBrief') {
                        setBriefModalProject(group.name);
                      } else if (key === 'projectSettings') {
                        setSettingsModalProject(group.name);
                      } else if (key === 'runNextStage') {
                        void handleRunNextStage(group.name);
                      } else if (key === 'resetKit') {
                        handleResetKit(group.name);
                      } else if (key === 'deleteProject') {
                        handleDeleteProject(group.name);
                      } else if (key === 'archiveProject') {
                        handleArchiveProject(group.name, group.conversations);
                      }
                    }}
                  >
                    <Menu.Item key='setLead'>
                      <span className='flex items-center gap-8px'>
                        <CheckOne theme='outline' size='14' />
                        {t('conversation.history.setLead')}
                      </span>
                    </Menu.Item>
                    <Menu.Item key='messageMembers' disabled={!crossSessionEnabled}>
                      <span className='flex items-center gap-8px'>
                        <Communication theme='outline' size='14' />
                        {t('conversation.history.messageMembers')}
                      </span>
                    </Menu.Item>
                    <Menu.Item key='editBrief'>
                      <span className='flex items-center gap-8px'>
                        <EditOne theme='outline' size='14' />
                        {t('conversation.history.editBrief')}
                      </span>
                    </Menu.Item>
                    <Menu.Item key='projectSettings'>
                      <span className='flex items-center gap-8px'>
                        <SettingTwo theme='outline' size='14' />
                        {t('conversation.history.projectSettingsShort')}
                      </span>
                    </Menu.Item>
                    <Menu.Item key='runNextStage' disabled={!crossSessionEnabled || kitBusyProject === group.name}>
                      <span className='flex items-center gap-8px'>
                        <PlayOne theme='outline' size='14' />
                        {kitStage === 0 ? t('conversation.history.startKit') : t('conversation.history.runNextStage')}
                      </span>
                    </Menu.Item>
                    <Menu.Item key='resetKit' disabled={kitStage === 0}>
                      <span className='flex items-center gap-8px'>
                        <Refresh theme='outline' size='14' />
                        {t('conversation.history.resetKit')}
                      </span>
                    </Menu.Item>
                    <Menu.Item key='archiveProject' disabled={group.conversations.length === 0}>
                      <span className='flex items-center gap-8px'>
                        <AllApplication theme='outline' size='14' />
                        {t('conversation.history.archiveProject')}
                      </span>
                    </Menu.Item>
                    <Menu.Item key='deleteProject'>
                      <span className='flex items-center gap-8px' style={{ color: 'rgb(var(--danger-6))' }}>
                        <Delete theme='outline' size='14' />
                        {t('conversation.history.deleteProject')}
                      </span>
                    </Menu.Item>
                  </Menu>
                );
                return (
                  <div key={expansionKey} className='min-w-0'>
                    <WorkspaceCollapse
                      expanded={expandedWorkspaces.includes(expansionKey)}
                      onToggle={() => handleToggleWorkspace(expansionKey)}
                      siderCollapsed={collapsed}
                      stickyHeader
                      stickyTop={28}
                      header={
                        <span className='text-14px font-[500] truncate flex-1 text-t-primary min-w-0'>
                          {group.name}
                        </span>
                      }
                      trailing={
                        <span className='flex items-center gap-2px mr-4px'>
                          <span className='text-12px text-t-secondary'>{group.conversations.length}</span>
                          <Dropdown
                            droplist={namedProjectMenu}
                            trigger='click'
                            position='br'
                            getPopupContainer={() => document.body}
                            unmountOnExit={false}
                          >
                            <span
                              aria-label='Project actions'
                              className={classNames(
                                'flex-center cursor-pointer transition-colors text-t-secondary hover:text-t-primary size-20px rd-4px sider-action-btn',
                                isMobile ? 'flex' : 'hidden group-hover:flex'
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreOne theme='outline' size='14' fill='currentColor' className='block leading-none' />
                            </span>
                          </Dropdown>
                        </span>
                      }
                    >
                      <div className={classNames('flex flex-col min-w-0', { 'mt-1px': !collapsed })}>
                        {/* Phase 3: kit pipeline — shown once a brief exists or the kit started. */}
                        {!collapsed && (hasBrief || kitStage > 0) && <KitPipeline stage={kitStage} t={t} />}
                        {group.conversations.map((conversation) =>
                          renderConversation(conversation, true, conversation.id === leadId)
                        )}
                      </div>
                    </WorkspaceCollapse>
                  </div>
                );
              })}
            {!collapsedSections.has('projects') &&
              projectGroups.map((group) => {
                const projectMenu = (
                  <Menu
                    onClickMenuItem={(key) => {
                      if (key === 'archive') {
                        handleArchiveProject(group.displayName, group.conversations);
                      }
                    }}
                  >
                    <Menu.Item key='archive'>
                      <span className='flex items-center gap-8px'>
                        <FolderClose theme='outline' size='14' />
                        {t('conversation.history.archiveProject')}
                      </span>
                    </Menu.Item>
                  </Menu>
                );
                return (
                  <div key={group.workspace} className='min-w-0'>
                    <WorkspaceCollapse
                      expanded={expandedWorkspaces.includes(group.workspace)}
                      onToggle={() => handleToggleWorkspace(group.workspace)}
                      siderCollapsed={collapsed}
                      stickyHeader
                      stickyTop={28}
                      header={
                        <span className='text-14px font-[500] truncate flex-1 text-t-primary min-w-0'>
                          {group.displayName}
                        </span>
                      }
                      trailing={
                        <span className='flex items-center gap-6px'>
                          <Tooltip content={t('conversation.history.newConversationInProject')} position='top'>
                            <span
                              role='button'
                              tabIndex={0}
                              aria-label={t('conversation.history.newConversationInProject')}
                              className={classNames(
                                'flex-center cursor-pointer transition-colors text-t-secondary hover:text-t-primary size-20px rd-4px sider-action-btn',
                                isMobile ? 'flex' : 'hidden group-hover:flex'
                              )}
                              onClick={(e) => {
                                e.stopPropagation();
                                void navigate('/guid', { state: { workspace: group.workspace } });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  void navigate('/guid', { state: { workspace: group.workspace } });
                                }
                              }}
                            >
                              <Plus theme='outline' size='14' fill='currentColor' className='block leading-none' />
                            </span>
                          </Tooltip>
                          <Dropdown
                            droplist={projectMenu}
                            trigger='click'
                            position='br'
                            getPopupContainer={() => document.body}
                            unmountOnExit={false}
                          >
                            <span
                              aria-label='Project actions'
                              className={classNames(
                                'flex-center cursor-pointer transition-colors text-t-secondary hover:text-t-primary size-20px rd-4px sider-action-btn',
                                isMobile ? 'flex' : 'hidden group-hover:flex'
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <MoreOne theme='outline' size='14' fill='currentColor' className='block leading-none' />
                            </span>
                          </Dropdown>
                        </span>
                      }
                    >
                      <div className={classNames('flex flex-col min-w-0', { 'mt-1px': !collapsed })}>
                        {group.conversations.map((conversation) => renderConversation(conversation, true))}
                      </div>
                    </WorkspaceCollapse>
                  </div>
                );
              })}
          </div>
        )}

        {/* L1: Conversations section — peer to projects, internally split by timeline */}
        {conversationOnlySections.length > 0 && (
          <div className='min-w-0'>
            {!collapsed && (
              <SectionLabel sectionKey='conversations' label={t('conversation.history.conversationsSection')} />
            )}
            {!collapsedSections.has('conversations') &&
              conversationOnlySections.map((section) => (
                <div key={section.timeline} className='min-w-0'>
                  {!collapsed && conversationOnlySections.length > 1 && (
                    <div className='flex items-center px-16px h-24px select-none'>
                      <span className='text-12px text-t-secondary font-[500] leading-none'>{section.timeline}</span>
                    </div>
                  )}
                  {section.items.map((item) =>
                    item.type === 'conversation' && item.conversation ? renderConversation(item.conversation) : null
                  )}
                </div>
              ))}
          </div>
        )}
      </div>
    </>
  );
};

export default WorkspaceGroupedHistory;
