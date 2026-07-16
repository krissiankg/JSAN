import type { SupabaseClient } from '@supabase/supabase-js';

export interface TicketCatalogItem {
  id: string;
  title: string;
  desc: string;
  price: string;
  amount: number;
  img: string;
  category: string;
  requiresStudent?: boolean;
  requiresMember?: boolean;
  /** NULL = illimité */
  stockLimit?: number | null;
  saleStartsAt?: string | null;
  saleEndsAt?: string | null;
  /** Réservations Payé + En_Attente */
  reservedCount?: number;
  purchaseAvailable?: boolean;
  purchaseBlockedReason?: string | null;
}

export interface TicketTypeRow {
  id: string;
  title: string;
  description: string | null;
  amount: number;
  category: string;
  image_path: string | null;
  image_url: string | null;
  requires_student: boolean;
  requires_member: boolean;
  ordre: number;
  is_active: boolean;
  stock_limit: number | null;
  sale_starts_at: string | null;
  sale_ends_at: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface TicketTypeInput {
  id: string;
  title: string;
  description?: string | null;
  amount: number;
  category: string;
  image_path?: string | null;
  image_url?: string | null;
  requires_student?: boolean;
  requires_member?: boolean;
  ordre?: number;
  is_active?: boolean;
  stock_limit?: number | null;
  sale_starts_at?: string | null;
  sale_ends_at?: string | null;
}

export const TICKET_IMAGES_BUCKET = 'ticket-images';
const TICKET_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'webp', 'gif'] as const;
const MAX_TICKET_IMAGE_MB = 5;
const TICKET_SELECT =
  'id, title, description, amount, category, image_path, image_url, requires_student, requires_member, ordre, is_active, stock_limit, sale_starts_at, sale_ends_at, created_at, updated_at';

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
};

/** Catalogue de secours si la table ticket_types est vide / migration non appliquée. */
export const TICKET_CATALOG: TicketCatalogItem[] = [
  {
    id: 'membre-snb-etudiant',
    title: 'Membre SNB - Étudiant',
    desc: 'Accès étudiant pour les membres actifs de la SNB.',
    price: '10 000 FCFA',
    amount: 10000,
    img: 'https://images.unsplash.com/photo-1523240795612-9a054b0db644?auto=format&fit=crop&q=80&w=400',
    category: 'Membre SNB',
    requiresStudent: true,
    requiresMember: true,
  },
  {
    id: 'membre-snb-pro',
    title: 'Membre SNB - Professionnel',
    desc: 'Accès professionnel pour les membres actifs.',
    price: '35 000 FCFA',
    amount: 35000,
    img: 'https://images.unsplash.com/photo-1540317580384-e5d43616b9aa?auto=format&fit=crop&q=80&w=400',
    category: 'Membre SNB',
    requiresMember: true,
  },
  {
    id: 'non-membre-etudiant',
    title: 'Non-membre SNB - Étudiant',
    desc: 'Accès étudiant pour les non-membres.',
    price: '10 000 FCFA',
    amount: 10000,
    img: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&q=80&w=400',
    category: 'Non-membre SNB',
    requiresStudent: true,
  },
  {
    id: 'non-membre-pro',
    title: 'Non-membre SNB - Professionnel',
    desc: 'Accès chercheur / professionnel pour les non-membres.',
    price: '40 000 FCFA',
    amount: 40000,
    img: 'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?auto=format&fit=crop&q=80&w=400',
    category: 'Non-membre SNB',
  },
  {
    id: 'formation-pre-congres',
    title: 'Formation Pré-Congrès',
    desc: 'Accès aux formations spécifiques du congrès.',
    price: '15 000 FCFA',
    amount: 15000,
    img: 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&q=80&w=400',
    category: 'Formation',
  },
  {
    id: 'stand-expo-etudiant',
    title: 'Stand Expo - Étudiant',
    desc: "Espace d'exposition réservé aux projets étudiants.",
    price: '50 000 FCFA',
    amount: 50000,
    img: 'https://images.unsplash.com/photo-1472851294608-062f824d29cc?auto=format&fit=crop&q=80&w=400',
    category: 'Exposition',
    requiresStudent: true,
  },
  {
    id: 'stand-expo-entreprise',
    title: 'Stand Expo - Entreprise',
    desc: "Espace d'exposition premium pour les entreprises.",
    price: '75 000 FCFA',
    amount: 75000,
    img: 'https://images.unsplash.com/photo-1505373877841-8d25f7d46678?auto=format&fit=crop&q=80&w=400',
    category: 'Exposition',
  },
  {
    id: 'symposium',
    title: 'Ticket Symposium',
    desc: 'Accès exclusif au Symposium (Partenariat/Sponsoring).',
    price: '2 000 000 FCFA',
    amount: 2000000,
    img: 'https://images.unsplash.com/photo-1515187029135-18ee286d815b?auto=format&fit=crop&q=80&w=400',
    category: 'Symposium',
  },
];

export type PaymentStatus = 'En_Attente' | 'Paye' | 'Echoue';

export interface TicketRegistration {
  id: string;
  user_id: string;
  type_billet: string;
  ticket_type_id?: string | null;
  transaction_id_kkiapay: string | null;
  montant: number | null;
  statut_paiement: PaymentStatus;
  created_at: string;
  badge_token?: string | null;
  checked_in_at?: string | null;
  checked_in_by?: string | null;
}

export function formatFcfa(amount: number | null): string {
  if (amount == null) return '—';
  return `${Number(amount).toLocaleString('fr-FR')} FCFA`;
}

function cleanText(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

function sanitizeFileName(fileName: string): string {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 120);
}

export function slugifyTicketId(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export function getTicketImageUrl(
  supabase: SupabaseClient,
  ticket: Pick<TicketTypeRow, 'image_path' | 'image_url'>
): string {
  if (ticket.image_path) {
    const { data } = supabase.storage.from(TICKET_IMAGES_BUCKET).getPublicUrl(ticket.image_path);
    if (data.publicUrl) return data.publicUrl;
  }
  return ticket.image_url?.trim() || '';
}

export function evaluateTicketPurchaseAvailability(
  ticket: Pick<
    TicketCatalogItem,
    'stockLimit' | 'saleStartsAt' | 'saleEndsAt' | 'reservedCount' | 'purchaseAvailable' | 'purchaseBlockedReason'
  >,
  now: Date = new Date()
): { available: boolean; reason: string | null } {
  if (ticket.purchaseAvailable === false && ticket.purchaseBlockedReason) {
    return { available: false, reason: ticket.purchaseBlockedReason };
  }

  if (ticket.saleStartsAt) {
    const start = new Date(ticket.saleStartsAt);
    if (!Number.isNaN(start.getTime()) && now < start) {
      return { available: false, reason: 'Ce billet n’est pas encore en vente.' };
    }
  }

  if (ticket.saleEndsAt) {
    const end = new Date(ticket.saleEndsAt);
    if (!Number.isNaN(end.getTime()) && now > end) {
      return { available: false, reason: 'La vente de ce billet est terminée.' };
    }
  }

  if (ticket.stockLimit != null && ticket.stockLimit >= 0) {
    const reserved = ticket.reservedCount ?? 0;
    if (reserved >= ticket.stockLimit) {
      return { available: false, reason: 'Ce billet est épuisé.' };
    }
  }

  return { available: true, reason: null };
}

export function ticketTypeToCatalogItem(
  supabase: SupabaseClient,
  row: TicketTypeRow,
  reservedCount = 0
): TicketCatalogItem {
  const base: TicketCatalogItem = {
    id: row.id,
    title: row.title,
    desc: row.description ?? '',
    price: formatFcfa(row.amount),
    amount: row.amount,
    img: getTicketImageUrl(supabase, row),
    category: row.category,
    requiresStudent: row.requires_student,
    requiresMember: row.requires_member,
    stockLimit: row.stock_limit,
    saleStartsAt: row.sale_starts_at,
    saleEndsAt: row.sale_ends_at,
    reservedCount,
  };
  const availability = evaluateTicketPurchaseAvailability(base);
  return {
    ...base,
    purchaseAvailable: availability.available,
    purchaseBlockedReason: availability.reason,
  };
}

export async function countReservedTicketsByType(
  supabase: SupabaseClient,
  ticketTypeIds: string[]
): Promise<Record<string, number>> {
  const out: Record<string, number> = {};
  if (ticketTypeIds.length === 0) return out;

  const { data } = await supabase
    .from('tickets_registrations')
    .select('ticket_type_id, statut_paiement')
    .in('ticket_type_id', ticketTypeIds)
    .in('statut_paiement', ['Paye', 'En_Attente']);

  for (const row of data ?? []) {
    const id = (row as { ticket_type_id?: string | null }).ticket_type_id;
    if (!id) continue;
    out[id] = (out[id] ?? 0) + 1;
  }
  return out;
}

export async function fetchTicketTypes(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<TicketTypeRow[]> {
  let query = supabase
    .from('ticket_types')
    .select(TICKET_SELECT)
    .order('ordre', { ascending: true })
    .order('title', { ascending: true });

  if (options?.activeOnly) {
    query = query.eq('is_active', true);
  }

  const { data, error } = await query;
  if (error) return [];
  return (data ?? []) as TicketTypeRow[];
}

/** Catalogue affiché (accueil / billetterie). Fallback sur TICKET_CATALOG si BDD vide. */
export async function fetchTicketCatalog(
  supabase: SupabaseClient,
  options?: { activeOnly?: boolean }
): Promise<TicketCatalogItem[]> {
  const rows = await fetchTicketTypes(supabase, { activeOnly: options?.activeOnly ?? true });
  if (rows.length === 0) return TICKET_CATALOG;
  const reserved = await countReservedTicketsByType(
    supabase,
    rows.map((r) => r.id)
  );
  return rows.map((row) => ticketTypeToCatalogItem(supabase, row, reserved[row.id] ?? 0));
}

export function normalizeTicketTypeInput(input: TicketTypeInput): Record<string, unknown> {
  const stockRaw = input.stock_limit;
  const stockLimit =
    stockRaw === null || stockRaw === undefined || String(stockRaw).trim() === ''
      ? null
      : Math.max(0, Math.round(Number(stockRaw)));

  return {
    id: input.id.trim(),
    title: input.title.trim(),
    description: cleanText(input.description),
    amount: Math.max(0, Math.round(Number(input.amount) || 0)),
    category: input.category.trim() || 'Général',
    image_path: cleanText(input.image_path),
    image_url: cleanText(input.image_url),
    requires_student: input.requires_student ?? false,
    requires_member: input.requires_member ?? false,
    ordre: input.ordre ?? 0,
    is_active: input.is_active ?? true,
    stock_limit: Number.isFinite(stockLimit as number) ? stockLimit : null,
    sale_starts_at: cleanText(input.sale_starts_at),
    sale_ends_at: cleanText(input.sale_ends_at),
  };
}

export function validateTicketImage(file: File): string | null {
  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  if (!TICKET_IMAGE_EXTENSIONS.includes(ext as (typeof TICKET_IMAGE_EXTENSIONS)[number])) {
    return `Format non autorisé (${TICKET_IMAGE_EXTENSIONS.join(', ')}).`;
  }
  if (file.size > MAX_TICKET_IMAGE_MB * 1024 * 1024) {
    return `Image trop volumineuse (max ${MAX_TICKET_IMAGE_MB} Mo).`;
  }
  return null;
}

export function buildTicketImagePath(ticketId: string, fileName: string): string {
  const safeId = sanitizeFileName(ticketId || 'ticket');
  const safeFile = sanitizeFileName(fileName);
  return `${safeId}/${Date.now()}-${safeFile}`;
}

export async function uploadTicketImage(
  supabase: SupabaseClient,
  ticketId: string,
  file: File,
  existingPath?: string | null
): Promise<{ imagePath: string | null; error: string | null }> {
  const validation = validateTicketImage(file);
  if (validation) return { imagePath: null, error: validation };

  if (existingPath) {
    await supabase.storage.from(TICKET_IMAGES_BUCKET).remove([existingPath]);
  }

  const ext = file.name.toLowerCase().split('.').pop() ?? '';
  const imagePath = buildTicketImagePath(ticketId, file.name);
  const { error } = await supabase.storage.from(TICKET_IMAGES_BUCKET).upload(imagePath, file, {
    upsert: false,
    contentType: file.type || MIME_BY_EXTENSION[ext] || 'application/octet-stream',
  });

  return error ? { imagePath: null, error: error.message } : { imagePath, error: null };
}

export async function removeTicketImage(
  supabase: SupabaseClient,
  imagePath: string | null | undefined
): Promise<string | null> {
  if (!imagePath) return null;
  const { error } = await supabase.storage.from(TICKET_IMAGES_BUCKET).remove([imagePath]);
  return error?.message ?? null;
}

export async function createTicketType(
  supabase: SupabaseClient,
  input: TicketTypeInput
): Promise<string | null> {
  if (!input.id.trim()) return 'L’identifiant du billet est obligatoire.';
  if (!input.title.trim()) return 'Le titre du billet est obligatoire.';
  const { error } = await supabase.from('ticket_types').insert(normalizeTicketTypeInput(input));
  return error ? error.message : null;
}

export async function updateTicketType(
  supabase: SupabaseClient,
  id: string,
  input: TicketTypeInput
): Promise<string | null> {
  if (!input.title.trim()) return 'Le titre du billet est obligatoire.';
  const payload = normalizeTicketTypeInput({ ...input, id });
  delete payload.id;
  const { error } = await supabase
    .from('ticket_types')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('id', id);
  return error ? error.message : null;
}

export async function deleteTicketType(
  supabase: SupabaseClient,
  id: string
): Promise<{ error: string | null; softDeleted?: boolean }> {
  const { count, error: countError } = await supabase
    .from('tickets_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('ticket_type_id', id);

  if (countError) return { error: countError.message };

  // Déjà vendu / tentatives : soft-delete (masquer) pour préserver l’historique
  if ((count ?? 0) > 0) {
    const { error } = await supabase
      .from('ticket_types')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return { error: error.message };
    return { error: null, softDeleted: true };
  }

  const { data } = await supabase.from('ticket_types').select('image_path').eq('id', id).maybeSingle();
  const { error } = await supabase.from('ticket_types').delete().eq('id', id);
  if (error) return { error: error.message };
  if (data?.image_path) {
    await removeTicketImage(supabase, data.image_path as string);
  }
  await pruneTicketPaymentLinks(supabase);
  return { error: null, softDeleted: false };
}

/** Monte / descend un billet dans la liste (échange d’ordre avec le voisin). */
export async function moveTicketTypeOrder(
  supabase: SupabaseClient,
  ticketId: string,
  direction: 'up' | 'down'
): Promise<string | null> {
  const tickets = await fetchTicketTypes(supabase);
  const index = tickets.findIndex((t) => t.id === ticketId);
  if (index < 0) return 'Billet introuvable.';

  const swapIndex = direction === 'up' ? index - 1 : index + 1;
  if (swapIndex < 0 || swapIndex >= tickets.length) return null;

  const current = tickets[index];
  const neighbor = tickets[swapIndex];
  const currentOrder = current.ordre ?? index * 10;
  const neighborOrder = neighbor.ordre ?? swapIndex * 10;

  // Si les ordres sont identiques, forcer un écart
  const nextCurrent = neighborOrder;
  const nextNeighbor = currentOrder === neighborOrder ? neighborOrder + (direction === 'up' ? 1 : -1) : currentOrder;

  const now = new Date().toISOString();
  const [{ error: errA }, { error: errB }] = await Promise.all([
    supabase.from('ticket_types').update({ ordre: nextCurrent, updated_at: now }).eq('id', current.id),
    supabase.from('ticket_types').update({ ordre: nextNeighbor, updated_at: now }).eq('id', neighbor.id),
  ]);

  return errA?.message ?? errB?.message ?? null;
}

/**
 * Réutilise une tentative En_Attente existante pour (user, billet),
 * sinon en crée une. Évite les doublons à chaque clic « Acheter ».
 */
export async function ensurePendingTicketRegistration(
  supabase: SupabaseClient,
  userId: string,
  ticket: TicketCatalogItem
): Promise<{ id: string | null; error: string | null; reused: boolean }> {
  const { data: byTypeId } = await supabase
    .from('tickets_registrations')
    .select('id')
    .eq('user_id', userId)
    .eq('statut_paiement', 'En_Attente')
    .eq('ticket_type_id', ticket.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  let existingId = byTypeId?.id as string | undefined;

  if (!existingId) {
    const { data: byTitle } = await supabase
      .from('tickets_registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('statut_paiement', 'En_Attente')
      .eq('type_billet', ticket.title)
      .is('ticket_type_id', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    existingId = byTitle?.id as string | undefined;
  }

  if (existingId) {
    // Réutilisation : pas de nouveau créneau stock consommé
    const windowOnly = evaluateTicketPurchaseAvailability({
      ...ticket,
      stockLimit: null,
      reservedCount: 0,
    });
    if (!windowOnly.available) {
      return { id: null, error: windowOnly.reason || 'Billet indisponible.', reused: false };
    }

    const { error } = await supabase
      .from('tickets_registrations')
      .update({
        ticket_type_id: ticket.id,
        type_billet: ticket.title,
        montant: ticket.amount,
      })
      .eq('id', existingId);

    if (error) return { id: null, error: error.message, reused: false };
    return { id: existingId, error: null, reused: true };
  }

  // Déjà payé pour ce type → pas de second achat
  const { count: paidCount } = await supabase
    .from('tickets_registrations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('ticket_type_id', ticket.id)
    .eq('statut_paiement', 'Paye');
  if ((paidCount ?? 0) > 0) {
    return {
      id: null,
      error: 'Vous avez déjà un billet payé de ce type. Consultez « Mon badge ».',
      reused: false,
    };
  }

  const reservedMap = await countReservedTicketsByType(supabase, [ticket.id]);
  const liveCheck = evaluateTicketPurchaseAvailability({
    ...ticket,
    reservedCount: reservedMap[ticket.id] ?? 0,
  });
  if (!liveCheck.available) {
    return { id: null, error: liveCheck.reason || 'Billet indisponible.', reused: false };
  }

  const { data: created, error } = await supabase
    .from('tickets_registrations')
    .insert({
      user_id: userId,
      ticket_type_id: ticket.id,
      type_billet: ticket.title,
      montant: ticket.amount,
      statut_paiement: 'En_Attente',
    })
    .select('id')
    .single();

  if (error || !created) {
    const { data: raced } = await supabase
      .from('tickets_registrations')
      .select('id')
      .eq('user_id', userId)
      .eq('statut_paiement', 'En_Attente')
      .eq('ticket_type_id', ticket.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (raced?.id) {
      return { id: raced.id as string, error: null, reused: true };
    }
    return { id: null, error: error?.message ?? 'Impossible de créer la demande.', reused: false };
  }

  return { id: created.id as string, error: null, reused: false };
}

/** Ne conserve que les liens Kkiapay dont l’id existe encore dans ticket_types. */
export async function pruneTicketPaymentLinks(
  supabase: SupabaseClient,
  validIds?: string[]
): Promise<string | null> {
  const { data: config } = await supabase
    .from('events_config')
    .select('id, ticket_payment_links')
    .limit(1)
    .maybeSingle();

  if (!config?.id) return null;

  let keepIds = validIds;
  if (!keepIds) {
    const types = await fetchTicketTypes(supabase);
    // Si la table est inaccessible, ne pas tout effacer.
    if (types.length === 0) return null;
    keepIds = types.map((t) => t.id);
  }

  const keepSet = new Set(keepIds);
  const current = parseTicketPaymentLinks(config.ticket_payment_links);
  const cleaned: TicketPaymentLinks = {};
  for (const [key, url] of Object.entries(current)) {
    if (keepSet.has(key)) cleaned[key] = url;
  }

  const sameKeys =
    Object.keys(cleaned).length === Object.keys(current).length &&
    Object.keys(cleaned).every((k) => current[k] === cleaned[k]);
  if (sameKeys) return null;

  const { error } = await supabase
    .from('events_config')
    .update({ ticket_payment_links: cleaned })
    .eq('id', config.id);

  return error?.message ?? null;
}

export function paymentStatusLabel(status: PaymentStatus): string {
  switch (status) {
    case 'Paye':
      return 'Payé';
    case 'Echoue':
      return 'Échoué';
    default:
      return 'En attente';
  }
}

export function paymentStatusColor(status: PaymentStatus): { bg: string; color: string } {
  switch (status) {
    case 'Paye':
      return { bg: '#dcfce7', color: '#166534' };
    case 'Echoue':
      return { bg: '#fee2e2', color: '#991b1b' };
    default:
      return { bg: '#fef3c7', color: '#b45309' };
  }
}

export interface EventConfig {
  id: string;
  nom_evenement: string;
  date_debut: string | null;
  date_fin: string | null;
}

/** Map { ticketId: urlDePaiementKkiapay } stockée dans events_config.ticket_payment_links. */
export type TicketPaymentLinks = Record<string, string>;

export function parseTicketPaymentLinks(raw: unknown): TicketPaymentLinks {
  if (!raw || typeof raw !== 'object') return {};
  const out: TicketPaymentLinks = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === 'string' && value.trim()) out[key] = value.trim();
  }
  return out;
}

export function isValidPaymentUrl(url: string): boolean {
  const trimmed = url.trim();
  if (!trimmed) return false;
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

export function formatEventDates(debut: string | null, fin: string | null): string {
  if (!debut) return 'Dates à confirmer';
  const d1 = new Date(debut).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  if (!fin || fin === debut) return d1;
  const d2 = new Date(fin).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  return `${d1} — ${d2}`;
}
