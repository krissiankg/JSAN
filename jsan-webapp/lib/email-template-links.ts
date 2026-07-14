import type { EmailTemplateKey } from '@/lib/email-templates';

export interface ResolveEmailLinkInput {
  templateKey: EmailTemplateKey;
  variables?: Record<string, string | null | undefined>;
  /** Lien explicite passé par l’appelant (prioritaire). */
  overrideLink?: string | null;
}

const DEFAULT_TEMPLATE_PATHS: Record<EmailTemplateKey, string> = {
  account_registration: '/dashboard',
  account_welcome: '/dashboard',
  account_email_confirmation: '/login',
  abstract_submitted: '/dashboard/mes-resumes',
  abstract_accepted: '/dashboard/mes-resumes',
  abstract_revision_requested: '/dashboard/mes-resumes',
  abstract_rejected: '/dashboard/mes-resumes',
  manuscript_submitted: '/dashboard/articles-complets',
  manuscript_accepted: '/dashboard/articles-complets',
  manuscript_revision_requested: '/dashboard/articles-complets',
  manuscript_rejected: '/dashboard/articles-complets',
  reviewer_application_received: '/dashboard',
  reviewer_application_approved: '/dashboard/resumes-a-evaluer',
  reviewer_application_rejected: '/dashboard',
  reviewer_assignment: '/dashboard/resumes-a-evaluer',
  reviewer_reminder: '/dashboard/resumes-a-evaluer',
  special_announcement: '/dashboard/programme',
  program_published: '/dashboard/programme',
  program_updated: '/dashboard/programme',
  session_reminder: '/dashboard/programme',
  payment_pending: '/dashboard/billetterie',
  payment_confirmed: '/dashboard/billetterie',
  payment_failed: '/dashboard/billetterie',
  student_document_approved: '/dashboard/billetterie',
  student_document_rejected: '/dashboard/profil',
  member_document_approved: '/dashboard/billetterie',
  member_document_rejected: '/dashboard/profil',
  attestation_available: '/dashboard/attestations',
  blog_post_published: '/blog',
  newsletter_campaign: '/blog',
};

export const EMAIL_TEMPLATE_LINK_LABELS: Record<EmailTemplateKey, string> = {
  account_registration: 'Tableau de bord',
  account_welcome: 'Tableau de bord',
  account_email_confirmation: 'Page de connexion',
  abstract_submitted: 'Mes résumés',
  abstract_accepted: 'Mes résumés',
  abstract_revision_requested: 'Détail du résumé (si fourni à l’envoi)',
  abstract_rejected: 'Mes résumés',
  manuscript_submitted: 'Articles complets',
  manuscript_accepted: 'Articles complets',
  manuscript_revision_requested: 'Articles complets',
  manuscript_rejected: 'Articles complets',
  reviewer_application_received: 'Tableau de bord',
  reviewer_application_approved: 'Résumés à évaluer',
  reviewer_application_rejected: 'Tableau de bord',
  reviewer_assignment: 'Évaluations (résumé ou manuscrit)',
  reviewer_reminder: 'Évaluations',
  special_announcement: 'Configurable (défaut : programme)',
  program_published: 'Programme',
  program_updated: 'Programme',
  session_reminder: 'Programme',
  payment_pending: 'Lien Kkiapay ou billetterie',
  payment_confirmed: 'Billetterie',
  payment_failed: 'Billetterie / paiement',
  student_document_approved: 'Billetterie',
  student_document_rejected: 'Profil',
  member_document_approved: 'Billetterie',
  member_document_rejected: 'Profil',
  attestation_available: 'Attestations',
  blog_post_published: 'Article du blog',
  newsletter_campaign: 'Configurable',
};

function normalizePath(path: string): string {
  const trimmed = path.trim();
  if (!trimmed) return '/dashboard';
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function resolveEmailTemplateLink(input: ResolveEmailLinkInput): string {
  if (input.overrideLink?.trim()) {
    return normalizePath(input.overrideLink);
  }

  const vars = input.variables ?? {};

  if (input.templateKey === 'payment_pending' || input.templateKey === 'payment_failed') {
    const paymentLink = vars.lien_paiement?.trim();
    if (paymentLink) return normalizePath(paymentLink);
  }

  if (input.templateKey === 'attestation_available') {
    const attestationLink = vars.lien_attestation?.trim();
    if (attestationLink) return normalizePath(attestationLink);
  }

  if (input.templateKey === 'blog_post_published') {
    const articleLink = vars.lien_article?.trim();
    if (articleLink) return normalizePath(articleLink);
  }

  return DEFAULT_TEMPLATE_PATHS[input.templateKey] ?? '/dashboard';
}

export function resolveEmailCtaUrl(
  baseUrl: string,
  input: ResolveEmailLinkInput
): string {
  const path = resolveEmailTemplateLink(input);
  if (path.startsWith('http://') || path.startsWith('https://')) return path;

  const base = baseUrl.replace(/\/$/, '');
  return `${base}${path}`;
}

export function previewEmailCtaUrl(
  input: ResolveEmailLinkInput,
  sampleBase = 'https://snb-jsan.bj'
): string {
  return resolveEmailCtaUrl(sampleBase, input);
}
