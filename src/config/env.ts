import 'dotenv/config';

function required(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Variabile d'ambiente mancante: ${name}. Copia .env.example in .env.`);
  return value;
}

export const config = {
  appUrl: (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, ''),
  databaseUrl: required('DATABASE_URL', 'postgres://palestra:palestra@127.0.0.1:5432/palestra'),
  resendApiKey: process.env.RESEND_API_KEY ?? '',
  mailFrom: process.env.MAIL_FROM ?? 'PalEstra <no-reply@localhost>',
  isProduction: process.env.NODE_ENV === 'production',
} as const;
