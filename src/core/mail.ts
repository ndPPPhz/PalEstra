import { config } from '@/config/env';

/**
 * Without RESEND_API_KEY the message is printed instead of sent. That keeps
 * local development and the end-to-end tests self-contained; .env.example
 * warns that it must not be left unset in production.
 */
export async function sendMail(to: string, subject: string, text: string): Promise<void> {
  if (!config.resendApiKey) {
    console.info(`\n── email a ${to} ──\n${subject}\n\n${text}\n──\n`);
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${config.resendApiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ from: config.mailFrom, to, subject, text }),
  });

  if (!response.ok) {
    // Never throw the provider's body back at the caller: it can echo the
    // API key. Log it, and let the caller report a generic failure.
    console.error('Invio email fallito', response.status, await response.text());
    throw new Error('Invio email fallito');
  }
}
