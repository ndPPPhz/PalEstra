'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useState } from 'react';
import type { z } from 'zod';
import type { DayRowDto } from '@/api/dto';
import { Badge, Card, Textarea } from '@/ui';

type Row = z.infer<typeof DayRowDto>;

export function ExerciseList({
  sessionId,
  rows,
  readOnly,
}: {
  sessionId: string;
  rows: Row[];
  readOnly: boolean;
}) {
  const [open, setOpen] = useState<Row | null>(null);

  return (
    <>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li key={row.slotId}>
            <Card className="p-4">
              {/* Tapping the name opens the coach's explanation — in the next
                  milestone the same sheet carries their photos and videos. */}
              <button
                type="button"
                onClick={() => setOpen(row)}
                className="text-left text-base font-semibold underline decoration-line underline-offset-4"
              >
                {row.name}
              </button>

              <p className="mt-2 text-2xl font-semibold tracking-tight">
                {row.prescription ?? <span className="text-faint">—</span>}
              </p>
              {row.formatted ? <p className="text-sm text-faint">{row.formatted}</p> : null}
              {row.coachNote ? <p className="mt-1.5 text-sm text-muted">{row.coachNote}</p> : null}

              {row.previousPrescription || row.previousFeedback ? (
                <p className="mt-3 rounded-lg bg-bg px-3 py-2 text-sm text-muted">
                  <span className="text-faint">La scorsa volta: </span>
                  {row.previousPrescription ?? '—'}
                  {row.previousFeedback ? ` → ${row.previousFeedback}` : ''}
                </p>
              ) : null}

              <div className="mt-3">
                {readOnly ? (
                  <p className="text-sm">
                    <span className="text-faint">Feedback: </span>
                    {row.feedback ?? '—'}
                  </p>
                ) : (
                  <FeedbackBox sessionId={sessionId} slotId={row.slotId} initial={row.feedback ?? ''} />
                )}
              </div>
            </Card>
          </li>
        ))}
      </ul>

      <Dialog.Root open={open !== null} onOpenChange={(next) => !next && setOpen(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          {/* A bottom sheet on the phone, a centred panel from sm upwards. */}
          <Dialog.Content className="fixed inset-x-0 bottom-0 z-50 max-h-[80dvh] overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 sm:inset-0 sm:m-auto sm:h-fit sm:max-w-md sm:rounded-2xl">
            <Dialog.Title className="text-lg font-semibold">{open?.name}</Dialog.Title>
            <Dialog.Description className="mt-3 whitespace-pre-wrap text-muted">
              {open?.description ?? 'Il preparatore non ha ancora aggiunto una descrizione.'}
            </Dialog.Description>
            <Dialog.Close className="mt-6 w-full rounded-xl border border-line py-2.5">
              Chiudi
            </Dialog.Close>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </>
  );
}

/** Saves on blur: no button to hunt for with chalky hands mid-set. */
function FeedbackBox({
  sessionId,
  slotId,
  initial,
}: {
  sessionId: string;
  slotId: string;
  initial: string;
}) {
  const [value, setValue] = useState(initial);
  const [saved, setSaved] = useState<'idle' | 'saving' | 'done'>('idle');

  async function commit() {
    if (value.trim() === initial.trim() && saved === 'idle') return;
    setSaved('saving');
    const response = await fetch(`/api/v1/sessions/${sessionId}/feedback`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slotId, rawText: value }),
    });
    setSaved(response.ok ? 'done' : 'idle');
  }

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-sm font-medium text-muted">Il tuo feedback</span>
        {saved === 'saving' ? <span className="text-xs text-faint">salvo…</span> : null}
        {saved === 'done' ? <Badge tone="accent">salvato</Badge> : null}
      </div>
      <Textarea
        rows={2}
        value={value}
        maxLength={500}
        onChange={(event) => {
          setValue(event.target.value);
          setSaved('idle');
        }}
        onBlur={commit}
        placeholder="6,5,5,5 secondi"
      />
    </div>
  );
}
