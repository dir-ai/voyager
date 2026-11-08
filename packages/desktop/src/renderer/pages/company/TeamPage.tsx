/**
 * VOYAGER Company Edition — Team page.
 *
 * SOLO dati canonici PSX (runtime dell'organizzazione attiva):
 * - AI EMPLOYEES: area `dipendenti` del Company Runtime (Employee Shell).
 *   CREAZIONE AI EMPLOYEE (Capability Bridge v1, direttiva utente): raccolta →
 *   proposta → approvazione → API canonica (POST /api/org/dipendenti) →
 *   register mapping (SYNC_PENDING) → read-back config effettiva → conferma.
 *   La conferma SYNCED avviene solo dopo l'istanziazione aioncore locale.
 * - INVITI UMANI: contratto org-scoped /api/org/invite (solo admin/owner).
 * - MEMBRI UMANI: GET /api/org/members?organization_id= (firma confermata CLIENT RUNTIME).
 *   Revoke invito: DELETE /api/org/invite?id= (gate admin).
 */

import React, { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Input, Message, Modal, Radio, Select, Tag } from '@arco-design/web-react';
import { IconCopy } from '@arco-design/web-react/icon';
import SettingsPageWrapper from '@renderer/pages/settings/components/SettingsPageWrapper';
import { useWorkbenchSession } from '@renderer/hooks/agent/useWorkbenchSession';
import { WORKBENCH_ORG_EVENT, getActiveOrgId } from '@renderer/services/workbenchSession';
import {
  enqueueAgentDispatch,
  getAgentDispatch,
  createDipendente,
  createOrgInvite,
  fetchOrgRuntimeViaSession,
  listAgentMappings,
  listOrgInvites,
  listOrgMembers,
  listReparti,
  retireDipendente,
  revokeOrgInvite,
  updateDipendente,
  type OrgInvite,
  type OrgMember,
  type PsxDipendente,
  type PsxRuntimeSnapshot,
  type Reparto,
  type AgentMapping,
  type AgentMappingStatus,
  type DispatchOrder,
} from '@renderer/services/companyContract';
import { getBridgeStatus, registerBridgeMapping } from '@renderer/services/psxAgentBridge';
import { emitter } from '@renderer/utils/emitter';

const TeamPage: React.FC = () => {
  const { t } = useTranslation();
  const { status, session } = useWorkbenchSession();
  const [runtime, setRuntime] = useState<PsxRuntimeSnapshot | null>(null);
  const [activeOrgId, setActiveOrgIdState] = useState<string | null>(getActiveOrgId());
  const [loading, setLoading] = useState(false);
  const [invites, setInvites] = useState<OrgInvite[]>([]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [inviteModalVisible, setInviteModalVisible] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviting, setInviting] = useState(false);
  // CREAZIONE AI EMPLOYEE (raccolta → proposta → approvazione → API canonica → mapping)
  const [agentModalVisible, setAgentModalVisible] = useState(false);
  const [agentStep, setAgentStep] = useState<'collect' | 'approve' | 'done'>('collect');
  const [agentName, setAgentName] = useState('');
  const [agentRole, setAgentRole] = useState('');
  const [agentDept, setAgentDept] = useState('');
  const [reparti, setReparti] = useState<Reparto[]>([]);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [agentResult, setAgentResult] = useState<{ dipendenteId: string; syncStatus: string } | null>(null);

  const refreshRuntime = useCallback(async () => {
    if (status !== 'authenticated' || !session || !activeOrgId) {
      setRuntime(null);
      return;
    }
    setLoading(true);
    try {
      setRuntime(await fetchOrgRuntimeViaSession(session, activeOrgId));
    } catch {
      setRuntime(null);
    } finally {
      setLoading(false);
    }
  }, [status, session, activeOrgId]);

  useEffect(() => {
    void refreshRuntime();
  }, [refreshRuntime]);

  const refreshInvites = useCallback(async () => {
    if (status !== 'authenticated' || !session || !activeOrgId) {
      setInvites([]);
      return;
    }
    try {
      setInvites(await listOrgInvites(session, activeOrgId));
    } catch {
      setInvites([]);
    }
  }, [status, session, activeOrgId]);

  const refreshMembers = useCallback(async () => {
    if (status !== 'authenticated' || !session || !activeOrgId) {
      setMembers([]);
      return;
    }
    try {
      setMembers(await listOrgMembers(session, activeOrgId));
    } catch {
      setMembers([]);
    }
  }, [status, session, activeOrgId]);

  useEffect(() => {
    void refreshInvites();
    void refreshMembers();
  }, [refreshInvites, refreshMembers]);

  const openAgentModal = useCallback(async () => {
    setAgentName(''); setAgentRole(''); setAgentDept(''); setAgentResult(null); setAgentStep('collect');
    setAgentModalVisible(true);
    if (session) {
      try { setReparti(await listReparti(session)); } catch { setReparti([]); }
    }
  }, [session]);

  // MODIFICA AI EMPLOYEE (contratto 2: PATCH /api/org/dipendenti, parziale e idempotente)
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editTarget, setEditTarget] = useState<PsxDipendente | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState('');
  const [editDept, setEditDept] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const openEditAgent = useCallback(async (emp: PsxDipendente) => {
    setEditTarget(emp);
    setEditName(emp.nome || '');
    setEditRole(emp.ruolo || '');
    setEditDept('');
    setEditModalVisible(true);
    if (session && reparti.length === 0) {
      try { setReparti(await listReparti(session)); } catch { /* reparti già in memoria */ }
    }
  }, [session, reparti.length]);

  const saveEditAgent = async () => {
    if (!session || !activeOrgId || !editTarget?.id) return;
    setSavingEdit(true);
    try {
      // Solo i campi realmente modificati (PATCH parziale, idempotente by-nature)
      const patch: Parameters<typeof updateDipendente>[1] = { organizationId: activeOrgId, agentId: editTarget.id };
      if (editName.trim() && editName.trim() !== editTarget.nome) patch.nome = editName.trim();
      if (editRole.trim() && editRole.trim() !== editTarget.ruolo) patch.ruolo = editRole.trim();
      if (editDept) patch.repartoId = editDept;
      if (Object.keys(patch).length === 2) {
        Message.info(t('company.team.editNothing'));
      } else {
        await updateDipendente(session, patch);
        Message.success(t('company.team.editSaved'));
      }
      setEditModalVisible(false);
      void refreshRuntime();
    } catch (e) {
      Message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setSavingEdit(false);
    }
  };

  // RITIRO AI EMPLOYEE (contratto 9: POST .../ritiro, organizationId + motivo obbligatori; PSX vince: il mapping diventa SYNC_FAILED al read-back)
  const retireAgent = async (emp: PsxDipendente) => {
    if (!session || !emp.id) return;
    const confirmed = await new Promise<boolean>((resolve) => {
      Modal.confirm({
        title: t('company.team.retireTitle', { name: emp.nome || emp.code }),
        content: t('company.team.retireNote'),
        okText: t('company.team.retire'),
        cancelText: t('company.team.cancel'),
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
    if (!confirmed) return;
    try {
      await retireDipendente(session, { organizationId: activeOrgId || '', agentId: emp.id, motivo: 'ritirato dal titolare in Voyager' });
      Message.success(t('company.team.retired'));
      void refreshRuntime();
    } catch (e) {
      Message.error(String(e instanceof Error ? e.message : e));
    }
  };

  // DISPATCH (lettera-19/21): assegna un incarico a un AI Employee via caserma (canale 'voyager').
  // VOYAGER NON CONSUMA LA CODA: accoda (POST) e legge lo stato (GET, pura lettura).
  // Il worker è di PSX (dispatch-worker, battito ~60s): noi solo osserviamo la transizione.
  const [dispatchTarget, setDispatchTarget] = useState<PsxDipendente | null>(null);
  const [dispatchText, setDispatchText] = useState('');
  const [dispatchPriority, setDispatchPriority] = useState(5);
  const [dispatching, setDispatching] = useState(false);
  const [dispatchResult, setDispatchResult] = useState<DispatchOrder | null>(null);

  // Polling leggero dello stato ordine: 4s finché in coda/in carico, stop su FINITA/FALLITA.
  useEffect(() => {
    if (!session || !activeOrgId || !dispatchResult) return;
    if (dispatchResult.stato !== 'IN_CODA' && dispatchResult.stato !== 'PRESO_IN_CARICO') return;
    const timer = setInterval(() => {
      getAgentDispatch(session, activeOrgId, dispatchResult.id)
        .then((updated) => setDispatchResult((prev) => (prev && prev.updated_at === updated.updated_at ? prev : updated)))
        .catch(() => { /* rete: riproviamo al prossimo tick, il GET è pura lettura */ });
    }, 4000);
    return () => clearInterval(timer);
  }, [session, activeOrgId, dispatchResult]);

  const submitDispatch = async () => {
    if (!session || !activeOrgId || !dispatchTarget?.id || !dispatchText.trim()) return;
    setDispatching(true);
    try {
      const { ripetuto, dispatch } = await enqueueAgentDispatch(session, {
        organizationId: activeOrgId,
        agentId: dispatchTarget.id,
        richiesta: dispatchText.trim(),
        richiestaId: crypto.randomUUID(),
        priorita: dispatchPriority,
      });
      setDispatchResult(dispatch);
      setDispatchText('');
      Message.success(ripetuto ? t('company.team.dispatchRepeat') : t('company.team.dispatchQueued'));
      void refreshRuntime();
    } catch (e) {
      Message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setDispatching(false);
    }
  };

  const submitAgent = async () => {    if (!session || !activeOrgId || !agentName.trim() || !agentDept) return;
    setCreatingAgent(true);
    try {
      // API canonica → l'agente NASCE in PSX (mai solo-locale)
      const { dipendente } = await createDipendente(session, {
        organizationId: activeOrgId, nome: agentName.trim(), ruolo: agentRole.trim() || undefined,
        repartoId: agentDept, richiestaId: crypto.randomUUID(),
      });
      // Capability Bridge: register → SYNC_PENDING (la conferma SYNCED arriva dopo l'istanziazione aioncore)
      let syncStatus = 'SYNC_PENDING';
      try {
        const mapping = await registerBridgeMapping(session, activeOrgId, dipendente.id);
        syncStatus = mapping.sync_status;
      } catch { /* mapping fallito: si ripete con la stessa richiestaId (recovery) */ }
      // READ-BACK canonico prima di confermare la creazione
      const status = await getBridgeStatus(session, activeOrgId, dipendente.id).catch((): AgentMapping | null => null);
      setAgentResult({ dipendenteId: dipendente.id, syncStatus: status?.sync_status || syncStatus });
      setAgentStep('done');
      Message.success(t('company.team.agentCreated'));
      void refreshRuntime();
    } catch (e) {
      Message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setCreatingAgent(false);
    }
  };

  const submitInvite = async () => {
    if (!session || !activeOrgId || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      await createOrgInvite(session, activeOrgId, inviteEmail, inviteRole);
      Message.success(t('company.team.inviteCreated'));
      setInviteModalVisible(false);
      setInviteEmail('');
      setInviteRole('member');
      void refreshInvites();
    } catch (e) {
      Message.error(String(e instanceof Error ? e.message : e));
    } finally {
      setInviting(false);
    }
  };

  useEffect(() => {
    const onOrgChange = (orgId: unknown): void => {
      setActiveOrgIdState((orgId as string | null) ?? null);
      setRuntime(null); // tenant isolation: invalidate on org switch
    };
    emitter.on(WORKBENCH_ORG_EVENT, onOrgChange);
    return () => {
      emitter.off(WORKBENCH_ORG_EVENT, onOrgChange);
    };
  }, []);

  const employees: PsxDipendente[] = runtime?.dipendenti?.configurato ?? [];
  // Chip di stato del Capability Bridge per ogni AI Employee (una sola GET di lista, member-safe).
  const [bridgeStatuses, setBridgeStatuses] = useState<Record<string, AgentMappingStatus>>({});
  useEffect(() => {
    if (status !== 'authenticated' || !session || !activeOrgId || employees.length === 0) {
      setBridgeStatuses({});
      return;
    }
    let alive = true;
    void (async () => {
      try {
        const { mappings } = await listAgentMappings(session, { organizationId: activeOrgId });
        if (!alive) return;
        setBridgeStatuses(Object.fromEntries(mappings.map((m) => [m.agent_id, m.sync_status])));
      } catch {
        if (alive) setBridgeStatuses({});
      }
    })();
    return () => { alive = false; };
  }, [status, session, activeOrgId, employees.length, runtime]);

  return (
    <SettingsPageWrapper>
      <div className='max-w-640px mx-auto flex flex-col gap-12px py-12px'>
        <div className='text-16px font-medium text-t-primary'>{t('company.team.title')}</div>
        {status !== 'authenticated' && (
          <div className='text-13px text-t-secondary px-4px'>{t('company.team.signInRequired')}</div>
        )}

        {status === 'authenticated' && !activeOrgId && (
          <div className='text-13px text-t-secondary px-4px'>{t('company.team.noOrgSelected')}</div>
        )}

        {status === 'authenticated' && activeOrgId && (
          <>
            {/* AI EMPLOYEES — canonical PSX records */}
            <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
              <div className='flex items-center gap-8px mb-10px'>
                <span className='text-14px font-medium text-t-primary'>{t('company.team.aiEmployees')}</span>
                <Tag size='small' color='blue'>{t('company.team.canonical')}</Tag>
                <Button size='mini' type='primary' className='ml-auto' onClick={() => void openAgentModal()}>
                  {t('company.team.createAgent')}
                </Button>
              </div>
              {loading && <div className='text-12px text-t-secondary'>{t('company.team.loading')}</div>}
              {!loading && employees.length === 0 && (
                <div className='text-12px text-t-tertiary'>{t('company.team.noEmployees')}</div>
              )}
              <div className='flex flex-col gap-6px'>
                {employees.map((emp) => {
                  const label = emp.nome || emp.code;
                  const initial = (emp.nome || emp.code || '?').charAt(0).toUpperCase();
                  const mStatus = (emp.id && bridgeStatuses[emp.id]) || bridgeStatuses[emp.code];
                  return (
                    <div key={emp.code} className='flex items-center gap-10px rd-8px px-10px py-8px' style={{ background: 'var(--color-fill-2)' }}>
                      <span className='w-28px h-28px rd-50% bg-fill-3 flex items-center justify-center text-12px font-medium text-t-secondary flex-shrink-0'>
                        {initial}
                      </span>
                      <div className='flex-1 min-w-0'>
                        <div className='text-13px font-medium text-t-primary truncate'>
                          {label} <span className='text-t-secondary font-normal'>· {emp.ruolo}</span>
                        </div>
                        <div className='text-11px text-t-tertiary truncate'>
                          {emp.reparto}{emp.canali && emp.canali.length > 0 ? ` · ${emp.canali.join(', ')}` : ''}{emp.attivo ? '' : ` · ${t('company.team.inactive')}`}
                        </div>
                      </div>
                      {mStatus && (
                        <Tag size='small' color={mStatus === 'SYNCED' ? 'green' : mStatus === 'SYNC_FAILED' ? 'red' : 'orange'}>{mStatus}</Tag>
                      )}
                      {emp.id && emp.attivo !== false && (
                        <Button size='mini' onClick={() => openEditAgent(emp)}>{t('company.team.edit')}</Button>
                      )}
                      {emp.id && emp.attivo !== false && (
                        <Button size='mini' type='primary' onClick={() => setDispatchTarget(emp)}>{t('company.team.dispatch')}</Button>
                      )}
                      {emp.id && emp.attivo !== false && (
                        <Button size='mini' status='warning' onClick={() => void retireAgent(emp)}>{t('company.team.retire')}</Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* HUMAN TEAM — inviti reali (org-scoped); lista membri in attesa del read canonico */}
            <div className='rd-12px p-16px' style={{ background: 'var(--color-fill-1)', border: '1px solid var(--color-border-2)' }}>
              <div className='text-14px font-medium text-t-primary mb-6px'>{t('company.team.humanMembers')}</div>
              {members.length > 0 && (
                <div className='flex flex-col gap-6px mb-10px'>
                  <div className='text-12px text-t-tertiary'>{t('company.team.membersCount', { count: members.length })}</div>
                  {members.map((m) => (
                    <div key={m.user_id} className='flex items-center gap-10px rd-8px px-10px py-8px' style={{ background: 'var(--color-fill-2)' }}>
                      <span className='w-28px h-28px rd-50% bg-fill-3 flex items-center justify-center text-12px font-medium text-t-secondary flex-shrink-0'>
                        {(m.full_name || m.email || '?').charAt(0).toUpperCase()}
                      </span>
                      <div className='flex-1 min-w-0'>
                        <div className='text-13px text-t-primary truncate'>{m.full_name || m.email || m.user_id}</div>
                        <div className='text-11px text-t-tertiary truncate'>{m.email || m.user_id}</div>
                      </div>
                      <Tag size='small' color='gray'>{m.role}</Tag>
                    </div>
                  ))}
                </div>
              )}
              <Button size='small' type='primary' onClick={() => setInviteModalVisible(true)}>
                {t('company.team.invite')}
              </Button>
              {invites.length > 0 && (
                <div className='flex flex-col gap-6px mt-10px'>
                  <div className='text-12px text-t-tertiary'>{t('company.team.pendingInvites', { count: invites.length })}</div>
                  {invites.map((inv) => (
                    <div key={inv.id} className='flex items-center gap-10px rd-8px px-10px py-8px' style={{ background: 'var(--color-fill-2)' }}>
                      <div className='flex-1 min-w-0'>
                        <div className='text-13px text-t-primary truncate'>{inv.email}</div>
                        <div className='text-11px text-t-tertiary'>
                          {inv.role}{inv.expires_at ? ` · ${t('company.team.expiresOn', { date: inv.expires_at.slice(0, 10) })}` : ''}
                        </div>
                      </div>
                      {inv.token && (
                        <Button
                          size='mini'
                          icon={<IconCopy />}
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(`${window.location.origin}/join?token=${inv.token}`);
                              Message.success(t('company.team.linkCopied'));
                            } catch {
                              Message.error(t('company.team.linkCopyFailed'));
                            }
                          }}
                        >
                          {t('company.team.copyLink')}
                        </Button>
                      )}
                      <Button
                        size='mini'
                        status='danger'
                        onClick={async () => {
                          if (!session) return;
                          try {
                            await revokeOrgInvite(session, inv.id);
                            Message.success(t('company.team.inviteRevoked'));
                            void refreshInvites();
                          } catch (e) {
                            Message.error(String(e instanceof Error ? e.message : e));
                          }
                        }}
                      >
                        {t('company.team.revoke')}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <Modal
              title={t('company.team.inviteModalTitle')}
              visible={inviteModalVisible}
              onCancel={() => setInviteModalVisible(false)}
              onOk={() => void submitInvite()}
              okText={t('company.team.invite')}
              confirmLoading={inviting}
              unmountOnExit
            >
              <div className='flex flex-col gap-10px'>
                <Input
                  placeholder='nome@azienda.com'
                  value={inviteEmail}
                  onChange={(v) => setInviteEmail(v)}
                  onPressEnter={() => void submitInvite()}
                />
                <Radio.Group value={inviteRole} onChange={(v) => setInviteRole(v)} size='small'>
                  <Radio value='member'>member</Radio>
                  <Radio value='admin'>admin</Radio>
                </Radio.Group>
                <div className='text-11px text-t-tertiary'>{t('company.team.inviteModalNote')}</div>
              </div>
            </Modal>

            {/* CREAZIONE AI EMPLOYEE — raccolta → proposta → approvazione → API canonica → mapping */}
            <Modal
              title={t('company.team.agentModalTitle')}
              visible={agentModalVisible}
              onCancel={() => !creatingAgent && setAgentModalVisible(false)}
              footer={null}
            >
              {agentStep === 'collect' && (
                <div className='flex flex-col gap-8px'>
                  <Input placeholder={t('company.team.agentNamePh')} value={agentName} onChange={setAgentName} maxLength={120} />
                  <Input placeholder={t('company.team.agentRolePh')} value={agentRole} onChange={setAgentRole} maxLength={60} />
                  <Select
                    placeholder={t('company.team.agentDeptPh')}
                    value={agentDept || undefined}
                    onChange={(v) => setAgentDept(String(v || ''))}
                    showSearch
                    filterOption={(input, option): boolean => String((option?.props as { children?: string } | undefined)?.children ?? '').toLowerCase().includes(input.toLowerCase())}
                  >
                    {reparti.map((r) => (
                      <Select.Option key={r.id} value={r.id}>{r.nome}</Select.Option>
                    ))}
                  </Select>
                  <Button type='primary' disabled={!agentName.trim() || !agentDept} onClick={() => setAgentStep('approve')}>
                    {t('company.team.agentPropose')}
                  </Button>
                </div>
              )}
              {agentStep === 'approve' && (
                <div className='flex flex-col gap-8px'>
                  <div className='text-13px text-t-secondary'>{t('company.team.agentApproveNote')}</div>
                  <div className='rd-8px px-10px py-8px text-13px text-t-primary' style={{ background: 'var(--color-fill-2)' }}>
                    {agentName}{agentRole ? ` · ${agentRole}` : ''} · {reparti.find((r) => r.id === agentDept)?.nome || agentDept}
                  </div>
                  <div className='text-11px text-t-tertiary'>{t('company.team.agentBridgeNote')}</div>
                  <Button type='primary' loading={creatingAgent} onClick={submitAgent}>
                    {t('company.team.agentApprove')}
                  </Button>
                </div>
              )}
              {agentStep === 'done' && agentResult && (
                <div className='flex flex-col gap-8px'>
                  <div className='text-13px text-t-primary'>{t('company.team.agentCreatedNote', { name: agentName })}</div>
                  <div className='text-12px text-t-secondary'>
                    <Tag size='small' color={agentResult.syncStatus === 'SYNCED' ? 'green' : agentResult.syncStatus === 'SYNC_FAILED' ? 'red' : 'orange'}>
                      {agentResult.syncStatus}
                    </Tag>
                    <span className='ml-6px'>{t('company.team.agentSyncNote')}</span>
                  </div>
                  <Button onClick={() => setAgentModalVisible(false)}>{t('company.team.close')}</Button>
                </div>
              )}
            </Modal>

            {/* MODIFICA AI EMPLOYEE — PATCH parziale idempotente (solo campi realmente cambiati) */}
            <Modal
              title={t('company.team.editTitle', { name: editTarget?.nome || editTarget?.code || '' })}
              visible={editModalVisible}
              onCancel={() => !savingEdit && setEditModalVisible(false)}
              footer={null}
            >
              <div className='flex flex-col gap-8px'>
                <Input placeholder={t('company.team.agentNamePh')} value={editName} onChange={setEditName} maxLength={120} />
                <Input placeholder={t('company.team.agentRolePh')} value={editRole} onChange={setEditRole} maxLength={60} />
                <Select
                  placeholder={t('company.team.editDeptPh')}
                  value={editDept || undefined}
                  onChange={(v) => setEditDept(String(v || ''))}
                  allowClear
                  showSearch
                  filterOption={(input, option): boolean => String((option?.props as { children?: string } | undefined)?.children ?? '').toLowerCase().includes(input.toLowerCase())}
                >
                  {reparti.map((r) => (
                    <Select.Option key={r.id} value={r.id}>{r.nome}</Select.Option>
                  ))}
                </Select>
                <div className='text-11px text-t-tertiary'>{t('company.team.editPartialNote')}</div>
                <Button type='primary' loading={savingEdit} onClick={saveEditAgent}>{t('company.team.editSave')}</Button>
              </div>
            </Modal>

            {/* DISPATCH — assegna un incarico via caserma (canale 'voyager', idempotente) */}
            <Modal
              title={t('company.team.dispatchTitle', { name: dispatchTarget?.nome || dispatchTarget?.code || '' })}
              visible={!!dispatchTarget}
              onCancel={() => !dispatching && (setDispatchTarget(null), setDispatchResult(null))}
              footer={null}
            >
              <div className='flex flex-col gap-8px'>
                {dispatchResult ? (
                  <div className='flex flex-col gap-8px'>
                    <div className='text-13px text-t-primary'>{t('company.team.dispatchAccepted')}</div>
                    <div className='text-12px text-t-secondary'>
                      <Tag size='small' color={dispatchResult.stato === 'FINITA' ? 'green' : dispatchResult.stato === 'FALLITA' ? 'red' : 'orange'}>{dispatchResult.stato}</Tag>
                      <span className='ml-6px'>{t('company.team.dispatchOrderNote')}</span>
                    </div>
                    {dispatchResult.stato === 'FALLITA' && dispatchResult.last_error ? (
                      <div className='text-12px text-t-danger'>{dispatchResult.last_error}</div>
                    ) : null}
                    {dispatchResult.stato === 'FINITA' && dispatchResult.risultato ? (
                      <div className='text-12px text-t-secondary'>
                        {typeof dispatchResult.risultato === 'string' ? dispatchResult.risultato : JSON.stringify(dispatchResult.risultato)}
                      </div>
                    ) : null}
                    <Button onClick={() => { setDispatchTarget(null); setDispatchResult(null); }}>{t('company.team.close')}</Button>
                  </div>
                ) : (
                  <>
                    <Input.TextArea
                      placeholder={t('company.team.dispatchPh')}
                      value={dispatchText}
                      onChange={(v) => setDispatchText(v)}
                      maxLength={8000}
                      autoSize={{ minRows: 3, maxRows: 8 }}
                    />
                    <Select value={dispatchPriority} onChange={(v: number) => setDispatchPriority(Number(v))}>
                      <Select.Option value={1}>{t('company.team.dispatchPriority1')}</Select.Option>
                      <Select.Option value={5}>{t('company.team.dispatchPriority5')}</Select.Option>
                      <Select.Option value={9}>{t('company.team.dispatchPriority9')}</Select.Option>
                    </Select>
                    <div className='text-11px text-t-tertiary'>{t('company.team.dispatchNote')}</div>
                    <Button type='primary' loading={dispatching} disabled={!dispatchText.trim()} onClick={submitDispatch}>
                      {t('company.team.dispatchSend')}
                    </Button>
                  </>
                )}
              </div>
            </Modal>

            <div className='text-12px text-t-tertiary px-4px'>{t('company.account.authorityNote')}</div>
          </>
        )}
      </div>
    </SettingsPageWrapper>
  );
};

export default TeamPage;
