import { NextResponse } from 'next/server';

import { isEmailConfigured, sendEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function contactInbox(): string {
  return (
    (process.env.CONTACT_EMAIL ?? '').trim() ||
    (process.env.EMAIL_CONTACT_TO ?? '').trim() ||
    'secretariat@snb-jsan.bj'
  );
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: Request) {
  let body: { nom?: string; email?: string; message?: string };
  try {
    body = (await request.json()) as { nom?: string; email?: string; message?: string };
  } catch {
    return NextResponse.json({ ok: false, message: 'Requête invalide.' }, { status: 400 });
  }

  const nom = (body.nom ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const message = (body.message ?? '').trim();

  if (!nom || nom.length < 2) {
    return NextResponse.json({ ok: false, message: 'Indiquez votre nom.' }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ ok: false, message: 'Adresse e-mail invalide.' }, { status: 400 });
  }
  if (!message || message.length < 10) {
    return NextResponse.json(
      { ok: false, message: 'Votre message est trop court (10 caractères minimum).' },
      { status: 400 }
    );
  }
  if (message.length > 4000) {
    return NextResponse.json({ ok: false, message: 'Message trop long.' }, { status: 400 });
  }

  if (!isEmailConfigured()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "L'envoi d'e-mails n'est pas encore configuré sur la plateforme. Écrivez-nous à secretariat@snb-jsan.bj.",
      },
      { status: 503 }
    );
  }

  const safeMessage = message.replace(/\r\n/g, '\n');
  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"></head>
<body style="margin:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:24px 0;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;">
        <tr><td style="background:#0f172a;padding:20px 28px;">
          <span style="color:#ffffff;font-size:18px;font-weight:700;">JSAN — Contact site</span>
        </td></tr>
        <tr><td style="padding:28px;">
          <h1 style="margin:0 0 16px;color:#0f172a;font-size:20px;font-weight:700;">Nouveau message</h1>
          <p style="margin:0 0 8px;color:#475569;font-size:14px;"><strong>Nom :</strong> ${escapeHtml(nom)}</p>
          <p style="margin:0 0 16px;color:#475569;font-size:14px;"><strong>E-mail :</strong> ${escapeHtml(email)}</p>
          <p style="margin:0;color:#334155;font-size:15px;line-height:1.6;white-space:pre-wrap;">${escapeHtml(safeMessage)}</p>
        </td></tr>
        <tr><td style="padding:18px 28px;background:#f8fafc;border-top:1px solid #e2e8f0;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">Répondez directement à cet e-mail pour contacter l'expéditeur (Reply-To).</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  const text = `Nouveau message contact JSAN\n\nNom : ${nom}\nE-mail : ${email}\n\n${safeMessage}`;

  const result = await sendEmail({
    to: contactInbox(),
    subject: `Contact JSAN — ${nom}`,
    html,
    text,
    replyTo: email,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        message: result.skipped
          ? "L'envoi d'e-mails n'est pas encore configuré. Écrivez-nous à secretariat@snb-jsan.bj."
          : "Impossible d'envoyer le message pour le moment. Réessayez ou contactez secretariat@snb-jsan.bj.",
      },
      { status: result.skipped ? 503 : 502 }
    );
  }

  return NextResponse.json({
    ok: true,
    message: 'Message envoyé. Le secrétariat JSAN vous répondra rapidement.',
  });
}
