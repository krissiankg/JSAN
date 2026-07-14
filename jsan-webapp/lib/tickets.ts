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
}

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
