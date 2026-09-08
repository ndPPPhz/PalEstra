import { and, asc, eq, isNull, or, sql } from 'drizzle-orm';
import { db } from '@/db';
import { exercises, mesoDays, mesoSlots, mesocycles } from '@/db/schema';
import { badRequest } from '@/core/errors';
import { mesocycleIdOfDay, mesocycleIdOfSlot, requireCoach } from '@/core/authz';
import { requireRelationship } from '@/core/relationships';
import { validateStructureDraft, type DraftDay } from './draft';
import type { SessionUser } from '@/core/auth';


type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Resolves an exercise name to a library row, creating it under the coach
 * only when nothing matches. Case-insensitive, because "trazioni" and
 * "Trazioni" are the same exercise to the person typing.
 *
 * `cache` lets the bulk builder resolve a whole programme without a query
 * per row; the inline single-row path passes none.
 */
async function findOrCreateExercise(
  tx: Tx,
  coachUserId: string,
  name: string,
  cache?: Map<string, string>,
): Promise<string> {
  const key = name.trim().toLowerCase();
  const cached = cache?.get(key);
  if (cached) return cached;

  const [found] = await tx
    .select({ id: exercises.id })
    .from(exercises)
    .where(
      and(
        or(eq(exercises.ownerUserId, coachUserId), isNull(exercises.ownerUserId)),
        isNull(exercises.archivedAt),
        sql`lower(${exercises.name}) = ${key}`,
      ),
    )
    .limit(1);

  if (found) {
    cache?.set(key, found.id);
    return found.id;
  }

  const [created] = await tx
    .insert(exercises)
    .values({ ownerUserId: coachUserId, name: name.trim() })
    .returning({ id: exercises.id });
  if (!created) throw new Error('Creazione esercizio fallita');

  cache?.set(key, created.id);
  return created.id;
}

export async function createMesocycle(
  coach: SessionUser,
  input: { relationshipId: string; title: string },
) {
  const relationship = await requireRelationship(coach, input.relationshipId);
  if (relationship.coachUserId !== coach.id) {
    throw badRequest('Solo il preparatore può creare una scheda.');
  }

  const title = input.title.trim();
  if (!title) throw badRequest('Dai un titolo alla scheda.');

  const [row] = await db
    .insert(mesocycles)
    .values({
      relationshipId: relationship.id,
      coachUserId: relationship.coachUserId,
      athleteUserId: relationship.athleteUserId,
      title,
    })
    .returning();

  if (!row) throw new Error('Creazione scheda fallita');
  return row;
}

export async function renameMesocycle(coach: SessionUser, mesocycleId: string, title: string) {
  await requireCoach(coach, mesocycleId);
  const trimmed = title.trim();
  if (!trimmed) throw badRequest('Dai un titolo alla scheda.');

  const [row] = await db
    .update(mesocycles)
    .set({ title: trimmed })
    .where(eq(mesocycles.id, mesocycleId))
    .returning();
  return row;
}

/** Closes the mesocycle. The coach then opens the next one, as in the sheet. */
export async function completeMesocycle(coach: SessionUser, mesocycleId: string) {
  await requireCoach(coach, mesocycleId);
  const [row] = await db
    .update(mesocycles)
    .set({ completedAt: new Date() })
    .where(eq(mesocycles.id, mesocycleId))
    .returning();
  return row;
}

export async function addDay(coach: SessionUser, mesocycleId: string, label?: string) {
  await requireCoach(coach, mesocycleId);

  const [last] = await db
    .select({ position: mesoDays.position })
    .from(mesoDays)
    .where(eq(mesoDays.mesocycleId, mesocycleId))
    .orderBy(sql`${mesoDays.position} desc`)
    .limit(1);

  const position = (last?.position ?? 0) + 1;
  const [row] = await db
    .insert(mesoDays)
    .values({ mesocycleId, position, label: label?.trim() || `DAY ${position}` })
    .returning();

  if (!row) throw new Error('Creazione giornata fallita');
  return row;
}

export async function addSlot(
  coach: SessionUser,
  dayId: string,
  input: { exerciseId?: string | null; labelOverride?: string | null; name?: string | null },
) {
  const mesocycleId = await mesocycleIdOfDay(dayId);
  await requireCoach(coach, mesocycleId);

  const name = input.name?.trim();
  if (!input.exerciseId && !name && !input.labelOverride?.trim()) {
    throw badRequest('Scegli un esercizio dalla libreria oppure scrivi un nome.');
  }

  return db.transaction(async (tx) => {
    // Typing a name behaves exactly like the bulk builder: reuse the
    // library entry if it exists, otherwise add it.
    const exerciseId = name
      ? await findOrCreateExercise(tx, coach.id, name)
      : (input.exerciseId ?? null);

    const [last] = await tx
      .select({ position: mesoSlots.position })
      .from(mesoSlots)
      .where(eq(mesoSlots.dayId, dayId))
      .orderBy(sql`${mesoSlots.position} desc`)
      .limit(1);

    const [row] = await tx
      .insert(mesoSlots)
      .values({
        dayId,
        position: (last?.position ?? 0) + 1,
        exerciseId,
        labelOverride: input.labelOverride?.trim() || null,
      })
      .returning();

    if (!row) throw new Error('Creazione riga fallita');
    return row;
  });
}

export async function removeSlot(coach: SessionUser, slotId: string) {
  const mesocycleId = await mesocycleIdOfSlot(slotId);
  await requireCoach(coach, mesocycleId);
  // Prescriptions and feedback for this row cascade away with it.
  await db.delete(mesoSlots).where(eq(mesoSlots.id, slotId));
}

export async function removeDay(coach: SessionUser, dayId: string) {
  const mesocycleId = await mesocycleIdOfDay(dayId);
  await requireCoach(coach, mesocycleId);
  await db.delete(mesoDays).where(eq(mesoDays.id, dayId));
}

/**
 * Applies an explicit order to a day's rows. Positions are rewritten in one
 * transaction, with a temporary negative offset first so the unique
 * (day, position) index never sees a duplicate mid-shuffle.
 */
export async function reorderSlots(coach: SessionUser, dayId: string, slotIds: string[]) {
  const mesocycleId = await mesocycleIdOfDay(dayId);
  await requireCoach(coach, mesocycleId);

  const existing = await db
    .select({ id: mesoSlots.id })
    .from(mesoSlots)
    .where(eq(mesoSlots.dayId, dayId))
    .orderBy(asc(mesoSlots.position));

  const known = new Set(existing.map((s) => s.id));
  if (slotIds.length !== known.size || slotIds.some((sid) => !known.has(sid))) {
    throw badRequest('L’ordine inviato non corrisponde alle righe della giornata.');
  }

  await db.transaction(async (tx) => {
    for (const [index, slotId] of slotIds.entries()) {
      await tx
        .update(mesoSlots)
        .set({ position: -(index + 1) })
        .where(and(eq(mesoSlots.id, slotId), eq(mesoSlots.dayId, dayId)));
    }
    for (const [index, slotId] of slotIds.entries()) {
      await tx
        .update(mesoSlots)
        .set({ position: index + 1 })
        .where(and(eq(mesoSlots.id, slotId), eq(mesoSlots.dayId, dayId)));
    }
  });
}

/**
 * Builds a whole programme in one go from what the coach typed.
 *
 * Adding a real programme a row at a time is around two dozen round trips,
 * which is the wrong first impression for someone who currently does this
 * in a spreadsheet in thirty seconds. This is the same work as one
 * transaction.
 *
 * Exercise names are matched case-insensitively against the coach's own
 * library plus the global seed, and only what is genuinely new gets
 * created — so the library fills itself as they work instead of being a
 * form to complete first, and an existing entry keeps its description.
 */
export async function buildStructure(coach: SessionUser, mesocycleId: string, draft: DraftDay[]) {
  await requireCoach(coach, mesocycleId);
  const days = validateStructureDraft(draft);

  return db.transaction(async (tx) => {
    const [lastDay] = await tx
      .select({ position: mesoDays.position })
      .from(mesoDays)
      .where(eq(mesoDays.mesocycleId, mesocycleId))
      .orderBy(sql`${mesoDays.position} desc`)
      .limit(1);

    const library = new Map<string, string>();
    const known = await tx
      .select({ id: exercises.id, name: exercises.name })
      .from(exercises)
      .where(
        and(
          or(eq(exercises.ownerUserId, coach.id), isNull(exercises.ownerUserId)),
          isNull(exercises.archivedAt),
        ),
      );
    for (const row of known) library.set(row.name.toLowerCase(), row.id);

    let dayPosition = lastDay?.position ?? 0;
    let slotCount = 0;
    let createdExercises = 0;

    for (const draftDay of days) {
      dayPosition += 1;

      const [day] = await tx
        .insert(mesoDays)
        .values({
          mesocycleId,
          position: dayPosition,
          label: draftDay.label?.trim() || `DAY ${dayPosition}`,
        })
        .returning();
      if (!day) throw new Error('Creazione giornata fallita');

      let slotPosition = 0;
      for (const name of draftDay.exercises) {
        const before = library.size;
        const exerciseId = await findOrCreateExercise(tx, coach.id, name, library);
        if (library.size > before) createdExercises += 1;

        slotPosition += 1;
        slotCount += 1;
        await tx.insert(mesoSlots).values({ dayId: day.id, position: slotPosition, exerciseId });
      }
    }

    return { dayCount: days.length, slotCount, createdExercises };
  });
}
