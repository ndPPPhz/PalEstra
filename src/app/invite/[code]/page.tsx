import { previewInvite } from '@/core/relationships';
import { currentUser } from '@/server/session';
import { Card, EmptyState, LinkButton } from '@/ui';
import { AcceptInvite } from './accept';

/**
 * The public landing for an invite link. It shows who is inviting before
 * asking anyone to log in — the athlete should know whose link they opened.
 */
export default async function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const invite = await previewInvite(code);
  const user = await currentUser();

  if (!invite) {
    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <EmptyState title="Invito non trovato">
          Controlla il link: potrebbe essere stato copiato male.
        </EmptyState>
      </main>
    );
  }

  const coachName = invite.coachPublicName ?? invite.coachName;

  if (invite.status !== 'pending') {
    const reason = {
      accepted: 'Questo invito è già stato usato.',
      revoked: 'Questo invito è stato revocato dal preparatore.',
      expired: 'Questo invito è scaduto.',
      pending: '',
    }[invite.status];

    return (
      <main className="mx-auto max-w-md px-5 py-16">
        <EmptyState title={reason}>Chiedi a {coachName} di generarne uno nuovo.</EmptyState>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-5 py-10">
      <Card className="p-7 text-center">
        <div className="mx-auto mb-4 flex size-16 items-center justify-center rounded-full bg-accent-soft text-2xl font-semibold text-accent-ink">
          {coachName.slice(0, 1).toUpperCase()}
        </div>
        <h1 className="text-xl font-semibold">{coachName}</h1>
        <p className="text-sm text-muted">@{invite.coachHandle}</p>
        <p className="mt-5 text-ink">vuole seguirti come preparatore su PalEstra.</p>

        <div className="mt-7">
          {user ? (
            <AcceptInvite code={invite.code} />
          ) : (
            <LinkButton href={`/login?next=${encodeURIComponent(`/invite/${invite.code}`)}`} className="w-full">
              Accedi per accettare
            </LinkButton>
          )}
        </div>
      </Card>
    </main>
  );
}
