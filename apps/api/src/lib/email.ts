import { Resend } from 'resend'

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null
const FROM = process.env.EMAIL_FROM ?? 'Trailtag <noreply@trailtag.ch>'

export async function sendVerificationEmail(to: string, name: string, code: string) {
  if (!resend) { console.log(`[DEV] Verification code for ${to}: ${code}`); return }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Bestätige deine Trailtag E-Mail-Adresse',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h1 style="color:#061907;font-size:22px;">🏔 Willkommen bei Trailtag, ${name}!</h1>
          <p style="color:#434841;font-size:15px;line-height:1.6;">Bestätige deine E-Mail-Adresse mit diesem Code:</p>
          <div style="background:#f0faf4;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
            <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#2c694e;">${code}</span>
          </div>
          <p style="color:#747871;font-size:13px;">Der Code ist 15 Minuten gültig.</p>
        </div>
      `
    })
  } catch (err) { console.error('Email send error:', err) }
}

export async function sendPasswordResetEmail(to: string, name: string, resetCode: string) {
  if (!resend) { console.log(`[DEV] Password reset code for ${to}: ${resetCode}`); return }
  try {
    await resend.emails.send({
      from: FROM,
      to,
      subject: 'Trailtag Passwort zurücksetzen',
      html: `
        <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;">
          <h1 style="color:#061907;font-size:22px;">Passwort zurücksetzen</h1>
          <p style="color:#434841;font-size:15px;line-height:1.6;">Hallo ${name}, hier ist dein Code zum Zurücksetzen deines Passworts:</p>
          <div style="background:#f0faf4;border-radius:12px;padding:20px;text-align:center;margin:24px 0;">
            <span style="font-size:32px;font-weight:900;letter-spacing:8px;color:#2c694e;">${resetCode}</span>
          </div>
          <p style="color:#747871;font-size:13px;">Der Code ist 15 Minuten gültig. Falls du das nicht angefordert hast, ignoriere diese E-Mail.</p>
        </div>
      `
    })
  } catch (err) { console.error('Email send error:', err) }
}