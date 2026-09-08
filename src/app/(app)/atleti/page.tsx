import { requireUserPage } from '@/server/session';
import { listAthletes, listInvites } from '@/core/relationships';
import { Badge, Button, Card, EmptyState, Field, Input, PageTitle, timeAgo } from '@/ui';
import { createInviteAction, revokeInviteAction } from '@/app/actions';
import { CopyLink } from './copy-link';
import { NewMesocycle } from './new-mesocycle';

export default async function AthletesPage() {
  const user = await requireUserPage();
  const [athletes, invites] = await Promise.all([listAthletes(user.id), listInvites(user.id)]);
  const pending = invites.filter((invite) => invite.status === 'pending');

  return (
    <>
      <PageTitle>Atleti</PageTitle>

      <Card className="mb-8 p-5">
        <form action={createInviteAction} className="flex flex-wrap items-end gap-3">
          <div className="min-w-56 flex-1">
            <Field
              label="Invita un atleta"
              hint="Il nome serve a te, per sapere a chi hai mandato il link. Ogni link vale per una persona sola."
            >
              <Input name="label" required placeholder="Andrea" maxLength={80} />
            </Field>
          </div>
          <Button type="submit">Genera link</Button>
        </form>
      </Card>

      {pending.length > 0 ? (
        <section className="mb-8">
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">
            Inviti in sospeso
          </h2>
          <ul className="space-y-2">
            {pending.map((invite) => (
              <li key={invite.id}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{invite.label}</p>
                    <p className="text-sm text-muted">inviato {timeAgo(invite.createdAt)}</p>
                  </div>
                  <CopyLink url={invite.url} />
                  <form action={revokeInviteAction}>
                    <input type="hidden" name="inviteId" value={invite.id} />
                    <Button variant="danger" className="px-3 py-1.5 text-sm">
                      Revoca
                    </Button>
                  </form>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted">Atleti seguiti</h2>
        {athletes.length === 0 ? (
          <EmptyState title="Ancora nessun atleta">
            Genera un link qui sopra e mandaglielo: quando lo accetta compare qui.
          </EmptyState>
        ) : (
          <ul className="space-y-2">
            {athletes.map((athlete) => (
              <li key={athlete.relationshipId}>
                <Card className="flex flex-wrap items-center gap-3 p-4">
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-soft font-semibold text-accent-ink">
                    {athlete.displayName.slice(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{athlete.displayName}</p>
                    <p className="text-sm text-muted">@{athlete.handle}</p>
                  </div>
                  {athlete.activeMesocycles > 0 ? (
                    <Badge tone="accent">{athlete.activeMesocycles} in corso</Badge>
                  ) : (
                    <Badge tone="warn">nessuna scheda</Badge>
                  )}
                  <NewMesocycle relationshipId={athlete.relationshipId} name={athlete.displayName} />
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
