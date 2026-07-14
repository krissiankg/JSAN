"use client";

import React, { useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';

import { uploadBlogImage } from '@/lib/blog-images';
import './BlogRichEditor.css';

interface BlogCoverImageFieldProps {
  value: string;
  onChange: (url: string) => void;
  supabase: SupabaseClient;
}

export default function BlogCoverImageField({ value, onChange, supabase }: BlogCoverImageFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    setUploading(true);
    setError(null);
    const { publicUrl, error: uploadError } = await uploadBlogImage(supabase, file);
    setUploading(false);

    if (uploadError || !publicUrl) {
      setError(uploadError ?? 'Upload impossible.');
      return;
    }

    onChange(publicUrl);
  };

  return (
    <div className="blog-cover-field">
      <label style={{ fontSize: '14px', fontWeight: 600, color: '#334155' }}>Image de couverture</label>

      {value ? (
        <img src={value} alt="Couverture" className="blog-cover-field__preview" />
      ) : null}

      <div className="blog-cover-field__actions">
        <label className={uploading ? 'is-disabled' : undefined}>
          {uploading ? 'Envoi…' : 'Téléverser une image'}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            disabled={uploading}
            onChange={handleUpload}
          />
        </label>
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              background: '#fff',
              padding: '8px 14px',
              fontSize: '13px',
              cursor: 'pointer',
            }}
          >
            Retirer
          </button>
        ) : null}
      </div>

      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Ou coller une URL d’image (optionnel)"
        style={{
          width: '100%',
          boxSizing: 'border-box',
          padding: '10px 12px',
          borderRadius: '8px',
          border: '1px solid #cbd5e1',
          fontSize: '14px',
        }}
      />

      <div className="blog-cover-field__hint">
        {error ?? 'PNG, JPG, WebP ou GIF — max 10 Mo. Affichée en haut de l’article et dans la liste du blog.'}
      </div>
    </div>
  );
}
