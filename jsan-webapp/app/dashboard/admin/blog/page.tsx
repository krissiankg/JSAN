"use client";

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../AuthContext';
import { createClient } from '@/lib/supabase/client';
import { isEventStaff } from '@/lib/roles';
import {
  type BlogPost,
  type BlogPostInput,
  type BlogPostStatus,
  createBlogPost,
  fetchAllBlogPosts,
  formatBlogDate,
  updateBlogPost,
} from '@/lib/blog';
import { fetchNewsletterSubscriberStats } from '@/lib/newsletter';

const EMPTY_FORM: BlogPostInput = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  cover_image_url: '',
  status: 'draft',
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: '12px',
  padding: '24px',
  boxShadow: '0 4px 6px -1px rgba(0,0,0,0.08)',
  border: '1px solid #e2e8f0',
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid #cbd5e1',
  fontSize: '14px',
};

export default function AdminBlogPage() {
  const { user, userRole } = useAuth();
  const supabase = useMemo(() => createClient(), []);
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [stats, setStats] = useState({ active: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<BlogPostInput>(EMPTY_FORM);
  const [notifyOnPublish, setNotifyOnPublish] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignLink, setCampaignLink] = useState('/blog');
  const [sendingCampaign, setSendingCampaign] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [allPosts, subscriberStats] = await Promise.all([
      fetchAllBlogPosts(supabase).catch(() => []),
      fetchNewsletterSubscriberStats(supabase).catch(() => ({ active: 0, total: 0 })),
    ]);
    setPosts(allPosts);
    setStats(subscriberStats);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    if (isEventStaff(userRole)) void load();
  }, [userRole, load]);

  if (!isEventStaff(userRole)) {
    return (
      <div style={{ padding: '40px', textAlign: 'center' }}>
        <h2 style={{ color: '#ef4444' }}>Accès Interdit</h2>
        <p style={{ color: '#64748b' }}>Réservé aux organisateurs.</p>
      </div>
    );
  }

  const openNew = () => {
    setEditingId('new');
    setForm(EMPTY_FORM);
    setNotifyOnPublish(true);
    setMessage(null);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt ?? '',
      content: post.content,
      cover_image_url: post.cover_image_url ?? '',
      status: post.status,
    });
    setNotifyOnPublish(false);
    setMessage(null);
  };

  const notifySubscribers = async (postId: string) => {
    setNotifying(true);
    const res = await fetch('/api/blog/notify-subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ postId }),
    });
    const data = await res.json();
    setNotifying(false);
    if (!res.ok || data.skipped) {
      setMessage({
        type: 'error',
        text: data.reason === 'email_not_configured'
          ? 'E-mails non configurés (Resend).'
          : data.error || 'Notification newsletter impossible.',
      });
      return false;
    }
    setMessage({
      type: 'success',
      text: `Newsletter envoyée : ${data.sent}/${data.recipientCount} abonné(s).`,
    });
    return true;
  };

  const handleSave = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      setMessage({ type: 'error', text: 'Titre et contenu requis.' });
      return;
    }

    setSaving(true);
    setMessage(null);

    const result =
      editingId === 'new'
        ? await createBlogPost(supabase, form, user?.id ?? null)
        : editingId
          ? await updateBlogPost(supabase, editingId, form)
          : { post: null, error: 'Aucun article sélectionné.' };

    setSaving(false);

    if (result.error || !result.post) {
      setMessage({ type: 'error', text: result.error ?? 'Enregistrement impossible.' });
      return;
    }

    const shouldNotify =
      notifyOnPublish &&
      form.status === 'published' &&
      !result.post.newsletter_sent_at;

    let notifyText = '';
    if (shouldNotify && form.status === 'published') {
      const notified = await notifySubscribers(result.post.id);
      if (notified) notifyText = ' Les abonnés ont été notifiés.';
    }

    setMessage({
      type: 'success',
      text: `Article enregistré.${notifyText}`,
    });
    setEditingId(null);
    await load();
  };

  const handleManualNotify = async (postId: string) => {
    setNotifying(true);
    await notifySubscribers(postId);
    setNotifying(false);
    await load();
  };

  const handleCampaign = async () => {
    if (!campaignMessage.trim()) {
      setMessage({ type: 'error', text: 'Message de campagne requis.' });
      return;
    }
    if (!confirm(`Envoyer cette campagne à ${stats.active} abonné(s) actifs ?`)) return;

    setSendingCampaign(true);
    setMessage(null);
    const res = await fetch('/api/notify/newsletter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: campaignMessage, link: campaignLink }),
    });
    const data = await res.json();
    setSendingCampaign(false);

    if (!res.ok || data.skipped) {
      setMessage({
        type: 'error',
        text: data.reason === 'email_not_configured'
          ? 'E-mails non configurés (Resend).'
          : data.error || 'Campagne impossible.',
      });
      return;
    }

    setCampaignMessage('');
    setMessage({
      type: 'success',
      text: `Campagne envoyée : ${data.sent}/${data.recipientCount} abonné(s).`,
    });
    await load();
  };

  if (loading) {
    return <div style={{ padding: '30px', color: '#64748b' }}>Chargement…</div>;
  }

  return (
    <div style={{ padding: '30px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: '0 0 8px', fontSize: '1.5rem' }}>Blog & Newsletter</h1>
          <p style={{ margin: 0, color: '#64748b' }}>
            {stats.active} abonné(s) actifs · {stats.total} inscription(s) au total ·{' '}
            <Link href="/blog" target="_blank" style={{ color: '#166534' }}>Voir le blog public</Link>
          </p>
        </div>
        <button
          type="button"
          onClick={openNew}
          style={{
            border: 'none',
            borderRadius: '8px',
            background: '#166534',
            color: '#fff',
            padding: '10px 16px',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Nouvel article
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '12px 16px',
            borderRadius: '8px',
            background: message.type === 'success' ? '#dcfce7' : '#fef2f2',
            color: message.type === 'success' ? '#166534' : '#b91c1c',
            border: `1px solid ${message.type === 'success' ? '#86efac' : '#fca5a5'}`,
          }}
        >
          {message.text}
        </div>
      )}

      {editingId && (
        <div style={cardStyle}>
          <h2 style={{ marginTop: 0 }}>{editingId === 'new' ? 'Nouvel article' : 'Modifier l’article'}</h2>
          <div style={{ display: 'grid', gap: '14px' }}>
            <input
              style={inputStyle}
              placeholder="Titre"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            />
            <input
              style={inputStyle}
              placeholder="Slug (optionnel)"
              value={form.slug}
              onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
            />
            <input
              style={inputStyle}
              placeholder="URL image de couverture (optionnel)"
              value={form.cover_image_url ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, cover_image_url: e.target.value }))}
            />
            <textarea
              style={{ ...inputStyle, minHeight: '80px', resize: 'vertical' }}
              placeholder="Résumé court (affiché dans la liste et l’e-mail)"
              value={form.excerpt}
              onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
            />
            <textarea
              style={{ ...inputStyle, minHeight: '220px', resize: 'vertical' }}
              placeholder="Contenu (paragraphes séparés par une ligne vide)"
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
            />
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <label style={{ fontSize: '14px' }}>
                Statut{' '}
                <select
                  style={{ ...inputStyle, width: 'auto', marginLeft: '8px' }}
                  value={form.status}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BlogPostStatus }))}
                >
                  <option value="draft">Brouillon</option>
                  <option value="published">Publié</option>
                  <option value="archived">Archivé</option>
                </select>
              </label>
              {form.status === 'published' && (
                <label style={{ fontSize: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={notifyOnPublish}
                    onChange={(e) => setNotifyOnPublish(e.target.checked)}
                  />
                  Notifier les abonnés newsletter
                </label>
              )}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                disabled={saving || notifying}
                onClick={handleSave}
                style={{
                  border: 'none',
                  borderRadius: '8px',
                  background: '#111827',
                  color: '#fff',
                  padding: '10px 16px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {saving || notifying ? '…' : 'Enregistrer'}
              </button>
              <button type="button" onClick={() => setEditingId(null)} style={{ ...inputStyle, width: 'auto' }}>
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Campagne newsletter</h2>
        <p style={{ color: '#64748b', fontSize: '14px', marginTop: 0 }}>
          Envoi manuel à tous les abonnés actifs (distinct de la publication d’un article).
        </p>
        <textarea
          style={{ ...inputStyle, minHeight: '120px', resize: 'vertical', marginBottom: '12px' }}
          placeholder="Message de la campagne…"
          value={campaignMessage}
          onChange={(e) => setCampaignMessage(e.target.value)}
        />
        <input
          style={{ ...inputStyle, marginBottom: '12px' }}
          placeholder="Lien du bouton (ex. /blog ou /dashboard/programme)"
          value={campaignLink}
          onChange={(e) => setCampaignLink(e.target.value)}
        />
        <button
          type="button"
          disabled={sendingCampaign || stats.active === 0}
          onClick={handleCampaign}
          style={{
            border: 'none',
            borderRadius: '8px',
            background: '#166534',
            color: '#fff',
            padding: '10px 16px',
            fontWeight: 600,
            cursor: stats.active === 0 ? 'not-allowed' : 'pointer',
            opacity: stats.active === 0 ? 0.6 : 1,
          }}
        >
          {sendingCampaign ? 'Envoi…' : `Envoyer à ${stats.active} abonné(s)`}
        </button>
      </div>

      <div style={cardStyle}>
        <h2 style={{ marginTop: 0 }}>Articles</h2>
        {posts.length === 0 ? (
          <p style={{ color: '#64748b' }}>Aucun article pour le moment.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {posts.map((post) => (
              <div
                key={post.id}
                style={{
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  padding: '14px 16px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontWeight: 700 }}>{post.title}</div>
                  <div style={{ fontSize: '13px', color: '#64748b', marginTop: '4px' }}>
                    {post.status} · {formatBlogDate(post.published_at || post.updated_at)}
                    {post.newsletter_sent_at ? ' · newsletter envoyée' : ''}
                  </div>
                  {post.status === 'published' && (
                    <Link href={`/blog/${post.slug}`} target="_blank" style={{ fontSize: '13px', color: '#166534' }}>
                      /blog/{post.slug}
                    </Link>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <button type="button" onClick={() => openEdit(post)} style={{ ...inputStyle, width: 'auto' }}>
                    Modifier
                  </button>
                  {post.status === 'published' && !post.newsletter_sent_at && (
                    <button
                      type="button"
                      disabled={notifying}
                      onClick={() => handleManualNotify(post.id)}
                      style={{ ...inputStyle, width: 'auto' }}
                    >
                      Notifier
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
