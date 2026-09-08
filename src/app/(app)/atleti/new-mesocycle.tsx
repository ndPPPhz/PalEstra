'use client';

import { useState } from 'react';
import { Button, Input } from '@/ui';
import { createMesocycleAction } from '@/app/actions';

export function NewMesocycle({ relationshipId, name }: { relationshipId: string; name: string }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <Button variant="secondary" className="px-3 py-1.5 text-sm" onClick={() => setOpen(true)}>
        Nuova scheda
      </Button>
    );
  }

  return (
    <form action={createMesocycleAction} className="flex w-full gap-2">
      <input type="hidden" name="relationshipId" value={relationshipId} />
      <Input
        name="title"
        required
        autoFocus
        maxLength={120}
        placeholder={`Mesociclo di ${name}`}
        className="flex-1 py-1.5 text-sm"
      />
      <Button type="submit" className="px-3 py-1.5 text-sm">
        Crea
      </Button>
      <Button type="button" variant="ghost" className="px-3 py-1.5 text-sm" onClick={() => setOpen(false)}>
        Annulla
      </Button>
    </form>
  );
}
