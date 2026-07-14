import type { UserProfile } from '@/lib/roles';
import type { ProfileDocument } from '@/lib/profile-documents';

export type ProfileReminderKind =
  | 'profile_incomplete'
  | 'justificatifs_missing'
  | 'justificatifs_rejected'
  | 'justificatifs_pending';

export interface ProfileReminder {
  kind: ProfileReminderKind;
  title: string;
  body: string;
  link: string;
  tone: 'warning' | 'danger' | 'info';
  /** Titre exact utilisé pour dédupliquer les notifications en base. */
  notificationTitle: string;
}

const PROFILE_FIELDS: { key: keyof UserProfile; label: string }[] = [
  { key: 'prenom', label: 'prénom' },
  { key: 'nom', label: 'nom' },
  { key: 'telephone', label: 'téléphone' },
  { key: 'pays', label: 'pays' },
];

function isBlank(value: string | null | undefined): boolean {
  return !value || !String(value).trim();
}

export function getMissingProfileFieldLabels(profile: UserProfile | null | undefined): string[] {
  if (!profile) return PROFILE_FIELDS.map((f) => f.label);
  return PROFILE_FIELDS.filter((f) => isBlank(profile[f.key] as string | null | undefined)).map((f) => f.label);
}

export function assessProfileReminders(
  profile: UserProfile | null | undefined,
  documents: ProfileDocument[]
): ProfileReminder[] {
  const reminders: ProfileReminder[] = [];
  const missingFields = getMissingProfileFieldLabels(profile);

  if (missingFields.length > 0) {
    reminders.push({
      kind: 'profile_incomplete',
      title: 'Profil incomplet',
      body: `Renseignez votre ${missingFields.join(', ')} pour finaliser votre compte.`,
      link: '/dashboard/profil#informations',
      tone: 'warning',
      notificationTitle: 'Complétez votre profil',
    });
  }

  const isStudentVerified = Boolean(profile?.is_student_verified);
  const isMemberVerified = Boolean(profile?.is_member_verified);
  const studentDoc = documents.find((d) => d.document_type === 'etudiant') ?? null;
  const memberDoc = documents.find((d) => d.document_type === 'membre') ?? null;

  const rejectedTypes: string[] = [];
  if (!isStudentVerified && studentDoc?.statut === 'Refuse') rejectedTypes.push('étudiant');
  if (!isMemberVerified && memberDoc?.statut === 'Refuse') rejectedTypes.push('membre SNB');

  if (rejectedTypes.length > 0) {
    reminders.push({
      kind: 'justificatifs_rejected',
      title: 'Justificatif refusé',
      body: `Votre justificatif ${rejectedTypes.join(' / ')} a été refusé. Déposez un nouveau document pour bénéficier des tarifs réduits.`,
      link: '/dashboard/profil#justificatifs',
      tone: 'danger',
      notificationTitle: 'Justificatif refusé — nouvelle soumission requise',
    });
    return reminders;
  }

  const hasPending =
    (!isStudentVerified && studentDoc?.statut === 'En_Attente')
    || (!isMemberVerified && memberDoc?.statut === 'En_Attente');

  if (hasPending) {
    reminders.push({
      kind: 'justificatifs_pending',
      title: 'Justificatif en cours de validation',
      body: 'Votre document a bien été reçu. L’équipe organisatrice le vérifie avant d’activer le tarif réduit.',
      link: '/dashboard/profil#justificatifs',
      tone: 'info',
      notificationTitle: 'Justificatif en cours de validation',
    });
    return reminders;
  }

  const needsJustificatif =
    !isStudentVerified
    && !isMemberVerified
    && !studentDoc
    && !memberDoc;

  if (needsJustificatif) {
    reminders.push({
      kind: 'justificatifs_missing',
      title: 'Justificatifs manquants',
      body: 'Déposez votre justificatif étudiant ou membre SNB pour accéder aux tarifs réduits de la billetterie.',
      link: '/dashboard/profil#justificatifs',
      tone: 'warning',
      notificationTitle: 'Déposez vos documents justificatifs',
    });
  }

  return reminders;
}

/** Rappels qui doivent aussi apparaître dans la cloche (pas le simple « en attente »). */
export function remindersForBell(reminders: ProfileReminder[]): ProfileReminder[] {
  return reminders.filter((r) => r.kind !== 'justificatifs_pending');
}
