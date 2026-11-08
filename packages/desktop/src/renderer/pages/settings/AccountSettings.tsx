/**
 * VOYAGER Company Edition — Account settings page.
 *
 * Identità, organizzazione attiva, ruolo effettivo e switcher: TUTTO da PSX.
 * Nessun registro utenti locale. La sessione vive nel servizio cifrato
 * (workbenchSession.ts); la password non è mai conservata.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Tag } from '@arco-design/web-react';
import SettingsPageWrapper from '@renderer/pages/settings/components/SettingsPageWrapper';
import { useWorkbenchSession } from '@renderer/hooks/agent/useWorkbenchSession';
import { emitter } from '@renderer/utils/emitter';
import {
  buildWorkbenchSessionCookie,
  checkDistribuzioneUpdate,
  fetchOrgRuntimeViaSession,
  isVersionNewer,
  listUserOrgs,
  type UserOrg,
  type PsxRuntimeSnapshot,
  type DistribuzioneManifest,
} from '@renderer/services/companyContract';

declare const __APP_VERSION__: string;
import {
  WORKBENCH_ORG_EVENT,
  getActiveOrgId,
  loginWorkbenchSession,
  logoutWorkbenchSession,
  restoreWorkbenchSession,
  setActiveOrg,
} from '@renderer/services/workbenchSession';

interface MeInfo {
  userId: string | null;
  email: string | null;
  platformRole: string | null;
  orgIds: string[];
}

const AccountSettings: React.FC = () => {
  const { t } = useTranslation();
  const { status, session } = useWorkbenchSession();
  const [me, setMe] = useState<MeInfo | null>(null);
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(getActiveOrgId());
  const [runtime, setRuntime] = useState<PsxRuntimeSnapshot | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updateManifest, setUpdateManifest] = useState<DistribuzioneManifest | null>(null);

  // Update-check via PSX (lettera-25): manifest autenticato, 404 = nessuna release.
  useEffect(() => {
    if (status !== 'authenticated' || !session) return;
    let alive = true;
    checkDistribuzioneUpdate(session, 'stable')
      .then((manifest) => {
        if (!alive) return;
        if (manifest && isVersionNewer(__APP_VERSION__, manifest.versione)) setUpdateManifest(manifest);
      })
      .catch(() => { /* rete/sessione: nessun disturbo all'utente */ });
    return () => { alive = false; };
  }, [status, session]);

  const readOrgContext = useCallback(
    async (s: typeof session) => {
      if (!s) return;
      try {
        const res = await fetch('https://dev.psxworkbench.com/api/me', {
          headers: { cookie: buildWorkbenchSessionCookie(s) },
        });
        if (res.ok) setMe((await res.json()) as MeInfo);
        const userOrgs = await listUserOrgs(s);
        setOrgs(userOrgs);
        const wanted = getActiveOrgId() || userOrgs[0]?.id || null;
        setActiveOrgIdState(wanted);
        if (wanted) {
          setActiveOrgIdState(wanted);
          setRuntime(await fetchOrgRuntimeViaSession(s, wanted).catch((): null => null));
        } else {
          setRuntime(null);
        }
      } catch {
        setRuntime(null);
      }
    },
    [],
  );

  useEffect(() => {
    void restoreWorkbenchSession();
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session) void readOrgContext(session);
    if (status === 'unauthenticated') {
      setMe(null);
      setOrgs([]);
      setRuntime(null);
    }
  }, [status, session, readOrgContext]);

  useEffect(() => {
    const onOrgChange = (orgId: unknown): void => {
      setActiveOrgIdState((orgId as string | null) ?? null);
      if (session && orgId) {
        void fetchOrgRuntimeViaSession(session, orgId as string)
          .then(setRuntime)
          .catch((): null => null);
      } else {
        setRuntime(null);
      }
    };
    emitter.on(WORKBENCH_ORG_EVENT, onOrgChange);
    return () => {
      emitter.off(WORKBENCH_ORG_EVENT, onOrgChange);
    };
  }, [session]);

  const signIn = async () => {
    if (!email.trim() || !password) return;
    setBusy(true);
    setError(null);
    try {
      await loginWorkbenchSession(email.trim(), password);
      setPassword('');
    } catch {
      setError(t('company.account.loginFailed'));
    } finally {
      setBusy(false);
    }
  };

  const signOut = async () => {
    await logoutWorkbenchSession();
    setMe(null);
    setOrgs([]);
    setRuntime(null);
  };

  const switchOrg = async (orgId: string) => {
    const org = orgs.find((o) => o.id === orgId) ?? null;
    await setActiveOrg(org); // emits WORKBENCH_ORG_EVENT → cache invalidation
  };

  const activeOrg = orgs.find((o) => o.id === activeOrgId) ?? null;
  const displayName = me?.email?.split('@')[0] ?? '';
  const initial = displayName.charAt(0).toUpperCase() || 'V';

  return (
    <SettingsPageWrapper>
      <div className='max-w-640px mx-auto flex flex-col gap-12px py-12px'>
        <div className='text-16px font-medium text-t-primary'>{t('company.account.title')}</div>
        {status === 'checking' && <div className='text-13px text-t-secondary'>{t('company.account.checking')}</div>}

        {status === 'authenticated' && updateManifest && (
          <div className='rd-12px p-12px flex items-center justify-between gap-8px' style={{ background: 'var(--color-success-bg-1, rgba(0,180,100,0.08))', border: '1px solid var(--color-border-2)' }}>
            <div className='text-13px text-t-primary'>
              {t('company.account.updateAvailable')} <Tag size='small' color='green'>{updateManifest.versione}</Tag>
              {!updateManifest.firmato && <span className='text-12px text-t-tertiary ml-6px'>{t('company.account.updateUnsigned')}</span>}
            </div>
          </div>
        )}

        {status === 'unauthenticated' && (
          <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
            <div className='text-14px font-medium text-t-primary mb-8px'>{t('company.account.signInTitle')}</div>
            <div className='text-12px text-t-secondary mb-10px'>{t('company.account.signInSubtitle')}</div>
            <div className='flex gap-8px flex-wrap mb-8px'>
              <Input value={email} onChange={setEmail} placeholder={t('company.founder.emailPlaceholder')} style={{ maxWidth: 260 }} />
              <Input.Password value={password} onChange={setPassword} placeholder={t('company.founder.passwordPlaceholder')} style={{ maxWidth: 200 }} />
              <Button type='primary' loading={busy} onClick={signIn}>
                {t('company.founder.connect')}
              </Button>
            </div>
            <div className='text-12px text-t-tertiary'>{t('company.account.noPasswordStored')}</div>
            {error && <div className='text-12px mt-8px' style={{ color: 'rgb(var(--danger-6))' }}>{error}</div>}
          </div>
        )}

        {status === 'authenticated' && (
          <>
            {/* Identity card */}
            <div className='rd-12px p-16px flex items-center gap-12px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
              <span className='w-40px h-40px rd-50% bg-fill-2 flex items-center justify-center text-16px font-medium text-t-primary flex-shrink-0'>
                {initial}
              </span>
              <div className='flex-1 min-w-0'>
                <div className='text-14px font-medium text-t-primary truncate'>{displayName || (me?.email ?? '')}</div>
                <div className='text-12px text-t-secondary truncate'>{me?.email ?? ''}</div>
                <div className='flex gap-6px mt-4px'>
                  {me?.platformRole && <Tag size='small' color='gray'>{me.platformRole}</Tag>}
                  {activeOrg?.role && <Tag size='small' color='blue'>{activeOrg.role}</Tag>}
                </div>
              </div>
              <Button size='small' onClick={signOut}>{t('company.account.signOut')}</Button>
            </div>

            {/* Organization switcher + active org summary */}
            <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
              <div className='text-14px font-medium text-t-primary mb-8px'>{t('company.account.orgTitle')}</div>
              {orgs.length === 0 && <div className='text-12px text-t-tertiary'>{t('company.account.noOrgs')}</div>}
              <div className='flex flex-col gap-6px'>
                {orgs.map((org) => (
                  <button
                    key={org.id}
                    type='button'
                    onClick={() => void switchOrg(org.id)}
                    className='rd-8px px-10px py-8px text-left flex items-center gap-8px'
                    style={{
                      background: org.id === activeOrgId ? 'var(--color-fill-2)' : 'transparent',
                      border: '1px solid ' + (org.id === activeOrgId ? 'rgb(var(--primary-6))' : 'var(--color-border-2)'),
                    }}
                  >
                    <span className='flex-1 text-13px text-t-primary'>{org.name}</span>
                    {org.role && <span className='text-11px text-t-tertiary'>{org.role}</span>}
                  </button>
                ))}
              </div>
              {runtime && (
                <div className='text-12px text-t-secondary mt-10px'>
                  {t('company.founder.structureCounts', {
                    aziende: runtime.identitaEStruttura.configurato.totali.aziende,
                    sedi: runtime.identitaEStruttura.configurato.totali.sedi,
                    reparti: runtime.identitaEStruttura.configurato.totali.reparti,
                  })}
                </div>
              )}
            </div>

            <div className='text-12px text-t-tertiary px-4px'>{t('company.account.authorityNote')}</div>
          </>
        )}
      </div>
    </SettingsPageWrapper>
  );
};

export default AccountSettings;
