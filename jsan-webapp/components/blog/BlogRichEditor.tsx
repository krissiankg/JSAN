"use client";

import React, { useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Underline from '@tiptap/extension-underline';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Placeholder from '@tiptap/extension-placeholder';
import type { SupabaseClient } from '@supabase/supabase-js';

import { normalizeBlogEditorContent } from '@/lib/blog';
import { uploadBlogImage } from '@/lib/blog-images';
import './BlogRichEditor.css';

const TEXT_COLORS = ['#0f172a', '#166534', '#b45309', '#dc2626', '#1B6B2E', '#C9A010', '#64748b'];

interface BlogRichEditorProps {
  content: string;
  onChange: (html: string) => void;
  supabase: SupabaseClient;
  placeholder?: string;
}

function ToolbarButton({
  active,
  disabled,
  onClick,
  title,
  children,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      className={active ? 'is-active' : undefined}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

export default function BlogRichEditor({ content, onChange, supabase, placeholder }: BlogRichEditorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
      }),
      Underline,
      Link.configure({
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer', target: '_blank' },
      }),
      Image.configure({
        inline: false,
        allowBase64: false,
      }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      TextStyle,
      Color,
      Placeholder.configure({
        placeholder: placeholder ?? 'Rédigez votre article…',
      }),
    ],
    content: normalizeBlogEditorContent(content),
    onUpdate: ({ editor: currentEditor }) => {
      onChange(currentEditor.getHTML());
    },
    editorProps: {
      attributes: {
        class: 'blog-rich-editor__content',
      },
    },
  });

  const handleImagePick = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !editor) return;

    setUploading(true);
    setUploadError(null);
    const { publicUrl, error } = await uploadBlogImage(supabase, file);
    setUploading(false);

    if (error || !publicUrl) {
      setUploadError(error ?? 'Upload impossible.');
      return;
    }

    editor.chain().focus().setImage({ src: publicUrl, alt: file.name.replace(/\.[^.]+$/, '') }).run();
  };

  const setLink = () => {
    if (!editor) return;
    const previous = editor.getAttributes('link').href as string | undefined;
    const url = window.prompt('URL du lien', previous ?? 'https://');
    if (url === null) return;
    if (url.trim() === '') {
      editor.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run();
  };

  if (!editor) {
    return <div className="blog-rich-editor__content-wrap">Chargement de l’éditeur…</div>;
  }

  return (
    <div className="blog-rich-editor">
      <div className="blog-rich-editor__toolbar">
        <ToolbarButton
          title="Gras"
          active={editor.isActive('bold')}
          onClick={() => editor.chain().focus().toggleBold().run()}
        >
          <strong>B</strong>
        </ToolbarButton>
        <ToolbarButton
          title="Italique"
          active={editor.isActive('italic')}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        >
          <em>I</em>
        </ToolbarButton>
        <ToolbarButton
          title="Souligné"
          active={editor.isActive('underline')}
          onClick={() => editor.chain().focus().toggleUnderline().run()}
        >
          <u>U</u>
        </ToolbarButton>

        <span className="blog-rich-editor__divider" />

        <ToolbarButton
          title="Titre niveau 2"
          active={editor.isActive('heading', { level: 2 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        >
          H2
        </ToolbarButton>
        <ToolbarButton
          title="Titre niveau 3"
          active={editor.isActive('heading', { level: 3 })}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        >
          H3
        </ToolbarButton>

        <span className="blog-rich-editor__divider" />

        <ToolbarButton
          title="Liste à puces"
          active={editor.isActive('bulletList')}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        >
          •
        </ToolbarButton>
        <ToolbarButton
          title="Liste numérotée"
          active={editor.isActive('orderedList')}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        >
          1.
        </ToolbarButton>
        <ToolbarButton
          title="Citation"
          active={editor.isActive('blockquote')}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        >
          “
        </ToolbarButton>

        <span className="blog-rich-editor__divider" />

        <ToolbarButton
          title="Aligner à gauche"
          active={editor.isActive({ textAlign: 'left' })}
          onClick={() => editor.chain().focus().setTextAlign('left').run()}
        >
          ⬅
        </ToolbarButton>
        <ToolbarButton
          title="Centrer"
          active={editor.isActive({ textAlign: 'center' })}
          onClick={() => editor.chain().focus().setTextAlign('center').run()}
        >
          ↔
        </ToolbarButton>
        <ToolbarButton
          title="Aligner à droite"
          active={editor.isActive({ textAlign: 'right' })}
          onClick={() => editor.chain().focus().setTextAlign('right').run()}
        >
          ➡
        </ToolbarButton>

        <span className="blog-rich-editor__divider" />

        <div className="blog-rich-editor__colors" title="Couleur du texte">
          {TEXT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className={`blog-rich-editor__color-swatch${editor.isActive('textStyle', { color }) ? ' is-active' : ''}`}
              style={{ background: color }}
              title={color}
              onClick={() => editor.chain().focus().setColor(color).run()}
            />
          ))}
          <ToolbarButton title="Réinitialiser la couleur" onClick={() => editor.chain().focus().unsetColor().run()}>
            ✕
          </ToolbarButton>
        </div>

        <span className="blog-rich-editor__divider" />

        <ToolbarButton title="Insérer un lien" active={editor.isActive('link')} onClick={setLink}>
          🔗
        </ToolbarButton>
        <label
          className={uploading ? 'is-disabled' : undefined}
          title="Insérer une image"
          style={{ cursor: uploading ? 'not-allowed' : 'pointer' }}
        >
          🖼
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            hidden
            disabled={uploading}
            onChange={handleImagePick}
          />
        </label>

        <span className="blog-rich-editor__divider" />

        <ToolbarButton title="Annuler" disabled={!editor.can().undo()} onClick={() => editor.chain().focus().undo().run()}>
          ↶
        </ToolbarButton>
        <ToolbarButton title="Rétablir" disabled={!editor.can().redo()} onClick={() => editor.chain().focus().redo().run()}>
          ↷
        </ToolbarButton>
      </div>

      <div className="blog-rich-editor__content-wrap">
        <EditorContent editor={editor} />
      </div>

      <div className="blog-rich-editor__status">
        {uploading
          ? 'Envoi de l’image en cours…'
          : uploadError
            ? uploadError
            : 'Gras, italique, couleurs, listes, liens et images intégrées au contenu.'}
      </div>
    </div>
  );
}
