import type { SupabaseClient } from '@supabase/supabase-js';

export type SponsorLevel =
  | 'institutionnel'
  | 'platine'
  | 'or'
  | 'argent'
  | 'bronze'
  | 'media'
  | 'partenaire';

export interface EventSponsor {
  id: string;
  nom: string;
  niveau: SponsorLevel;
  description: string | null;
  logo_path: string | null;
  logo_url: string | null;
  website_url: string | null;
  couleur: string | null;
  ordre: number | null;
  is_active: boolean;
  is_featured: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface EventSponsorInput {
  nom: string;
  niveau: SponsorLevel;
  description?: string | null;
  logo_path?: string | null;
  logo_url?: string | null;
  website_url?: string | null;
  couleur?: string | null;
  ordre?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
}

export const SPONSOR_LEVEL_LABELS: Record<SponsorLevel, string> = {
  institutionnel: 'Institutionnel',
  platine: 'Platine',
  or: 'Or',
  argent: 'Argent',
  bronze: 'Bronze',
  media: 'Média',
  partenaire: 'Partenaire',
};

export const SPONSOR_LEVEL_ORDER: SponsorLevel[] = [
  'institutionnel',
  'platine',
  'or',
  'argent',
  'bronze',
  'media',
  'partenaire',
];

export const SPONSOR_LEVEL_COLORS: Record<SponsorLevel, string> = {
  institutionnel: '#0f172a',
  platine: '#475569',
  or: '#ca8a04',
  argent: '#64748b',
  bronze: '#b45309',
  media: '#1B6B2E',
  partenaire: '#10b981',
};

const SPONSOR_SELECT =
  'id, nom, niveau, description, logo_path, logo_url, website_url, couleur, ordre, is_active, is_featured, created_at, updated_at';

export const SPONSOR_LOGOS_BUCKET = 'sponsor-logos';
const SPONSOR_ALLOWED_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'svg'] as const;
const MAX_SPONSOR_LOGO_MB = 5;

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

export async function fetchSponsors(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<EventSponsor[]> {
  let query = supabase
    .from('event_sponsors')
    .select(SPONSOR_SELECT)
    .order('ordre', { ascending: true })
    .order('nom', { ascending: true });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data } = await query;
  return (data ?? []) as EventSponsor[];
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

export function normalizeSponsorInput(input: EventSponsorInput): Record<string, unknown> {
  return {
    nom: input.nom.trim(),
    niveau: input.niveau,
    description: cleanText(input.description),
    logo_path: cleanText(input.logo_path),
    logo_url: cleanText(input.logo_url),
    website_url: cleanText(input.website_url),
    couleur: cleanText(input.couleur),
    ordre: input.ordre ?? 0,
    is_active: input.is_active ?? true,
    is_featured: input.is_featured ?? false,
  };
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

export function validateSponsorLogo(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (!SPONSOR_ALLOWED_EXTENSIONS.includes(ext as (typeof SPONSOR_ALLOWED_EXTENSIONS)[number])) {
    return `Format non autorisé (${SPONSOR_ALLOWED_EXTENSIONS.join(', ')}).`;
  }
  if (file.size > MAX_SPONSOR_LOGO_MB * 1024 * 1024) {
    return `Logo trop volumineux (max ${MAX_SPONSOR_LOGO_MB} Mo).`;
  }
  return null;
}

export function buildSponsorLogoPath(sponsorName: string, fileName: string): string {
  const safeSponsor = sanitizeFileName(sponsorName || 'sponsor');
  const safeFile = sanitizeFileName(fileName);
  return `${safeSponsor}/${Date.now()}-${safeFile}`;
}

export async function uploadSponsorLogo(
  supabase: SupabaseClient,
  sponsorName: string,
  file: File,
  existingPath?: string | null
): Promise<{ logoPath: string | null; error: string | null }> {
  const validation = validateSponsorLogo(file);
  if (validation) return { logoPath: null, error: validation };

  if (existingPath) {
    await supabase.storage.from(SPONSOR_LOGOS_BUCKET).remove([existingPath]);
  }

  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const logoPath = buildSponsorLogoPath(sponsorName, file.name);
  const { error } = await supabase.storage
    .from(SPONSOR_LOGOS_BUCKET)
    .upload(logoPath, file, {
      upsert: false,
      contentType: file.type || MIME_BY_EXTENSION[ext] || 'application/octet-stream',
    });

  return error ? { logoPath: null, error: error.message } : { logoPath, error: null };
}

export async function removeSponsorLogo(
  supabase: SupabaseClient,
  logoPath: string | null | undefined
): Promise<string | null> {
  if (!logoPath) return null;
  const { error } = await supabase.storage.from(SPONSOR_LOGOS_BUCKET).remove([logoPath]);
  return error?.message ?? null;
}

export function getSponsorLogoUrl(
  supabase: SupabaseClient,
  sponsor: Pick<EventSponsor, 'logo_path' | 'logo_url'>
): string | null {
  if (sponsor.logo_path) {
    const { data } = supabase.storage.from(SPONSOR_LOGOS_BUCKET).getPublicUrl(sponsor.logo_path);
    return data.publicUrl;
  }
  return sponsor.logo_url;
}

export async function createSponsor(
  supabase: SupabaseClient,
  input: EventSponsorInput
): Promise<string | null> {
  if (!input.nom.trim()) return 'Le nom du sponsor est obligatoire.';
  const { error } = await supabase.from('event_sponsors').insert(normalizeSponsorInput(input));
  return error ? error.message : null;
}

export async function updateSponsor(
  supabase: SupabaseClient,
  id: string,
  input: EventSponsorInput
): Promise<string | null> {
  if (!input.nom.trim()) return 'Le nom du sponsor est obligatoire.';
  const { error } = await supabase
    .from('event_sponsors')
    .update({ ...normalizeSponsorInput(input), updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteSponsor(
  supabase: SupabaseClient,
  id: string
): Promise<string | null> {
  const { error } = await supabase.from('event_sponsors').delete().eq('id', id);
  return error ? error.message : null;
}

export function groupSponsorsByLevel(sponsors: EventSponsor[]): Array<{
  level: SponsorLevel;
  label: string;
  items: EventSponsor[];
}> {
  return SPONSOR_LEVEL_ORDER.map((level) => ({
    level,
    label: SPONSOR_LEVEL_LABELS[level],
    items: sponsors.filter((s) => s.niveau === level),
  })).filter((group) => group.items.length > 0);
}
