import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { fetchBlogPostById, markBlogNewsletterSent } from '@/lib/blog';
import { sendNewsletterCampaign } from '@/lib/newsletter-send';
import { isEventStaff, mapDbRoleToAppRole, type DbUserRole } from '@/lib/roles';

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) {
    return NextResponse.json({ ok: false, error: 'Non authentifié.' }, { status: 401 });
  }

  const { data: profile } = await supabase.from('users_profile').select('role').eq('id', auth.user.id).maybeSingle();
  const role = profile?.role as DbUserRole | undefined;
  if (!role || !isEventStaff(mapDbRoleToAppRole(role))) {
    return NextResponse.json({ ok: false, error: 'Accès refusé.' }, { status: 403 });
  }

  let body: { postId?: string };
  try {
    body = (await request.json()) as { postId?: string };
  } catch {
    return NextResponse.json({ ok: false, error: 'JSON invalide.' }, { status: 400 });
  }

  if (!body.postId) {
    return NextResponse.json({ ok: false, error: 'postId requis.' }, { status: 400 });
  }

  const admin = createAdminClient();
  const post = await fetchBlogPostById(admin, body.postId);
  if (!post || post.status !== 'published') {
    return NextResponse.json({ ok: false, error: 'Article publié introuvable.' }, { status: 404 });
  }

  const link = `/blog/${post.slug}`;
  const result = await sendNewsletterCampaign({
    supabase: admin,
    createdBy: auth.user.id,
    templateKey: 'blog_post_published',
    variables: {
      titre_article: post.title,
      extrait_article: post.excerpt?.trim() || 'Découvrez le nouvel article sur le blog JSAN.',
      lien_article: link,
      nom_evenement: 'JSAN',
    },
    link,
    campaignKind: 'blog',
    audienceLabel: 'newsletter_subscribers',
    metadata: { postId: post.id, slug: post.slug },
  });

  if (result.skipped) {
    return NextResponse.json({ ok: false, skipped: true, reason: result.reason }, { status: 200 });
  }

  if (result.ok && result.sent > 0) {
    await markBlogNewsletterSent(admin, post.id);
  }

  return NextResponse.json({
    ok: result.ok,
    sent: result.sent,
    failed: result.failed,
    recipientCount: result.recipientCount,
  });
}
