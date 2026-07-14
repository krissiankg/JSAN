import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { UserProfile } from '@/lib/roles';
import { fetchProfileDocuments } from '@/lib/profile-documents';
import { assessProfileReminders, remindersForBell } from '@/lib/profile-completeness';

export async function POST() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }

  try {
    const admin = createAdminClient();
    const { data: profile, error: profileError } = await admin
      .from('users_profile')
      .select('*')
      .eq('id', auth.user.id)
      .maybeSingle();

    if (profileError) {
      return NextResponse.json({ ok: false, error: profileError.message }, { status: 500 });
    }

    const documents = await fetchProfileDocuments(admin, auth.user.id);
    const reminders = remindersForBell(
      assessProfileReminders(profile as UserProfile | null, documents)
    );

    const allPossibleTitles = [
      'Complétez votre profil',
      'Déposez vos documents justificatifs',
      'Justificatif refusé — nouvelle soumission requise',
      'Justificatif en cours de validation',
    ];
    const activeTitles = new Set(reminders.map((r) => r.notificationTitle));
    const obsoleteTitles = allPossibleTitles.filter((t) => !activeTitles.has(t));

    if (obsoleteTitles.length > 0) {
      await admin
        .from('user_notifications')
        .update({ is_read: true })
        .eq('user_id', auth.user.id)
        .eq('is_read', false)
        .in('title', obsoleteTitles);
    }

    if (reminders.length === 0) {
      return NextResponse.json({ ok: true, created: 0, reminders: [] });
    }

    const titles = reminders.map((r) => r.notificationTitle);
    const { data: existing } = await admin
      .from('user_notifications')
      .select('title')
      .eq('user_id', auth.user.id)
      .eq('is_read', false)
      .in('title', titles);

    const existingTitles = new Set((existing ?? []).map((row) => row.title as string));
    const toInsert = reminders
      .filter((r) => !existingTitles.has(r.notificationTitle))
      .map((r) => ({
        user_id: auth.user.id,
        type: 'system' as const,
        title: r.notificationTitle,
        body: r.body,
        link: r.link,
        is_read: false,
      }));

    if (toInsert.length > 0) {
      const { error: insertError } = await admin.from('user_notifications').insert(toInsert);
      if (insertError) {
        return NextResponse.json({ ok: false, error: insertError.message }, { status: 500 });
      }
    }

    return NextResponse.json({
      ok: true,
      created: toInsert.length,
      reminders: reminders.map((r) => r.kind),
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : 'Impossible de créer les rappels.' },
      { status: 500 }
    );
  }
}
