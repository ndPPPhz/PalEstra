import { requireUserPage } from '@/server/session';
import { listExercises } from '@/core/exercises';
import { Badge, Button, Card, Field, Input, PageTitle, Textarea } from '@/ui';
import { archiveExerciseAction, createExerciseAction } from '@/app/actions';

/**
 * The coach's library. In this milestone an exercise is a name and a
 * description; photos and videos hang off the same rows in the next one,
 * which is why the athlete's screen already links to it.
 */
export default async function ExercisesPage() {
  const user = await requireUserPage();
  const exercises = await listExercises(user.id);

  return (
    <>
      <PageTitle>Esercizi</PageTitle>

      <Card className="mb-8 p-5">
        <form action={createExerciseAction} className="space-y-4">
          <Field label="Nome">
            <Input name="name" required maxLength={120} placeholder="Panca piana" />
          </Field>
          <Field label="Descrizione" hint="Come si esegue, errori da evitare, cue tecnici.">
            <Textarea name="description" rows={3} maxLength={4000} placeholder="Scapole retratte, gomiti a 45°…" />
          </Field>
          <Button type="submit">Aggiungi esercizio</Button>
        </form>
      </Card>

      <ul className="space-y-2">
        {exercises.map((exercise) => (
          <li key={exercise.id}>
            <Card className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-medium">{exercise.name}</p>
                {exercise.description ? (
                  <p className="mt-1 whitespace-pre-wrap text-sm text-muted">{exercise.description}</p>
                ) : (
                  <p className="mt-1 text-sm text-faint">Nessuna descrizione.</p>
                )}
              </div>
              {exercise.ownerUserId === null ? (
                <Badge>di sistema</Badge>
              ) : (
                <form action={archiveExerciseAction}>
                  <input type="hidden" name="exerciseId" value={exercise.id} />
                  <Button variant="ghost" className="px-3 py-1.5 text-sm">
                    Archivia
                  </Button>
                </form>
              )}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
