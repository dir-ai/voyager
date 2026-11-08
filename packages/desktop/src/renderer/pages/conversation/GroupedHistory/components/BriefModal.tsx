/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AionModal from '@/renderer/components/base/AionModal';
import { PROJECT_BRIEF_MAX_LENGTH, setProjectBrief } from '../utils/projectStorage';

type BriefModalProps = {
  visible: boolean;
  projectName: string;
  /** Current brief markdown (may be empty). */
  brief: string;
  onClose: () => void;
};

/**
 * Editor for the project brief (the project "DNA": client requirements,
 * blueprint, constraints, definition-of-done), styled after BroadcastModal.
 * The brief stays renderer-side (localStorage, size-guarded); it is delivered
 * to the project lead when a kit stage is kicked.
 */
const BriefModal: React.FC<BriefModalProps> = ({ visible, projectName, brief, onClose }) => {
  const { t } = useTranslation();
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setText(brief ?? '');
      setSaving(false);
    }
  }, [visible, brief]);

  const tooLong = new TextEncoder().encode(text).length > PROJECT_BRIEF_MAX_LENGTH;

  const save = () => {
    const content = text.trim();
    if (!content || saving || tooLong) return;
    setSaving(true);
    const ok = setProjectBrief(projectName, content);
    setSaving(false);
    if (!ok) {
      Message.error(t('conversation.history.briefTooLarge'));
      return;
    }
    Message.success(t('conversation.history.briefSaved'));
    onClose();
  };

  if (!visible) return null;

  return (
    <AionModal
      visible={visible}
      style={{ width: '560px' }}
      header={{
        title: t('conversation.history.projectBrief', { project: projectName }),
        showClose: true,
        style: { borderBottom: 'none' },
      }}
      onCancel={onClose}
      footer={null}
    >
      <div className='flex flex-col gap-12px'>
        <textarea
          className='w-full px-10px py-8px rd-8px text-14px font-mono'
          style={{
            border: '1px solid var(--color-border-2)',
            background: 'var(--color-fill-2)',
            color: 'var(--color-text-1)',
            caretColor: 'var(--color-text-1)',
            minHeight: '260px',
            resize: 'vertical',
          }}
          placeholder={t('conversation.history.briefPlaceholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={saving}
        />

        <div className='flex items-center justify-between text-12px text-t-tertiary'>
          <span>
            {new TextEncoder().encode(text).length} / {Math.round(PROJECT_BRIEF_MAX_LENGTH / 1024)} KB
          </span>
          {tooLong && <span style={{ color: 'rgb(var(--danger-6))' }}>{t('conversation.history.briefTooLarge')}</span>}
        </div>

        <div className='flex justify-end gap-8px'>
          <button
            type='button'
            className='px-12px py-6px rd-16px text-13px cursor-pointer'
            style={{
              border: '1px solid var(--color-border-2)',
              color: 'var(--color-text-2)',
              backgroundColor: 'transparent',
            }}
            onClick={onClose}
          >
            {t('common.close')}
          </button>
          <button
            type='button'
            className='px-12px py-6px rd-16px text-13px cursor-pointer'
            style={{
              border: 'none',
              color: '#fff',
              backgroundColor: 'rgb(var(--primary-6))',
              opacity: !text.trim() || tooLong || saving ? 0.6 : 1,
            }}
            disabled={!text.trim() || tooLong || saving}
            onClick={save}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </AionModal>
  );
};

export default BriefModal;
