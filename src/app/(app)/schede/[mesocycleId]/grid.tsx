'use client';

import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import type { z } from 'zod';
import type { GridDto } from '@/api/dto';
import { Badge, cn } from '@/ui';

type Grid = z.infer<typeof GridDto>;

const key = (weekId: string, slotId: string) => `${weekId}:${slotId}`;

/**
 * The coach's spreadsheet. Rows are exercises grouped by day, columns are
 * weeks alternating with the athlete's feedback — deliberately the same
 * shape as the sheet this replaces, so it reads as familiar on the first
 * open. The first column is sticky, everything else scrolls sideways.
 */
export function MesocycleGrid({ data }: { data: Grid }) {
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

  if (data.weeks.length === 0) {
    return (
      <p className="rounded-[var(--radius-card)] border border-dashed border-line p-8 text-center text-muted">
        Nessuna settimana. Aggiungi la prima per iniziare a compilare.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line">
      <table className="w-max min-w-full border-collapse text-sm">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 w-56 min-w-56 border-b border-r border-line bg-surface p-3 text-left font-semibold">
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
                  colSpan={1 + data.weeks.length * 2}
                  className="sticky left-0 border-y border-line bg-day p-2 px-3 text-left text-xs font-semibold uppercase tracking-wide"
                >
                  {day.label}
                </th>
              </tr>

              {day.slots.map((slot) => (
                <tr key={slot.id} className="align-top">
                  <th className="sticky left-0 z-10 border-b border-r border-line bg-surface p-3 text-left font-normal">
                    {slot.name}
                  </th>
                  {data.weeks.map((week, index) => {
                    const cell = cells.get(key(week.id, slot.id));
                    return (
                      <Fragment key={week.id}>
                        <td
                          className={cn(
                            'border-b border-l border-line p-1.5',
                            index % 2 === 0 ? 'bg-week-a' : 'bg-week-b',
                          )}
                        >
                          <PrescriptionCell
                            initial={cell?.rawText ?? ''}
                            formatted={cell?.formatted ?? null}
                            onSave={(value) => save(week.id, slot.id, value)}
                          />
                        </td>
                        <td
                          className={cn(
                            'w-40 min-w-40 border-b border-line p-3 text-muted',
                            index % 2 === 0 ? 'bg-week-a' : 'bg-week-b',
                          )}
                        >
                          {feedbacks.get(key(week.id, slot.id)) ?? (
                            <span className="text-faint">—</span>
                          )}
                        </td>
                      </Fragment>
                    );
                  })}
                </tr>
              ))}

              {day.slots.length === 0 ? (
                <tr>
                  <td
                    colSpan={1 + data.weeks.length * 2}
                    className="border-b border-line p-3 text-faint"
                  >
                    Nessun esercizio in questa giornata.
                  </td>
                </tr>
              ) : null}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
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
  onSave,
}: {
  initial: string;
  formatted: string | null;
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
