import type { SupabaseClient } from '@supabase/supabase-js';

// Agrégations pour le tableau de bord Rapports & Statistiques (Admin).
// Les données sont lues telles quelles (le staff a un accès complet via RLS)
// puis agrégées côté client — volume attendu modeste pour un congrès.

export interface AbstractRow {
  statut: string;
  thematique: string | null;
  created_at: string;
}
export interface StatutRow {
  statut: string;
}
export interface TicketRow {
  type_billet: string;
  montant: number | null;
  statut_paiement: string;
  created_at: string;
}
export interface UserRow {
  role: string;
}

export interface ReportsData {
  abstracts: AbstractRow[];
  fullArticles: StatutRow[];
  reviews: StatutRow[];
  tickets: TicketRow[];
  users: UserRow[];
}

export async function fetchReportsData(supabase: SupabaseClient): Promise<ReportsData> {
  const [abstractsRes, articlesRes, reviewsRes, ticketsRes, usersRes] = await Promise.all([
    supabase.from('abstracts').select('statut, thematique, created_at'),
    supabase.from('full_articles').select('statut'),
    supabase.from('reviews').select('statut'),
    supabase.from('tickets_registrations').select('type_billet, montant, statut_paiement, created_at'),
    supabase.from('users_profile').select('role'),
  ]);

  return {
    abstracts: (abstractsRes.data ?? []) as AbstractRow[],
    fullArticles: (articlesRes.data ?? []) as StatutRow[],
    reviews: (reviewsRes.data ?? []) as StatutRow[],
    tickets: (ticketsRes.data ?? []) as TicketRow[],
    users: (usersRes.data ?? []) as UserRow[],
  };
}

// --- Libellés FR ------------------------------------------------------------

export const ABSTRACT_STATUS_LABELS: Record<string, string> = {
  Brouillon: 'Brouillon',
  Soumis: 'Soumis',
  En_Evaluation: 'En évaluation',
  Accepte: 'Accepté',
  Rejete: 'Rejeté',
  A_Reviser: 'À réviser',
};

export const ARTICLE_STATUS_LABELS: Record<string, string> = {
  Brouillon: 'Brouillon',
  Soumis: 'Soumis',
  Accepte: 'Accepté',
  Rejete: 'Rejeté',
  Publie: 'Publié',
};

export const ROLE_LABELS: Record<string, string> = {
  participant: 'Participants',
  auteur: 'Auteurs',
  pair_en_attente: 'Évaluateurs (attente)',
  pair_valide: 'Évaluateurs validés',
  organisateur: 'Organisateurs',
  admin: 'Admins',
  superadmin: 'Super admins',
};

export const PAYMENT_LABELS: Record<string, string> = {
  En_Attente: 'En attente',
  Paye: 'Payé',
  Echoue: 'Échoué',
};

// --- Helpers ----------------------------------------------------------------

export interface ChartDatum {
  name: string;
  value: number;
}

function countBy<T>(rows: T[], key: (row: T) => string | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const k = key(row);
    if (k == null || k === '') continue;
    map.set(k, (map.get(k) ?? 0) + 1);
  }
  return map;
}

function toChartData(map: Map<string, number>, labels?: Record<string, string>): ChartDatum[] {
  return [...map.entries()]
    .map(([k, value]) => ({ name: labels?.[k] ?? k, value }))
    .sort((a, b) => b.value - a.value);
}

// --- KPI --------------------------------------------------------------------

export interface ReportsKpis {
  soumissions: number;
  acceptes: number;
  rejetes: number;
  enCours: number;
  tauxAcceptation: number | null;
  manuscrits: number;
  evaluationsCompletes: number;
  evaluationsEnAttente: number;
  tauxCompletionEval: number | null;
  utilisateurs: number;
  evaluateursValides: number;
  billetsPayes: number;
  revenus: number;
}

export function computeKpis(data: ReportsData): ReportsKpis {
  const submitted = data.abstracts.filter((a) => a.statut !== 'Brouillon');
  const acceptes = submitted.filter((a) => a.statut === 'Accepte').length;
  const rejetes = submitted.filter((a) => a.statut === 'Rejete').length;
  const decisions = acceptes + rejetes;
  const enCours = submitted.filter((a) => ['Soumis', 'En_Evaluation', 'A_Reviser'].includes(a.statut)).length;

  const evalComplete = data.reviews.filter((r) => r.statut === 'Complete').length;
  const evalAttente = data.reviews.filter((r) => r.statut === 'En_Attente').length;
  const totalEval = evalComplete + evalAttente;

  const paid = data.tickets.filter((t) => t.statut_paiement === 'Paye');
  const revenus = paid.reduce((sum, t) => sum + (Number(t.montant) || 0), 0);

  return {
    soumissions: submitted.length,
    acceptes,
    rejetes,
    enCours,
    tauxAcceptation: decisions > 0 ? Math.round((acceptes / decisions) * 100) : null,
    manuscrits: data.fullArticles.filter((a) => a.statut !== 'Brouillon').length,
    evaluationsCompletes: evalComplete,
    evaluationsEnAttente: evalAttente,
    tauxCompletionEval: totalEval > 0 ? Math.round((evalComplete / totalEval) * 100) : null,
    utilisateurs: data.users.length,
    evaluateursValides: data.users.filter((u) => u.role === 'pair_valide').length,
    billetsPayes: paid.length,
    revenus,
  };
}

// --- Séries pour graphiques -------------------------------------------------

export function abstractsByStatus(data: ReportsData): ChartDatum[] {
  return toChartData(
    countBy(data.abstracts.filter((a) => a.statut !== 'Brouillon'), (a) => a.statut),
    ABSTRACT_STATUS_LABELS
  );
}

export function abstractsByTheme(data: ReportsData): ChartDatum[] {
  return toChartData(countBy(data.abstracts, (a) => a.thematique));
}

export function articlesByStatus(data: ReportsData): ChartDatum[] {
  return toChartData(
    countBy(data.fullArticles.filter((a) => a.statut !== 'Brouillon'), (a) => a.statut),
    ARTICLE_STATUS_LABELS
  );
}

export function reviewsByStatus(data: ReportsData): ChartDatum[] {
  return toChartData(countBy(data.reviews, (r) => r.statut), {
    Complete: 'Complétées',
    En_Attente: 'En attente',
  });
}

export function usersByRole(data: ReportsData): ChartDatum[] {
  return toChartData(countBy(data.users, (u) => u.role), ROLE_LABELS);
}

export function paymentsByStatus(data: ReportsData): ChartDatum[] {
  return toChartData(countBy(data.tickets, (t) => t.statut_paiement), PAYMENT_LABELS);
}

/** Revenus (billets payés) agrégés par type de billet. */
export function revenueByTicket(data: ReportsData): ChartDatum[] {
  const map = new Map<string, number>();
  for (const t of data.tickets) {
    if (t.statut_paiement !== 'Paye') continue;
    map.set(t.type_billet, (map.get(t.type_billet) ?? 0) + (Number(t.montant) || 0));
  }
  return [...map.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value);
}
