/**
 * @license
 * Copyright 2025 AionUi (aionui.com)
 * SPDX-License-Identifier: Apache-2.0
 */

import { CheckOne, Close } from '@icon-park/react';
import { Message } from '@arco-design/web-react';
import React, { useEffect, useState } from 'react';

import { useTranslation } from 'react-i18next';

import AionModal from '@/renderer/components/base/AionModal';
import { ipcBridge } from '@/common';
import { buildAtSessionInsertion } from '@/renderer/utils/chat/atSessionQuery';
import { resolveBroadcastRecipients } from '../utils/groupingHelpers';
import { buildProjectSettingsBlock } from '../utils/projectStorage';

import type { TChatConversation } from '@/common/config/storage';

type BroadcastModalProps = {
  visible: boolean;
  projectName: string;
  /** Member conversations of the project (recipients). */
  members: TChatConversation[];
  /** Current lead conversation id of the project (preferred @transport sender), if any. */
  leadId: string | null;
  onClose: () => void;
};

type DeliveryState = 'pending' | 'sent' | 'failed';

type DeliveryResult = {
  id: string;
  name: string;
  state: DeliveryState;
  reason?: string;
};

/**
 * "Message members" broadcast modal for a named project group, styled after
 * MoveToProjectModal. The user picks recipients (checkbox per member plus
 * "select all"), writes one message, and it is delivered to each selected
 * member through the exact transport the '@@' mention feature uses:
 * a message sent from a sender conversation carrying a `sessions` ref per
 * recipient; the backend appends the [[AION_SESSIONS]] block and delivers a
 * [[AION_SESSION_MESSAGE]]-wrapped copy into each target conversation. The
 * sender is the project lead when one is set, otherwise the most recently
 * active member (the message must originate from a real conversation).
 * Delivery is fully manual and opt-in; nothing is routed automatically.
 */
const BroadcastModal: React.FC<BroadcastModalProps> = ({ visible, projectName, members, leadId, onClose }) => {
  const { t } = useTranslation();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [results, setResults] = useState<DeliveryResult[]>([]);

  useEffect(() => {
    if (visible) {
      // Default to all members selected; the user can uncheck freely.
      setSelectedIds(members.map((member) => member.id));
      setText('');
      setSending(false);
      setResults([]);
    }
  }, [visible, members]);

  const toggleMember = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const allSelected = members.length > 0 && selectedIds.length === members.length;

  // Sender for the '@@' transport: the backend records the mention in one
  // originating conversation, like a manual '@@' sent from that chat. Prefer
  // the lead; otherwise the most recently active member.
  const sender = React.useMemo(() => {
    const lead = leadId ? members.find((member) => member.id === leadId) : undefined;
    if (lead) return lead;
    return [...members].sort((a, b) => (b.modified_at ?? 0) - (a.modified_at ?? 0))[0] ?? null;
  }, [leadId, members]);

  const send = async () => {
    if (!sender) return;
    const content = text.trim();
    if (!content || sending || selectedIds.length === 0) return;
    setSending(true);
    const recipients = resolveBroadcastRecipients(members, allSelected ? 'all' : selectedIds);
    const pending: DeliveryResult[] = members
      .filter((member) => recipients.includes(member.id))
      .map((member) => ({ id: member.id, name: member.name || member.id, state: 'pending' as const }));
    setResults(pending);

    let failures = 0;
    for (const result of pending) {
      // The sender conversation already holds the message (it is the message's
      // origin, exactly as when a user types '@@' in that chat); nothing to deliver.
      if (result.id === sender.id) {
        setResults((prev) => prev.map((r) => (r.id === result.id ? { ...r, state: 'sent' } : r)));
        continue;
      }
      try {
        // Same transport as the '@@' mention flow: a message from the sender
        // conversation carrying a session ref; the backend resolves it and
        // delivers an inter-phone message into the target conversation.
        // The shared project settings (guidelines / delivery / repo) ride
        // along so recipients never need to be re-briefed manually.
        await ipcBridge.conversation.sendMessage.invoke({
          input: `${content}${buildProjectSettingsBlock(projectName)}\n\n${buildAtSessionInsertion(result.name)}`,
          conversation_id: sender.id,
          sessions: [{ id: result.id }],
        });
        setResults((prev) => prev.map((r) => (r.id === result.id ? { ...r, state: 'sent' } : r)));
      } catch (error) {
        failures += 1;
        const reason = error instanceof Error ? error.message : String(error);
        setResults((prev) => prev.map((r) => (r.id === result.id ? { ...r, state: 'failed', reason } : r)));
      }
    }

    setSending(false);
    if (failures === 0) {
      Message.success(t('conversation.history.deliverySent'));
    }
  };

  if (!visible) return null;

  return (
    <AionModal
      visible={visible}
      style={{ width: '480px' }}
      header={{
        title: t('conversation.history.messageMembersTitle', { project: projectName }),
        showClose: true,
        style: { borderBottom: 'none' },
      }}
      onCancel={onClose}
      footer={null}
    >
      <div className='flex flex-col gap-12px'>
        <div className='flex flex-col gap-6px max-h-180px overflow-y-auto min-w-0'>
          {members.length === 0 && (
            <div className='text-13px text-t-secondary py-8px'>{t('conversation.history.noMembers')}</div>
          )}
          {members.length > 0 && (
            <label className='flex items-center gap-8px px-12px py-4px text-13px text-t-secondary cursor-pointer'>
              <input
                type='checkbox'
                checked={allSelected}
                onChange={(event) => setSelectedIds(event.target.checked ? members.map((m) => m.id) : [])}
              />
              {t('conversation.history.selectAll')}
            </label>
          )}
          {members.map((member) => {
            const result = results.find((r) => r.id === member.id);
            return (
              <label
                key={member.id}
                className='flex items-center gap-8px px-12px py-6px rd-8px text-14px cursor-pointer min-w-0'
                style={{ border: '1px solid var(--color-border-2)' }}
              >
                <input
                  type='checkbox'
                  checked={selectedIds.includes(member.id)}
                  onChange={() => toggleMember(member.id)}
                />
                <span className='truncate flex-1'>{member.name || member.id}</span>
                {result?.state === 'sent' && (
                  <CheckOne theme='outline' size='14' className='shrink-0' style={{ color: 'rgb(var(--primary-6))' }} />
                )}
                {result?.state === 'failed' && (
                  <Close theme='outline' size='14' className='shrink-0' style={{ color: 'rgb(var(--danger-6))' }} />
                )}
              </label>
            );
          })}
        </div>

        <textarea
          className='w-full px-10px py-8px rd-8px text-14px'
          style={{
            border: '1px solid var(--color-border-2)',
            background: 'var(--color-fill-2)',
            color: 'var(--color-text-1)',
            caretColor: 'var(--color-text-1)',
            minHeight: '80px',
            resize: 'vertical',
          }}
          placeholder={t('conversation.history.messageMembersPlaceholder')}
          value={text}
          onChange={(event) => setText(event.target.value)}
          disabled={sending}
        />

        {results.length > 0 && (
          <div className='flex flex-col gap-2px max-h-120px overflow-y-auto text-12px'>
            {results.map((result) => (
              <div key={result.id} className='flex items-center gap-6px'>
                <span className='truncate flex-1'>{result.name}</span>
                {result.state === 'sent' && (
                  <span style={{ color: 'rgb(var(--primary-6))' }}>{t('conversation.history.deliverySent')}</span>
                )}
                {result.state === 'failed' && (
                  <span className='truncate' style={{ color: 'rgb(var(--danger-6))' }} title={result.reason}>
                    {t('conversation.history.deliveryFailed')}
                    {result.reason ? `: ${result.reason}` : ''}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

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
            className='px-12px py-6px rd-16px text-13px font-medium cursor-pointer rd-6px'
            style={{
              border: '1px solid rgb(var(--primary-6))',
              color: text.trim() && selectedIds.length > 0 && !sending ? '#fff' : 'var(--color-text-3)',
              backgroundColor:
                text.trim() && selectedIds.length > 0 && !sending ? 'rgb(var(--primary-6))' : 'transparent',
              cursor: text.trim() && selectedIds.length > 0 && !sending ? 'pointer' : 'not-allowed',
            }}
            disabled={!text.trim() || selectedIds.length === 0 || sending}
            onClick={send}
          >
            {sending ? '…' : t('common.send')}
          </button>
        </div>
      </div>
    </AionModal>
  );
};

export default BroadcastModal;
