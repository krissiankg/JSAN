"use client";

import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import { renderNotificationEmail } from '@/lib/email';
import { fetchEmailCampaignLogs, type EmailCampaignLog } from '@/lib/email-history';
import { TICKET_CATALOG, fetchTicketCatalog, type TicketCatalogItem } from '@/lib/tickets';
import {
  EMAIL_TEMPLATE_CATEGORY_LABELS,
  EMAIL_TEMPLATE_DEFINITIONS,
  EMAIL_TEMPLATE_DEFINITIONS_BY_KEY,
  fetchEmailTemplateConfig,
  renderEmailTemplate,
  sampleVariablesForTemplate,
  updateEmailTemplates,
  type EmailTemplateCategory,
  type EmailTemplateKey,
  type EmailTemplateMap,
} from '@/lib/email-templates';
import {
  EMAIL_TEMPLATE_LINK_LABELS,
  previewEmailCtaUrl,
  resolveEmailTemplateLink,
} from '@/lib/email-template-links';

type BroadcastAudience = 'all' | 'participants' | 'authors' | 'evaluators' | 'organizers';
type BroadcastLogMetadata = {
  link?: string | null;
  filters?: {
    paidOnly?: boolean;
    verifiedOnly?: boolean;
    ticketType?: string | null;
    userIds?: string[];
  };
  variables?: Record<string, string | null | undefined>;
};

export default function AdminEmailsPage() {
  const { userRole } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [configId, setConfigId] = useState<string | null>(null);
  const [templates, setTemplates] = useState<EmailTemplateMap | null>(null);
  const [selectedKey, setSelectedKey] = useState<EmailTemplateKey>('account_registration');
  const [saving, setSaving] = useState(false);
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [history, setHistory] = useState<EmailCampaignLog[]>([]);
  const [catalog, setCatalog] = useState<TicketCatalogItem[]>(TICKET_CATALOG);
  const [announcementAudience, setAnnouncementAudience] = useState<BroadcastAudience>('all');
  const [announcementNote, setAnnouncementNote] = useState('');
  const [announcementLink, setAnnouncementLink] = useState('/dashboard/programme');
  const [announcementPaidOnly, setAnnouncementPaidOnly] = useState(false);
  const [announcementVerifiedOnly, setAnnouncementVerifiedOnly] = useState(false);
  const [announcementTicketType, setAnnouncementTicketType] = useState('');
  const [showAnnouncementPreview, setShowAnnouncementPreview] = useState(false);
  const [historyKindFilter, setHistoryKindFilter] = useState<'all' | EmailCampaignLog['campaign_kind']>('all');
  const [historyTemplateFilter, setHistoryTemplateFilter] = useState<'all' | string>('all');
  const [historyDateFrom, setHistoryDateFrom] = useState('');
  const [historyDateTo, setHistoryDateTo] = useState('');
  const [resendingLogId, setResendingLogId] = useState<string | null>(null);
  const [selectedHistoryLog, setSelectedHistoryLog] = useState<EmailCampaignLog | null>(null);

  useEffect(() => {
    async function load() {
      if (!isEventStaff(userRole)) return;
      setLoading(true);
      const [config, logs, catalogRows] = await Promise.all([
        fetchEmailTemplateConfig(supabase),
        fetchEmailCampaignLogs(supabase).catch(() => []),
        fetchTicketCatalog(supabase, { activeOnly: false }),
      ]);
      setConfigId(config?.id ?? null);
      setTemplates(config?.email_templates ?? null);
      setHistory(logs);
      setCatalog(catalogRows);
      setLoading(false);
    }
    void load();
  }, [supabase, userRole]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444', marginBottom: '20px' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Seuls les organisateurs peuvent gérer les modèles d’e-mails.</p>
      </div>
    );
  }

  if (loading) {
    return <div style={{ padding: '30px', color: '#64748b' }}>Chargement…</div>;
  }

  if (!configId || !templates) {
    return (
      <div style={{ padding: '30px' }}>
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', color: '#b91c1c', padding: '14px 16px', borderRadius: '10px' }}>
          Aucune configuration d’événement n’a été trouvée. Crée ou initialise d’abord `events_config`, puis recharge cette page.
        </div>
      </div>
    );
  }

  const selectedDefinition = EMAIL_TEMPLATE_DEFINITIONS_BY_KEY[selectedKey];
  const selectedTemplate = templates[selectedKey];
  const sampleVars = sampleVariablesForTemplate(selectedKey);
  const preview = renderEmailTemplate(selectedTemplate, sampleVars);
  const previewCtaPath = resolveEmailTemplateLink({
    templateKey: selectedKey,
    variables: sampleVars,
  });
  const previewCtaUrl = previewEmailCtaUrl({
    templateKey: selectedKey,
    variables: sampleVars,
  });
  const templatePreviewHtml = renderNotificationEmail({
    title: preview.title,
    body: preview.body,
    ctaLabel: preview.ctaLabel || 'Ouvrir la plateforme',
    ctaUrl: previewCtaUrl,
    recipientName: sampleVars.nom_complet || sampleVars.prenom || 'Destinataire',
  });
  const announcementPreview = renderEmailTemplate(templates.special_announcement, {
    ...sampleVariablesForTemplate('special_announcement'),
    message_special: announcementNote.trim() || sampleVariablesForTemplate('special_announcement').message_special,
    lien_plateforme: announcementLink.trim() || '/dashboard/programme',
  });
  const announcementCtaUrl = previewEmailCtaUrl({
    templateKey: 'special_announcement',
    variables: {
      message_special: announcementNote.trim(),
    },
    overrideLink: announcementLink.trim() || '/dashboard/programme',
  });
  const announcementPreviewHtml = renderNotificationEmail({
    title: announcementPreview.title,
    body: announcementPreview.body,
    ctaLabel: announcementPreview.ctaLabel || 'Ouvrir la plateforme',
    ctaUrl: announcementCtaUrl,
    recipientName: 'Awa Kouassi',
  });
  const grouped = EMAIL_TEMPLATE_DEFINITIONS.reduce<Record<EmailTemplateCategory, typeof EMAIL_TEMPLATE_DEFINITIONS>>(
    (acc, definition) => {
      if (!acc[definition.category]) acc[definition.category] = [];
      acc[definition.category].push(definition);
      return acc;
    },
    {} as Record<EmailTemplateCategory, typeof EMAIL_TEMPLATE_DEFINITIONS>
  );
  const historyDetailPreview = selectedHistoryLog
    ? (() => {
        const templateKey = selectedHistoryLog.template_key as EmailTemplateKey;
        const template = templates[templateKey];
        if (!template) return null;
        const metadata = (selectedHistoryLog.metadata ?? {}) as BroadcastLogMetadata;
        const sample = sampleVariablesForTemplate(templateKey);
        const rendered = renderEmailTemplate(template, {
          ...sample,
          ...(metadata.variables ?? {}),
          lien_plateforme: metadata.link ?? sample.lien_plateforme,
        });
        const html = renderNotificationEmail({
          title: rendered.title,
          body: rendered.body,
          ctaLabel: rendered.ctaLabel || 'Ouvrir la plateforme',
          ctaUrl: previewEmailCtaUrl({
            templateKey,
            variables: { ...sample, ...(metadata.variables ?? {}) },
            overrideLink: metadata.link,
          }),
          recipientName: sample.nom_complet || 'Destinataire',
        });
        return { ...rendered, html };
      })()
    : null;

  const filteredHistory = history.filter((log) => {
    if (historyKindFilter !== 'all' && log.campaign_kind !== historyKindFilter) return false;
    if (historyTemplateFilter !== 'all' && log.template_key !== historyTemplateFilter) return false;
    if (historyDateFrom) {
      const from = new Date(`${historyDateFrom}T00:00:00`).getTime();
      if (new Date(log.created_at).getTime() < from) return false;
    }
    if (historyDateTo) {
      const to = new Date(`${historyDateTo}T23:59:59`).getTime();
      if (new Date(log.created_at).getTime() > to) return false;
    }
    return true;
  });

  const updateField = <K extends keyof typeof selectedTemplate>(key: K, value: (typeof selectedTemplate)[K]) => {
    setTemplates((prev) => (prev ? { ...prev, [selectedKey]: { ...prev[selectedKey], [key]: value } } : prev));
  };

  const handleSave = async () => {
    if (!templates || !configId) return;
    setSaving(true);
    const error = await updateEmailTemplates(supabase, configId, templates);
    setSaving(false);
    if (error) {
      setMessage({ type: 'error', text: error });
      return;
    }
    setMessage({ type: 'success', text: 'Modèles d’e-mails enregistrés.' });
  };

  const handleSendAnnouncement = async () => {
    if (!announcementNote.trim()) {
      setMessage({ type: 'error', text: "Saisis d'abord le message spécial à diffuser." });
      return;
    }
    setSendingAnnouncement(true);
    const response = await fetch('/api/notify/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: 'special_announcement',
        audience: announcementAudience,
        link: announcementLink.trim() || '/dashboard',
        variables: {
          message_special: announcementNote.trim(),
        },
        filters: {
          paidOnly: announcementPaidOnly,
          verifiedOnly: announcementVerifiedOnly,
          ticketType: announcementTicketType || null,
        },
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; sent?: number; failed?: number; error?: string } | null;
    setSendingAnnouncement(false);
    if (!response.ok || !result?.ok) {
      setMessage({ type: 'error', text: result?.error || "Impossible d'envoyer l'annonce spéciale." });
      return;
    }
    setMessage({
      type: 'success',
      text: `Annonce spéciale envoyée à ${result.sent ?? 0} destinataire(s)${(result.failed ?? 0) > 0 ? `, ${result.failed} échec(s)` : ''}.`,
    });
    setAnnouncementNote('');
    setHistory(await fetchEmailCampaignLogs(supabase).catch(() => history));
  };

  const handleSendTest = async () => {
    setSendingTest(true);
    const response = await fetch('/api/notify/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ templateKey: selectedKey }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; skipped?: boolean; error?: string } | null;
    setSendingTest(false);
    if (!response.ok || (!result?.ok && !result?.skipped)) {
      setMessage({ type: 'error', text: result?.error || 'Impossible d’envoyer le mail de test.' });
      return;
    }
    setMessage({ type: 'success', text: 'Mail de test envoyé à votre propre adresse.' });
    setHistory(await fetchEmailCampaignLogs(supabase).catch(() => history));
  };

  const handleResendCampaign = async (log: EmailCampaignLog) => {
    if (log.campaign_kind !== 'broadcast') return;
    const metadata = (log.metadata ?? {}) as BroadcastLogMetadata;
    setResendingLogId(log.id);
    const response = await fetch('/api/notify/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        templateKey: log.template_key,
        audience: log.audience_label ?? 'all',
        link: metadata.link ?? '/dashboard',
        variables: metadata.variables ?? {},
        filters: metadata.filters ?? {},
      }),
    });
    const result = (await response.json().catch(() => null)) as { ok?: boolean; sent?: number; failed?: number; error?: string } | null;
    setResendingLogId(null);
    if (!response.ok || !result?.ok) {
      setMessage({ type: 'error', text: result?.error || 'Impossible de renvoyer cette campagne.' });
      return;
    }
    setMessage({
      type: 'success',
      text: `Campagne renvoyée à ${result.sent ?? 0} destinataire(s)${(result.failed ?? 0) > 0 ? `, ${result.failed} échec(s)` : ''}.`,
    });
    setHistory(await fetchEmailCampaignLogs(supabase).catch(() => history));
  };

  const loadCampaignIntoAnnouncementForm = (log: EmailCampaignLog) => {
    const metadata = (log.metadata ?? {}) as BroadcastLogMetadata;
    setSelectedKey('special_announcement');
    setAnnouncementAudience((log.audience_label as BroadcastAudience | null) ?? 'all');
    setAnnouncementLink(metadata.link ?? '/dashboard');
    setAnnouncementNote(typeof metadata.variables?.message_special === 'string' ? metadata.variables.message_special : '');
    setAnnouncementPaidOnly(Boolean(metadata.filters?.paidOnly));
    setAnnouncementVerifiedOnly(Boolean(metadata.filters?.verifiedOnly));
    setAnnouncementTicketType(metadata.filters?.ticketType ?? '');
    setMessage({ type: 'success', text: 'Campagne chargée dans le formulaire d’annonce.' });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="page-shell page-shell--wide" style={{ display: 'grid', gap: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 6px', fontSize: '24px', color: '#0f172a' }}>E-mails éditables</h1>
          <p style={{ margin: 0, color: '#64748b', maxWidth: '840px', lineHeight: 1.6 }}>
            Gère les modèles pour les mails d’inscription, de bienvenue, d’annonces spéciales, de rappels de session, de soumissions, de paiements et de documents.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={handleSendTest} disabled={sendingTest} style={{ ...buttonSecondary, background: '#fff' }}>
            {sendingTest ? 'Test…' : 'M’envoyer un test'}
          </button>
          <button type="button" onClick={handleSave} disabled={saving} style={buttonPrimary}>
            {saving ? 'Enregistrement…' : 'Enregistrer'}
          </button>
        </div>
      </div>

      {message && (
        <div style={{
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '14px',
          background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
          color: message.type === 'success' ? '#166534' : '#b91c1c',
          border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
        }}>
          {message.text}
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
        <h2 style={{ margin: '0 0 6px', fontSize: '18px', color: '#0f172a' }}>Annonce spéciale</h2>
        <p style={{ margin: '0 0 16px', color: '#64748b', fontSize: '13px', lineHeight: 1.6 }}>
          Diffuse un message important en utilisant le modèle éditable `Annonce spéciale`.
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
          <div>
            <label style={labelStyle}>Audience</label>
            <select style={inputStyle} value={announcementAudience} onChange={(e) => setAnnouncementAudience(e.target.value as BroadcastAudience)}>
              <option value="all">Tous les utilisateurs</option>
              <option value="participants">Participants</option>
              <option value="authors">Auteurs</option>
              <option value="evaluators">Évaluateurs</option>
              <option value="organizers">Organisateurs / admins</option>
            </select>
          </div>
          <div>
            <label style={labelStyle}>Lien d’action</label>
            <input style={inputStyle} value={announcementLink} onChange={(e) => setAnnouncementLink(e.target.value)} placeholder="/dashboard/programme" />
          </div>
          <div>
            <label style={labelStyle}>Type de billet</label>
            <select style={inputStyle} value={announcementTicketType} onChange={(e) => setAnnouncementTicketType(e.target.value)}>
              <option value="">Tous les billets</option>
              {catalog.map((ticket) => (
                <option key={ticket.id} value={ticket.id}>{ticket.title}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'end', gap: '18px', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', fontWeight: 600 }}>
              <input type="checkbox" checked={announcementPaidOnly} onChange={(e) => setAnnouncementPaidOnly(e.target.checked)} />
              Payés uniquement
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#334155', fontWeight: 600 }}>
              <input type="checkbox" checked={announcementVerifiedOnly} onChange={(e) => setAnnouncementVerifiedOnly(e.target.checked)} />
              Profils vérifiés uniquement
            </label>
          </div>
          <div style={{ gridColumn: '1 / -1' }}>
            <label style={labelStyle}>Message spécial</label>
            <textarea style={{ ...inputStyle, minHeight: '100px' }} value={announcementNote} onChange={(e) => setAnnouncementNote(e.target.value)} placeholder="Ex : le programme final est disponible, merci de consulter les nouvelles salles et horaires." />
          </div>
        </div>
        <div style={{ marginTop: '14px', display: 'flex', justifyContent: 'flex-end', gap: '10px', flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setShowAnnouncementPreview(true)} style={buttonSecondary}>
            Prévisualiser le mail
          </button>
          <button type="button" onClick={handleSendAnnouncement} disabled={sendingAnnouncement} style={buttonPrimary}>
            {sendingAnnouncement ? 'Envoi…' : 'Envoyer l’annonce spéciale'}
          </button>
        </div>
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '320px minmax(0, 1fr)', gap: '20px', alignItems: 'start' }}>
        <aside style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '18px', position: 'sticky', top: '18px' }}>
          {Object.entries(grouped).map(([category, definitions]) => (
            <div key={category} style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '8px' }}>
                {EMAIL_TEMPLATE_CATEGORY_LABELS[category as EmailTemplateCategory]}
              </div>
              <div style={{ display: 'grid', gap: '8px' }}>
                {definitions.map((definition) => {
                  const active = definition.key === selectedKey;
                  const enabled = templates[definition.key].enabled;
                  return (
                    <button
                      key={definition.key}
                      type="button"
                      onClick={() => setSelectedKey(definition.key)}
                      style={{
                        textAlign: 'left',
                        padding: '10px 12px',
                        borderRadius: '10px',
                        border: `1px solid ${active ? '#93c5fd' : '#e2e8f0'}`,
                        background: active ? '#E8F5EC' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', alignItems: 'center' }}>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{definition.label}</strong>
                        <span style={{ fontSize: '11px', fontWeight: 700, color: enabled ? '#166534' : '#b91c1c' }}>
                          {enabled ? 'Actif' : 'Off'}
                        </span>
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', lineHeight: 1.45 }}>{definition.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </aside>

        <div style={{ display: 'grid', gap: '18px' }}>
          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>{selectedDefinition.label}</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>{selectedDefinition.description}</p>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#334155', fontSize: '13px', fontWeight: 600 }}>
                <input type="checkbox" checked={selectedTemplate.enabled} onChange={(e) => updateField('enabled', e.target.checked)} />
                Modèle actif
              </label>
            </div>

            <div style={{ display: 'grid', gap: '14px' }}>
              <div>
                <label style={labelStyle}>Objet du mail</label>
                <input style={inputStyle} value={selectedTemplate.subject} onChange={(e) => updateField('subject', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Titre dans le mail</label>
                <input style={inputStyle} value={selectedTemplate.title} onChange={(e) => updateField('title', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Corps du message</label>
                <textarea style={{ ...inputStyle, minHeight: '180px' }} value={selectedTemplate.body} onChange={(e) => updateField('body', e.target.value)} />
              </div>
              <div>
                <label style={labelStyle}>Texte du bouton</label>
                <input style={inputStyle} value={selectedTemplate.ctaLabel} onChange={(e) => updateField('ctaLabel', e.target.value)} />
              </div>
            </div>
          </section>

          <section style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 380px)', gap: '18px' }}>
            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#0f172a' }}>Variables disponibles</h3>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {selectedDefinition.variables.map((variable) => (
                  <span key={variable} style={{ fontSize: '12px', fontWeight: 700, color: '#145224', background: '#E8F5EC', border: '1px solid #B7DFC0', borderRadius: '999px', padding: '6px 10px' }}>
                    {`{{${variable}}}`}
                  </span>
                ))}
              </div>
              <div style={{ marginTop: '16px', fontSize: '13px', color: '#475569', lineHeight: 1.6 }}>
                <strong>Exemples injectés dans l’aperçu :</strong>
                <div style={{ marginTop: '8px', display: 'grid', gap: '6px' }}>
                  {Object.entries(sampleVars).map(([key, value]) => (
                    <div key={key}>
                      <code>{`{{${key}}}`}</code> → {value || '—'}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
              <h3 style={{ margin: '0 0 10px', fontSize: '16px', color: '#0f172a' }}>Aperçu texte</h3>
              <p style={{ margin: '0 0 12px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
                Résumé technique pour vérifier le contenu. L’URL ci-dessous n’apparaît pas en clair dans le mail reçu : le destinataire voit un bouton cliquable.
              </p>
              <div style={{ display: 'grid', gap: '10px', fontSize: '13px' }}>
                <div><strong>Objet :</strong> {preview.subject}</div>
                <div><strong>Titre :</strong> {preview.title}</div>
                <div>
                  <strong>Corps :</strong>
                  <div style={{ marginTop: '6px', whiteSpace: 'pre-wrap', color: '#475569', lineHeight: 1.6 }}>{preview.body}</div>
                </div>
                <div><strong>Libellé du bouton :</strong> {preview.ctaLabel || '—'}</div>
                <div style={{ marginTop: '8px' }}>
                  <strong>Destination (interne) :</strong>{' '}
                  <code style={{ fontSize: '12px', color: '#166534' }}>{previewCtaPath}</code>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  URL complète : {previewCtaUrl}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '8px' }}>
                  Page cible : {EMAIL_TEMPLATE_LINK_LABELS[selectedKey]}
                </div>
              </div>
            </div>
          </section>

          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'flex-start', flexWrap: 'wrap', marginBottom: '12px' }}>
              <div>
                <h3 style={{ margin: '0 0 4px', fontSize: '16px', color: '#0f172a' }}>Aperçu HTML (rendu réel)</h3>
                <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                  C’est exactement ce que le destinataire reçoit : un bouton sombre cliquable, pas une URL écrite en texte.
                </p>
              </div>
            </div>
            <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', background: '#f8fafc' }}>
              <iframe
                title="Aperçu HTML du modèle"
                srcDoc={templatePreviewHtml}
                style={{ width: '100%', height: '520px', border: 'none', background: '#fff' }}
              />
            </div>
          </section>

          <section style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '22px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a' }}>Historique récent</h3>
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <select style={{ ...inputStyle, width: '190px' }} value={historyKindFilter} onChange={(e) => setHistoryKindFilter(e.target.value as 'all' | EmailCampaignLog['campaign_kind'])}>
                  <option value="all">Tous les types</option>
                  <option value="broadcast">Campagnes</option>
                  <option value="test">Tests</option>
                  <option value="account">Cycle de compte</option>
                </select>
                <select style={{ ...inputStyle, width: '230px' }} value={historyTemplateFilter} onChange={(e) => setHistoryTemplateFilter(e.target.value)}>
                  <option value="all">Tous les modèles</option>
                  {Array.from(new Set(history.map((log) => log.template_key))).map((templateKey) => (
                    <option key={templateKey} value={templateKey}>{templateKey}</option>
                  ))}
                </select>
                <input
                  type="date"
                  style={{ ...inputStyle, width: '160px' }}
                  value={historyDateFrom}
                  onChange={(e) => setHistoryDateFrom(e.target.value)}
                />
                <input
                  type="date"
                  style={{ ...inputStyle, width: '160px' }}
                  value={historyDateTo}
                  onChange={(e) => setHistoryDateTo(e.target.value)}
                />
              </div>
            </div>
            {filteredHistory.length === 0 ? (
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '13px' }}>Aucun envoi enregistré pour le moment.</p>
            ) : (
              <div style={{ display: 'grid', gap: '10px' }}>
                {filteredHistory.map((log) => (
                  <div key={log.id} style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', background: '#fafafa' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div>
                        <strong style={{ fontSize: '13px', color: '#0f172a' }}>{log.template_key}</strong>
                        <span style={{ marginLeft: '8px', fontSize: '11px', color: '#64748b', fontWeight: 700 }}>{log.campaign_kind}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                        <div style={{ fontSize: '12px', color: '#64748b' }}>
                          {new Date(log.created_at).toLocaleString('fr-FR')}
                        </div>
                        <button
                          type="button"
                          onClick={() => setSelectedHistoryLog(log)}
                          style={{ ...buttonSecondary, padding: '6px 10px', fontSize: '12px', background: '#fff' }}
                        >
                          Détail
                        </button>
                        {log.campaign_kind === 'broadcast' && log.template_key === 'special_announcement' && (
                          <button
                            type="button"
                            onClick={() => loadCampaignIntoAnnouncementForm(log)}
                            style={{ ...buttonSecondary, padding: '6px 10px', fontSize: '12px', background: '#fff' }}
                          >
                            Charger
                          </button>
                        )}
                        {log.campaign_kind === 'broadcast' && (
                          <button
                            type="button"
                            onClick={() => handleResendCampaign(log)}
                            disabled={resendingLogId === log.id}
                            style={{ ...buttonSecondary, padding: '6px 10px', fontSize: '12px', background: '#fff' }}
                          >
                            {resendingLogId === log.id ? 'Renvoi…' : 'Renvoyer'}
                          </button>
                        )}
                      </div>
                    </div>
                    <div style={{ marginTop: '6px', fontSize: '12px', color: '#475569', lineHeight: 1.6 }}>
                      Audience: {log.audience_label || '—'} · Destinataires: {log.recipient_count} · Envoyés: {log.sent_count} · Échecs: {log.failed_count}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>

      {showAnnouncementPreview && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, padding: '20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '920px', margin: '24px auto', background: '#fff', borderRadius: '18px', padding: '24px', boxShadow: '0 18px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>Prévisualisation HTML complète</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                  Aperçu du rendu réel de l’annonce spéciale avant envoi.
                </p>
              </div>
              <button type="button" onClick={() => setShowAnnouncementPreview(false)} style={buttonSecondary}>
                Fermer
              </button>
            </div>

            <div style={{ display: 'grid', gap: '10px', marginBottom: '14px', fontSize: '13px', color: '#334155' }}>
              <div><strong>Objet :</strong> {announcementPreview.subject}</div>
              <div><strong>Audience :</strong> {announcementAudience}</div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', background: '#f8fafc' }}>
              <iframe
                title="Aperçu HTML annonce spéciale"
                srcDoc={announcementPreviewHtml}
                style={{ width: '100%', height: '640px', border: 'none', background: '#fff' }}
              />
            </div>
          </div>
        </div>
      )}

      {selectedHistoryLog && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.55)', zIndex: 10000, padding: '20px', overflowY: 'auto' }}>
          <div style={{ maxWidth: '860px', margin: '24px auto', background: '#fff', borderRadius: '18px', padding: '24px', boxShadow: '0 18px 40px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '14px' }}>
              <div>
                <h2 style={{ margin: '0 0 4px', fontSize: '18px', color: '#0f172a' }}>Détail de campagne</h2>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>
                  {selectedHistoryLog.template_key} · {selectedHistoryLog.campaign_kind}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedHistoryLog(null)} style={buttonSecondary}>
                Fermer
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px', fontSize: '13px', color: '#334155' }}>
              <div><strong>Date :</strong> {new Date(selectedHistoryLog.created_at).toLocaleString('fr-FR')}</div>
              <div><strong>Audience :</strong> {selectedHistoryLog.audience_label || '—'}</div>
              <div><strong>Résultat :</strong> {selectedHistoryLog.sent_count} envoyé(s), {selectedHistoryLog.failed_count} échec(s), {selectedHistoryLog.recipient_count} destinataire(s)</div>
            </div>

            {historyDetailPreview ? (
              <div style={{ marginTop: '18px' }}>
                <div style={{ display: 'grid', gap: '8px', marginBottom: '12px', fontSize: '13px', color: '#334155' }}>
                  <div><strong>Objet :</strong> {historyDetailPreview.subject}</div>
                  <div><strong>Titre :</strong> {historyDetailPreview.title}</div>
                </div>
                <div style={{ border: '1px solid #e2e8f0', borderRadius: '14px', overflow: 'hidden', background: '#f8fafc' }}>
                  <iframe
                    title="Aperçu HTML campagne historique"
                    srcDoc={historyDetailPreview.html}
                    style={{ width: '100%', height: '520px', border: 'none', background: '#fff' }}
                  />
                </div>
              </div>
            ) : (
              <p style={{ marginTop: '18px', fontSize: '13px', color: '#94a3b8' }}>
                Aperçu HTML indisponible pour ce type de campagne.
              </p>
            )}

            <div style={{ marginTop: '18px', fontSize: '13px', color: '#334155' }}>
              <strong>Métadonnées :</strong>
              <pre style={{ marginTop: '8px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: '12px', color: '#475569' }}>
{JSON.stringify(selectedHistoryLog.metadata ?? {}, null, 2)}
              </pre>
            </div>

            {selectedHistoryLog.campaign_kind === 'broadcast' && selectedHistoryLog.template_key === 'special_announcement' && (
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '18px' }}>
                <button
                  type="button"
                  onClick={() => {
                    loadCampaignIntoAnnouncementForm(selectedHistoryLog);
                    setSelectedHistoryLog(null);
                  }}
                  style={buttonPrimary}
                >
                  Charger dans le formulaire
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: '12px',
  fontWeight: 700,
  color: '#475569',
  marginBottom: '6px',
  display: 'block',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '13px',
  boxSizing: 'border-box',
};

const buttonPrimary: React.CSSProperties = {
  background: '#0f172a',
  color: '#fff',
  border: 'none',
  padding: '10px 18px',
  borderRadius: '8px',
  fontWeight: 700,
  cursor: 'pointer',
};

const buttonSecondary: React.CSSProperties = {
  background: 'transparent',
  color: '#475569',
  border: '1px solid #cbd5e1',
  padding: '10px 16px',
  borderRadius: '8px',
  fontWeight: 700,
  cursor: 'pointer',
};
