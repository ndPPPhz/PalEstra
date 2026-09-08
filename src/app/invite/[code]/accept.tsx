'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/ui';

export function AcceptInvite({ code }: { code: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function accept() {
    setBusy(true);
    setError(null);
    const response = await fetch(`/api/v1/invites/code/${code}/accept`, { method: 'POST' });
    const payload = await response.json();

    if (!response.ok) {
      setError(payload?.error?.message ?? 'Errore');
      setBusy(false);
      return;
    }
    router.replace('/home');
    router.refresh();
  }

  return (
    <>
      <Button onClick={accept} disabled={busy} className="w-full">
        {busy ? 'Accetto…' : 'Accetta e inizia'}
      </Button>
      {error ? <p className="mt-3 text-sm text-warn">{error}</p> : null}
    </>
  );
}
