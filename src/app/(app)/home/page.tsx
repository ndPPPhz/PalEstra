import Link from 'next/link';
import { requireUserPage } from '@/server/session';
import { listAthletes } from '@/core/relationships';
import { athleteMesocycles, coachMesocycles, coachPendingUpdates } from '@/core/programs';
import { Badge, Card, EmptyState, LinkButton, PageTitle, timeAgo } from '@/ui';

export default async function HomePage() {
  const user = await requireUserPage();
  const [pending, athletes, asCoach, asAthlete] = await Promise.all([
    coachPendingUpdates(user.id),
    listAthletes(user.id),
    coachMesocycles(user.id),
    athleteMesocycles(user.id),
  ]);

  const isCoach = athletes.length > 0 || asCoach.length > 0;
  // Chi arriva su un account nuovo non e' ne' l'uno ne' l'altro: senza un
  // bivio esplicito resterebbe fermo su una pagina vuota.
  const isFirstRun = !isCoach && asAthlete.length === 0;

  return (
    <>
      <PageTitle>Ciao {user.displayName}</PageTitle>

      {isFirstRun ? (
        <Card className="p-6">
          <h2 className="font-semibold">Da qui si comincia</h2>
          <p className="mt-1 text-muted">Due strade, e puoi percorrerle entrambe.</p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-line p-4">
              <p className="font-medium">Ti alleni</p>
              <p className="mt-1 text-sm text-muted">
                Chiedi al tuo preparatore il link di invito. Si apre, si accetta, e la scheda
                compare qui.
              </p>
            </div>
            <div className="rounded-xl border border-line p-4">
              <p className="font-medium">Alleni qualcuno</p>
              <p className="mt-1 text-sm text-muted">
                Genera un link per il tuo primo atleta: quando lo accetta puoi creargli la scheda.
              </p>
              <LinkButton href="/atleti" className="mt-3 px-3 py-2 text-sm">
                Invita un atleta
              </LinkButton>
            </div>
          </div>
        </Card>
      ) : null}

      {isCoach ? (
        <section className="mb-10">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Schede da aggiornare
          </h2>
          {pending.length === 0 ? (
            <EmptyState title="Niente in coda">
              Quando un atleta chiude una settimana la trovi qui.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {pending.map((item) => (
                <li key={item.weekId}>
                  <Link href={`/schede/${item.mesocycleId}`} className="block">
                    <Card className="flex items-center gap-4 p-4 transition hover:border-faint">
                      <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink">
                        {item.athleteName.slice(0, 1).toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {item.athleteName} ha finito {item.weekLabel}
                        </p>
                        <p className="truncate text-sm text-muted">{item.mesocycleTitle}</p>
                      </div>
                      <span className="shrink-0 text-sm text-faint">{timeAgo(item.completedAt)}</span>
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {isCoach ? (
        <section className="mb-10">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">Schede che segui</h2>
            <LinkButton href="/atleti" variant="secondary" className="px-3 py-1.5 text-sm">
              Atleti
            </LinkButton>
          </div>
          {asCoach.length === 0 ? (
            <EmptyState title="Nessuna scheda ancora">
              Vai su <Link href="/atleti" className="underline">Atleti</Link> e creane una.
            </EmptyState>
          ) : (
            <ul className="space-y-2">
              {asCoach.map((meso) => (
                <li key={meso.id}>
                  <Link href={`/schede/${meso.id}`} className="block">
                    <Card className="flex items-center gap-3 p-4 transition hover:border-faint">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{meso.title}</p>
                        <p className="text-sm text-muted">{meso.athleteName}</p>
                      </div>
                      {meso.completedAt ? <Badge>Chiuso</Badge> : <Badge tone="accent">In corso</Badge>}
                    </Card>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section className={isFirstRun ? 'hidden' : undefined}>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Le tue schede</h2>
        {asAthlete.length === 0 ? (
          <EmptyState title="Non hai ancora una scheda">
            Chiedi al tuo preparatore il link di invito: si apre, si accetta, e la scheda arriva qui.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {asAthlete.map((meso) => (
              <li key={meso.id}>
                <Link href={`/schede/${meso.id}`} className="block">
                  <Card className="flex items-center gap-3 p-4 transition hover:border-faint">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{meso.title}</p>
                      <p className="text-sm text-muted">
                        {meso.coachName} · {meso.doneWeekCount}/{meso.weekCount} settimane
                      </p>
                    </div>
                    {meso.completedAt ? <Badge>Terminato</Badge> : <Badge tone="accent">In corso</Badge>}
                  </Card>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
