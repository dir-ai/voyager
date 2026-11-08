/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { Message, Select } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import AionModal from '@/renderer/components/base/AionModal';
import { getProjectSettings, setProjectSettings, type ProjectSettings } from '../utils/projectStorage';

type ProjectSettingsModalProps = {
  visible: boolean;
  projectName: string;
  onClose: () => void;
};

const TEXT_AREA_STYLE: React.CSSProperties = {
  border: '1px solid var(--color-border-2)',
  background: 'var(--color-fill-2)',
  color: 'var(--color-text-1)',
  caretColor: 'var(--color-text-1)',
  minHeight: '90px',
  resize: 'vertical',
};

const INPUT_STYLE: React.CSSProperties = {
  border: '1px solid var(--color-border-2)',
  background: 'var(--color-fill-2)',
  color: 'var(--color-text-1)',
  caretColor: 'var(--color-text-1)',
};

/**
 * Shared per-project instructions: development guidelines, UI guidelines,
 * delivery mode and repository URL. These are appended automatically to kit
 * stage kicks and member broadcasts, so every agent/session added to the
 * project receives them without the user re-explaining.
 */
const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({ visible, projectName, onClose }) => {
  const { t } = useTranslation();
  const [guidelines, setGuidelines] = useState('');
  const [uiGuidelines, setUiGuidelines] = useState('');
  const [delivery, setDelivery] = useState<ProjectSettings['delivery']>('both');
  const [repoUrl, setRepoUrl] = useState('');

  useEffect(() => {
    if (!visible || !projectName) return;
    const current = getProjectSettings(projectName);
    setGuidelines(current.guidelines ?? '');
    setUiGuidelines(current.uiGuidelines ?? '');
    setDelivery(current.delivery ?? 'both');
    setRepoUrl(current.repoUrl ?? '');
  }, [visible, projectName]);

  const save = () => {
    const ok = setProjectSettings(projectName, {
      guidelines: guidelines.trim() || undefined,
      uiGuidelines: uiGuidelines.trim() || undefined,
      delivery,
      repoUrl: repoUrl.trim() || undefined,
    });
    if (!ok) {
      Message.error(t('conversation.history.settingsSaveFailed'));
      return;
    }
    Message.success(t('conversation.history.settingsSaved'));
    onClose();
  };

  if (!visible) return null;

  return (
    <AionModal
      visible={visible}
      style={{ width: '560px' }}
      header={{
        title: t('conversation.history.projectSettings', { project: projectName }),
        showClose: true,
        style: { borderBottom: 'none' },
      }}
      onCancel={onClose}
      footer={null}
    >
      <div className='flex flex-col gap-10px'>
        <label className='text-12px text-t-secondary'>{t('conversation.history.settingsGuidelines')}</label>
        <textarea
          style={TEXT_AREA_STYLE}
          className='w-full px-10px py-8px rd-8px text-13px font-mono'
          value={guidelines}
          onChange={(e) => setGuidelines(e.target.value)}
          placeholder={t('conversation.history.settingsGuidelinesHint')}
        />

        <label className='text-12px text-t-secondary'>{t('conversation.history.settingsUiGuidelines')}</label>
        <textarea
          style={TEXT_AREA_STYLE}
          className='w-full px-10px py-8px rd-8px text-13px font-mono'
          value={uiGuidelines}
          onChange={(e) => setUiGuidelines(e.target.value)}
          placeholder={t('conversation.history.settingsUiGuidelinesHint')}
        />

        <div className='grid grid-cols-2 gap-10px'>
          <div className='flex flex-col gap-4px'>
            <label className='text-12px text-t-secondary'>{t('conversation.history.settingsDelivery')}</label>
            <Select
              value={delivery}
              onChange={(value) => setDelivery(value as ProjectSettings['delivery'])}
              className='w-full'
              options={[
                { label: t('conversation.history.deliveryGit'), value: 'git' },
                { label: t('conversation.history.deliveryWorkspace'), value: 'workspace' },
                { label: t('conversation.history.deliveryBoth'), value: 'both' },
              ]}
            />
          </div>
          <div className='flex flex-col gap-4px'>
            <label className='text-12px text-t-secondary'>{t('conversation.history.settingsRepo')}</label>
            <input
              style={INPUT_STYLE}
              className='px-8px py-6px rd-8px text-13px'
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder='https://github.com/…'
            />
          </div>
        </div>

        <div className='flex justify-end gap-8px mt-4px'>
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
            style={{ border: 'none', color: '#fff', backgroundColor: 'rgb(var(--primary-6))' }}
            onClick={save}
          >
            {t('common.save')}
          </button>
        </div>
      </div>
    </AionModal>
  );
};

export default ProjectSettingsModal;
