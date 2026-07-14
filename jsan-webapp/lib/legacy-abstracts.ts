import type { SupabaseClient } from '@supabase/supabase-js';

export interface LegacyClaimResult {
  claimed: number;
  titles: string[];
}

function normalizeEmail(value: string | null | undefined): string {
  return (value ?? '').trim().toLowerCase();
}

/**
 * Rattache les résumés legacy (author_id NULL) dont claim_email = e-mail du compte.
 * À appeler avec un client admin (service role) ou depuis une route API serveur.
 */
export async function claimLegacyAbstractsForUser(
  admin: SupabaseClient,
  userId: string,
  email: string
): Promise<LegacyClaimResult> {
  const claimEmail = normalizeEmail(email);
  if (!claimEmail) return { claimed: 0, titles: [] };

  const { data: pending, error: readError } = await admin
    .from('abstracts')
    .select('id, titre')
    .is('author_id', null)
    .eq('claim_email', claimEmail);

  if (readError) throw new Error(readError.message);
  if (!pending?.length) return { claimed: 0, titles: [] };

  const ids = pending.map((row) => row.id);
  const { error: updateError } = await admin
    .from('abstracts')
    .update({
      author_id: userId,
      claimed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .in('id', ids)
    .is('author_id', null);

  if (updateError) throw new Error(updateError.message);

  return {
    claimed: pending.length,
    titles: pending.map((row) => row.titre),
  };
}

export async function notifyLegacyAbstractsClaimed(
  admin: SupabaseClient,
  userId: string,
  claimed: number
): Promise<void> {
  if (claimed <= 0) return;
  const title =
    claimed === 1
      ? '1 résumé JSAN 2025 a été ajouté à votre espace'
      : `${claimed} résumés JSAN 2025 ont été ajoutés à votre espace`;

  await admin.from('user_notifications').insert({
    user_id: userId,
    type: 'soumission',
    title,
    body: 'Ces documents proviennent de la 11ᵉ édition. Consultez-les dans Mes résumés ou la Bibliothèque.',
    link: '/dashboard/mes-resumes',
    is_read: false,
  });
}
