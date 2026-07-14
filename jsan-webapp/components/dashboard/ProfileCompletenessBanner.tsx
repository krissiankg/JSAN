"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { fetchProfileDocuments, type ProfileDocument } from '@/lib/profile-documents';
import {
  assessProfileReminders,
  type ProfileReminder,
} from '@/lib/profile-completeness';

const TONE_STYLES: Record<ProfileReminder['tone'], { bg: string; border: string; color: string; btn: string }> = {
  warning: { bg: '#FFF8E1', border: '#F0C419', color: '#92400e', btn: '#C9A010' },
  danger: { bg: '#FDECEA', border: '#F5C4B8', color: '#B53A1F', btn: '#D94A2A' },
  info: { bg: '#E8F5EC', border: '#B7DFC0', color: '#145224', btn: '#1B6B2E' },
};

export default function ProfileCompletenessBanner() {
  const { user, profile, isLoading } = useAuth();
  const supabase = createClient();
  const [reminders, setReminders] = useState<ProfileReminder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      if (!user || isLoading) return;

      try {
        let docs: ProfileDocument[] = [];
        try {
          docs = await fetchProfileDocuments(supabase, user.id);
        } catch {
          docs = [];
        }

        if (cancelled) return;
        const next = assessProfileReminders(profile, docs);
        setReminders(next);

        // Toujours synchroniser la cloche (création ou marquage lu si complété)
        void fetch('/api/profile/reminders', { method: 'POST' }).catch(() => {
          /* bannière suffit si la cloche échoue */
        });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    run();
    return () => {
      cancelled = true;
    };
  }, [user, profile, isLoading, supabase]);

  if (isLoading || loading || reminders.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
      {reminders.map((reminder) => {
        const tone = TONE_STYLES[reminder.tone];
        return (
          <div
            key={reminder.kind}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '16px',
              flexWrap: 'wrap',
              padding: '14px 16px',
              borderRadius: '12px',
              background: tone.bg,
              border: `1px solid ${tone.border}`,
              color: tone.color,
            }}
          >
            <div style={{ minWidth: 0, flex: '1 1 240px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px', marginBottom: '4px' }}>
                {reminder.title}
              </div>
              <div style={{ fontSize: '13px', lineHeight: 1.45, opacity: 0.95 }}>
                {reminder.body}
              </div>
            </div>
            <Link
              href={reminder.link}
              style={{
                flexShrink: 0,
                display: 'inline-flex',
                alignItems: 'center',
                padding: '9px 14px',
                borderRadius: '8px',
                background: tone.btn,
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Compléter →
            </Link>
          </div>
        );
      })}
    </div>
  );
}
