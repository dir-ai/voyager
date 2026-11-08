/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * VOYAGER Company Edition — Founder onboarding.
 *
 * Percorso vincolante: Conversation → Structured proposal → Review → Approval.
 * Contratto REALE (bootstrap canonico, rev e29e1c54): "Approva e crea" esegue
 * POST /api/org/crea con richiestaId generato all'apertura del wizard (idempotenza:
 * crash/retry ritrasmettono lo stesso id). La conferma arriva dal read-back del
 * runtime PSX, mai da una risposta del modello. Reparti/dipendenti restano simulati
 * finché non arriva il contratto Department & Employee.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Tag } from '@arco-design/web-react';
import AionScrollArea from '@/renderer/components/base/AionScrollArea';
import voyagerLogo from '@renderer/assets/logos/brand/app.png';
import {
  BOOTSTRAP_CONTRACT_REAL,
  DEPARTMENT_EMPLOYEE_CONTRACT_REAL,
  OrganizzazioneOmonimaError,
  createDipendente,
  createOrganizationBootstrap,
  createReparto,
  fetchOrgRuntimeViaSession,
  listDipendenti,
  listReparti,
  listUserOrgs,
  loginWorkbench,
  mockDepartmentsForSector,
  newRichiestaId,
  type BootstrapResult,
  type CompanyFacts,
  type Dipendente,
  type OrganizationProposal,
  type PsxRuntimeSnapshot,
  type Reparto,
  type UserOrg,
  type WorkbenchSession,
} from '@/renderer/services/companyContract';

type Step = 'intro' | 'askName' | 'askSector' | 'askHq' | 'askWebsite' | 'proposal' | 'applying' | 'applied' | 'error';

const FounderOnboarding: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('intro');
  const [facts, setFacts] = useState<CompanyFacts>({ name: '', sector: '', headquarters: '', website: '', description: '' });
  const [draft, setDraft] = useState<OrganizationProposal | null>(null);
  const [input, setInput] = useState('');
  const [applyResult, setApplyResult] = useState<{ mock: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Chiave di idempotenza del bootstrap — generata all'apertura del wizard,
  // rigenerata solo su restart completo del percorso.
  const [richiestaId, setRichiestaId] = useState<string>(() => newRichiestaId());

  // ── Live connection (read-only) ────────────────────────────────────────────
  const [session, setSession] = useState<WorkbenchSession | null>(null);
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [liveRuntime, setLiveRuntime] = useState<PsxRuntimeSnapshot | null>(null);
  const [liveReparti, setLiveReparti] = useState<Reparto[]>([]);
  const [dipendenti, setDipendenti] = useState<Dipendente[]>([]);
  const [provisioningResult, setProvisioningResult] = useState<{ repartiCreati: number; dipendentiCreati: number; errori: string[] } | null>(null);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);

  const connect = async () => {
    if (!loginEmail.trim() || !loginPassword) return;
    setConnecting(true);
    setConnectError(null);
    try {
      const s = await loginWorkbench(loginEmail.trim(), loginPassword);
      setLoginPassword('');
      setSession(s);
      const userOrgs = await listUserOrgs(s);
      setOrgs(userOrgs);
      const first = userOrgs[0];
      if (first) {
        setSelectedOrgId(first.id);
        const [runtime, reparti] = await Promise.all([
          fetchOrgRuntimeViaSession(s, first.id).catch((): null => null),
          listReparti(s).catch((): Reparto[] => []),
        ]);
        setLiveRuntime(runtime);
        setLiveReparti(reparti);
      }
    } catch (e) {
      setConnectError(String(e instanceof Error ? e.message : e));
    } finally {
      setConnecting(false);
    }
  };

  const progress = useMemo(() => {
    const order: Step[] = ['intro', 'askName', 'askSector', 'askHq', 'askWebsite', 'proposal', 'applying', 'applied'];
    return Math.min(order.indexOf(step) + 1, 6);
  }, [step]);

  const submit = (value: string) => {
    const v = value.trim();
    if (!v) return;
    setInput('');
    setFacts((prev) => {
      const next = { ...prev };
      if (step === 'askName') next.name = v;
      if (step === 'askSector') next.sector = v;
      if (step === 'askHq') next.headquarters = v;
      if (step === 'askWebsite') {
        next.website = v;
        next.description = v; // refined later by the CEO agent — mock keeps it simple
      }
      return next;
    });
    if (step === 'askName') setStep('askSector');
    else if (step === 'askSector') setStep('askHq');
    else if (step === 'askHq') setStep('askWebsite');
    else if (step === 'askWebsite') {
      setFacts((prev) => {
        const proposal: OrganizationProposal = { facts: prev, departments: mockDepartmentsForSector(prev.sector) };
        setDraft(proposal);
        return prev;
      });
      setStep('proposal');
    }
  };

  const approve = async () => {
    if (!draft) return;
    if (!session) {
      setError(t('company.founder.loginRequired'));
      setStep('error');
      return;
    }
    setStep('applying');
    setError(null);
    try {
      const bootstrap = await createOrganizationBootstrap(session, richiestaId, {
        nome: draft.facts.name,
        // La sede principale usa la sede raccolta nell'intervista (se presente).
        ...(draft.facts.headquarters
          ? { sede: { nome: 'Sede principale', citta: draft.facts.headquarters } }
          : {}),
      });
      setApplyResult({
        mock: false,
        message: t('company.founder.appliedReal', {
          nome: bootstrap.organizzazione.nome,
          azienda: bootstrap.azienda.nome,
          sede: bootstrap.sede.nome,
          runtime: bootstrap.runtime.runtime_id,
          isolation: bootstrap.runtime.isolation_mode,
          repeat: bootstrap.ripetuta ? t('company.founder.bootstrapRepeat') : '',
        }),
      });
      // Read-back reale: aggiorna il pannello live con la struttura appena creata.
      let repartiForProvisioning: Reparto[] = [];
      try {
        const userOrgs = await listUserOrgs(session);
        setOrgs(userOrgs);
        setSelectedOrgId(bootstrap.organizzazione.id);
        const [runtime, reparti] = await Promise.all([
          fetchOrgRuntimeViaSession(session, bootstrap.organizzazione.id).catch((): null => null),
          listReparti(session).catch((): Reparto[] => []),
        ]);
        setLiveRuntime(runtime);
        setLiveReparti(reparti);
        repartiForProvisioning = reparti;
      } catch {
        // il read-back non deve mai bloccare l'esito del bootstrap
      }

      // Contratto Department & Employee (lettera-7): reparti + dipendenti REALI,
      // org-scoped, idempotenti per richiestaId. Il fallimento di un elemento non
      // blocca gli altri; l'esito resta 'applied' con un conteggio.
      if (DEPARTMENT_EMPLOYEE_CONTRACT_REAL && draft.departments.length > 0) {
        let dipendentiCreati = 0;
        let repartiCreati = 0;
        const errori: string[] = [];
        for (const dept of draft.departments) {
          try {
            let reparto = repartiForProvisioning.find((r) => r.nome === dept.name);
            if (!reparto) {
              reparto = await createReparto(session, {
                nome: dept.name,
                azienda_id: bootstrap.azienda.id,
                sede_id: bootstrap.sede.id,
              });
              repartiCreati += 1;
            }
            for (const emp of dept.employees) {
              try {
                await createDipendente(session, {
                  organizationId: bootstrap.organizzazione.id,
                  nome: emp.displayName,
                  ruolo: emp.role || 'operatore',
                  repartoId: reparto.id,
                  richiestaId: newRichiestaId(),
                });
                dipendentiCreati += 1;
              } catch (e) {
                errori.push(`${emp.displayName}: ${String(e instanceof Error ? e.message : e)}`);
              }
            }
          } catch (e) {
            errori.push(`${dept.name}: ${String(e instanceof Error ? e.message : e)}`);
          }
        }
        setProvisioningResult({ repartiCreati, dipendentiCreati, errori });
        try {
          const [runtime, dipendenti] = await Promise.all([
            fetchOrgRuntimeViaSession(session, bootstrap.organizzazione.id).catch((): null => null),
            listDipendenti(session, bootstrap.organizzazione.id).catch((): Dipendente[] => []),
          ]);
          if (runtime) setLiveRuntime(runtime);
          setDipendenti(dipendenti);
        } catch {
          // read-back post-provisioning best-effort
        }
      }
      setStep('applied');
    } catch (e) {
      if (e instanceof OrganizzazioneOmonimaError) {
        setError(
          t('company.founder.omonima', {
            nome: e.nome,
            lista: e.esistenti.map((o) => `${o.nome} (${o.id.slice(0, 8)})`).join(', '),
          }),
        );
      } else {
        setError(String(e instanceof Error ? e.message : e));
      }
      setStep('error');
    }
  };

  const restart = () => {
    setStep('intro');
    setDraft(null);
    setApplyResult(null);
    setError(null);
    setFacts({ name: '', sector: '', headquarters: '', website: '', description: '' });
    // Nuovo percorso → nuova chiave di idempotenza.
    setRichiestaId(newRichiestaId());
  };

  return (
    <div className='flex flex-col h-full'>
      {/* Header */}
      <div className='flex items-center gap-10px px-24px py-16px border-b' style={{ borderColor: 'var(--color-border-2)' }}>
        <img src={voyagerLogo} alt='Voyager' className='w-28px h-28px object-contain' />
        <div className='flex-1'>
          <div className='text-15px font-medium text-t-primary'>{t('company.founder.title')}</div>
          <div className='text-12px text-t-secondary'>{t('company.founder.subtitle')}</div>
        </div>
        <Tag color={BOOTSTRAP_CONTRACT_REAL ? 'orangered' : 'gray'} size='small'>
          {BOOTSTRAP_CONTRACT_REAL ? t('company.founder.realBadge') : t('company.founder.mockBadge')}
        </Tag>
      </div>

      {/* Progress */}
      <div className='px-24px pt-12px'>
        <div className='flex gap-6px'>
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div
              key={i}
              className='flex-1 h-3px rd-2px'
              style={{ background: i <= progress ? 'rgb(var(--primary-6))' : 'var(--color-fill-3)' }}
            />
          ))}
        </div>
      </div>

      <AionScrollArea className='flex-1 min-h-0 px-24px py-16px'>
        <div className='max-w-720px mx-auto flex flex-col gap-12px pb-16px'>
          {/* Live connection + read-back (read-only, real PSX data) */}
          {!session ? (
            <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
              <div className='text-14px font-medium text-t-primary mb-6px'>{t('company.founder.connectTitle')}</div>
              <div className='text-12px text-t-secondary mb-10px'>{t('company.founder.connectSubtitle')}</div>
              <div className='flex gap-8px flex-wrap'>
                <Input
                  value={loginEmail}
                  onChange={setLoginEmail}
                  placeholder={t('company.founder.emailPlaceholder')}
                  style={{ maxWidth: 260 }}
                />
                <Input.Password
                  value={loginPassword}
                  onChange={setLoginPassword}
                  placeholder={t('company.founder.passwordPlaceholder')}
                  style={{ maxWidth: 200 }}
                />
                <Button type='primary' size='small' loading={connecting} onClick={connect}>
                  {t('company.founder.connect')}
                </Button>
              </div>
              {connectError && <div className='text-12px mt-8px' style={{ color: 'rgb(var(--danger-6))' }}>{connectError}</div>}
            </div>
          ) : (
            <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
              <div className='flex items-center gap-8px mb-6px'>
                <span className='text-14px font-medium text-t-primary'>{t('company.founder.connectedTitle')}</span>
                <Tag color='green' size='small'>{t('company.founder.liveBadge')}</Tag>
              </div>
              {liveRuntime ? (
                <>
                  <div className='text-13px text-t-secondary mb-8px'>
                    {liveRuntime.identitaEStruttura.configurato.nome} ·{' '}
                    {t('company.founder.structureCounts', {
                      aziende: liveRuntime.identitaEStruttura.configurato.totali.aziende,
                      sedi: liveRuntime.identitaEStruttura.configurato.totali.sedi,
                      reparti: liveRuntime.identitaEStruttura.configurato.totali.reparti,
                    })}
                  </div>
                  {liveReparti.length > 0 && (
                    <div className='flex flex-wrap gap-6px'>
                      {liveReparti.map((r) => (
                        <span key={String(r.id)} className='px-8px py-2px rd-8px text-12px' style={{ background: 'var(--color-fill-2)' }}>
                          {String(r.nome ?? r.nome_reparto ?? r.id)}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div className='text-12px text-t-tertiary'>
                  {t('company.founder.orgsList', { orgs: orgs.map((o) => o.name).join(', ') })}
                </div>
              )}
            </div>
          )}

          {/* Conversation messages */}
          {step === 'intro' && (
            <Bubble>
              {t('company.founder.intro')}
            </Bubble>
          )}
          {['askName', 'askSector', 'askHq', 'askWebsite'].includes(step) && (
            <Bubble>{t(`company.founder.${step}`)}</Bubble>
          )}

          {/* Answers echoed back as user bubbles */}
          {facts.name && <UserBubble>{facts.name}</UserBubble>}
          {facts.sector && <UserBubble>{facts.sector}</UserBubble>}
          {facts.headquarters && <UserBubble>{facts.headquarters}</UserBubble>}
          {facts.website && <UserBubble>{facts.website}</UserBubble>}

          {/* Structured proposal */}
          {draft && step !== 'applying' && step !== 'applied' && step !== 'error' && (
            <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
              <div className='text-14px font-medium text-t-primary mb-8px'>{t('company.founder.proposalTitle')}</div>
              <div className='text-13px text-t-secondary mb-12px'>{draft.facts.name} — {draft.facts.sector}</div>
              {draft.departments.map((dept) => (
                <div key={dept.name} className='mb-10px'>
                  <div className='text-13px font-medium text-t-primary'>{dept.name}</div>
                  <div className='text-12px text-t-secondary mb-4px'>{dept.purpose}</div>
                  <div className='flex flex-wrap gap-6px'>
                    {dept.employees.map((emp) => (
                      <span
                        key={emp.displayName + emp.role}
                        className='px-8px py-4px rd-8px text-12px'
                        style={{ background: 'var(--color-fill-2)' }}
                      >
                        <span className='font-medium text-t-primary'>{emp.displayName}</span>
                        <span className='text-t-secondary'> — {emp.role}</span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
              <Button type='primary' size='small' className='mt-8px' onClick={approve}>
                {BOOTSTRAP_CONTRACT_REAL ? t('company.founder.approveReal') : t('company.founder.approve')}
              </Button>
            </div>
          )}

          {step === 'applying' && <Bubble>{t('company.founder.applying')}</Bubble>}

          {step === 'applied' && applyResult && (
            <div
              className='rd-12px p-16px'
              style={{ background: 'var(--color-fill-1)', border: '1px dashed var(--color-border-3)' }}
            >
              <div className='text-13px font-medium text-t-primary mb-4px'>{t('company.founder.appliedTitle')}</div>
              <div className='text-12px text-t-secondary mb-12px'>{applyResult.message}</div>
              {provisioningResult && (
                <div className='text-12px text-t-secondary mb-12px'>
                  {t('company.founder.provisioned', {
                    reparti: provisioningResult.repartiCreati,
                    dipendenti: provisioningResult.dipendentiCreati,
                  })}
                  {provisioningResult.errori.length > 0 && (
                    <div className='mt-4px' style={{ color: 'rgb(var(--danger-6))' }}>
                      {t('company.founder.provisionErrors', { count: provisioningResult.errori.length })}
                    </div>
                  )}
                </div>
              )}
              {dipendenti.length > 0 && (
                <div className='flex flex-wrap gap-6px mb-12px'>
                  {dipendenti.map((d) => (
                    <span key={d.id} className='px-8px py-4px rd-8px text-12px' style={{ background: 'var(--color-fill-2)' }}>
                      <span className='font-medium text-t-primary'>{d.nome}</span>
                      <span className='text-t-secondary'> — {d.ruolo}</span>
                    </span>
                  ))}
                </div>
              )}
              <Button size='small' onClick={restart}>
                {t('company.founder.restart')}
              </Button>
            </div>
          )}

          {step === 'error' && (
            <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid rgb(var(--danger-6))' }}>
              <div className='text-13px text-t-primary mb-8px'>{t('company.founder.error')}</div>
              <div className='text-12px text-t-tertiary mb-12px'>{error}</div>
              <Button size='small' onClick={restart}>
                {t('company.founder.restart')}
              </Button>
            </div>
          )}
        </div>
      </AionScrollArea>

      {/* Input — interview only (no mutations), hidden once the proposal is drafted */}
      {['askName', 'askSector', 'askHq', 'askWebsite'].includes(step) && (
        <div className='px-24px pb-16px'>
          <Input
            value={input}
            onChange={setInput}
            onPressEnter={() => submit(input)}
            placeholder={t('company.founder.inputPlaceholder')}
          />
        </div>
      )}
    </div>
  );
};

const Bubble: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className='flex items-start gap-8px'>
    <img src={voyagerLogo} alt='Voyager' className='w-24px h-24px object-contain mt-2px' />
    <div className='px-12px py-8px rd-10px text-13px text-t-primary' style={{ background: 'var(--color-fill-2)' }}>
      {children}
    </div>
  </div>
);

const UserBubble: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className='flex justify-end'>
    <div className='px-12px py-8px rd-10px text-13px' style={{ background: 'rgb(var(--primary-6))', color: '#fff' }}>
      {children}
    </div>
  </div>
);

export default FounderOnboarding;
