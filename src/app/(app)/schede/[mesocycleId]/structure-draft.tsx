'use client';

import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';
import { parseStructureDraft } from '@/core/programs/draft';
import { Badge, Button, Card } from '@/ui';

const PLACEHOLDER = `DAY 1
Trazioni
HSPU
Panca piana

DAY 2
Squat
Stacco
Dip`;

/**
 * The first screen of an empty programme.
 *
 * Adding a real programme a row at a time is around two dozen round trips,
 * and the first one is exactly when a coach decides whether this beats
 * their spreadsheet. Here they type or paste the whole thing and it is one
 * save. Afterwards the grid takes over and rows are edited in place.
 *
 * The preview runs the same parser the server does, so what it promises is
 * what gets created.
 */
export function StructureDraft({
  mesocycleId,
  libraryNames,
}: {
  mesocycleId: string;
  libraryNames: string[];
}) {
  const router = useRouter();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const known = useMemo(() => new Set(libraryNames.map((n) => n.toLowerCase())), [libraryNames]);

  const preview = useMemo(() => {
    const days = parseStructureDraft(text);
    const names = new Set(days.flatMap((d) => d.exercises.map((e) => e.toLowerCase())));
    return {
      days,
      slotCount: days.reduce((total, day) => total + day.exercises.length, 0),
      newExercises: [...names].filter((name) => !known.has(name)).length,
    };
  }, [text, known]);

  async function save() {
    setBusy(true);
    setError(null);

    const response = await fetch(`/api/v1/mesocycles/${mesocycleId}/structure`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ days: preview.days }),
    });

    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setError(payload?.error?.message ?? 'Non sono riuscito a salvare la struttura.');
      setBusy(false);
      return;
    }
    router.refresh();
  }

  return (
    <Card className="p-5">
      <h2 className="font-semibold">Costruisci la scheda</h2>
      <p className="mt-1 mb-4 text-sm text-muted">
        Scrivi o incolla gli esercizi, uno per riga. Una riga vuota separa una giornata dall’altra;
        se la prima riga di un blocco è tipo <code className="rounded bg-bg px-1 text-ink">DAY 1</code> diventa il nome
        della giornata.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <textarea
          aria-label="Struttura della scheda"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={14}
          spellCheck={false}
          placeholder={PLACEHOLDER}
          className="w-full rounded-xl border border-line bg-surface px-3.5 py-2.5 font-mono text-sm leading-relaxed text-ink placeholder:text-faint focus:border-accent focus:outline-none"
        />

        <div className="rounded-xl border border-dashed border-line p-4">
          {preview.days.length === 0 ? (
            <p className="text-sm text-faint">
              Qui vedi cosa verrà creato, mentre scrivi.
            </p>
          ) : (
            <>
              <p className="mb-3 text-sm text-muted">
                {preview.days.length} {preview.days.length === 1 ? 'giornata' : 'giornate'} ·{' '}
                {preview.slotCount} esercizi
                {preview.newExercises > 0 ? (
                  <>
                    {' · '}
                    <span className="text-accent-ink">
                      {preview.newExercises} nuovi in libreria
                    </span>
                  </>
                ) : null}
              </p>
              <ul className="space-y-3">
                {preview.days.map((day, index) => (
                  <li key={index}>
                    <p className="text-xs font-semibold uppercase tracking-wide">
                      {day.label ?? `DAY ${index + 1}`}
                    </p>
                    <ul className="mt-1 space-y-0.5">
                      {day.exercises.map((exercise, position) => (
                        <li key={position} className="flex items-center gap-2 text-sm">
                          <span className="text-ink">{exercise}</span>
                          {!known.has(exercise.toLowerCase()) ? (
                            <Badge tone="accent">nuovo</Badge>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {error ? <p className="mt-4 text-sm text-warn">{error}</p> : null}

      <Button onClick={save} disabled={busy || preview.days.length === 0} className="mt-4">
        {busy ? 'Creo…' : 'Crea la struttura'}
      </Button>
    </Card>
  );
}
