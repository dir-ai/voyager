/**
 * VOYAGER Company Edition — Join page: the invited collaborator opens
 * /join?token=…, reads the invite and accepts with their account.
 * Contract: accept route firma confermata da CLIENT RUNTIME; se l'endpoint
 * non è attivo l'errore viene mostrato così com'è (no retry cieco).
 */

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button, Tag } from '@arco-design/web-react';
import voyagerLogo from '@renderer/assets/logos/brand/app.png';
import { useWorkbenchSession } from '@renderer/hooks/agent/useWorkbenchSession';
import { acceptOrgInvite, getOrgInviteByToken, type OrgInvite } from '@renderer/services/companyContract';

const JoinPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const { status, session } = useWorkbenchSession();
  const [invite, setInvite] = useState<OrgInvite | null>(null);
  const [checking, setChecking] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  useEffect(() => {
    const read = async () => {
      if (!token) {
        setChecking(false);
        setResult(t('company.join.missingToken'));
        return;
      }
      try {
        const found = await getOrgInviteByToken(session, token);
        setInvite(found);
        if (!found) setResult(t('company.join.notFound'));
      } catch (e) {
        setResult(String(e instanceof Error ? e.message : e));
      } finally {
        setChecking(false);
      }
    };
    void read();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, status]);

  const accept = async () => {
    if (!session) return;
    setAccepting(true);
    try {
      const acc = await acceptOrgInvite(session, token);
      setResult(`${t('company.join.accepted')} — ${acc.orgName || acc.organizationId} (${acc.role})`);
      // Il titolare/collaboratore finisce subito nella sua squadra, zero attriti.
      setTimeout(() => navigate('/settings/team'), 1200);
    } catch (e) {
      setResult(String(e instanceof Error ? e.message : e));
    } finally {
      setAccepting(false);
    }
  };

  return (
    <div className='h-full flex flex-col items-center justify-center gap-12px p-24px'>
      <img src={voyagerLogo} alt='VOYAGER' className='w-64px h-64px' />
      <div className='text-18px font-medium text-t-primary'>{t('company.join.title')}</div>
      {checking && <div className='text-13px text-t-secondary'>{t('common.loading')}…</div>}
      {!checking && invite && (
        <div className='rd-12px p-16px max-w-420px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
          <div className='text-14px text-t-primary font-medium mb-6px'>{invite.email}</div>
          <div className='flex items-center gap-8px mb-10px'>
            <Tag size='small' color='blue'>{invite.role}</Tag>
          </div>
          {result ? (
            <div className='text-12px text-t-secondary'>{result}</div>
          ) : status !== 'authenticated' ? (
            <Button type='primary' size='small' onClick={() => navigate('/settings/account')}>
              {t('company.join.signInToAccept')}
            </Button>
          ) : (
            <Button type='primary' size='small' loading={accepting} onClick={() => void accept()}>
              {t('company.join.accept')}
            </Button>
          )}
        </div>
      )}
      {!checking && !invite && result && <div className='text-12px text-t-secondary'>{result}</div>}
    </div>
  );
};

export default JoinPage;
