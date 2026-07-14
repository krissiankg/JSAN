import type { SupabaseClient } from '@supabase/supabase-js';

export const BLOG_IMAGES_BUCKET = 'blog-images';

const ALLOWED_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif']);
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

function extensionFromFile(file: File): string | null {
  const fromName = file.name.split('.').pop()?.toLowerCase();
  if (fromName && ALLOWED_EXTENSIONS.has(fromName)) return fromName === 'jpeg' ? 'jpg' : fromName;

  const mime = file.type.toLowerCase();
  if (mime === 'image/png') return 'png';
  if (mime === 'image/jpeg') return 'jpg';
  if (mime === 'image/webp') return 'webp';
  if (mime === 'image/gif') return 'gif';
  return null;
}

export async function uploadBlogImage(
  supabase: SupabaseClient,
  file: File
): Promise<{ publicUrl: string | null; error: string | null }> {
  const ext = extensionFromFile(file);
  if (!ext) {
    return { publicUrl: null, error: 'Format non supporté (PNG, JPG, WebP, GIF).' };
  }
  if (file.size > MAX_SIZE_BYTES) {
    return { publicUrl: null, error: 'Image trop volumineuse (max 10 Mo).' };
  }

  const path = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
  const { error } = await supabase.storage.from(BLOG_IMAGES_BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || `image/${ext === 'jpg' ? 'jpeg' : ext}`,
  });

  if (error) {
    return { publicUrl: null, error: error.message };
  }

  const { data } = supabase.storage.from(BLOG_IMAGES_BUCKET).getPublicUrl(path);
  return { publicUrl: data.publicUrl, error: null };
}
