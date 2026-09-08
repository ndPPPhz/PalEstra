import Link from 'next/link';
import { requireUserPage } from '@/server/session';
import { athleteDayView } from '@/core/programs';
import { dayViewToDto } from '@/api/mappers';
import { Badge, Button, PageTitle, Textarea } from '@/ui';
import { completeSessionAction, reopenSessionAction, setSessionNoteAction } from '@/app/actions';
import { ExerciseList } from './exercise-list';

/**
 * The in-gym screen. Never a grid: one column, big type, large tap
 * targets, and last week's numbers in plain sight — the thing a
 * spreadsheet on a phone cannot do.
 */
export default async function SessionPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const { sessionId } = await params;
  const user = await requireUserPage(`/allenamenti/${sessionId}`);
  const view = await athleteDayView(user, sessionId);
  const dto = dayViewToDto(view);
  const readOnly = view.role !== 'athlete';

  return (
    <>
      <PageTitle
        action={dto.session.completedAt ? <Badge tone="accent">giornata fatta</Badge> : null}
      >
        {dto.session.dayLabel}
      </PageTitle>

      <Link href={`/settimane/${dto.session.weekId}`} className="mb-6 -mt-3 block text-sm text-muted underline">
        ← {dto.session.mesocycleTitle} · {dto.session.weekLabel}
      </Link>

      <ExerciseList sessionId={sessionId} rows={dto.rows} readOnly={readOnly} />

      {!readOnly ? (
        <>
          <form action={setSessionNoteAction} className="mt-8 space-y-3">
            <input type="hidden" name="sessionId" value={sessionId} />
            <label className="block text-sm font-medium text-muted" htmlFor="note">
              Com’è andata oggi?
            </label>
            <Textarea
              id="note"
              name="note"
              rows={3}
              defaultValue={dto.session.note ?? ''}
              maxLength={2000}
              placeholder="Sto cotto oggi, ho dormito poco…"
            />
            <Button type="submit" variant="secondary" className="text-sm">
              Salva nota
            </Button>
          </form>

          <form
            action={dto.session.completedAt ? reopenSessionAction : completeSessionAction}
            className="mt-8"
          >
            <input type="hidden" name="sessionId" value={sessionId} />
            {dto.session.completedAt ? (
              <Button variant="ghost" className="w-full">
                Riapri la giornata
              </Button>
            ) : (
              <Button className="w-full py-3.5 text-base">Giornata completata</Button>
            )}
          </form>
        </>
      ) : null}
    </>
  );
}
