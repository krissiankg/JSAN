import type { SupabaseClient } from '@supabase/supabase-js';

import DOMPurify from 'isomorphic-dompurify';

export type BlogPostStatus = 'draft' | 'published' | 'archived';

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  cover_image_url: string | null;
  status: BlogPostStatus;
  published_at: string | null;
  newsletter_sent_at: string | null;
  author_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface BlogPostInput {
  title: string;
  slug?: string;
  excerpt?: string;
  content: string;
  cover_image_url?: string | null;
  status: BlogPostStatus;
}

export function slugifyBlogTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'article';
}

export async function ensureUniqueBlogSlug(
  supabase: SupabaseClient,
  baseSlug: string,
  excludeId?: string
): Promise<string> {
  let slug = baseSlug;
  let suffix = 2;

  while (true) {
    let query = supabase.from('blog_posts').select('id').eq('slug', slug).limit(1);
    if (excludeId) query = query.neq('id', excludeId);
    const { data } = await query.maybeSingle();
    if (!data) return slug;
    slug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }
}

export async function fetchPublishedBlogPosts(supabase: SupabaseClient): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}

export async function fetchBlogPostBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<BlogPost | null> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data as BlogPost | null) ?? null;
}

export async function fetchAllBlogPosts(supabase: SupabaseClient): Promise<BlogPost[]> {
  const { data, error } = await supabase
    .from('blog_posts')
    .select('*')
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}

export async function fetchBlogPostById(
  supabase: SupabaseClient,
  id: string
): Promise<BlogPost | null> {
  const { data, error } = await supabase.from('blog_posts').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(error.message);
  return (data as BlogPost | null) ?? null;
}

export async function createBlogPost(
  supabase: SupabaseClient,
  input: BlogPostInput,
  authorId: string | null
): Promise<{ post: BlogPost | null; error: string | null }> {
  const baseSlug = slugifyBlogTitle(input.slug?.trim() || input.title);
  const slug = await ensureUniqueBlogSlug(supabase, baseSlug);
  const now = new Date().toISOString();
  const isPublished = input.status === 'published';

  const { data, error } = await supabase
    .from('blog_posts')
    .insert({
      slug,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() || null,
      content: input.content,
      cover_image_url: input.cover_image_url?.trim() || null,
      status: input.status,
      published_at: isPublished ? now : null,
      author_id: authorId,
      updated_at: now,
    })
    .select('*')
    .single();

  if (error) return { post: null, error: error.message };
  return { post: data as BlogPost, error: null };
}

export async function updateBlogPost(
  supabase: SupabaseClient,
  id: string,
  input: BlogPostInput
): Promise<{ post: BlogPost | null; error: string | null }> {
  const existing = await fetchBlogPostById(supabase, id);
  if (!existing) return { post: null, error: 'Article introuvable.' };

  const baseSlug = slugifyBlogTitle(input.slug?.trim() || input.title);
  const slug = await ensureUniqueBlogSlug(supabase, baseSlug, id);
  const now = new Date().toISOString();
  const isPublished = input.status === 'published';
  const publishedAt =
    isPublished ? (existing.published_at ?? now) : null;

  const { data, error } = await supabase
    .from('blog_posts')
    .update({
      slug,
      title: input.title.trim(),
      excerpt: input.excerpt?.trim() || null,
      content: input.content,
      cover_image_url: input.cover_image_url?.trim() || null,
      status: input.status,
      published_at: publishedAt,
      updated_at: now,
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) return { post: null, error: error.message };
  return { post: data as BlogPost, error: null };
}

export async function markBlogNewsletterSent(
  supabase: SupabaseClient,
  postId: string
): Promise<void> {
  await supabase
    .from('blog_posts')
    .update({ newsletter_sent_at: new Date().toISOString() })
    .eq('id', postId);
}

export function formatBlogDate(iso: string | null): string {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function looksLikeBlogHtml(content: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(content.trim());
}

export function plainTextToBlogHtml(content: string): string {
  return content
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, '<br />')}</p>`)
    .join('');
}

export function normalizeBlogEditorContent(content: string): string {
  if (!content.trim()) return '';
  return looksLikeBlogHtml(content) ? content : plainTextToBlogHtml(content);
}

export function stripBlogHtml(content: string): string {
  if (!content.trim()) return '';
  const html = looksLikeBlogHtml(content) ? content : plainTextToBlogHtml(content);
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function renderBlogContentHtml(content: string): string {
  if (!content.trim()) return '';
  const html = looksLikeBlogHtml(content) ? content : plainTextToBlogHtml(content);
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS: [
      'p', 'br', 'strong', 'b', 'em', 'i', 'u', 's', 'h2', 'h3',
      'ul', 'ol', 'li', 'a', 'img', 'span', 'blockquote', 'div',
    ],
    ALLOWED_ATTR: ['href', 'src', 'alt', 'title', 'target', 'rel', 'style', 'class'],
    ALLOW_DATA_ATTR: false,
  });
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
