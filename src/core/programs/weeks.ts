import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { mesoDays, mesoWeeks, prescriptions, trainingSessions } from '@/db/schema';
import { badRequest, notFound } from '@/core/errors';
import { mesocycleIdOfSlot, mesocycleIdOfWeek, requireCoach } from '@/core/authz';
import { parsePrescription } from '@/core/prescriptions/parser';
import type { SessionUser } from '@/core/auth';

/**
 * Adds the next WEEK column.
 *
 * Copy-forward is what replaces the sheet's "Uguale": every cell of the
 * previous week is duplicated into the new one, so the coach edits only
 * what actually changes and every cell always holds real values. That is
 * why history and future charts work at all — a cell reading "same as last
 * week" would be a dangling reference.
 */
export async function addWeek(
  coach: SessionUser,
  mesocycleId: string,
  options: { copyFromPrevious?: boolean; label?: string } = {},
) {
  await requireCoach(coach, mesocycleId);
  const copyFromPrevious = options.copyFromPrevious ?? true;

  return db.transaction(async (tx) => {
    const [previous] = await tx
      .select()
      .from(mesoWeeks)
      .where(eq(mesoWeeks.mesocycleId, mesocycleId))
      .orderBy(sql`${mesoWeeks.position} desc`)
      .limit(1);

    const position = (previous?.position ?? 0) + 1;

    const [week] = await tx
      .insert(mesoWeeks)
      .values({ mesocycleId, position, label: options.label?.trim() || `WEEK ${position}` })
      .returning();

    if (!week) throw new Error('Creazione settimana fallita');

    if (copyFromPrevious && previous) {
      const cells = await tx.select().from(prescriptions).where(eq(prescriptions.weekId, previous.id));

      if (cells.length > 0) {
        await tx.insert(prescriptions).values(
          cells.map((cell) => ({
            weekId: week.id,
            slotId: cell.slotId,
            rawText: cell.rawText,
            parsed: cell.parsed,
            sets: cell.sets,
            reps: cell.reps,
            loadKg: cell.loadKg,
            // The coach's note belonged to that week, not to this one.
            coachNote: null,
          })),
        );
      }
    }

    return { week, copiedFrom: copyFromPrevious ? (previous ?? null) : null };
  });
}

export async function renameWeek(coach: SessionUser, weekId: string, label: string) {
  await requireCoach(coach, await mesocycleIdOfWeek(weekId));
  const trimmed = label.trim();
  if (!trimmed) throw badRequest('La settimana deve avere un nome.');

  const [row] = await db.update(mesoWeeks).set({ label: trimmed }).where(eq(mesoWeeks.id, weekId)).returning();
  return row;
}

/**
 * Releases the week to the athlete and materialises one training session
 * per day. Sessions are what the athlete ticks off and what execution
 * videos will hang from later.
 */
export async function publishWeek(coach: SessionUser, weekId: string) {
  const mesocycleId = await mesocycleIdOfWeek(weekId);
  await requireCoach(coach, mesocycleId);

  return db.transaction(async (tx) => {
    const days = await tx
      .select({ id: mesoDays.id })
      .from(mesoDays)
      .where(eq(mesoDays.mesocycleId, mesocycleId))
      .orderBy(asc(mesoDays.position));

    if (days.length === 0) {
      throw badRequest('Aggiungi almeno una giornata prima di pubblicare la settimana.');
    }

    await tx
      .insert(trainingSessions)
      .values(days.map((day) => ({ weekId, dayId: day.id })))
      // Re-publishing must not wipe what the athlete already logged.
      .onConflictDoNothing();

    const [week] = await tx
      .update(mesoWeeks)
      .set({ publishedAt: sql`coalesce(${mesoWeeks.publishedAt}, now())` })
      .where(eq(mesoWeeks.id, weekId))
      .returning();

    return week;
  });
}

/**
 * Writes a cell. The raw text is stored verbatim and always wins on screen;
 * the parsed columns are best effort and a failure to understand is a
 * normal outcome, never a rejected save.
 */
export async function upsertPrescription(
  coach: SessionUser,
  input: { weekId: string; slotId: string; rawText: string; coachNote?: string | null },
) {
  const mesocycleId = await mesocycleIdOfWeek(input.weekId);
  await requireCoach(coach, mesocycleId);

  // The slot must belong to the same mesocycle as the week, or a coach
  // could write into another athlete's programme through a crafted id.
  if ((await mesocycleIdOfSlot(input.slotId)) !== mesocycleId) {
    throw badRequest('Questa riga non appartiene alla scheda.');
  }

  const rawText = input.rawText.trim();
  if (!rawText) {
    await db
      .delete(prescriptions)
      .where(and(eq(prescriptions.weekId, input.weekId), eq(prescriptions.slotId, input.slotId)));
    return null;
  }

  const parsed = parsePrescription(rawText);
  const values = {
    weekId: input.weekId,
    slotId: input.slotId,
    rawText,
    parsed: parsed.parsed,
    sets: parsed.sets,
    reps: parsed.reps,
    loadKg: parsed.loadKg === null ? null : String(parsed.loadKg),
    coachNote: input.coachNote?.trim() || null,
  };

  const [row] = await db
    .insert(prescriptions)
    .values(values)
    .onConflictDoUpdate({
      target: [prescriptions.weekId, prescriptions.slotId],
      set: { ...values, updatedAt: new Date() },
    })
    .returning();

  return row;
}

export async function deleteWeek(coach: SessionUser, weekId: string) {
  const mesocycleId = await mesocycleIdOfWeek(weekId);
  await requireCoach(coach, mesocycleId);

  const [week] = await db.select().from(mesoWeeks).where(eq(mesoWeeks.id, weekId)).limit(1);
  if (!week) throw notFound('Settimana non trovata.');
  if (week.completedAt) {
    throw badRequest('Una settimana già completata dall’atleta non si cancella: fa parte dello storico.');
  }

  await db.delete(mesoWeeks).where(eq(mesoWeeks.id, weekId));
}
