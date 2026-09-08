'use client';

import { useRouter } from 'next/navigation';
import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';
import type { GridDto } from '@/api/dto';
import { Badge, Button, cn } from '@/ui';

type Grid = z.infer<typeof GridDto>;

const key = (weekId: string, slotId: string) => `${weekId}:${slotId}`;

/**
 * The coach's spreadsheet. Rows are exercises grouped by day, columns are
 * weeks alternating with the athlete's feedback — deliberately the same
 * shape as the sheet this replaces, so it reads as familiar on the first
 * open. The first column is sticky, everything else scrolls sideways.
 *
 * Structure editing lives here rather than in a panel of its own: adding,
 * removing and reordering a row happens where the coach is already
 * looking, without a page reload.
 */
export function MesocycleGrid({
  data,
  canEdit,
  libraryNames,
}: {
  data: Grid;
  canEdit: boolean;
  libraryNames: string[];
}) {
  const router = useRouter();

  /**
   * Local edits are kept as overrides on top of the server data rather than
   * as a copy of it. Seeding state once would freeze the grid at its first
   * render, so a new column added by copy-forward would come back from the
   * server filled in and still look empty on screen.
   */
  const [edits, setEdits] = useState(new Map<string, { rawText: string; formatted: string | null } | null>());

  const cells = useMemo(() => {
    const map = new Map<string, { rawText: string; formatted: string | null }>();
    for (const cell of data.cells) map.set(key(cell.weekId, cell.slotId), cell);
    for (const [cellKey, value] of edits) {
      if (value === null) map.delete(cellKey);
      else map.set(cellKey, value);
    }
    return map;
  }, [data.cells, edits]);

  const feedbacks = useMemo(() => {
    const map = new Map<string, string>();
    for (const f of data.feedbacks) map.set(key(f.weekId, f.slotId), f.rawText);
    return map;
  }, [data.feedbacks]);

  const save = useCallback(async (weekId: string, slotId: string, rawText: string) => {
    const response = await fetch(`/api/v1/weeks/${weekId}/prescriptions`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slotId, rawText }),
    });
    if (!response.ok) return;

    // The server owns the parse, so the chip always matches what was stored.
    const saved = (await response.json()) as { rawText: string | null; formatted: string | null };
    setEdits((previous) => {
      const next = new Map(previous);
      next.set(
        key(weekId, slotId),
        saved.rawText === null ? null : { rawText: saved.rawText, formatted: saved.formatted },
      );
      return next;
    });
  }, []);

  const columns = 1 + data.weeks.length * 2;

  return (
    <>
      <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
        <table className="w-max min-w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 w-64 min-w-64 border-b border-r border-line bg-surface p-3 text-left font-semibold">
                Esercizio
              </th>
              {data.weeks.map((week, index) => (
                <th
                  key={week.id}
                  colSpan={2}
                  className={cn(
                    'min-w-72 border-b border-l border-line p-3 text-left',
                    index % 2 === 0 ? 'bg-week-a' : 'bg-week-b',
                  )}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{week.label}</span>
                    {week.completedAt ? (
                      <Badge tone="accent">completata</Badge>
                    ) : week.publishedAt ? (
                      <Badge>pubblicata</Badge>
                    ) : (
                      <Badge tone="warn">bozza</Badge>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.days.map((day) => (
              <Fragment key={day.id}>
                <tr>
                  <th
                    colSpan={columns}
                    className="sticky left-0 border-y border-line bg-day p-2 px-3 text-left text-xs font-semibold uppercase tracking-wide"
                  >
                    {day.label}
                  </th>
                </tr>

                {day.slots.map((slot, index) => (
                  <tr key={slot.id} className="group align-top">
                    <th className="sticky left-0 z-10 border-b border-r border-line bg-surface p-3 text-left font-normal">
                      <div className="flex items-start gap-2">
                        <span className="flex-1">{slot.name}</span>
                        {canEdit ? (
                          <RowControls
                            slotIds={day.slots.map((s) => s.id)}
                            index={index}
                            dayId={day.id}
                            onDone={() => router.refresh()}
                          />
                        ) : null}
                      </div>
                    </th>
                    {data.weeks.map((week, weekIndex) => {
                      const cell = cells.get(key(week.id, slot.id));
                      return (
                        <Fragment key={week.id}>
                          <td
                            className={cn(
                              'border-b border-l border-line p-1.5',
                              weekIndex % 2 === 0 ? 'bg-week-a' : 'bg-week-b',
                            )}
                          >
                            <PrescriptionCell
                              initial={cell?.rawText ?? ''}
                              formatted={cell?.formatted ?? null}
                              readOnly={!canEdit}
                              onSave={(value) => save(week.id, slot.id, value)}
                            />
                          </td>
                          <td
                            className={cn(
                              'w-40 min-w-40 border-b border-line p-3 text-muted',
                              weekIndex % 2 === 0 ? 'bg-week-a' : 'bg-week-b',
                            )}
                          >
                            {feedbacks.get(key(week.id, slot.id)) ?? <span className="text-faint">—</span>}
                          </td>
                        </Fragment>
                      );
                    })}
                  </tr>
                ))}

                {canEdit ? (
                  <tr>
                    <th colSpan={columns} className="sticky left-0 border-b border-line p-2 text-left">
                      <AddRow dayId={day.id} libraryNames={libraryNames} onDone={() => router.refresh()} />
                    </th>
                  </tr>
                ) : null}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {data.weeks.length === 0 ? (
        <p className="mt-3 text-sm text-muted">
          La struttura c’è. Aggiungi la prima settimana per iniziare a compilare le celle.
        </p>
      ) : null}
    </>
  );
}

/** Move up, move down, remove — enough to fix a row without a drag library. */
function RowControls({
  slotIds,
  index,
  dayId,
  onDone,
}: {
  slotIds: string[];
  index: number;
  dayId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const slotId = slotIds[index]!;

  async function move(direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= slotIds.length) return;

    const reordered = [...slotIds];
    [reordered[index], reordered[target]] = [reordered[target]!, reordered[index]!];

    setBusy(true);
    await fetch(`/api/v1/days/${dayId}/slots/order`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ slotIds: reordered }),
    });
    setBusy(false);
    onDone();
  }

  async function remove() {
    // Deleting a row drops its prescriptions and the athlete's feedback for
    // it across every week, so it is worth one question.
    if (!window.confirm('Elimino questa riga da tutte le settimane, feedback compresi. Procedo?')) return;
    setBusy(true);
    await fetch(`/api/v1/slots/${slotId}`, { method: 'DELETE' });
    setBusy(false);
    onDone();
  }

  const button = 'rounded px-1.5 text-faint transition hover:bg-bg hover:text-ink disabled:opacity-40';

  return (
    <span className="flex shrink-0 items-center opacity-60 transition group-hover:opacity-100">
      <button type="button" className={button} onClick={() => move(-1)} disabled={busy || index === 0} title="Sposta su">
        ↑
      </button>
      <button
        type="button"
        className={button}
        onClick={() => move(1)}
        disabled={busy || index === slotIds.length - 1}
        title="Sposta giù"
      >
        ↓
      </button>
      <button type="button" className={button} onClick={remove} disabled={busy} title="Elimina riga">
        ×
      </button>
    </span>
  );
}

/** Adds one exercise to a day, matching the library the same way the builder does. */
function AddRow({
  dayId,
  libraryNames,
  onDone,
}: {
  dayId: string;
  libraryNames: string[];
  onDone: () => void;
}) {
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const listId = `library-${dayId}`;

  async function add() {
    const trimmed = name.trim();
    if (!trimmed) return;

    setBusy(true);
    const response = await fetch(`/api/v1/days/${dayId}/slots`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name: trimmed }),
    });
    setBusy(false);
    if (!response.ok) return;

    setName('');
    onDone();
  }

  return (
    <span className="flex items-center gap-2">
      <input
        value={name}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault();
            void add();
          }
        }}
        list={listId}
        placeholder="+ aggiungi esercizio"
        maxLength={160}
        className="w-64 rounded-lg border border-transparent bg-transparent px-2 py-1.5 font-normal hover:border-line focus:border-accent focus:bg-surface focus:outline-none"
      />
      <datalist id={listId}>
        {libraryNames.map((exercise) => (
          <option key={exercise} value={exercise} />
        ))}
      </datalist>
      {name.trim() ? (
        <Button type="button" variant="secondary" className="px-2.5 py-1 text-xs" onClick={add} disabled={busy}>
          Aggiungi
        </Button>
      ) : null}
    </span>
  );
}

/**
 * One cell. Saves on blur rather than on every keystroke, and shows the
 * parsed reading underneath when the text was understood — which is how the
 * coach learns the shorthand without being taught it.
 */
function PrescriptionCell({
  initial,
  formatted,
  readOnly,
  onSave,
}: {
  initial: string;
  formatted: string | null;
  readOnly: boolean;
  onSave: (value: string) => Promise<void>;
}) {
  const [value, setValue] = useState(initial);
  const [saving, setSaving] = useState(false);

  // Follow the server when the cell changes underneath us — a week added by
  // copy-forward arrives as new props, not as a remount.
  useEffect(() => setValue(initial), [initial]);

  async function commit() {
    if (value.trim() === initial.trim()) return;
    setSaving(true);
    await onSave(value);
    setSaving(false);
  }

  if (readOnly) {
    return (
      <div className="px-2 py-1.5">
        {value || <span className="text-faint">—</span>}
        {formatted ? <p className="text-xs text-faint">{formatted}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <input
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') event.currentTarget.blur();
          if (event.key === 'Escape') setValue(initial);
        }}
        placeholder="4x2@20kg"
        maxLength={200}
        className={cn(
          'w-full rounded-lg border border-transparent bg-transparent px-2 py-1.5',
          'hover:border-line focus:border-accent focus:bg-surface focus:outline-none',
          saving && 'opacity-60',
        )}
      />
      {formatted ? <p className="px-2 text-xs text-faint">{formatted}</p> : null}
    </div>
  );
}
