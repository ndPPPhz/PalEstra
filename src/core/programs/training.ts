import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import { feedbacks, mesoWeeks, trainingSessions } from '@/db/schema';
import { badRequest, notFound } from '@/core/errors';
import { mesocycleIdOfSession, mesocycleIdOfSlot, mesocycleIdOfWeek, requireAthlete } from '@/core/authz';
import type { SessionUser } from '@/core/auth';

async function loadSessionForAthlete(athlete: SessionUser, sessionId: string) {
  const mesocycleId = await mesocycleIdOfSession(sessionId);
  await requireAthlete(athlete, mesocycleId);

  const [session] = await db.select().from(trainingSessions).where(eq(trainingSessions.id, sessionId)).limit(1);
  if (!session) throw notFound('Allenamento non trovato.');

  const [week] = await db.select().from(mesoWeeks).where(eq(mesoWeeks.id, session.weekId)).limit(1);
  if (!week?.publishedAt) {
    throw badRequest('Questa settimana non è ancora stata pubblicata dal preparatore.');
  }

  return { session, week, mesocycleId };
}

/** The FEEDBACK cell: "6,5,5,5 secondi", "3 ultima 2". */
export async function upsertFeedback(
  athlete: SessionUser,
  input: { sessionId: string; slotId: string; rawText: string },
) {
  const { mesocycleId } = await loadSessionForAthlete(athlete, input.sessionId);

  if ((await mesocycleIdOfSlot(input.slotId)) !== mesocycleId) {
    throw badRequest('Questa riga non appartiene alla scheda.');
  }

  const rawText = input.rawText.trim();
  if (!rawText) {
    await db
      .delete(feedbacks)
      .where(and(eq(feedbacks.sessionId, input.sessionId), eq(feedbacks.slotId, input.slotId)));
    return null;
  }

  const values = {
    sessionId: input.sessionId,
    slotId: input.slotId,
    authorUserId: athlete.id,
    rawText,
  };

  const [row] = await db
    .insert(feedbacks)
    .values(values)
    .onConflictDoUpdate({
      target: [feedbacks.sessionId, feedbacks.slotId],
      set: { rawText, updatedAt: new Date() },
    })
    .returning();

  return row;
}

/** The whole-day note: "sta giornata sono un po' stanco". */
export async function setSessionNote(athlete: SessionUser, sessionId: string, note: string) {
  await loadSessionForAthlete(athlete, sessionId);

  const [row] = await db
    .update(trainingSessions)
    .set({ note: note.trim() || null })
    .where(eq(trainingSessions.id, sessionId))
    .returning();

  return row;
}

/**
 * Marks a day done and, if it was the last one, closes the week.
 *
 * Week completion is derived from its sessions rather than trusted from
 * the client, so the coach's "schede da aggiornare" list can never show a
 * week the athlete has not actually finished.
 */
export async function completeSession(
  athlete: SessionUser,
  sessionId: string,
  options: { performedOn?: string } = {},
) {
  const { session } = await loadSessionForAthlete(athlete, sessionId);

  return db.transaction(async (tx) => {
    await tx
      .update(trainingSessions)
      .set({
        completedAt: sql`coalesce(${trainingSessions.completedAt}, now())`,
        performedOn: options.performedOn ?? sql`coalesce(${trainingSessions.performedOn}, current_date)`,
      })
      .where(eq(trainingSessions.id, sessionId));

    const [pending] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(trainingSessions)
      .where(and(eq(trainingSessions.weekId, session.weekId), isNull(trainingSessions.completedAt)));

    const weekComplete = (pending?.count ?? 0) === 0;

    const [week] = await tx
      .update(mesoWeeks)
      .set({ completedAt: weekComplete ? sql`coalesce(${mesoWeeks.completedAt}, now())` : null })
      .where(eq(mesoWeeks.id, session.weekId))
      .returning();

    return { weekComplete, week };
  });
}

/** Undo, for the inevitable mis-tap in the gym. */
export async function reopenSession(athlete: SessionUser, sessionId: string) {
  const { session } = await loadSessionForAthlete(athlete, sessionId);

  return db.transaction(async (tx) => {
    await tx
      .update(trainingSessions)
      .set({ completedAt: null })
      .where(eq(trainingSessions.id, sessionId));

    // The week follows its sessions in both directions.
    await tx.update(mesoWeeks).set({ completedAt: null }).where(eq(mesoWeeks.id, session.weekId));
  });
}

/**
 * Lets the athlete close the week explicitly even with days left untouched
 * — an illness, a trip. The remaining sessions are marked skipped by
 * staying uncompleted, and the coach sees the week in their queue.
 */
export async function completeWeek(athlete: SessionUser, weekId: string) {
  const mesocycleId = await mesocycleIdOfWeek(weekId);
  await requireAthlete(athlete, mesocycleId);

  const [week] = await db
    .update(mesoWeeks)
    .set({ completedAt: sql`coalesce(${mesoWeeks.completedAt}, now())` })
    .where(and(eq(mesoWeeks.id, weekId), sql`${mesoWeeks.publishedAt} is not null`))
    .returning();

  if (!week) throw badRequest('Questa settimana non è ancora stata pubblicata.');
  return week;
}
