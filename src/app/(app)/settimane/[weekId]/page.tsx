import Link from 'next/link';
import { requireUserPage } from '@/server/session';
import { athleteWeekView } from '@/core/programs';
import { Badge, Button, Card, EmptyState, PageTitle } from '@/ui';
import { completeWeekAction } from '@/app/actions';

/** The athlete's week: one card per training day. */
export default async function WeekPage({ params }: { params: Promise<{ weekId: string }> }) {
  const { weekId } = await params;
  const user = await requireUserPage(`/settimane/${weekId}`);
  const view = await athleteWeekView(user, weekId);

  if (!view.week.publishedAt) {
    return <EmptyState title="Settimana non ancora pubblicata" />;
  }

  const remaining = view.days.filter((day) => day.sessionId && !day.completedAt).length;

  return (
    <>
      <PageTitle>{view.week.label}</PageTitle>
      <Link href={`/schede/${view.mesocycleId}`} className="mb-6 -mt-3 block text-sm text-muted underline">
        ← torna alla scheda
      </Link>

      <ul className="space-y-2">
        {view.days.map((day) => (
          <li key={day.dayId}>
            {day.sessionId ? (
              <Link href={`/allenamenti/${day.sessionId}`} className="block">
                <Card className="flex items-center gap-3 p-4 transition hover:border-faint">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{day.label}</p>
                    <p className="text-sm text-muted">{day.exerciseCount} esercizi</p>
                  </div>
                  {day.completedAt ? <Badge tone="accent">fatto</Badge> : <Badge>da fare</Badge>}
                </Card>
              </Link>
            ) : (
              <Card className="p-4 text-faint">{day.label} — non disponibile</Card>
            )}
          </li>
        ))}
      </ul>

      {!view.week.completedAt && view.role === 'athlete' ? (
        <form action={completeWeekAction} className="mt-8">
          <input type="hidden" name="weekId" value={weekId} />
          <Button variant="secondary" className="w-full">
            {remaining > 0
              ? `Chiudi la settimana (${remaining} ${remaining === 1 ? 'giornata' : 'giornate'} non ${remaining === 1 ? 'fatta' : 'fatte'})`
              : 'Chiudi la settimana'}
          </Button>
        </form>
      ) : null}
    </>
  );
}
