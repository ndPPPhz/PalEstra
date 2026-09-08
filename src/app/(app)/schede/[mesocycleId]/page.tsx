import Link from 'next/link';
import { requireUserPage } from '@/server/session';
import { mesocycleGrid } from '@/core/programs';
import { listExercises } from '@/core/exercises';
import { gridToDto } from '@/api/mappers';
import { Badge, Button, Card, EmptyState, Input, PageTitle } from '@/ui';
import { addDayAction, addWeekAction, completeMesocycleAction, publishWeekAction } from '@/app/actions';
import { MesocycleGrid } from './grid';
import { StructureDraft } from './structure-draft';

/**
 * Same data, two opposite screens — the point at which this beats the
 * sheet. The coach gets the grid on a wide screen; the athlete gets cards
 * they can use one-handed between sets.
 */
export default async function MesocyclePage({ params }: { params: Promise<{ mesocycleId: string }> }) {
  const { mesocycleId } = await params;
  const user = await requireUserPage(`/schede/${mesocycleId}`);
  const grid = await mesocycleGrid(user, mesocycleId);

  if (grid.role === 'athlete') return <AthleteView grid={grid} />;

  const exercises = await listExercises(user.id);
  const libraryNames = exercises.map((exercise) => exercise.name);
  const lastWeek = grid.weeks.at(-1);
  const isEmpty = grid.days.length === 0;

  return (
    <>
      <PageTitle
        action={
          // While the programme is still empty the only job is building it;
          // weeks would just be empty columns.
          isEmpty ? null : (
            <div className="flex flex-wrap gap-2">
              <form action={addWeekAction}>
                <input type="hidden" name="mesocycleId" value={mesocycleId} />
                <Button type="submit">Aggiungi settimana</Button>
              </form>
              {lastWeek && !lastWeek.publishedAt ? (
                <form action={publishWeekAction}>
                  <input type="hidden" name="mesocycleId" value={mesocycleId} />
                  <input type="hidden" name="weekId" value={lastWeek.id} />
                  <Button type="submit" variant="secondary">
                    Pubblica {lastWeek.label}
                  </Button>
                </form>
              ) : null}
            </div>
          )
        }
      >
        {grid.mesocycle.title}
      </PageTitle>

      <p className="-mt-3 mb-6 text-muted">
        Atleta: {grid.mesocycle.athleteName} · @{grid.mesocycle.athleteHandle}
        {grid.mesocycle.completedAt ? ' · mesociclo chiuso' : ''}
      </p>

      {isEmpty ? (
        <StructureDraft mesocycleId={mesocycleId} libraryNames={libraryNames} />
      ) : (
        <>
          {grid.weeks.length > 1 ? (
            <p className="mb-4 rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-accent-ink">
              Le settimane nuove nascono già compilate copiando la precedente: cambia solo le celle
              che cambiano davvero.
            </p>
          ) : null}

          <MesocycleGrid data={gridToDto(grid)} canEdit libraryNames={libraryNames} />

          <form action={addDayAction} className="mt-4 flex gap-2">
            <input type="hidden" name="mesocycleId" value={mesocycleId} />
            <Input
              name="label"
              placeholder={`DAY ${grid.days.length + 1}`}
              className="max-w-48 py-2 text-sm"
            />
            <Button type="submit" variant="secondary" className="px-3 py-2 text-sm">
              Aggiungi giornata
            </Button>
          </form>
        </>
      )}

      {!grid.mesocycle.completedAt && !isEmpty ? (
        <form action={completeMesocycleAction} className="mt-10">
          <input type="hidden" name="mesocycleId" value={mesocycleId} />
          <Button variant="ghost" className="text-sm">
            Chiudi il mesociclo
          </Button>
        </form>
      ) : null}
    </>
  );
}

async function AthleteView({ grid }: { grid: Awaited<ReturnType<typeof mesocycleGrid>> }) {
  const weeks = grid.weeks.filter((week) => week.publishedAt);

  return (
    <>
      <PageTitle>{grid.mesocycle.title}</PageTitle>

      {weeks.length === 0 ? (
        <EmptyState title="Nessuna settimana ancora pubblicata">
          Il tuo preparatore sta preparando la prima: la trovi qui appena la pubblica.
        </EmptyState>
      ) : (
        <ul className="space-y-2">
          {[...weeks].reverse().map((week) => (
            <li key={week.id}>
              <Link href={`/settimane/${week.id}`} className="block">
                <Card className="flex items-center gap-3 p-4 transition hover:border-faint">
                  <span className="flex-1 font-medium">{week.label}</span>
                  {week.completedAt ? <Badge tone="accent">completata</Badge> : <Badge>da fare</Badge>}
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
