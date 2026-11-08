/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Button } from '@arco-design/web-react';
import { useTranslation } from 'react-i18next';
import SettingsPageWrapper from './components/SettingsPageWrapper';
import PreferenceRow from '@/renderer/components/settings/SettingsModal/contents/SystemModalContent/PreferenceRow';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import { useSettingsViewMode } from '@/renderer/components/settings/SettingsModal/settingsViewContext';
import { useVoyagerEdition, type VoyagerEdition } from '@/renderer/services/voyagerEdition';

const EditionSettings: React.FC = () => {
  const { t } = useTranslation();
  const { edition, setEdition } = useVoyagerEdition();
  const navigate = useNavigate();
  const viewMode = useSettingsViewMode();
  const isPageMode = viewMode === 'page';

  const options: Array<{ value: VoyagerEdition; label: string; description: string }> = [
    {
      value: 'coding',
      label: t('settings.editionCoding'),
      description: t('settings.editionCodingDescription'),
    },
    {
      value: 'company',
      label: t('settings.editionCompany'),
      description: t('settings.editionCompanyDescription'),
    },
  ];

  return (
    <SettingsPageWrapper>
      <AionScrollArea className='flex-1 min-h-0 pb-16px' disableOverflow={isPageMode}>
        <div className='space-y-16px'>
          <div className='px-[12px] md:px-[32px] py-16px bg-2 rd-16px space-y-12px'>
            <PreferenceRow label={t('settings.edition')} description={t('settings.editionDescription')}>
              <Radio.Group
                value={edition}
                onChange={(value) => setEdition(value as VoyagerEdition)}
                type='button'
                size='small'
              >
                {options.map((option) => (
                  <Radio key={option.value} value={option.value}>
                    {option.label}
                  </Radio>
                ))}
              </Radio.Group>
            </PreferenceRow>
            {options.map((option) => (
              <div key={option.value} className='px-12px py-8px rd-12px' style={{ background: 'var(--color-fill-1)' }}>
                <div className='flex items-center gap-8px'>
                  <span
                    className={`text-13px ${edition === option.value ? 'text-t-primary font-medium' : 'text-t-secondary'}`}
                  >
                    {option.label}
                  </span>
                  {edition === option.value && (
                    <span
                      className='text-11px px-6px py-1px rd-10px'
                      style={{ color: 'rgb(var(--primary-6))', border: '1px solid rgb(var(--primary-6))' }}
                    >
                      {t('settings.editionActive')}
                    </span>
                  )}
                  {option.value === 'company' && (
                    <span
                      className='text-11px px-6px py-1px rd-10px text-t-tertiary'
                      style={{ border: '1px solid var(--color-border-2)' }}
                    >
                      {t('settings.editionCompanyPreview')}
                    </span>
                  )}
                </div>
                <p className='m-0 mt-4px text-12px text-t-secondary'>{option.description}</p>
              </div>
            ))}
            <p className='m-0 px-12px text-12px text-t-tertiary'>{t('settings.editionNote')}</p>
            {edition === 'company' && (
              <div className='px-12px'>
                <Button size='small' type='outline' onClick={() => navigate('/company/founder')}>
                  {t('company.founder.openEntry')}
                </Button>
              </div>
            )}
          </div>
        </div>
      </AionScrollArea>
    </SettingsPageWrapper>
  );
};

export default EditionSettings;
