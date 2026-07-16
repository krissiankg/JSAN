import type { SupabaseClient } from '@supabase/supabase-js';
import type { EmailTemplateKey } from '@/lib/email-templates';
import type { NotificationPreferences } from '@/lib/roles';

export type NotificationType = 'evenement' | 'billetterie' | 'messagerie' | 'soumission' | 'system';

export interface UserNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

const TYPE_TO_APP_PREF: Record<NotificationType, keyof NotificationPreferences | null> = {
  evenement: 'app_evenement',
  billetterie: 'app_billetterie',
  messagerie: 'app_messagerie',
  soumission: 'app_soumissions',
  system: null,
};

export function filterNotificationsByAppPrefs(
  notifications: UserNotification[],
  prefs: NotificationPreferences
): UserNotification[] {
  return notifications.filter((n) => {
    const prefKey = TYPE_TO_APP_PREF[n.type];
    if (!prefKey) return true;
    return prefs[prefKey] !== false;
  });
}

export function notificationTypeIcon(type: NotificationType): string {
  switch (type) {
    case 'evenement':
      return '📅';
    case 'billetterie':
      return '🎟️';
    case 'messagerie':
      return '✉️';
    case 'soumission':
      return '📄';
    default:
      return '🔔';
  }
}

export function formatRelativeTime(isoDate: string): string {
  const date = new Date(isoDate);
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return "À l'instant";
  if (diffMin < 60) return `Il y a ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `Il y a ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `Il y a ${diffDays} j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

export interface CreateNotificationInput {
  userId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  link?: string | null;
  templateKey?: EmailTemplateKey;
  templateVariables?: Record<string, string | null | undefined>;
}

function truncateTitle(titre: string, max = 64): string {
  const t = titre.trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}

/** Insère une notification (RLS : compte staff requis). Les échecs n'interrompent pas le flux métier. */
export async function createNotification(
  supabase: SupabaseClient,
  input: CreateNotificationInput
): Promise<void> {
  const { error } = await supabase.from('user_notifications').insert({
    user_id: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    link: input.link ?? null,
  });
  if (error && process.env.NODE_ENV === 'development') {
    console.warn('[createNotification]', error.message);
  }

  // Notification e-mail (fire-and-forget). Côté serveur, le fetch relatif n'a pas
  // de contexte d'origine → on ne déclenche l'e-mail que depuis le navigateur.
  // La route vérifie elle-même les droits, les préférences et la configuration.
  if (typeof window !== 'undefined') {
    void fetch('/api/notify/email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        link: input.link ?? null,
        templateKey: input.templateKey,
        variables: input.templateVariables ?? {},
      }),
    }).catch(() => {
      /* silencieux : l'e-mail est secondaire par rapport à l'in-app */
    });
  }
}

export async function notifyAbstractDecision(
  supabase: SupabaseClient,
  authorId: string,
  abstractId: string,
  titre: string,
  decision: 'Accepte' | 'A_Reviser' | 'Rejete'
): Promise<void> {
  const short = truncateTitle(titre);
  let title: string;
  let body: string;

  switch (decision) {
    case 'Accepte':
      title = 'Résumé accepté';
      body = `Votre résumé « ${short} » a été accepté par le comité scientifique.`;
      break;
    case 'A_Reviser':
      title = 'Révisions demandées';
      body = `Des révisions sont demandées sur votre résumé « ${short} ». Consultez les retours des évaluateurs.`;
      break;
    case 'Rejete':
      title = 'Résumé non retenu';
      body = `Votre résumé « ${short} » n'a pas été retenu par le comité scientifique.`;
      break;
  }

  await createNotification(supabase, {
    userId: authorId,
    type: 'soumission',
    title,
    body,
    link: `/dashboard/mes-resumes/${abstractId}`,
    templateKey:
      decision === 'Accepte'
        ? 'abstract_accepted'
        : decision === 'A_Reviser'
          ? 'abstract_revision_requested'
          : 'abstract_rejected',
    templateVariables: {
      titre_resume: short,
    },
  });
}

export async function notifyManuscriptDecision(
  supabase: SupabaseClient,
  authorId: string,
  titre: string,
  decision: 'Accepte' | 'Rejete' | 'Soumis'
): Promise<void> {
  const short = truncateTitle(titre);
  let title: string;
  let body: string;

  switch (decision) {
    case 'Accepte':
      title = 'Manuscrit accepté';
      body = `Votre manuscrit « ${short} » a été accepté pour publication.`;
      break;
    case 'Rejete':
      title = 'Manuscrit non retenu';
      body = `Votre manuscrit « ${short} » n'a pas été retenu pour publication.`;
      break;
    case 'Soumis':
      title = 'Corrections demandées';
      body = `Des corrections sont demandées sur votre manuscrit « ${short} ».`;
      break;
  }

  await createNotification(supabase, {
    userId: authorId,
    type: 'soumission',
    title,
    body,
    link: '/dashboard/articles-complets',
    templateKey:
      decision === 'Accepte'
        ? 'manuscript_accepted'
        : decision === 'Soumis'
          ? 'manuscript_revision_requested'
          : 'manuscript_rejected',
    templateVariables: {
      titre_manuscrit: short,
    },
  });
}

async function reviewerAssignmentLink(
  supabase: SupabaseClient,
  abstractId: string
): Promise<string> {
  const { data } = await supabase
    .from('full_articles')
    .select('id')
    .eq('abstract_id', abstractId)
    .neq('statut', 'Brouillon')
    .maybeSingle();

  return data ? '/dashboard/articles-a-evaluer' : '/dashboard/resumes-a-evaluer';
}

export async function notifyReviewerAssignment(
  supabase: SupabaseClient,
  reviewerId: string,
  abstractId: string,
  titre: string
): Promise<void> {
  const short = truncateTitle(titre);
  const link = await reviewerAssignmentLink(supabase, abstractId);
  const isManuscript = link.includes('articles');

  await createNotification(supabase, {
    userId: reviewerId,
    type: 'soumission',
    title: 'Nouvelle évaluation assignée',
    body: isManuscript
      ? `Vous avez été assigné pour évaluer le manuscrit lié à « ${short} ».`
      : `Vous avez été assigné pour évaluer le résumé « ${short} ».`,
    link,
    templateKey: 'reviewer_assignment',
    templateVariables: {
      titre_resume: short,
      titre_manuscrit: short,
    },
  });
}

export async function notifyJustificatifApproved(
  supabase: SupabaseClient,
  userId: string,
  documentType: 'etudiant' | 'membre'
): Promise<void> {
  const label = documentType === 'etudiant' ? 'justificatif étudiant' : 'justificatif membre SNB';

  await createNotification(supabase, {
    userId,
    type: 'billetterie',
    title: 'Justificatif validé',
    body: `Votre ${label} a été validé. Les tarifs réduits sont désormais disponibles à la billetterie.`,
    link: '/dashboard/billetterie',
    templateKey: documentType === 'etudiant' ? 'student_document_approved' : 'member_document_approved',
  });
}

export async function notifyJustificatifRejected(
  supabase: SupabaseClient,
  userId: string,
  documentType: 'etudiant' | 'membre'
): Promise<void> {
  const label = documentType === 'etudiant' ? 'justificatif étudiant' : 'justificatif membre SNB';

  await createNotification(supabase, {
    userId,
    type: 'billetterie',
    title: 'Justificatif refusé',
    body: `Votre ${label} n'a pas été accepté. Vous pouvez en soumettre un nouveau depuis votre profil.`,
    link: '/dashboard/profil',
    templateKey: documentType === 'etudiant' ? 'student_document_rejected' : 'member_document_rejected',
  });
}

export async function notifyEvaluatorApproved(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await createNotification(supabase, {
    userId,
    type: 'soumission',
    title: 'Candidature évaluateur validée',
    body: 'Votre candidature comme évaluateur a été acceptée. Vous pouvez consulter les soumissions à évaluer.',
    link: '/dashboard/resumes-a-evaluer',
    templateKey: 'reviewer_application_approved',
  });
}

export async function notifyEvaluatorRejected(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await createNotification(supabase, {
    userId,
    type: 'soumission',
    title: 'Candidature évaluateur non retenue',
    body: 'Votre candidature comme évaluateur n’a pas été retenue pour cette édition des JSAN.',
    link: '/dashboard',
    templateKey: 'reviewer_application_rejected',
  });
}

export async function notifyAbstractSubmitted(
  supabase: SupabaseClient,
  authorId: string,
  abstractId: string,
  titre: string
): Promise<void> {
  const short = truncateTitle(titre);
  await createNotification(supabase, {
    userId: authorId,
    type: 'soumission',
    title: 'Résumé soumis',
    body: `Votre résumé « ${short} » a bien été reçu par le comité scientifique.`,
    link: `/dashboard/mes-resumes/${abstractId}`,
    templateKey: 'abstract_submitted',
    templateVariables: { titre_resume: short },
  });
}

export async function notifyManuscriptSubmitted(
  supabase: SupabaseClient,
  authorId: string,
  titre: string
): Promise<void> {
  const short = truncateTitle(titre);
  await createNotification(supabase, {
    userId: authorId,
    type: 'soumission',
    title: 'Manuscrit soumis',
    body: `Votre manuscrit « ${short} » a bien été reçu.`,
    link: '/dashboard/articles-complets',
    templateKey: 'manuscript_submitted',
    templateVariables: { titre_manuscrit: short },
  });
}

export async function notifyReviewerApplicationReceived(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await createNotification(supabase, {
    userId,
    type: 'soumission',
    title: 'Candidature évaluateur reçue',
    body: 'Votre candidature pour rejoindre le comité de lecture JSAN a bien été reçue.',
    link: '/dashboard',
    templateKey: 'reviewer_application_received',
  });
}

export async function notifyPaymentPending(
  supabase: SupabaseClient,
  userId: string,
  input: { typeBillet: string; montant: number | null; paymentLink?: string | null }
): Promise<void> {
  const montant =
    input.montant != null ? `${Number(input.montant).toLocaleString('fr-FR')} FCFA` : '';
  await createNotification(supabase, {
    userId,
    type: 'billetterie',
    title: 'Paiement en attente',
    body: `Votre demande pour « ${input.typeBillet} » est en attente de confirmation.`,
    link: input.paymentLink ?? '/dashboard/billetterie',
    templateKey: 'payment_pending',
    templateVariables: {
      type_billet: input.typeBillet,
      montant,
      lien_paiement: input.paymentLink ?? '',
    },
  });
}

export async function notifyPaymentConfirmed(
  supabase: SupabaseClient,
  userId: string,
  input: { typeBillet: string; montant: number | null; reference?: string | null }
): Promise<void> {
  const montant =
    input.montant != null ? `${Number(input.montant).toLocaleString('fr-FR')} FCFA` : '';
  await createNotification(supabase, {
    userId,
    type: 'billetterie',
    title: 'Paiement confirmé',
    body: `Votre paiement pour « ${input.typeBillet} » a été confirmé.`,
    link: '/dashboard/billetterie',
    templateKey: 'payment_confirmed',
    templateVariables: {
      type_billet: input.typeBillet,
      montant,
      reference: input.reference ?? '',
    },
  });
}

export async function notifyPaymentFailed(
  supabase: SupabaseClient,
  userId: string,
  input: { typeBillet: string; montant: number | null; paymentLink?: string | null }
): Promise<void> {
  const montant =
    input.montant != null ? `${Number(input.montant).toLocaleString('fr-FR')} FCFA` : '';
  await createNotification(supabase, {
    userId,
    type: 'billetterie',
    title: 'Paiement échoué',
    body: `Votre tentative de paiement pour « ${input.typeBillet} » n'a pas abouti.`,
    link: input.paymentLink ?? '/dashboard/billetterie',
    templateKey: 'payment_failed',
    templateVariables: {
      type_billet: input.typeBillet,
      montant,
      lien_paiement: input.paymentLink ?? '',
    },
  });
}

export async function notifyCheckInSuccess(
  supabase: SupabaseClient,
  userId: string,
  input: { typeBillet: string; checkedInAt: string }
): Promise<void> {
  const when = new Date(input.checkedInAt).toLocaleString('fr-FR', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  await createNotification(supabase, {
    userId,
    type: 'billetterie',
    title: 'Entrée validée',
    body: `Votre entrée pour « ${input.typeBillet} » a été validée le ${when}.`,
    link: '/dashboard/badge',
  });
}

export async function notifyAttestationAvailable(
  supabase: SupabaseClient,
  userId: string,
  documentName: string,
  link = '/dashboard/attestations'
): Promise<void> {
  await createNotification(supabase, {
    userId,
    type: 'evenement',
    title: 'Attestation disponible',
    body: `Votre document « ${documentName} » est disponible au téléchargement.`,
    link,
    templateKey: 'attestation_available',
    templateVariables: {
      nom_document: documentName,
      lien_attestation: link,
    },
  });
}
