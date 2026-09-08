import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { db } from '@/db';
import { exercises } from '@/db/schema';
import { badRequest, notFound } from '@/core/errors';
import type { SessionUser } from '@/core/auth';

/**
 * A coach sees their own exercises plus the global seed ones
 * (`ownerUserId is null`), so nobody has to retype "Panca piana". Only the
 * owner can edit, which means seed rows are read-only for everyone.
 */
export async function listExercises(userId: string) {
  return db
    .select()
    .from(exercises)
    .where(and(or(eq(exercises.ownerUserId, userId), isNull(exercises.ownerUserId)), isNull(exercises.archivedAt)))
    .orderBy(asc(exercises.name));
}

export async function getExercise(userId: string, exerciseId: string) {
  const [row] = await db.select().from(exercises).where(eq(exercises.id, exerciseId)).limit(1);
  if (!row) throw notFound('Esercizio non trovato.');
  if (row.ownerUserId !== null && row.ownerUserId !== userId) throw notFound('Esercizio non trovato.');
  return row;
}

export async function createExercise(user: SessionUser, input: { name: string; description?: string }) {
  const name = input.name.trim();
  if (!name) throw badRequest('Il nome dell’esercizio è obbligatorio.');

  const [row] = await db
    .insert(exercises)
    .values({ ownerUserId: user.id, name, description: input.description?.trim() || null })
    .returning();

  if (!row) throw new Error('Creazione esercizio fallita');
  return row;
}

export async function updateExercise(
  user: SessionUser,
  exerciseId: string,
  input: { name?: string; description?: string },
) {
  const values: Partial<typeof exercises.$inferInsert> = {};
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (!name) throw badRequest('Il nome dell’esercizio è obbligatorio.');
    values.name = name;
  }
  if (input.description !== undefined) values.description = input.description.trim() || null;

  const [row] = await db
    .update(exercises)
    .set(values)
    // Owner-scoped: a seed exercise has no owner and so matches nobody.
    .where(and(eq(exercises.id, exerciseId), eq(exercises.ownerUserId, user.id)))
    .returning();

  if (!row) throw notFound('Esercizio non trovato o non tuo.');
  return row;
}

/** Archived, not deleted: old programmes keep pointing at a real exercise. */
export async function archiveExercise(user: SessionUser, exerciseId: string) {
  const [row] = await db
    .update(exercises)
    .set({ archivedAt: new Date() })
    .where(and(eq(exercises.id, exerciseId), eq(exercises.ownerUserId, user.id)))
    .returning();

  if (!row) throw notFound('Esercizio non trovato o non tuo.');
  return row;
}
