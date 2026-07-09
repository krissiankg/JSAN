// Envoi d'e-mails transactionnels — SERVEUR UNIQUEMENT.
//
// Fournisseur : Resend (API HTTP, aucune dépendance npm). Les identifiants sont
// lus dans les variables d'environnement, à remplir plus tard :
//   RESEND_API_KEY  — clé API Resend (secret serveur)
//   EMAIL_FROM      — expéditeur vérifié, ex: "JSAN 2025 <no-reply@jsan.bj>"
//
// Tant que ces variables sont absentes, l'envoi est simplement ignoré
// (les notifications in-app continuent de fonctionner).

export function isEmailConfigured(): boolean {
  return Boolean((process.env.RESEND_API_KEY ?? '').trim() && (process.env.EMAIL_FROM ?? '').trim());
}

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export interface SendEmailResult {
  ok: boolean;
  skipped?: boolean;
  error?: string;
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  if (!isEmailConfigured()) {
    return { ok: false, skipped: true };
  }
  if (!input.to || !input.to.includes('@')) {
    return { ok: false, error: 'Adresse destinataire invalide.' };
  }

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${(process.env.RESEND_API_KEY ?? '').trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: (process.env.EMAIL_FROM ?? '').trim(),
        to: [input.to],
        subject: input.subject,
        html: input.html,
        ...(input.text ? { text: input.text } : {}),
      }),
      cache: 'no-store',
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { ok: false, error: `Resend HTTP ${res.status} ${detail}`.trim() };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erreur réseau e-mail.' };
  }
}

/** Gabarit HTML sobre et responsive pour les notifications JSAN. */
export function renderNotificationEmail(params: {
  title: string;
  body: string;
  ctaLabel?: string;
  ctaUrl?: string;
  recipientName?: string | null;
}): string {
  const { title, body, ctaLabel, ctaUrl, recipientName } = params;
  const greeting = recipientName ? `Bonjour ${escapeHtml(recipientName)},` : 'Bonjour,';
  const cta =
    ctaLabel && ctaUrl
      ? `<tr><td style="padding:8px 0 0;">
           <a href="${escapeAttr(ctaUrl)}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px;">${escapeHtml(ctaLabel)}</a>
         </td></tr>`
      : '';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0f172a;padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;">JSAN 2025</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <p style="margin:0 0 12px;color:#334155;font-size:14px;">${greeting}</p>
          <h1 style="margin:0 0 12px;color:#0f172a;font-size:20px;font-weight:700;">${escapeHtml(title)}</h1>
          <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.6;">${escapeHtml(body)}</p>
          <table role="presentation" cellpadding="0" cellspacing="0">${cta}</table>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;line-height:1.5;">
            Vous recevez cet e-mail car vous avez un compte sur la plateforme JSAN 2025.
            Vous pouvez ajuster vos préférences de notification dans votre profil.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeAttr(s: string): string {
  return s.replace(/"/g, '&quot;');
}
