// E-mail behind one function. Uses Resend (free tier) when RESEND_API_KEY is
// set, otherwise prints the message to the console so development needs no
// external account.
import { config } from '../config/env.js';

export async function sendMail({ to, subject, text, html }) {
  if (config.mail.provider === 'console') {
    console.log(`\n── e-mail (console mode) ──\nTo: ${to}\nSubject: ${subject}\n${text}\n───────────────────────────\n`);
    return;
  }
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${config.mail.apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: config.mail.from, to, subject, text, html }),
    });
    if (!res.ok) console.error('Mail provider error', res.status);
  } catch (e) {
    // e-mail failure must never break sign-up; the user can request another link
    console.error('Mail send failed:', e.message);
  }
}

const link = (path) => `${config.clientUrls[0]}${path}`;

export const sendVerificationMail = (user, token) =>
  sendMail({
    to: user.email,
    subject: 'Verify your Social-Feed account',
    text: `Hi @${user.username}, confirm your e-mail: ${link(`/verify-email?token=${token}`)}\nThis link expires in 24 hours.`,
    html: `<p>Hi @${user.username},</p><p><a href="${link(`/verify-email?token=${token}`)}">Confirm your e-mail</a> (valid for 24 hours).</p>`,
  });

export const sendResetMail = (user, token) =>
  sendMail({
    to: user.email,
    subject: 'Reset your Social-Feed password',
    text: `Reset your password: ${link(`/reset-password?token=${token}`)}\nThis link expires in 1 hour. If you did not ask for it, ignore this e-mail.`,
    html: `<p><a href="${link(`/reset-password?token=${token}`)}">Reset your password</a> (valid for 1 hour). If you did not ask for this, ignore this e-mail.</p>`,
  });
