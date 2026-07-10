import Link from 'next/link';

import { formatBlogDate, fetchPublishedBlogPosts } from '@/lib/blog';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BlogIndexPage() {
  const supabase = await createClient();
  const posts = await fetchPublishedBlogPosts(supabase).catch(() => []);

  return (
    <>
      <div className="blog-hero">
        <h1>Blog JSAN</h1>
        <p>Actualités, comptes-rendus et annonces publiques des Journées Scientifiques de l&apos;Alimentation et de la Nutrition.</p>
      </div>

      {posts.length === 0 ? (
        <div className="blog-empty">
          <p>Aucun article publié pour le moment. Revenez bientôt ou inscrivez-vous à la newsletter sur la page d&apos;accueil.</p>
          <p style={{ marginTop: '12px' }}>
            <Link href="/">Retour à l&apos;accueil</Link>
          </p>
        </div>
      ) : (
        <div className="blog-grid">
          {posts.map((post) => (
            <article key={post.id} className="blog-card">
              <Link href={`/blog/${post.slug}`}>
                {post.cover_image_url ? (
                  <div
                    className="blog-card-cover"
                    style={{ backgroundImage: `url(${post.cover_image_url})` }}
                  />
                ) : (
                  <div className="blog-card-cover" style={{ background: 'linear-gradient(135deg, #166534, #0f172a)' }} />
                )}
                <div className="blog-card-body">
                  <div className="blog-card-date">{formatBlogDate(post.published_at)}</div>
                  <h2>{post.title}</h2>
                  <p>{post.excerpt || 'Lire l’article complet sur le blog JSAN.'}</p>
                </div>
              </Link>
            </article>
          ))}
        </div>
      )}
    </>
  );
}
