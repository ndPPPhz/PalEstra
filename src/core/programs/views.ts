import { and, asc, desc, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db';
import {
  exercises,
  feedbacks,
  mesoDays,
  mesoSlots,
  mesoWeeks,
  mesocycles,
  prescriptions,
  trainingSessions,
  users,
} from '@/db/schema';
import { notFound } from '@/core/errors';
import { accessToMesocycle, mesocycleIdOfSession, mesocycleIdOfWeek } from '@/core/authz';
import type { ParsedPrescription } from '@/core/prescriptions/parser';
import type { SessionUser } from '@/core/auth';

export const cellKey = (weekId: string, slotId: string) => `${weekId}:${slotId}`;

export interface GridCell {
  rawText: string;
  parsed: ParsedPrescription | null;
  coachNote: string | null;
}

/**
 * The coach's whole spreadsheet in a fixed number of queries — six,
 * regardless of how many weeks or exercises the programme has. The sheet
 * is a cartesian product, so it is read as one, never a query per cell.
 */
export async function mesocycleGrid(user: SessionUser, mesocycleId: string) {
  const access = await accessToMesocycle(user, mesocycleId);

  const [meta] = await db
    .select({
      id: mesocycles.id,
      title: mesocycles.title,
      completedAt: mesocycles.completedAt,
      createdAt: mesocycles.createdAt,
      athleteName: users.displayName,
      athleteHandle: users.handle,
      athleteId: users.id,
    })
    .from(mesocycles)
    .innerJoin(users, eq(users.id, mesocycles.athleteUserId))
    .where(eq(mesocycles.id, mesocycleId))
    .limit(1);

  if (!meta) throw notFound('Scheda non trovata.');

  const slotRows = await db
    .select({
      slotId: mesoSlots.id,
      slotPosition: mesoSlots.position,
      labelOverride: mesoSlots.labelOverride,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      exerciseDescription: exercises.description,
      dayId: mesoDays.id,
      dayPosition: mesoDays.position,
      dayLabel: mesoDays.label,
    })
    .from(mesoDays)
    .leftJoin(mesoSlots, eq(mesoSlots.dayId, mesoDays.id))
    .leftJoin(exercises, eq(exercises.id, mesoSlots.exerciseId))
    .where(eq(mesoDays.mesocycleId, mesocycleId))
    .orderBy(asc(mesoDays.position), asc(mesoSlots.position));

  const weeks = await db
    .select()
    .from(mesoWeeks)
    .where(eq(mesoWeeks.mesocycleId, mesocycleId))
    .orderBy(asc(mesoWeeks.position));

  const cells = await db
    .select({
      weekId: prescriptions.weekId,
      slotId: prescriptions.slotId,
      rawText: prescriptions.rawText,
      parsed: prescriptions.parsed,
      coachNote: prescriptions.coachNote,
    })
    .from(prescriptions)
    .innerJoin(mesoWeeks, eq(mesoWeeks.id, prescriptions.weekId))
    .where(eq(mesoWeeks.mesocycleId, mesocycleId));

  const sessions = await db
    .select({
      id: trainingSessions.id,
      weekId: trainingSessions.weekId,
      dayId: trainingSessions.dayId,
      note: trainingSessions.note,
      performedOn: trainingSessions.performedOn,
      completedAt: trainingSessions.completedAt,
    })
    .from(trainingSessions)
    .innerJoin(mesoWeeks, eq(mesoWeeks.id, trainingSessions.weekId))
    .where(eq(mesoWeeks.mesocycleId, mesocycleId));

  const feedbackRows = await db
    .select({
      weekId: trainingSessions.weekId,
      slotId: feedbacks.slotId,
      rawText: feedbacks.rawText,
    })
    .from(feedbacks)
    .innerJoin(trainingSessions, eq(trainingSessions.id, feedbacks.sessionId))
    .innerJoin(mesoWeeks, eq(mesoWeeks.id, trainingSessions.weekId))
    .where(eq(mesoWeeks.mesocycleId, mesocycleId));

  // Rebuild the day -> slots tree. The left joins mean a day with no rows
  // yet still arrives, with a null slotId.
  const days = new Map<string, { id: string; position: number; label: string; slots: Array<{ id: string; position: number; name: string; exerciseId: string | null; description: string | null }> }>();

  for (const row of slotRows) {
    let day = days.get(row.dayId);
    if (!day) {
      day = { id: row.dayId, position: row.dayPosition, label: row.dayLabel, slots: [] };
      days.set(row.dayId, day);
    }
    if (row.slotId) {
      day.slots.push({
        id: row.slotId,
        position: row.slotPosition ?? 0,
        // The programme-specific name wins over the library one.
        name: row.labelOverride ?? row.exerciseName ?? 'Esercizio',
        exerciseId: row.exerciseId,
        description: row.exerciseDescription,
      });
    }
  }

  return {
    role: access.role,
    mesocycle: meta,
    days: [...days.values()],
    weeks,
    prescriptions: new Map(cells.map((c) => [cellKey(c.weekId, c.slotId), c as GridCell])),
    feedbacks: new Map(feedbackRows.map((f) => [cellKey(f.weekId, f.slotId), f.rawText])),
    sessions: new Map(sessions.map((s) => [`${s.weekId}:${s.dayId}`, s])),
  };
}

/** The athlete's home: current programmes first, then the finished ones. */
export async function athleteMesocycles(athleteUserId: string) {
  return db
    .select({
      id: mesocycles.id,
      title: mesocycles.title,
      completedAt: mesocycles.completedAt,
      createdAt: mesocycles.createdAt,
      coachName: users.displayName,
      coachHandle: users.handle,
      weekCount: sql<number>`(select count(*)::int from ${mesoWeeks} w where w.mesocycle_id = ${mesocycles.id} and w.published_at is not null)`,
      doneWeekCount: sql<number>`(select count(*)::int from ${mesoWeeks} w where w.mesocycle_id = ${mesocycles.id} and w.completed_at is not null)`,
    })
    .from(mesocycles)
    .innerJoin(users, eq(users.id, mesocycles.coachUserId))
    .where(and(eq(mesocycles.athleteUserId, athleteUserId), isNull(mesocycles.deletedAt)))
    .orderBy(asc(mesocycles.completedAt), desc(mesocycles.createdAt));
}

export async function coachMesocycles(coachUserId: string) {
  return db
    .select({
      id: mesocycles.id,
      title: mesocycles.title,
      completedAt: mesocycles.completedAt,
      createdAt: mesocycles.createdAt,
      athleteName: users.displayName,
      athleteHandle: users.handle,
    })
    .from(mesocycles)
    .innerJoin(users, eq(users.id, mesocycles.athleteUserId))
    .where(and(eq(mesocycles.coachUserId, coachUserId), isNull(mesocycles.deletedAt)))
    .orderBy(asc(mesocycles.completedAt), desc(mesocycles.createdAt));
}

/**
 * "Schede da aggiornare": the coach's home list.
 *
 * Deliberately a derived query and not a table of tasks — a completed week
 * with no week after it *is* the task, so this can never drift out of sync
 * with reality or need a backfill. A notifications table only becomes
 * worthwhile when push arrives.
 */
export async function coachPendingUpdates(coachUserId: string) {
  return db
    .select({
      weekId: mesoWeeks.id,
      weekLabel: mesoWeeks.label,
      weekPosition: mesoWeeks.position,
      completedAt: mesoWeeks.completedAt,
      mesocycleId: mesocycles.id,
      mesocycleTitle: mesocycles.title,
      athleteName: users.displayName,
      athleteHandle: users.handle,
    })
    .from(mesoWeeks)
    .innerJoin(mesocycles, eq(mesocycles.id, mesoWeeks.mesocycleId))
    .innerJoin(users, eq(users.id, mesocycles.athleteUserId))
    .where(
      and(
        eq(mesocycles.coachUserId, coachUserId),
        isNull(mesocycles.completedAt),
        isNull(mesocycles.deletedAt),
        sql`${mesoWeeks.completedAt} is not null`,
        // No later week exists: the athlete is waiting on the coach.
        sql`not exists (
          select 1 from ${mesoWeeks} later
          where later.mesocycle_id = ${mesocycles.id} and later.position > ${mesoWeeks.position}
        )`,
      ),
    )
    .orderBy(desc(mesoWeeks.completedAt));
}

/** The athlete's view of one week: a card per day. */
export async function athleteWeekView(user: SessionUser, weekId: string) {
  const mesocycleId = await mesocycleIdOfWeek(weekId);
  const access = await accessToMesocycle(user, mesocycleId);

  const [week] = await db.select().from(mesoWeeks).where(eq(mesoWeeks.id, weekId)).limit(1);
  if (!week) throw notFound('Settimana non trovata.');

  const days = await db
    .select({
      dayId: mesoDays.id,
      label: mesoDays.label,
      position: mesoDays.position,
      sessionId: trainingSessions.id,
      note: trainingSessions.note,
      completedAt: trainingSessions.completedAt,
      performedOn: trainingSessions.performedOn,
      exerciseCount: sql<number>`(select count(*)::int from ${mesoSlots} s where s.day_id = ${mesoDays.id})`,
    })
    .from(mesoDays)
    .leftJoin(
      trainingSessions,
      and(eq(trainingSessions.dayId, mesoDays.id), eq(trainingSessions.weekId, weekId)),
    )
    .where(eq(mesoDays.mesocycleId, mesocycleId))
    .orderBy(asc(mesoDays.position));

  return { role: access.role, week, days, mesocycleId };
}

/**
 * The in-gym screen: one day's exercises with what to do, what was logged,
 * and — the thing the spreadsheet cannot do on a phone — last week's
 * prescription and feedback side by side.
 */
export async function athleteDayView(user: SessionUser, sessionId: string) {
  const mesocycleId = await mesocycleIdOfSession(sessionId);
  const access = await accessToMesocycle(user, mesocycleId);

  const [session] = await db
    .select({
      id: trainingSessions.id,
      note: trainingSessions.note,
      completedAt: trainingSessions.completedAt,
      performedOn: trainingSessions.performedOn,
      weekId: mesoWeeks.id,
      weekLabel: mesoWeeks.label,
      weekPosition: mesoWeeks.position,
      publishedAt: mesoWeeks.publishedAt,
      dayId: mesoDays.id,
      dayLabel: mesoDays.label,
      mesocycleTitle: mesocycles.title,
    })
    .from(trainingSessions)
    .innerJoin(mesoWeeks, eq(mesoWeeks.id, trainingSessions.weekId))
    .innerJoin(mesoDays, eq(mesoDays.id, trainingSessions.dayId))
    .innerJoin(mesocycles, eq(mesocycles.id, mesoWeeks.mesocycleId))
    .where(eq(trainingSessions.id, sessionId))
    .limit(1);

  if (!session) throw notFound('Allenamento non trovato.');

  // The same day one week earlier, for the inline comparison.
  const [previousWeek] = await db
    .select({ id: mesoWeeks.id })
    .from(mesoWeeks)
    .where(and(eq(mesoWeeks.mesocycleId, mesocycleId), sql`${mesoWeeks.position} < ${session.weekPosition}`))
    .orderBy(desc(mesoWeeks.position))
    .limit(1);

  const rows = await db
    .select({
      slotId: mesoSlots.id,
      position: mesoSlots.position,
      labelOverride: mesoSlots.labelOverride,
      exerciseId: exercises.id,
      exerciseName: exercises.name,
      description: exercises.description,
      rawText: prescriptions.rawText,
      parsed: prescriptions.parsed,
      coachNote: prescriptions.coachNote,
      feedback: feedbacks.rawText,
    })
    .from(mesoSlots)
    .leftJoin(exercises, eq(exercises.id, mesoSlots.exerciseId))
    .leftJoin(
      prescriptions,
      and(eq(prescriptions.slotId, mesoSlots.id), eq(prescriptions.weekId, session.weekId)),
    )
    .leftJoin(feedbacks, and(eq(feedbacks.slotId, mesoSlots.id), eq(feedbacks.sessionId, sessionId)))
    .where(eq(mesoSlots.dayId, session.dayId))
    .orderBy(asc(mesoSlots.position));

  const previous = new Map<string, { prescription: string | null; feedback: string | null }>();
  if (previousWeek) {
    const previousRows = await db
      .select({
        slotId: mesoSlots.id,
        prescription: prescriptions.rawText,
        feedback: feedbacks.rawText,
      })
      .from(mesoSlots)
      .leftJoin(
        prescriptions,
        and(eq(prescriptions.slotId, mesoSlots.id), eq(prescriptions.weekId, previousWeek.id)),
      )
      .leftJoin(
        trainingSessions,
        and(eq(trainingSessions.dayId, session.dayId), eq(trainingSessions.weekId, previousWeek.id)),
      )
      .leftJoin(
        feedbacks,
        and(eq(feedbacks.slotId, mesoSlots.id), eq(feedbacks.sessionId, trainingSessions.id)),
      )
      .where(eq(mesoSlots.dayId, session.dayId));

    for (const row of previousRows) {
      previous.set(row.slotId, { prescription: row.prescription, feedback: row.feedback });
    }
  }

  return {
    role: access.role,
    session,
    mesocycleId,
    rows: rows.map((row) => ({
      ...row,
      name: row.labelOverride ?? row.exerciseName ?? 'Esercizio',
      previous: previous.get(row.slotId) ?? { prescription: null, feedback: null },
    })),
  };
}
