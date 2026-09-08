'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button, Card, Field, Input } from '@/ui';

/**
 * Two steps, no password: the code goes to the inbox and opens a session.
 * A six-digit code rather than a magic link, because the native app will
 * reuse this same endpoint and a typed code needs no universal links.
 */
export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function call(path: string, body: unknown) {
    const response = await fetch(`/api/v1${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload?.error?.message ?? 'Qualcosa è andato storto.');
    return payload;
  }

  async function requestCode(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await call('/auth/otp', { email });
      setSent(true);
      // Outside production the API hands the code back, so development and
      // the end-to-end tests do not need a real mailbox.
      setDevCode(result.devCode ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(false);
    }
  }

  async function verify(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await call('/auth/session', { email, code });
      router.replace(next ?? '/home');
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="p-6">
      {!sent ? (
        <form onSubmit={requestCode} className="space-y-4">
          <Field label="La tua email">
            <Input
              type="email"
              name="email"
              autoComplete="email"
              required
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="andrea@example.com"
            />
          </Field>
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Invio…' : 'Ricevi il codice'}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="space-y-4">
          <Field label="Codice a 6 cifre" hint={`Inviato a ${email}. Scade tra 10 minuti.`}>
            <Input
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              required
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="123456"
              className="text-center text-2xl tracking-[0.4em]"
            />
          </Field>
          {devCode ? (
            <p className="rounded-xl bg-warn-soft px-3 py-2 text-sm text-warn">
              Modalità sviluppo: il codice è <strong>{devCode}</strong>
            </p>
          ) : null}
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Verifico…' : 'Entra'}
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={() => setSent(false)}>
            Cambia email
          </Button>
        </form>
      )}
      {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}
    </Card>
  );
}
