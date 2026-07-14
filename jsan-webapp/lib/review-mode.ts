import type { SupabaseClient } from '@supabase/supabase-js';

/** Lit le flag double aveugle depuis events_config (défaut : activé). */
export async function fetchDoubleBlindEnabled(supabase: SupabaseClient): Promise<boolean> {
  const { data } = await supabase
    .from('events_config')
    .select('double_aveugle_actif')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data || data.double_aveugle_actif == null) return true;
  return Boolean(data.double_aveugle_actif);
}

export async function setDoubleBlindEnabled(
  supabase: SupabaseClient,
  eventConfigId: string,
  enabled: boolean
): Promise<string | null> {
  const { error } = await supabase
    .from('events_config')
    .update({ double_aveugle_actif: enabled })
    .eq('id', eventConfigId);
  return error?.message ?? null;
}
