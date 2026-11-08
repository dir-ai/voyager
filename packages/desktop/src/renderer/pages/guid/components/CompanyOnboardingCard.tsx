/**
 * VOYAGER Company Edition — home card for the founder journey.
 * Presentation only: navigates to the (mock-safe) FounderOnboarding route.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { Right } from '@icon-park/react';
import voyagerLogo from '@renderer/assets/logos/brand/app.png';
import { useVoyagerEdition } from '@renderer/services/voyagerEdition';

const CompanyOnboardingCard: React.FC = () => {
  const { t } = useTranslation();
  const { edition } = useVoyagerEdition();
  const navigate = useNavigate();
  if (edition !== 'company') return null;

  return (
    <button
      type='button'
      onClick={() => navigate('/company/founder')}
      className='max-w-640px w-full mx-auto mb-14px rd-14px px-16px py-12px flex items-center gap-12px text-left transition-colors'
      style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}
    >
      <img src={voyagerLogo} alt='Voyager' className='w-32px h-32px object-contain flex-shrink-0' />
      <span className='flex-1 min-w-0'>
        <span className='block text-14px font-medium text-t-primary'>{t('company.home.cardTitle')}</span>
        <span className='block text-12px text-t-secondary truncate'>{t('company.home.cardSubtitle')}</span>
      </span>
      <Right theme='outline' size='16' fill='currentColor' className='text-t-secondary flex-shrink-0' />
    </button>
  );
};

export default CompanyOnboardingCard;
