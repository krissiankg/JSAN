import type { SupabaseClient } from '@supabase/supabase-js';

export type AttestationType =
  | 'participation'
  | 'organisation'
  | 'communication'
  | 'evaluation'
  | 'publication'
  | 'merite'
  | 'autre';

export interface UserAttestation {
  id: string;
  user_id: string;
  attestation_type: AttestationType;
  titre: string;
  designation: string | null;
  recipient_label: string | null;
  recipient_name: string;
  intro_text: string | null;
  body_text: string;
  footer_text: string | null;
  reference_code: string | null;
  issued_on: string | null;
  signatory_left_name: string | null;
  signatory_left_title: string | null;
  signatory_right_name: string | null;
  signatory_right_title: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface UserAttestationInput {
  user_id: string;
  attestation_type: AttestationType;
  titre: string;
  designation?: string | null;
  recipient_label?: string | null;
  recipient_name: string;
  intro_text?: string | null;
  body_text: string;
  footer_text?: string | null;
  reference_code?: string | null;
  issued_on?: string | null;
  signatory_left_name?: string | null;
  signatory_left_title?: string | null;
  signatory_right_name?: string | null;
  signatory_right_title?: string | null;
  is_active?: boolean;
}

export interface AttestationSettings {
  id: string;
  attestations_enabled: boolean;
}

export interface BulkAttestationInput {
  userIds: string[];
  attestation_type: AttestationType;
  titre: string;
  designation?: string | null;
  intro_text?: string | null;
  footer_text?: string | null;
  reference_prefix?: string | null;
  issued_on?: string | null;
  signatory_left_name?: string | null;
  signatory_left_title?: string | null;
  signatory_right_name?: string | null;
  signatory_right_title?: string | null;
  is_active?: boolean;
}

export interface AttestationTemplate {
  id: string;
  label: string;
  attestation_type: AttestationType;
  titre: string;
  designation: string;
  intro_text: string;
  footer_text: string;
  signatory_left_name: string;
  signatory_left_title: string;
  signatory_right_name: string;
  signatory_right_title: string;
  reference_prefix: string;
}

export const ATTESTATION_TYPE_LABELS: Record<AttestationType, string> = {
  participation: 'Participation',
  organisation: 'Organisation',
  communication: 'Communication',
  evaluation: 'Évaluation',
  publication: 'Publication',
  merite: 'Mérite',
  autre: 'Autre',
};

export const ATTESTATION_TEMPLATES: AttestationTemplate[] = [
  {
    id: 'participation',
    label: 'Participation',
    attestation_type: 'participation',
    titre: 'ATTESTATION',
    designation: 'DE PARTICIPATION',
    intro_text: 'Cette attestation certifie que:',
    footer_text: 'Pour servir et valoir ce que de droit.',
    signatory_left_name: 'MCA S. Colette AZANDJEME',
    signatory_left_title: 'Présidente du comité d’organisation',
    signatory_right_name: 'Dr (MC) Evariste MITCHIKPE',
    signatory_right_title: 'Président de la Société de Nutrition du Bénin',
    reference_prefix: 'ATT-PART-JSAN',
  },
  {
    id: 'organisation',
    label: 'Organisation',
    attestation_type: 'organisation',
    titre: 'ATTESTATION',
    designation: 'DE MERITE',
    intro_text: 'Cette attestation certifie que:',
    footer_text: 'Pour servir et valoir ce que de droit.',
    signatory_left_name: 'MCA S. Colette AZANDJEME',
    signatory_left_title: 'Présidente du comité d’organisation',
    signatory_right_name: 'Dr (MC) Evariste MITCHIKPE',
    signatory_right_title: 'Président de la Société de Nutrition du Bénin',
    reference_prefix: 'ATT-ORG-JSAN',
  },
  {
    id: 'communication',
    label: 'Communication',
    attestation_type: 'communication',
    titre: 'ATTESTATION',
    designation: 'DE COMMUNICATION',
    intro_text: 'Cette attestation certifie que:',
    footer_text: 'Pour servir et valoir ce que de droit.',
    signatory_left_name: 'MCA S. Colette AZANDJEME',
    signatory_left_title: 'Présidente du comité d’organisation',
    signatory_right_name: 'Dr (MC) Evariste MITCHIKPE',
    signatory_right_title: 'Président de la Société de Nutrition du Bénin',
    reference_prefix: 'ATT-COM-JSAN',
  },
  {
    id: 'evaluation',
    label: 'Évaluation',
    attestation_type: 'evaluation',
    titre: 'ATTESTATION',
    designation: "D'EVALUATION",
    intro_text: 'Cette attestation certifie que:',
    footer_text: 'Pour servir et valoir ce que de droit.',
    signatory_left_name: 'MCA S. Colette AZANDJEME',
    signatory_left_title: 'Présidente du comité d’organisation',
    signatory_right_name: 'Dr (MC) Evariste MITCHIKPE',
    signatory_right_title: 'Président de la Société de Nutrition du Bénin',
    reference_prefix: 'ATT-EVAL-JSAN',
  },
  {
    id: 'publication',
    label: 'Publication',
    attestation_type: 'publication',
    titre: 'ATTESTATION',
    designation: 'DE PUBLICATION',
    intro_text: 'Cette attestation certifie que:',
    footer_text: 'Pour servir et valoir ce que de droit.',
    signatory_left_name: 'MCA S. Colette AZANDJEME',
    signatory_left_title: 'Présidente du comité d’organisation',
    signatory_right_name: 'Dr (MC) Evariste MITCHIKPE',
    signatory_right_title: 'Président de la Société de Nutrition du Bénin',
    reference_prefix: 'ATT-PUB-JSAN',
  },
];

const ATTESTATION_SELECT = `
  id, user_id, attestation_type, titre, designation, recipient_label, recipient_name,
  intro_text, body_text, footer_text, reference_code, issued_on,
  signatory_left_name, signatory_left_title, signatory_right_name, signatory_right_title,
  is_active, created_at, updated_at
`;

function cleanText(v: string | null | undefined): string | null {
  const t = (v ?? '').trim();
  return t === '' ? null : t;
}

function normalizeInput(input: UserAttestationInput): Record<string, unknown> {
  return {
    user_id: input.user_id,
    attestation_type: input.attestation_type,
    titre: input.titre.trim(),
    designation: cleanText(input.designation),
    recipient_label: cleanText(input.recipient_label) ?? 'Monsieur',
    recipient_name: input.recipient_name.trim(),
    intro_text: cleanText(input.intro_text) ?? 'Cette attestation certifie que:',
    body_text: input.body_text.trim(),
    footer_text: cleanText(input.footer_text) ?? 'Pour servir et valoir ce que de droit.',
    reference_code: cleanText(input.reference_code),
    issued_on: cleanText(input.issued_on),
    signatory_left_name: cleanText(input.signatory_left_name),
    signatory_left_title: cleanText(input.signatory_left_title),
    signatory_right_name: cleanText(input.signatory_right_name),
    signatory_right_title: cleanText(input.signatory_right_title),
    is_active: input.is_active ?? true,
  };
}

export async function fetchAttestationSettings(supabase: SupabaseClient): Promise<AttestationSettings | null> {
  const { data } = await supabase
    .from('events_config')
    .select('id, attestations_enabled')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data ?? null) as AttestationSettings | null;
}

export async function updateAttestationSettings(
  supabase: SupabaseClient,
  id: string,
  enabled: boolean
): Promise<string | null> {
  const { error } = await supabase
    .from('events_config')
    .update({ attestations_enabled: enabled })
    .eq('id', id);
  return error?.message ?? null;
}

export async function fetchAttestationsForStaff(supabase: SupabaseClient): Promise<UserAttestation[]> {
  const { data, error } = await supabase
    .from('user_attestations')
    .select(ATTESTATION_SELECT)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as UserAttestation[];
}

export async function fetchMyAttestations(supabase: SupabaseClient, userId: string): Promise<UserAttestation[]> {
  const { data, error } = await supabase
    .from('user_attestations')
    .select(ATTESTATION_SELECT)
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as UserAttestation[];
}

export async function createAttestation(
  supabase: SupabaseClient,
  input: UserAttestationInput
): Promise<string | null> {
  if (!input.user_id) return "L'utilisateur est obligatoire.";
  if (!input.titre.trim()) return 'Le titre est obligatoire.';
  if (!input.recipient_name.trim()) return 'Le nom du bénéficiaire est obligatoire.';
  if (!input.body_text.trim()) return "Le texte de l'attestation est obligatoire.";
  const { error } = await supabase.from('user_attestations').insert(normalizeInput(input));
  return error?.message ?? null;
}

export async function updateAttestation(
  supabase: SupabaseClient,
  id: string,
  input: UserAttestationInput
): Promise<string | null> {
  if (!input.titre.trim()) return 'Le titre est obligatoire.';
  if (!input.recipient_name.trim()) return 'Le nom du bénéficiaire est obligatoire.';
  if (!input.body_text.trim()) return "Le texte de l'attestation est obligatoire.";
  const { error } = await supabase
    .from('user_attestations')
    .update({ ...normalizeInput(input), updated_at: new Date().toISOString() })
    .eq('id', id);
  return error?.message ?? null;
}

export async function deleteAttestation(supabase: SupabaseClient, id: string): Promise<string | null> {
  const { error } = await supabase.from('user_attestations').delete().eq('id', id);
  return error?.message ?? null;
}

export async function createAttestationsBulk(
  supabase: SupabaseClient,
  users: Array<{ id: string; fullName: string }>,
  input: BulkAttestationInput
): Promise<string | null> {
  if (!input.userIds.length) return 'Sélectionnez au moins un bénéficiaire.';
  if (!input.titre.trim()) return 'Le titre est obligatoire.';

  const selected = users.filter((u) => input.userIds.includes(u.id));
  if (!selected.length) return 'Aucun bénéficiaire valide trouvé.';

  const { data: existing } = await supabase
    .from('user_attestations')
    .select('user_id, attestation_type')
    .in('user_id', input.userIds)
    .eq('attestation_type', input.attestation_type);

  const existingSet = new Set(
    ((existing ?? []) as Array<{ user_id: string; attestation_type: AttestationType }>).map(
      (row) => `${row.user_id}:${row.attestation_type}`
    )
  );

  const roleText =
    input.attestation_type === 'organisation'
      ? "l’organisation, en tant que membre du comité / responsable de commission"
      : input.attestation_type === 'participation'
        ? 'la participation aux'
        : input.attestation_type === 'communication'
          ? 'la communication scientifique lors des'
          : input.attestation_type === 'evaluation'
            ? "l’évaluation scientifique des soumissions des"
            : input.attestation_type === 'publication'
              ? 'la publication aux actes des'
              : 'sa contribution aux';

  const rows = selected
    .filter((user) => !existingSet.has(`${user.id}:${input.attestation_type}`))
    .map((user, index) => ({
      user_id: user.id,
      attestation_type: input.attestation_type,
      titre: input.titre.trim(),
      designation: cleanText(input.designation),
      recipient_label: 'Monsieur',
      recipient_name: user.fullName,
      intro_text: cleanText(input.intro_text) ?? 'Cette attestation certifie que:',
      body_text: buildDefaultAttestationBody({ fullName: user.fullName, roleText }),
      footer_text: cleanText(input.footer_text) ?? 'Pour servir et valoir ce que de droit.',
      reference_code: input.reference_prefix ? `${input.reference_prefix}-${index + 1}` : null,
      issued_on: cleanText(input.issued_on),
      signatory_left_name: cleanText(input.signatory_left_name),
      signatory_left_title: cleanText(input.signatory_left_title),
      signatory_right_name: cleanText(input.signatory_right_name),
      signatory_right_title: cleanText(input.signatory_right_title),
      is_active: input.is_active ?? true,
    }));

  if (!rows.length) return 'Toutes les attestations existent déjà pour cette sélection.';

  const { error } = await supabase.from('user_attestations').insert(rows);
  return error?.message ?? null;
}

export function formatAttestationDate(isoDate: string | null | undefined): string {
  if (!isoDate) return '';
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function buildDefaultAttestationBody(params: {
  fullName: string;
  roleText: string;
}): string {
  return `${params.fullName} a effectivement participé à ${params.roleText}, des Journées Scientifiques d’Alimentation et de Nutrition (JSAN) à Cotonou, Bénin du 10 au 14 Juin 2025.`;
}

export function roleTextForAttestationType(type: AttestationType): string {
  switch (type) {
    case 'organisation':
      return "l’organisation, en tant que membre du comité / responsable de commission";
    case 'participation':
      return 'la participation aux';
    case 'communication':
      return 'la communication scientifique lors des';
    case 'evaluation':
      return "l’évaluation scientifique des soumissions des";
    case 'publication':
      return 'la publication aux actes des';
    default:
      return 'sa contribution aux';
  }
}
