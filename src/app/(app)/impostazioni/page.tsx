import { requireUserPage } from '@/server/session';
import { getCoachProfile } from '@/core/users';
import { Button, Card, Field, Input, PageTitle } from '@/ui';
import { updateProfileAction } from '@/app/actions';

export default async function SettingsPage() {
  const user = await requireUserPage();
  const profile = await getCoachProfile(user.id);

  return (
    <>
      <PageTitle>Impostazioni</PageTitle>
      <Card className="p-5">
        <form action={updateProfileAction} className="space-y-4">
          <Field label="Nome" hint="È quello che vedono il tuo preparatore e i tuoi atleti.">
            <Input name="displayName" defaultValue={user.displayName} required maxLength={80} />
          </Field>
          <Field
            label="Nome pubblico da preparatore"
            hint="Compare nel link di invito che mandi agli atleti. Lascia vuoto se non alleni nessuno."
          >
            <Input
              name="publicName"
              defaultValue={profile?.publicName ?? ''}
              maxLength={120}
              placeholder="Callistenics by Perruccio"
            />
          </Field>
          <div className="text-sm text-muted">
            Email: {user.email} · Handle: @{user.handle}
          </div>
          <Button type="submit">Salva</Button>
        </form>
      </Card>
    </>
  );
}
