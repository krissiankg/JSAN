import type { SupabaseClient } from '@supabase/supabase-js';

export type EmailTemplateCategory =
  | 'compte'
  | 'soumissions'
  | 'evaluations'
  | 'paiements'
  | 'programme'
  | 'documents';

export type EmailTemplateKey =
  | 'account_registration'
  | 'account_welcome'
  | 'account_email_confirmation'
  | 'abstract_submitted'
  | 'abstract_accepted'
  | 'abstract_revision_requested'
  | 'abstract_rejected'
  | 'manuscript_submitted'
  | 'manuscript_accepted'
  | 'manuscript_revision_requested'
  | 'manuscript_rejected'
  | 'reviewer_application_received'
  | 'reviewer_application_approved'
  | 'reviewer_application_rejected'
  | 'reviewer_assignment'
  | 'reviewer_reminder'
  | 'special_announcement'
  | 'program_published'
  | 'program_updated'
  | 'session_reminder'
  | 'payment_pending'
  | 'payment_confirmed'
  | 'payment_failed'
  | 'student_document_approved'
  | 'student_document_rejected'
  | 'member_document_approved'
  | 'member_document_rejected'
  | 'attestation_available';

export interface EmailTemplateDefinition {
  key: EmailTemplateKey;
  category: EmailTemplateCategory;
  label: string;
  description: string;
  variables: string[];
  defaultSubject: string;
  defaultTitle: string;
  defaultBody: string;
  defaultCtaLabel: string;
}

export interface EmailTemplateRecord {
  enabled: boolean;
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
}

export type EmailTemplateMap = Record<EmailTemplateKey, EmailTemplateRecord>;

export interface EmailTemplateRenderResult {
  subject: string;
  title: string;
  body: string;
  ctaLabel: string;
}

export const EMAIL_TEMPLATE_DEFINITIONS: EmailTemplateDefinition[] = [
  {
    key: 'account_registration',
    category: 'compte',
    label: "Inscription reçue",
    description: "Accusé de réception juste après la création d'un compte.",
    variables: ['prenom', 'nom_complet', 'role_label', 'lien_plateforme'],
    defaultSubject: 'Votre inscription JSAN a bien été enregistrée',
    defaultTitle: 'Inscription reçue',
    defaultBody:
      'Bonjour {{prenom}}, votre inscription à la plateforme JSAN a bien été prise en compte en tant que {{role_label}}. Vous pouvez revenir sur la plateforme à tout moment pour compléter votre parcours.',
    defaultCtaLabel: 'Accéder à la plateforme',
  },
  {
    key: 'account_welcome',
    category: 'compte',
    label: 'Bienvenue',
    description: "Message d'accueil après activation ou première connexion.",
    variables: ['prenom', 'nom_complet', 'role_label', 'lien_plateforme'],
    defaultSubject: 'Bienvenue sur la plateforme JSAN',
    defaultTitle: 'Bienvenue',
    defaultBody:
      'Bonjour {{prenom}}, bienvenue sur la plateforme des Journées Scientifiques de l’Alimentation et de la Nutrition. Votre espace {{role_label}} est prêt.',
    defaultCtaLabel: 'Ouvrir mon espace',
  },
  {
    key: 'account_email_confirmation',
    category: 'compte',
    label: "Confirmation d'e-mail",
    description: "Message d'accompagnement quand l'utilisateur doit confirmer son adresse.",
    variables: ['prenom', 'email', 'lien_plateforme'],
    defaultSubject: 'Confirmez votre adresse e-mail JSAN',
    defaultTitle: 'Confirmation requise',
    defaultBody:
      'Bonjour {{prenom}}, votre compte a été créé. Merci de confirmer votre adresse e-mail afin d’activer complètement votre accès à la plateforme JSAN.',
    defaultCtaLabel: 'Finaliser mon inscription',
  },
  {
    key: 'abstract_submitted',
    category: 'soumissions',
    label: 'Résumé soumis',
    description: 'Accusé de réception après dépôt de résumé.',
    variables: ['prenom', 'titre_resume', 'lien_plateforme'],
    defaultSubject: 'Votre résumé a bien été soumis',
    defaultTitle: 'Résumé reçu',
    defaultBody:
      'Bonjour {{prenom}}, votre résumé « {{titre_resume}} » a bien été reçu par le comité scientifique. Vous pourrez suivre son traitement depuis votre espace.',
    defaultCtaLabel: 'Voir mon résumé',
  },
  {
    key: 'abstract_accepted',
    category: 'soumissions',
    label: 'Résumé accepté',
    description: "Notification d'acceptation d'un résumé.",
    variables: ['prenom', 'titre_resume', 'lien_plateforme'],
    defaultSubject: 'Votre résumé a été accepté',
    defaultTitle: 'Résumé accepté',
    defaultBody:
      'Bonjour {{prenom}}, votre résumé « {{titre_resume}} » a été accepté par le comité scientifique.',
    defaultCtaLabel: 'Consulter la décision',
  },
  {
    key: 'abstract_revision_requested',
    category: 'soumissions',
    label: 'Résumé à réviser',
    description: 'Demande de révision sur un résumé.',
    variables: ['prenom', 'titre_resume', 'lien_plateforme'],
    defaultSubject: 'Des révisions sont demandées sur votre résumé',
    defaultTitle: 'Révisions demandées',
    defaultBody:
      'Bonjour {{prenom}}, des révisions sont demandées sur votre résumé « {{titre_resume}} ». Consultez les retours pour effectuer les corrections attendues.',
    defaultCtaLabel: 'Voir les retours',
  },
  {
    key: 'abstract_rejected',
    category: 'soumissions',
    label: 'Résumé rejeté',
    description: "Notification de non-rétention d'un résumé.",
    variables: ['prenom', 'titre_resume', 'lien_plateforme'],
    defaultSubject: 'Votre résumé n’a pas été retenu',
    defaultTitle: 'Résumé non retenu',
    defaultBody:
      'Bonjour {{prenom}}, votre résumé « {{titre_resume}} » n’a pas été retenu pour cette édition.',
    defaultCtaLabel: 'Ouvrir la plateforme',
  },
  {
    key: 'manuscript_submitted',
    category: 'soumissions',
    label: 'Manuscrit soumis',
    description: 'Accusé de réception après dépôt du manuscrit complet.',
    variables: ['prenom', 'titre_manuscrit', 'lien_plateforme'],
    defaultSubject: 'Votre manuscrit a bien été soumis',
    defaultTitle: 'Manuscrit reçu',
    defaultBody:
      'Bonjour {{prenom}}, votre manuscrit « {{titre_manuscrit}} » a bien été reçu et sera traité par le comité scientifique.',
    defaultCtaLabel: 'Voir mon manuscrit',
  },
  {
    key: 'manuscript_accepted',
    category: 'soumissions',
    label: 'Manuscrit accepté',
    description: "Notification d'acceptation d'un manuscrit.",
    variables: ['prenom', 'titre_manuscrit', 'lien_plateforme'],
    defaultSubject: 'Votre manuscrit a été accepté',
    defaultTitle: 'Manuscrit accepté',
    defaultBody:
      'Bonjour {{prenom}}, votre manuscrit « {{titre_manuscrit}} » a été accepté pour publication.',
    defaultCtaLabel: 'Consulter la décision',
  },
  {
    key: 'manuscript_revision_requested',
    category: 'soumissions',
    label: 'Manuscrit à corriger',
    description: 'Demande de corrections sur le manuscrit complet.',
    variables: ['prenom', 'titre_manuscrit', 'lien_plateforme'],
    defaultSubject: 'Des corrections sont demandées sur votre manuscrit',
    defaultTitle: 'Corrections demandées',
    defaultBody:
      'Bonjour {{prenom}}, des corrections sont demandées sur votre manuscrit « {{titre_manuscrit}} ».',
    defaultCtaLabel: 'Voir les commentaires',
  },
  {
    key: 'manuscript_rejected',
    category: 'soumissions',
    label: 'Manuscrit rejeté',
    description: "Notification de non-rétention d'un manuscrit.",
    variables: ['prenom', 'titre_manuscrit', 'lien_plateforme'],
    defaultSubject: 'Votre manuscrit n’a pas été retenu',
    defaultTitle: 'Manuscrit non retenu',
    defaultBody:
      'Bonjour {{prenom}}, votre manuscrit « {{titre_manuscrit}} » n’a pas été retenu pour publication.',
    defaultCtaLabel: 'Ouvrir la plateforme',
  },
  {
    key: 'reviewer_application_received',
    category: 'evaluations',
    label: "Candidature évaluateur reçue",
    description: "Confirmation envoyée lorsqu'une candidature évaluateur est déposée.",
    variables: ['prenom', 'lien_plateforme'],
    defaultSubject: 'Votre candidature évaluateur a bien été reçue',
    defaultTitle: 'Candidature reçue',
    defaultBody:
      'Bonjour {{prenom}}, votre candidature pour rejoindre le comité de lecture JSAN a bien été reçue. Vous serez informé dès qu’une décision sera prise.',
    defaultCtaLabel: 'Accéder à mon espace',
  },
  {
    key: 'reviewer_application_approved',
    category: 'evaluations',
    label: 'Candidature évaluateur acceptée',
    description: "Validation d'une candidature évaluateur.",
    variables: ['prenom', 'lien_plateforme'],
    defaultSubject: 'Votre candidature évaluateur a été validée',
    defaultTitle: 'Candidature validée',
    defaultBody:
      'Bonjour {{prenom}}, votre candidature comme évaluateur a été acceptée. Vous pouvez maintenant consulter les soumissions à évaluer.',
    defaultCtaLabel: 'Voir mes évaluations',
  },
  {
    key: 'reviewer_application_rejected',
    category: 'evaluations',
    label: 'Candidature évaluateur refusée',
    description: "Refus d'une candidature évaluateur.",
    variables: ['prenom', 'lien_plateforme'],
    defaultSubject: 'Suite à votre candidature évaluateur JSAN',
    defaultTitle: 'Candidature non retenue',
    defaultBody:
      'Bonjour {{prenom}}, votre candidature comme évaluateur n’a pas été retenue pour cette édition.',
    defaultCtaLabel: 'Ouvrir la plateforme',
  },
  {
    key: 'reviewer_assignment',
    category: 'evaluations',
    label: 'Nouvelle évaluation assignée',
    description: "Affectation d'un résumé ou manuscrit à un évaluateur.",
    variables: ['prenom', 'titre_resume', 'titre_manuscrit', 'lien_plateforme'],
    defaultSubject: 'Une nouvelle évaluation vous a été assignée',
    defaultTitle: 'Nouvelle évaluation assignée',
    defaultBody:
      'Bonjour {{prenom}}, une nouvelle soumission vous a été assignée pour évaluation. Merci de consulter votre espace pour prendre connaissance des consignes.',
    defaultCtaLabel: 'Voir mes évaluations',
  },
  {
    key: 'reviewer_reminder',
    category: 'evaluations',
    label: "Rappel d'évaluation",
    description: 'Relance de courtoisie pour une évaluation en attente.',
    variables: ['prenom', 'titre_resume', 'date_limite', 'lien_plateforme'],
    defaultSubject: 'Rappel concernant une évaluation en attente',
    defaultTitle: 'Rappel',
    defaultBody:
      'Bonjour {{prenom}}, ceci est un rappel concernant une évaluation toujours en attente. Merci de la finaliser avant le {{date_limite}} si possible.',
    defaultCtaLabel: 'Finaliser l’évaluation',
  },
  {
    key: 'special_announcement',
    category: 'programme',
    label: 'Annonce spéciale',
    description: 'Modèle libre pour communication événementielle importante.',
    variables: ['prenom', 'nom_evenement', 'message_special', 'lien_plateforme'],
    defaultSubject: 'Annonce spéciale JSAN',
    defaultTitle: 'Annonce spéciale',
    defaultBody:
      'Bonjour {{prenom}}, {{message_special}}',
    defaultCtaLabel: 'Consulter les détails',
  },
  {
    key: 'program_published',
    category: 'programme',
    label: 'Programme publié',
    description: "Annonce de publication du programme de l'événement.",
    variables: ['prenom', 'nom_evenement', 'lien_plateforme'],
    defaultSubject: 'Le programme JSAN est disponible',
    defaultTitle: 'Programme publié',
    defaultBody:
      'Bonjour {{prenom}}, le programme du {{nom_evenement}} est maintenant disponible sur la plateforme.',
    defaultCtaLabel: 'Voir le programme',
  },
  {
    key: 'program_updated',
    category: 'programme',
    label: 'Programme mis à jour',
    description: 'Notification de modification importante du programme.',
    variables: ['prenom', 'nom_evenement', 'message_special', 'lien_plateforme'],
    defaultSubject: 'Le programme JSAN a été mis à jour',
    defaultTitle: 'Programme mis à jour',
    defaultBody:
      'Bonjour {{prenom}}, des changements importants ont été apportés au programme. {{message_special}}',
    defaultCtaLabel: 'Consulter la mise à jour',
  },
  {
    key: 'session_reminder',
    category: 'programme',
    label: 'Rappel de session',
    description: 'Rappel avant une session, une section ou une intervention.',
    variables: ['prenom', 'nom_session', 'date_session', 'heure_session', 'nom_salle', 'message_special', 'lien_plateforme'],
    defaultSubject: 'Rappel de session JSAN',
    defaultTitle: 'Votre session approche',
    defaultBody:
      'Bonjour {{prenom}}, rappel pour la session « {{nom_session}} » prévue le {{date_session}} à {{heure_session}} en {{nom_salle}}. {{message_special}}',
    defaultCtaLabel: 'Voir la session',
  },
  {
    key: 'payment_pending',
    category: 'paiements',
    label: 'Paiement en attente',
    description: "Paiement lancé mais pas encore confirmé.",
    variables: ['prenom', 'type_billet', 'montant', 'lien_paiement', 'lien_plateforme'],
    defaultSubject: 'Votre paiement est en attente',
    defaultTitle: 'Paiement en attente',
    defaultBody:
      'Bonjour {{prenom}}, votre demande pour « {{type_billet}} » est en attente de confirmation pour un montant de {{montant}}.',
    defaultCtaLabel: 'Finaliser le paiement',
  },
  {
    key: 'payment_confirmed',
    category: 'paiements',
    label: 'Paiement confirmé',
    description: 'Confirmation après paiement validé.',
    variables: ['prenom', 'type_billet', 'montant', 'reference', 'lien_plateforme'],
    defaultSubject: 'Paiement confirmé',
    defaultTitle: 'Paiement confirmé',
    defaultBody:
      'Bonjour {{prenom}}, votre paiement pour « {{type_billet}} » a été confirmé. Référence : {{reference}}.',
    defaultCtaLabel: 'Voir mon inscription',
  },
  {
    key: 'payment_failed',
    category: 'paiements',
    label: 'Paiement échoué',
    description: "Échec d'une tentative de paiement.",
    variables: ['prenom', 'type_billet', 'montant', 'lien_paiement', 'lien_plateforme'],
    defaultSubject: 'Votre paiement n’a pas abouti',
    defaultTitle: 'Paiement échoué',
    defaultBody:
      'Bonjour {{prenom}}, votre tentative de paiement pour « {{type_billet}} » n’a pas abouti.',
    defaultCtaLabel: 'Réessayer le paiement',
  },
  {
    key: 'student_document_approved',
    category: 'paiements',
    label: 'Justificatif étudiant validé',
    description: "Validation du justificatif étudiant.",
    variables: ['prenom', 'lien_plateforme'],
    defaultSubject: 'Votre justificatif étudiant a été validé',
    defaultTitle: 'Justificatif validé',
    defaultBody:
      'Bonjour {{prenom}}, votre justificatif étudiant a été validé. Les tarifs réduits sont désormais disponibles.',
    defaultCtaLabel: 'Voir la billetterie',
  },
  {
    key: 'student_document_rejected',
    category: 'paiements',
    label: 'Justificatif étudiant refusé',
    description: "Refus du justificatif étudiant.",
    variables: ['prenom', 'lien_plateforme'],
    defaultSubject: 'Votre justificatif étudiant n’a pas été accepté',
    defaultTitle: 'Justificatif refusé',
    defaultBody:
      'Bonjour {{prenom}}, votre justificatif étudiant n’a pas été accepté. Vous pouvez en soumettre un nouveau depuis votre profil.',
    defaultCtaLabel: 'Mettre à jour mon profil',
  },
  {
    key: 'member_document_approved',
    category: 'paiements',
    label: 'Justificatif membre validé',
    description: 'Validation du justificatif membre SNB.',
    variables: ['prenom', 'lien_plateforme'],
    defaultSubject: 'Votre justificatif membre SNB a été validé',
    defaultTitle: 'Justificatif validé',
    defaultBody:
      'Bonjour {{prenom}}, votre justificatif membre SNB a été validé. Les tarifs membres sont désormais disponibles.',
    defaultCtaLabel: 'Voir la billetterie',
  },
  {
    key: 'member_document_rejected',
    category: 'paiements',
    label: 'Justificatif membre refusé',
    description: 'Refus du justificatif membre SNB.',
    variables: ['prenom', 'lien_plateforme'],
    defaultSubject: 'Votre justificatif membre SNB n’a pas été accepté',
    defaultTitle: 'Justificatif refusé',
    defaultBody:
      'Bonjour {{prenom}}, votre justificatif membre SNB n’a pas été accepté. Vous pouvez en soumettre un nouveau depuis votre profil.',
    defaultCtaLabel: 'Mettre à jour mon profil',
  },
  {
    key: 'attestation_available',
    category: 'documents',
    label: 'Attestation disponible',
    description: "Annonce de disponibilité d'une attestation ou d'un document.",
    variables: ['prenom', 'nom_document', 'lien_attestation', 'lien_plateforme'],
    defaultSubject: 'Votre attestation est disponible',
    defaultTitle: 'Document disponible',
    defaultBody:
      'Bonjour {{prenom}}, votre document « {{nom_document}} » est maintenant disponible au téléchargement sur la plateforme.',
    defaultCtaLabel: 'Télécharger le document',
  },
];

export const EMAIL_TEMPLATE_CATEGORY_LABELS: Record<EmailTemplateCategory, string> = {
  compte: 'Compte & bienvenue',
  soumissions: 'Soumissions scientifiques',
  evaluations: 'Évaluations',
  paiements: 'Paiements & justificatifs',
  programme: 'Programme, annonces & rappels',
  documents: 'Documents & attestations',
};

export const EMAIL_TEMPLATE_DEFINITIONS_BY_KEY: Record<EmailTemplateKey, EmailTemplateDefinition> =
  Object.fromEntries(EMAIL_TEMPLATE_DEFINITIONS.map((definition) => [definition.key, definition])) as Record<
    EmailTemplateKey,
    EmailTemplateDefinition
  >;

export function defaultEmailTemplateRecord(definition: EmailTemplateDefinition): EmailTemplateRecord {
  return {
    enabled: true,
    subject: definition.defaultSubject,
    title: definition.defaultTitle,
    body: definition.defaultBody,
    ctaLabel: definition.defaultCtaLabel,
  };
}

export function defaultEmailTemplateMap(): EmailTemplateMap {
  return Object.fromEntries(
    EMAIL_TEMPLATE_DEFINITIONS.map((definition) => [definition.key, defaultEmailTemplateRecord(definition)])
  ) as EmailTemplateMap;
}

export function parseEmailTemplateMap(raw: unknown): EmailTemplateMap {
  const defaults = defaultEmailTemplateMap();
  if (!raw || typeof raw !== 'object') return defaults;

  const input = raw as Record<string, unknown>;
  const output: EmailTemplateMap = { ...defaults };

  for (const definition of EMAIL_TEMPLATE_DEFINITIONS) {
    const candidate = input[definition.key];
    if (!candidate || typeof candidate !== 'object') continue;
    const row = candidate as Record<string, unknown>;
    output[definition.key] = {
      enabled: row.enabled !== false,
      subject: typeof row.subject === 'string' && row.subject.trim() ? row.subject : defaults[definition.key].subject,
      title: typeof row.title === 'string' && row.title.trim() ? row.title : defaults[definition.key].title,
      body: typeof row.body === 'string' && row.body.trim() ? row.body : defaults[definition.key].body,
      ctaLabel:
        typeof row.ctaLabel === 'string' && row.ctaLabel.trim() ? row.ctaLabel : defaults[definition.key].ctaLabel,
    };
  }

  return output;
}

export async function fetchEmailTemplateConfig(
  supabase: SupabaseClient
): Promise<{ id: string; email_templates: EmailTemplateMap } | null> {
  const { data } = await supabase
    .from('events_config')
    .select('id, email_templates')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id as string,
    email_templates: parseEmailTemplateMap((data as { email_templates?: unknown }).email_templates),
  };
}

export async function updateEmailTemplates(
  supabase: SupabaseClient,
  id: string,
  emailTemplates: EmailTemplateMap
): Promise<string | null> {
  const { error } = await supabase.from('events_config').update({ email_templates: emailTemplates }).eq('id', id);
  return error?.message ?? null;
}

export function renderTemplateString(input: string, variables: Record<string, string | null | undefined>): string {
  return input.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key: string) => {
    const value = variables[key];
    return value == null ? '' : String(value);
  });
}

export function renderEmailTemplate(
  template: EmailTemplateRecord,
  variables: Record<string, string | null | undefined>
): EmailTemplateRenderResult {
  return {
    subject: renderTemplateString(template.subject, variables).trim(),
    title: renderTemplateString(template.title, variables).trim(),
    body: renderTemplateString(template.body, variables).trim(),
    ctaLabel: renderTemplateString(template.ctaLabel, variables).trim(),
  };
}

export function sampleVariablesForTemplate(key: EmailTemplateKey): Record<string, string> {
  const shared = {
    prenom: 'Awa',
    nom_complet: 'Awa Kouassi',
    email: 'awa@example.com',
    role_label: 'Participant',
    lien_plateforme: 'https://example.com/dashboard',
    titre_resume: 'Nutrition infantile et sécurité alimentaire',
    titre_manuscrit: 'Analyse multicentrique de la malnutrition',
    date_limite: '20 juillet 2026',
    nom_evenement: 'JSAN 2026',
    message_special: 'une annonce importante a été publiée par le comité d’organisation.',
    nom_session: 'Session orale 2 - Nutrition clinique',
    date_session: '14 juin 2026',
    heure_session: '10:30',
    nom_salle: 'Salle Baobab',
    type_billet: 'Participant professionnel',
    montant: '40 000 FCFA',
    reference: 'KKP-2026-00451',
    lien_paiement: 'https://pay.example.com/transaction',
    lien_attestation: 'https://example.com/dashboard/attestations/123',
    nom_document: 'Attestation de participation',
  };

  const definition = EMAIL_TEMPLATE_DEFINITIONS_BY_KEY[key];
  return Object.fromEntries(definition.variables.map((variable) => [variable, shared[variable as keyof typeof shared] ?? ''])) as Record<
    string,
    string
  >;
}
