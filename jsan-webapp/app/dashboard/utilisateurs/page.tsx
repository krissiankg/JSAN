"use client";

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  type PendingVerificationRow,
  type ProfileDocument,
  approveProfileDocument,
  rejectProfileDocument,
  fetchPendingProfileDocuments,
  getProfileDocumentSignedUrl,
  profileDocumentTypeLabel,
  formatProfileDocDate,
} from '@/lib/profile-documents';
import TableScroll from '@/components/dashboard/TableScroll';
import {
  type StaffUserRow,
  fetchStaffUsersWithEmails,
  updateUserRole,
  dbRoleToSelectValue,
  selectValueToDbRole,
  formatUserDisplayName,
  formatRegistrationDate,
  getRoleLabelFromDb,
} from '@/lib/users-admin';

type TabId = 'all' | 'pending';

export default function GestionUtilisateurs() {
  const { userRole } = useAuth();
  const supabase = createClient();

  const [users, setUsers] = useState<StaffUserRow[]>([]);
  const [pendingRows, setPendingRows] = useState<PendingVerificationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<TabId>('pending');
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [selectedVerification, setSelectedVerification] = useState<PendingVerificationRow | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const pendingUserIds = new Set(pendingRows.map((r) => r.user.id));

  const loadData = useCallback(async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [usersData, pendingData] = await Promise.all([
        fetchStaffUsersWithEmails(),
        fetchPendingProfileDocuments(supabase),
      ]);
      const emailById = new Map(usersData.map((u) => [u.id, u.email ?? null]));
      setUsers(usersData);
      setPendingRows(
        pendingData.map((row) => ({
          ...row,
          user: {
            ...row.user,
            email: emailById.get(row.user.id) ?? null,
          },
        }))
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur de chargement.';
      const hint = msg.includes('profile_documents')
        ? ' Exécutez la migration 014 dans Supabase.'
        : '';
      setMessage({ type: 'error', text: `${msg}${hint}` });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) loadData();
  }, [userRole, loadData]);

  useEffect(() => {
    if (!selectedVerification) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    setPreviewLoading(true);
    getProfileDocumentSignedUrl(supabase, selectedVerification.document.file_url)
      .then((url) => {
        if (!cancelled) setPreviewUrl(url);
      })
      .finally(() => {
        if (!cancelled) setPreviewLoading(false);
      });
    return () => { cancelled = true; };
  }, [selectedVerification, supabase]);

  if (!isEventStaff(userRole)) {
    return (
      <div className="dashboard-content">
        <div className="alert-card" style={{ background: '#fef2f2', border: '1px solid #fca5a5', color: '#b91c1c', padding: '20px', borderRadius: '8px' }}>
          <h2>Accès refusé</h2>
          <p>Vous n&apos;avez pas les droits nécessaires pour accéder à cette page.</p>
          <Link href="/dashboard" className="btn btn-primary" style={{ marginTop: '15px', display: 'inline-block' }}>Retour au tableau de bord</Link>
        </div>
      </div>
    );
  }

  const matchesSearch = (
    prenom: string | null,
    nom: string | null,
    phone: string | null,
    email?: string | null
  ) => {
    const q = searchTerm.toLowerCase();
    if (!q) return true;
    return (
      (prenom ?? '').toLowerCase().includes(q) ||
      (nom ?? '').toLowerCase().includes(q) ||
      (phone ?? '').toLowerCase().includes(q) ||
      (email ?? '').toLowerCase().includes(q)
    );
  };

  const filteredUsers = users.filter((u) => matchesSearch(u.prenom, u.nom, u.telephone, u.email));
  const filteredPending = pendingRows.filter((r) =>
    matchesSearch(r.user.prenom, r.user.nom, r.user.telephone, (r.user as StaffUserRow).email)
  );

  const getUserStatus = (user: StaffUserRow) => {
    if (user.is_student_verified || user.is_member_verified) {
      return { label: '↑ Validé', bg: '#dcfce7', color: '#166534' };
    }
    if (pendingUserIds.has(user.id)) {
      return { label: '⏳ En attente', bg: '#fef3c7', color: '#b45309' };
    }
    return { label: '—', bg: '#f1f5f9', color: '#64748b' };
  };

  const handleRoleChange = async (user: StaffUserRow, selectValue: string) => {
    const newRole = selectValueToDbRole(selectValue, user.role);
    if (newRole === user.role) return;
    const err = await updateUserRole(supabase, user.id, newRole);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setUsers((prev) => prev.map((u) => (u.id === user.id ? { ...u, role: newRole } : u)));
    setMessage({ type: 'success', text: 'Rôle mis à jour.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleApprove = async (doc: ProfileDocument) => {
    setActionLoading(true);
    const err = await approveProfileDocument(supabase, doc);
    setActionLoading(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setSelectedVerification(null);
    await loadData();
    setMessage({ type: 'success', text: 'Justificatif approuvé.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleReject = async (doc: ProfileDocument) => {
    setActionLoading(true);
    const err = await rejectProfileDocument(supabase, doc);
    setActionLoading(false);
    if (err) {
      setMessage({ type: 'error', text: err });
      return;
    }
    setSelectedVerification(null);
    await loadData();
    setMessage({ type: 'success', text: 'Justificatif refusé.' });
    setTimeout(() => setMessage(null), 3000);
  };

  const isImagePreview = (doc: ProfileDocument) =>
    ['jpg', 'jpeg', 'png'].includes((doc.file_type ?? '').toLowerCase());

  return (
    <div className="dashboard-content" style={{ minHeight: '100vh', padding: '10px 0' }}>
      <div style={{ background: '#ffffff', borderRadius: '16px', padding: '24px', boxShadow: '0 4px 20px rgba(0,0,0,0.03)', border: '1px solid #f1f5f9' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '24px', flexWrap: 'wrap' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: '#111' }}>Utilisateurs</h2>
            <div style={{ display: 'flex', alignItems: 'center', background: '#f8fafc', padding: '8px 16px', borderRadius: '24px', width: '320px', border: '1px solid #f1f5f9' }}>
              <span style={{ color: '#94a3b8', marginRight: '8px', fontSize: '14px' }}>🔍</span>
              <input
                type="text"
                placeholder="Rechercher par nom, e-mail ou téléphone…"
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', width: '100%', color: '#333' }}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'flex', background: '#f8fafc', borderRadius: '24px', border: '1px solid #f1f5f9', padding: '4px' }}>
            <button
              onClick={() => setActiveTab('all')}
              style={{
                padding: '6px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: activeTab === 'all' ? '#ffffff' : 'transparent',
                color: activeTab === 'all' ? '#111' : '#64748b',
                boxShadow: activeTab === 'all' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              Tous ({users.length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              style={{
                padding: '6px 20px', borderRadius: '20px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: 'pointer',
                background: activeTab === 'pending' ? '#ffffff' : 'transparent',
                color: activeTab === 'pending' ? '#111' : '#64748b',
                boxShadow: activeTab === 'pending' ? '0 2px 6px rgba(0,0,0,0.05)' : 'none',
              }}
            >
              À vérifier ({pendingRows.length})
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            marginBottom: '20px', padding: '12px 16px', borderRadius: '8px',
            background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
          }}>
            {message.text}
          </div>
        )}

        {loading ? (
          <p style={{ color: '#64748b', padding: '24px 0' }}>Chargement…</p>
        ) : activeTab === 'pending' ? (
          filteredPending.length === 0 ? (
            <p style={{ color: '#64748b', padding: '24px 0' }}>Aucun justificatif en attente de validation.</p>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <TableScroll minWidth={720}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '12px' }}>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Utilisateur</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Type</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Document</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Envoyé le</th>
                    <th style={{ padding: '16px', fontWeight: 500, textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPending.map((row) => (
                    <tr key={row.document.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '16px' }}>
                        <div style={{ fontWeight: 600, color: '#111', fontSize: '14px' }}>{formatUserDisplayName(row.user)}</div>
                        <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                          {row.user.email ?? getRoleLabelFromDb(row.user.role)}
                        </div>
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>
                        {profileDocumentTypeLabel(row.document.document_type)}
                      </td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>{row.document.file_name}</td>
                      <td style={{ padding: '16px', fontSize: '14px', color: '#475569' }}>
                        {formatProfileDocDate(row.document.created_at)}
                      </td>
                      <td style={{ padding: '16px', textAlign: 'right' }}>
                        <button
                          type="button"
                          onClick={() => setSelectedVerification(row)}
                          style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#111', color: '#fff', fontWeight: 500, cursor: 'pointer', fontSize: '13px' }}
                        >
                          Vérifier
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </TableScroll>
            </div>
          )
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <TableScroll minWidth={860}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                  <tr style={{ borderBottom: '1px solid #f1f5f9', color: '#94a3b8', fontSize: '12px' }}>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Utilisateur</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>E-mail</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Téléphone</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Rôle</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Justificatif</th>
                    <th style={{ padding: '16px', fontWeight: 500 }}>Inscription</th>
                  </tr>
              </thead>
              <tbody>
                {filteredUsers.map((user) => {
                  const status = getUserStatus(user);
                  return (
                    <tr
                      key={user.id}
                      onMouseEnter={() => setHoveredRow(user.id)}
                      onMouseLeave={() => setHoveredRow(null)}
                      style={{ borderBottom: '1px solid #f1f5f9', backgroundColor: hoveredRow === user.id ? '#f8fafc' : 'transparent' }}
                    >
                      <td style={{ padding: '16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', overflow: 'hidden', flexShrink: 0 }}>
                            <img
                              src={`https://ui-avatars.com/api/?name=${encodeURIComponent(formatUserDisplayName(user))}&background=random&color=fff`}
                              alt=""
                              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                            />
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#111', fontSize: '14px' }}>{formatUserDisplayName(user)}</div>
                            {!user.prenom && !user.nom && user.email && (
                              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>Nom non renseigné</div>
                            )}
                            {pendingUserIds.has(user.id) && (
                              <button
                                type="button"
                                onClick={() => {
                                  const row = pendingRows.find((r) => r.user.id === user.id);
                                  if (row) setSelectedVerification(row);
                                  setActiveTab('pending');
                                }}
                                style={{ fontSize: '12px', color: '#1B6B2E', background: 'none', border: 'none', cursor: 'pointer', padding: 0, marginTop: '4px' }}
                              >
                                ↗ Voir justificatif en attente
                              </button>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: '13px' }}>
                        {user.email ? (
                          <a href={`mailto:${user.email}`} style={{ color: '#1B6B2E', textDecoration: 'none' }}>
                            {user.email}
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>{user.telephone ?? '—'}</td>
                      <td style={{ padding: '16px' }}>
                        <select
                          value={dbRoleToSelectValue(user.role)}
                          onChange={(e) => handleRoleChange(user, e.target.value)}
                          style={{
                            padding: '6px 12px', borderRadius: '8px', border: '1px solid #e2e8f0',
                            background: '#ffffff', fontSize: '13px', color: '#475569', cursor: 'pointer',
                          }}
                        >
                          <option value="participant">Participant</option>
                          <option value="auteur">Auteur</option>
                          <option value="pair_pending">Évaluateur (en attente)</option>
                          <option value="pair_valid">Évaluateur (validé)</option>
                          <option value="organisateur">Organisateur</option>
                          <option value="superadmin">Super Admin</option>
                        </select>
                      </td>
                      <td style={{ padding: '16px' }}>
                        <span style={{
                          display: 'inline-flex', padding: '4px 10px', borderRadius: '20px',
                          fontSize: '12px', fontWeight: 600, backgroundColor: status.bg, color: status.color,
                        }}>
                          {status.label}
                        </span>
                      </td>
                      <td style={{ padding: '16px', color: '#475569', fontSize: '14px' }}>
                        {formatRegistrationDate(user.created_at)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </TableScroll>
          </div>
        )}
      </div>

      {selectedVerification && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '20px' }}>
          <div style={{ background: '#fff', borderRadius: '16px', width: '100%', maxWidth: '640px', maxHeight: '90vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #f1f5f9', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 600, color: '#1e293b' }}>
                Vérification — {profileDocumentTypeLabel(selectedVerification.document.document_type)}
              </h3>
              <button type="button" onClick={() => setSelectedVerification(null)} style={{ background: 'transparent', border: 'none', fontSize: '20px', cursor: 'pointer', color: '#64748b' }}>✕</button>
            </div>

            <div style={{ padding: '24px', overflowY: 'auto' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginBottom: '20px', padding: '15px', background: '#f8fafc', borderRadius: '12px' }}>
                <img
                  src={`https://ui-avatars.com/api/?name=${encodeURIComponent(formatUserDisplayName(selectedVerification.user))}&background=random`}
                  alt=""
                  style={{ width: '50px', height: '50px', borderRadius: '50%' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '16px', color: '#1e293b' }}>{formatUserDisplayName(selectedVerification.user)}</div>
                  <div style={{ color: '#64748b', fontSize: '13px' }}>
                    {(selectedVerification.user as StaffUserRow).email ?? 'Pas d’e-mail'} • {selectedVerification.user.telephone ?? 'Pas de téléphone'} • Inscrit le {formatRegistrationDate(selectedVerification.user.created_at)}
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', color: '#475569' }}>Document : {selectedVerification.document.file_name}</h4>
                <div style={{ width: '100%', minHeight: '240px', maxHeight: '360px', background: '#e2e8f0', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
                  {previewLoading ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px', color: '#64748b' }}>Chargement de l&apos;aperçu…</div>
                  ) : previewUrl ? (
                    isImagePreview(selectedVerification.document) ? (
                      <img src={previewUrl} alt="Aperçu" style={{ width: '100%', maxHeight: '360px', objectFit: 'contain' }} />
                    ) : (
                      <iframe src={previewUrl} title="Aperçu document" style={{ width: '100%', height: '360px', border: 'none' }} />
                    )
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '240px', flexDirection: 'column', color: '#64748b' }}>
                      <span style={{ fontSize: '32px', marginBottom: '8px' }}>📄</span>
                      <span>Aperçu indisponible</span>
                    </div>
                  )}
                </div>
                {previewUrl && (
                  <a href={previewUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: '8px', fontSize: '13px', color: '#1B6B2E' }}>
                    Ouvrir dans un nouvel onglet
                  </a>
                )}
              </div>
            </div>

            <div style={{ padding: '16px 24px', background: '#f8fafc', borderTop: '1px solid #f1f5f9', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setSelectedVerification(null)}
                disabled={actionLoading}
                style={{ padding: '8px 16px', borderRadius: '8px', border: '1px solid #cbd5e1', background: '#fff', color: '#475569', fontWeight: 500, cursor: 'pointer' }}
              >
                Fermer
              </button>
              <button
                type="button"
                onClick={() => handleReject(selectedVerification.document)}
                disabled={actionLoading}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#fef2f2', color: '#dc2626', fontWeight: 500, cursor: 'pointer' }}
              >
                {actionLoading ? '…' : 'Rejeter'}
              </button>
              <button
                type="button"
                onClick={() => handleApprove(selectedVerification.document)}
                disabled={actionLoading}
                style={{ padding: '8px 16px', borderRadius: '8px', border: 'none', background: '#111', color: '#fff', fontWeight: 500, cursor: 'pointer' }}
              >
                {actionLoading ? '…' : '✅ Approuver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
