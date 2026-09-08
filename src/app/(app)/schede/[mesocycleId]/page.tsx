import Link from 'next/link';
import { requireUserPage } from '@/server/session';
import { mesocycleGrid } from '@/core/programs';
import { listExercises } from '@/core/exercises';
import { gridToDto } from '@/api/mappers';
import { Badge, Button, Card, EmptyState, Input, PageTitle } from '@/ui';
import { addDayAction, addSlotAction, addWeekAction, completeMesocycleAction, publishWeekAction } from '@/app/actions';
import { MesocycleGrid } from './grid';

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
  const lastWeek = grid.weeks.at(-1);

  return (
    <>
      <PageTitle
        action={
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
        }
      >
        {grid.mesocycle.title}
      </PageTitle>

      <p className="-mt-3 mb-6 text-muted">
        Atleta: {grid.mesocycle.athleteName} · @{grid.mesocycle.athleteHandle}
        {grid.mesocycle.completedAt ? ' · mesociclo chiuso' : ''}
      </p>

      {grid.weeks.length > 1 ? (
        <p className="mb-4 rounded-xl bg-accent-soft px-4 py-2.5 text-sm text-accent-ink">
          Le settimane nuove nascono già compilate copiando la precedente: cambia solo le celle che
          cambiano davvero.
        </p>
      ) : null}

      <MesocycleGrid data={gridToDto(grid)} />

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Struttura</h2>
        <div className="space-y-3">
          {grid.days.map((day) => (
            <Card key={day.id} className="p-4">
              <p className="mb-3 font-medium">{day.label}</p>
              <form action={addSlotAction} className="flex flex-wrap items-center gap-2">
                <input type="hidden" name="mesocycleId" value={mesocycleId} />
                <input type="hidden" name="dayId" value={day.id} />
                <select
                  name="exerciseId"
                  className="rounded-xl border border-line bg-surface px-3 py-2 text-sm"
                  defaultValue=""
                >
                  <option value="">— dalla libreria —</option>
                  {exercises.map((exercise) => (
                    <option key={exercise.id} value={exercise.id}>
                      {exercise.name}
                    </option>
                  ))}
                </select>
                <Input
                  name="labelOverride"
                  placeholder="oppure scrivi: FRONT ONE LEG LEGGERISSIMA"
                  maxLength={160}
                  className="min-w-56 flex-1 py-2 text-sm"
                />
                <Button type="submit" variant="secondary" className="px-3 py-2 text-sm">
                  Aggiungi riga
                </Button>
              </form>
            </Card>
          ))}

          <form action={addDayAction} className="flex gap-2">
            <input type="hidden" name="mesocycleId" value={mesocycleId} />
            <Input name="label" placeholder={`DAY ${grid.days.length + 1}`} className="max-w-48 py-2 text-sm" />
            <Button type="submit" variant="secondary" className="px-3 py-2 text-sm">
              Aggiungi giornata
            </Button>
          </form>
        </div>
      </section>

      {!grid.mesocycle.completedAt ? (
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
