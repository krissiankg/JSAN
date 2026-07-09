"use client";

import React, { useEffect, useRef, useState } from 'react';

const QUICK_EMOJIS = [
  '😀', '😊', '😅', '🙏', '👍', '👏', '🎉', '❤️', '✅', '❌',
  '📄', '📎', '💡', '⏳', '🎓', '📧', '🤔', '😢', '🔔', '✨',
  '👋', '💬', '📝', '🎯', '🚀', '⚠️', '❓', '💯', '🙂', '😉',
];

interface MessageEmojiPickerProps {
  onSelect: (emoji: string) => void;
  disabled?: boolean;
  variant?: 'default' | 'inline';
}

export default function MessageEmojiPicker({ onSelect, disabled, variant = 'default' }: MessageEmojiPickerProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [open]);

  const handleSelect = (emoji: string) => {
    onSelect(emoji);
    setOpen(false);
  };

  const isInline = variant === 'inline';

  return (
    <div ref={containerRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        title="Ajouter un emoji"
        aria-label="Ajouter un emoji"
        aria-expanded={open}
        style={isInline ? {
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          border: 'none',
          background: 'transparent',
          fontSize: '18px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
          padding: 0,
        } : {
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          border: '1px solid #e2e8f0',
          background: open ? '#f1f5f9' : '#fff',
          fontSize: '20px',
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        😊
      </button>

      {open && (
        <div
          role="listbox"
          aria-label="Choisir un emoji"
          style={{
            position: 'absolute',
            bottom: 'calc(100% + 8px)',
            left: 0,
            zIndex: 50,
            width: '252px',
            padding: '10px',
            boxSizing: 'border-box',
            overflow: 'hidden',
            background: '#fff',
            border: '1px solid #e2e8f0',
            borderRadius: '12px',
            boxShadow: '0 10px 40px rgba(0,0,0,0.12)',
            display: 'grid',
            gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
            gap: '4px',
          }}
        >
          {QUICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              role="option"
              onClick={() => handleSelect(emoji)}
              style={{
                width: '100%',
                height: '34px',
                minWidth: 0,
                border: 'none',
                borderRadius: '8px',
                background: 'transparent',
                fontSize: '18px',
                cursor: 'pointer',
                lineHeight: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = '#f1f5f9'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
