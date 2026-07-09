"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import MessageEmojiPicker from '@/components/dashboard/MessageEmojiPicker';
import { getRoleLabel, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';
import {
  type MessageThread,
  type StaffContactProfile,
  avatarUrl,
  fetchUserMessages,
  formatMessageTime,
  formatMessageTimestamp,
  formatUserName,
  getStaffContactProfile,
  groupMessagesIntoThreads,
  markThreadAsRead,
  sendMessage,
  threadDisplayName,
  userHandle,
} from '@/lib/messages';

function roleLabel(dbRole: string | undefined): string {
  if (!dbRole) return 'Organisateur';
  try {
    return getRoleLabel(mapDbRoleToAppRole(dbRole as DbUserRole));
  } catch {
    return 'Organisateur';
  }
}

function previewText(text: string, max = 52): string {
  const oneLine = text.replace(/\s+/g, ' ').trim();
  return oneLine.length > max ? `${oneLine.slice(0, max)}…` : oneLine;
}

export default function MessageriePage() {
  const { user, profile } = useAuth();
  const supabase = createClient();

  const [threads, setThreads] = useState<MessageThread[]>([]);
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [staffContact, setStaffContact] = useState<StaffContactProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const myName = formatUserName(profile?.prenom, profile?.nom);
  const myHandle = userHandle(profile?.prenom, profile?.nom, profile?.role);

  const loadMessages = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const [messages, staff] = await Promise.all([
        fetchUserMessages(supabase, user.id),
        getStaffContactProfile(supabase),
      ]);
      setStaffContact(staff);
      const grouped = groupMessagesIntoThreads(messages, user.id);
      setThreads(grouped);
      setActiveThreadId((current) => {
        if (current && grouped.some((t) => t.id === current)) return current;
        return grouped[0]?.id ?? null;
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Erreur de chargement.';
      const hint = msg.includes('messages') ? ' Exécutez la migration 013 dans Supabase.' : '';
      setError(`${msg}${hint}`);
    }
    setLoading(false);
  }, [user, supabase]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const activeThread = useMemo(
    () => threads.find((t) => t.id === activeThreadId),
    [threads, activeThreadId]
  );

  useEffect(() => {
    async function markRead() {
      if (!user || !activeThread || activeThread.messages.length === 0) return;
      await markThreadAsRead(supabase, user.id, activeThread.otherUserId);
      setThreads((prev) =>
        prev.map((t) => (t.id === activeThread.id ? { ...t, unread: false } : t))
      );
    }
    markRead();
  }, [activeThreadId, activeThread, user, supabase]);

  const handleSend = async () => {
    if (!user || !inputText.trim() || !activeThread) return;

    setSending(true);
    const err = await sendMessage(supabase, {
      sender_id: user.id,
      receiver_id: activeThread.otherUserId,
      abstract_id: activeThread.abstractId ?? null,
      contenu: inputText.trim(),
    });
    setSending(false);

    if (err) {
      setError(err);
      return;
    }

    setInputText('');
    await loadMessages();
  };

  const startWithStaff = () => {
    if (!staffContact) {
      setError('Secrétariat indisponible. Lancez npm run seed:users.');
      return;
    }
    const exists = threads.find((t) => t.otherUserId === staffContact.id);
    if (exists) {
      setActiveThreadId(exists.id);
    } else {
      setError('Envoyez un premier message via le champ ci-dessous après avoir sélectionné le comité.');
    }
    setError(null);
  };

  const filteredThreads = threads.filter((t) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      t.otherUserName.toLowerCase().includes(q)
      || t.otherUserHandle.toLowerCase().includes(q)
      || t.lastMessage.toLowerCase().includes(q)
      || (t.abstractTitle?.toLowerCase().includes(q) ?? false)
    );
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 340px) minmax(0, 1fr)', gap: '0', height: 'calc(100vh - 130px)', minHeight: '520px', background: '#f1f5f9', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0' }}>
      {/* Colonne conversations */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#f8fafc', borderRight: '1px solid #e2e8f0', minWidth: 0 }}>
        <div style={{ padding: '16px', borderBottom: '1px solid #e2e8f0' }}>
          <div style={{ background: '#fff', borderRadius: '24px', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: '10px', border: '1px solid #e2e8f0' }}>
            <span style={{ color: '#94a3b8' }}>🔍</span>
            <input
              type="text"
              placeholder="Rechercher un message..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{ background: 'transparent', border: 'none', outline: 'none', width: '100%', fontSize: '13px', color: '#334155' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', padding: '24px' }}>Chargement…</p>
          ) : filteredThreads.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center' }}>
              <p style={{ color: '#94a3b8', fontSize: '13px', margin: '0 0 12px' }}>Aucune conversation.</p>
              {staffContact && (
                <button type="button" onClick={startWithStaff} style={{ fontSize: '12px', color: '#2563eb', background: 'none', border: 'none', cursor: 'pointer' }}>
                  Contacter le secrétariat →
                </button>
              )}
              <p style={{ fontSize: '11px', color: '#b45309', marginTop: '12px' }}>
                Démo : <code>npm run seed:messages</code>
              </p>
            </div>
          ) : (
            filteredThreads.map((conv) => {
              const isActive = activeThreadId === conv.id;
              return (
                <div
                  key={conv.id}
                  onClick={() => setActiveThreadId(conv.id)}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '48px 1fr 10px',
                    gap: '12px',
                    alignItems: 'start',
                    padding: '14px 16px',
                    cursor: 'pointer',
                    background: isActive ? '#ffffff' : 'transparent',
                    borderBottom: '1px solid #eef2f6',
                    transition: 'background 0.15s',
                  }}
                >
                  <img
                    src={avatarUrl(conv.otherUserPrenom, conv.otherUserNom, 96)}
                    alt=""
                    style={{ width: '48px', height: '48px', borderRadius: '50%', objectFit: 'cover' }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '8px', marginBottom: '4px' }}>
                      <span style={{ fontWeight: 700, fontSize: '13px', color: '#0f172a' }}>{conv.otherUserHandle}</span>
                      <span style={{ fontSize: '11px', color: '#94a3b8', flexShrink: 0 }}>{formatMessageTime(conv.lastMessageAt)}</span>
                    </div>
                    <p style={{ margin: 0, fontSize: '12px', color: '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1.4 }}>
                      {previewText(conv.lastMessage)}
                    </p>
                  </div>
                  <div style={{
                    width: '8px', height: '8px', borderRadius: '50%', marginTop: '6px',
                    background: conv.unread ? '#22c55e' : '#cbd5e1',
                    flexShrink: 0,
                  }} />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Colonne conversation active */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#ffffff', minWidth: 0 }}>
        {error && (
          <div style={{ padding: '10px 20px', background: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{error}</div>
        )}

        {activeThread ? (
          <>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                <img
                  src={avatarUrl(activeThread.otherUserPrenom, activeThread.otherUserNom, 80)}
                  alt=""
                  style={{ width: '44px', height: '44px', borderRadius: '50%', flexShrink: 0 }}
                />
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: '15px', color: '#0f172a' }}>{activeThread.otherUserName}</div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>{activeThread.otherUserHandle}</div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Rôle : {roleLabel(activeThread.otherUserRole)}
                  </div>
                </div>
              </div>
              <button
                type="button"
                title="Archiver (bientôt)"
                style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', width: '36px', height: '36px', cursor: 'pointer', color: '#94a3b8', fontSize: '16px' }}
              >
                🗑️
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
              {activeThread.messages.length === 0 ? (
                <p style={{ textAlign: 'center', color: '#94a3b8', fontSize: '13px', marginTop: '40px' }}>
                  Aucun message dans cette conversation.
                </p>
              ) : (
                activeThread.messages.map((msg) => {
                  const isMe = msg.sender_id === user?.id;
                  const senderProfile = isMe
                    ? { prenom: profile?.prenom, nom: profile?.nom, role: profile?.role }
                    : msg.sender;
                  const displayName = isMe
                    ? myName
                    : threadDisplayName(senderProfile?.prenom, senderProfile?.nom, senderProfile?.role);
                  const handle = isMe
                    ? myHandle
                    : userHandle(senderProfile?.prenom, senderProfile?.nom, senderProfile?.role);

                  return (
                    <div key={msg.id} style={{ marginBottom: '28px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: '12px', marginBottom: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontSize: '13px', color: '#0f172a' }}>
                          <strong>{displayName}</strong>
                          {' '}
                          <span style={{ color: '#94a3b8', fontWeight: 400 }}>{handle}</span>
                        </span>
                        <span style={{ fontSize: '12px', color: '#94a3b8' }}>{formatMessageTimestamp(msg.created_at)}</span>
                      </div>
                      <div style={{
                        padding: '14px 18px',
                        borderRadius: '8px',
                        border: '1px solid #e2e8f0',
                        background: isMe ? '#f8fafc' : '#ffffff',
                        fontSize: '14px',
                        color: '#334155',
                        lineHeight: 1.6,
                        whiteSpace: 'pre-wrap',
                      }}>
                        {msg.contenu}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div style={{ padding: '16px 24px 20px', borderTop: '1px solid #e2e8f0', background: '#fafbfc' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ flex: 1, position: 'relative' }}>
                  <div style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', zIndex: 1 }}>
                    <MessageEmojiPicker
                      variant="inline"
                      disabled={sending}
                      onSelect={(emoji) => {
                        setInputText((prev) => prev + emoji);
                        inputRef.current?.focus();
                      }}
                    />
                  </div>
                  <input
                    ref={inputRef}
                    type="text"
                    placeholder={`Écrire à ${activeThread.otherUserHandle}...`}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                    style={{
                      width: '100%',
                      boxSizing: 'border-box',
                      padding: '12px 16px 12px 44px',
                      border: '1px solid #e2e8f0',
                      borderRadius: '24px',
                      fontSize: '14px',
                      outline: 'none',
                      background: '#fff',
                    }}
                  />
                </div>
                <button
                  type="button"
                  disabled={sending || !inputText.trim()}
                  onClick={handleSend}
                  style={{
                    padding: '10px 22px',
                    borderRadius: '8px',
                    border: 'none',
                    background: '#1e293b',
                    color: '#fff',
                    fontWeight: 600,
                    fontSize: '13px',
                    cursor: 'pointer',
                    opacity: sending || !inputText.trim() ? 0.6 : 1,
                    flexShrink: 0,
                  }}
                >
                  {sending ? '…' : 'Envoyer'}
                </button>
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px', padding: '24px' }}>
            Sélectionnez une conversation dans la liste.
          </div>
        )}
      </div>
    </div>
  );
}
