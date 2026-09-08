import { and, asc, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { mesoDays, mesoSlots, mesocycles } from '@/db/schema';
import { badRequest } from '@/core/errors';
import { mesocycleIdOfDay, mesocycleIdOfSlot, requireCoach } from '@/core/authz';
import { requireRelationship } from '@/core/relationships';
import type { SessionUser } from '@/core/auth';

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
  input: { exerciseId?: string | null; labelOverride?: string | null },
) {
  const mesocycleId = await mesocycleIdOfDay(dayId);
  await requireCoach(coach, mesocycleId);

  if (!input.exerciseId && !input.labelOverride?.trim()) {
    throw badRequest('Scegli un esercizio dalla libreria oppure scrivi un nome.');
  }

  const [last] = await db
    .select({ position: mesoSlots.position })
    .from(mesoSlots)
    .where(eq(mesoSlots.dayId, dayId))
    .orderBy(sql`${mesoSlots.position} desc`)
    .limit(1);

  const [row] = await db
    .insert(mesoSlots)
    .values({
      dayId,
      position: (last?.position ?? 0) + 1,
      exerciseId: input.exerciseId ?? null,
      labelOverride: input.labelOverride?.trim() || null,
    })
    .returning();

  if (!row) throw new Error('Creazione riga fallita');
  return row;
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
