/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckOne, Minus } from '@icon-park/react';
import React from 'react';

import { useTranslation } from 'react-i18next';

import AionModal from '@/renderer/components/base/AionModal';
import ThemedLogo from '@/renderer/components/agent/ThemedLogo';
import { usePresetAssistantInfo } from '@renderer/hooks/agent/usePresetAssistantInfo';
import { useAgentLogos } from '@renderer/utils/model/agentLogo';
import { resolveConversationLeadingMark } from '@renderer/pages/conversation/utils/conversationAssistantIdentity';

import type { TChatConversation } from '@/common/config/storage';

type LeadProjectModalProps = {
  visible: boolean;
  projectName: string;
  /** Member conversations of the project (candidate leads). */
  members: TChatConversation[];
  /** Current lead conversation id, or null for "no lead". */
  currentLead: string | null;
  onSelect: (conversationId: string | null) => void;
  onClose: () => void;
};

/** Avatar mark for a member conversation (agent logo / emoji / fallback). */
const MemberAvatar: React.FC<{ conversation: TChatConversation }> = ({ conversation }) => {
  const logos = useAgentLogos();
  const { info: assistantInfo } = usePresetAssistantInfo(conversation);
  const mark = resolveConversationLeadingMark(conversation, assistantInfo, logos);
  if (mark.kind === 'emoji') {
    return <span className='text-16px leading-none flex-shrink-0'>{mark.value}</span>;
  }
  if (mark.kind === 'image') {
    return <ThemedLogo src={mark.value} alt={mark.label} className='w-16px h-16px rounded-50% flex-shrink-0' />;
  }
  const initial = (mark.label || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <span className='w-16px h-16px rounded-50% bg-fill-3 text-10px font-medium text-t-secondary flex items-center justify-center flex-shrink-0'>
      {initial}
    </span>
  );
};

/**
 * "Set lead" picker for a named project group, styled after
 * MoveToProjectModal. Lists the project's member conversations; the current
 * lead is marked with a check. Selecting "None" clears the lead. Purely a
 * designation (metadata + sidebar badge) — no routing behavior is enabled.
 */
const LeadProjectModal: React.FC<LeadProjectModalProps> = ({
  visible,
  projectName,
  members,
  currentLead,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!visible) return null;

  return (
    <AionModal
      visible={visible}
      style={{ width: '400px' }}
      header={{
        title: t('conversation.history.setLead'),
        showClose: true,
        style: { borderBottom: 'none' },
      }}
      onCancel={onClose}
      footer={null}
    >
      <div className='flex flex-col gap-12px'>
        <div className='text-13px text-t-secondary truncate'>{projectName}</div>

        <div className='flex flex-col gap-6px max-h-260px overflow-y-auto min-w-0'>
          <button
            type='button'
            className='flex items-center gap-8px px-12px py-8px rd-8px text-14px text-left transition-colors cursor-pointer min-w-0'
            style={{
              border: '1px solid var(--color-border-2)',
              backgroundColor: currentLead === null ? 'var(--color-fill-2)' : 'transparent',
              color: 'var(--color-text-1)',
            }}
            onMouseEnter={(event) => {
              if (currentLead !== null) event.currentTarget.style.backgroundColor = 'var(--color-fill-2)';
            }}
            onMouseLeave={(event) => {
              if (currentLead !== null) event.currentTarget.style.backgroundColor = 'transparent';
            }}
            onClick={() => {
              if (currentLead === null) return;
              onSelect(null);
            }}
          >
            <Minus theme='outline' size='14' className='shrink-0' />
            <span className='truncate flex-1'>{t('conversation.history.removeLead')}</span>
            {currentLead === null && <span className='text-12px text-t-secondary shrink-0'>✓</span>}
          </button>

          {members.map((member) => {
            const isCurrent = member.id === currentLead;
            return (
              <button
                key={member.id}
                type='button'
                className='flex items-center gap-8px px-12px py-8px rd-8px text-14px text-left transition-colors cursor-pointer min-w-0'
                style={{
                  border: '1px solid var(--color-border-2)',
                  backgroundColor: isCurrent ? 'var(--color-fill-2)' : 'transparent',
                  color: 'var(--color-text-1)',
                }}
                onMouseEnter={(event) => {
                  if (!isCurrent) event.currentTarget.style.backgroundColor = 'var(--color-fill-2)';
                }}
                onMouseLeave={(event) => {
                  if (!isCurrent) event.currentTarget.style.backgroundColor = 'transparent';
                }}
                onClick={() => {
                  if (isCurrent) return;
                  onSelect(member.id);
                }}
              >
                <MemberAvatar conversation={member} />
                <span className='truncate flex-1'>{member.name || member.id}</span>
                {isCurrent && <CheckOne theme='outline' size='14' className='shrink-0' />}
              </button>
            );
          })}
        </div>
      </div>
    </AionModal>
  );
};

export default LeadProjectModal;
