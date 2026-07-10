import Link from 'next/link';
import { notFound } from 'next/navigation';

import { fetchBlogPostBySlug, formatBlogDate, renderBlogContentHtml } from '@/lib/blog';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function BlogArticlePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const supabase = await createClient();
  const post = await fetchBlogPostBySlug(supabase, slug);

  if (!post) notFound();

  return (
    <>
      <Link href="/blog" className="blog-back">← Tous les articles</Link>
      <article className="blog-article">
        {post.cover_image_url && (
          <img src={post.cover_image_url} alt={post.title} className="blog-article-cover" />
        )}
        <div className="blog-article-content">
          <div className="blog-article-meta">{formatBlogDate(post.published_at)}</div>
          <h1>{post.title}</h1>
          {post.excerpt && <p className="blog-article-excerpt">{post.excerpt}</p>}
          <div
            className="blog-article-body"
            dangerouslySetInnerHTML={{ __html: renderBlogContentHtml(post.content) }}
          />
        </div>
      </article>
    </>
  );
}
