/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { FolderPlus, Minus } from '@icon-park/react';
import { Input } from '@arco-design/web-react';
import React, { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';

import AionModal from '@/renderer/components/base/AionModal';

import { normalizeProjectName, PROJECT_NAME_MAX_LENGTH } from '../utils/projectStorage';

type MoveToProjectModalProps = {
  visible: boolean;
  /** Display name of the conversation being moved (for the subtitle). */
  conversationName: string;
  /** Project the conversation currently belongs to, if any. */
  currentProject: string | null;
  /** Known project names (derived groups + stored names list), pre-sorted. */
  existingNames: string[];
  onMove: (projectName: string) => void;
  onRemove: () => void;
  onClose: () => void;
};

/**
 * "Move to project" picker, styled after the archive-project AionModal:
 * click an existing project to move, or create a new one via an inline input
 * (validated: non-empty, trimmed, ≤60 chars, case-insensitive dedupe).
 * Also offers "Remove from project" when the conversation currently has one.
 */
const MoveToProjectModal: React.FC<MoveToProjectModalProps> = ({
  visible,
  conversationName,
  currentProject,
  existingNames,
  onMove,
  onRemove,
  onClose,
}) => {
  const { t } = useTranslation();
  const [creating, setCreating] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) {
      setCreating(false);
      setDraftName('');
      setError(null);
    }
  }, [visible]);

  const existingLower = useMemo(() => new Set(existingNames.map((name) => name.toLowerCase())), [existingNames]);

  const confirmNewProject = () => {
    const normalized = normalizeProjectName(draftName);
    if (!normalized) {
      setError(t('conversation.history.projectNamePlaceholder'));
      return;
    }
    if (existingLower.has(normalized.toLowerCase())) {
      onMove(normalized); // moving into an existing project is valid
      return;
    }
    onMove(normalized);
  };

  if (!visible) return null;

  return (
    <AionModal
      visible={visible}
      style={{ width: '400px' }}
      header={{
        title: t('conversation.history.moveToProject'),
        showClose: true,
        style: { borderBottom: 'none' },
      }}
      onCancel={onClose}
      footer={null}
    >
      <div className='flex flex-col gap-12px'>
        {conversationName && <div className='text-13px text-t-secondary truncate'>{conversationName}</div>}

        <div className='flex flex-col gap-6px max-h-260px overflow-y-auto min-w-0'>
          {existingNames.length === 0 && (
            <div className='text-13px text-t-secondary py-8px'>{t('conversation.history.projectGroupEmptyHint')}</div>
          )}
          {existingNames.map((name) => {
            const isCurrent = currentProject !== null && name.toLowerCase() === currentProject.toLowerCase();
            return (
              <button
                key={name}
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
                  onMove(name);
                }}
              >
                <FolderPlus theme='outline' size='14' className='shrink-0' />
                <span className='truncate flex-1'>{name}</span>
                {isCurrent && <span className='text-12px text-t-secondary shrink-0'>✓</span>}
              </button>
            );
          })}
        </div>

        {creating ? (
          <div className='flex flex-col gap-4px'>
            <div className='flex items-center gap-8px'>
              <Input
                size='small'
                autoFocus
                value={draftName}
                maxLength={PROJECT_NAME_MAX_LENGTH}
                placeholder={t('conversation.history.projectNamePlaceholder')}
                onChange={(value) => {
                  setDraftName(value);
                  setError(null);
                }}
                onPressEnter={confirmNewProject}
              />
              <button
                type='button'
                className='px-12px py-4px rd-16px text-13px font-medium shrink-0 cursor-pointer'
                style={{
                  border: '1px solid rgb(var(--primary-6))',
                  color: 'rgb(var(--primary-6))',
                  backgroundColor: 'transparent',
                }}
                onClick={confirmNewProject}
              >
                {t('common.confirm')}
              </button>
            </div>
            {error && <div className='text-12px text-t-tertiary'>{error}</div>}
          </div>
        ) : (
          <button
            type='button'
            className='flex items-center gap-8px px-12px py-8px rd-8px text-14px transition-colors cursor-pointer text-left'
            style={{
              border: '1px dashed var(--color-border-2)',
              color: 'rgb(var(--primary-6))',
              backgroundColor: 'transparent',
            }}
            onClick={() => setCreating(true)}
          >
            <FolderPlus theme='outline' size='14' className='shrink-0' />
            {t('conversation.history.newProject')}
          </button>
        )}

        {currentProject && (
          <button
            type='button'
            className='flex items-center gap-8px px-12px py-8px rd-8px text-14px transition-colors cursor-pointer text-left'
            style={{
              border: '1px solid var(--color-border-2)',
              color: 'var(--color-text-2)',
              backgroundColor: 'transparent',
            }}
            onClick={() => {
              onRemove();
            }}
          >
            <Minus theme='outline' size='14' className='shrink-0' />
            {t('conversation.history.removeFromProject')}
          </button>
        )}
      </div>
    </AionModal>
  );
};

export default MoveToProjectModal;
