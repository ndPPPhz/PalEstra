import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { mesoDays, mesoSlots, mesoWeeks, mesocycles, trainingSessions } from '@/db/schema';
import { forbidden, notFound } from '@/core/errors';
import type { SessionUser } from '@/core/auth';

/**
 * The one place permissions are decided. Route handlers and server
 * components call these; none of them re-implement a check of their own.
 *
 * A user has no global role: the same person is a coach in some
 * relationships and an athlete in others, so the role is always resolved
 * against the specific mesocycle being touched.
 */
export type ProgramRole = 'coach' | 'athlete';

export interface MesocycleAccess {
  mesocycleId: string;
  coachUserId: string;
  athleteUserId: string;
  role: ProgramRole;
}

export async function accessToMesocycle(user: SessionUser, mesocycleId: string): Promise<MesocycleAccess> {
  const [row] = await db
    .select({
      id: mesocycles.id,
      coachUserId: mesocycles.coachUserId,
      athleteUserId: mesocycles.athleteUserId,
      deletedAt: mesocycles.deletedAt,
    })
    .from(mesocycles)
    .where(eq(mesocycles.id, mesocycleId))
    .limit(1);

  if (!row || row.deletedAt) throw notFound('Scheda non trovata.');

  const role: ProgramRole | null =
    row.coachUserId === user.id ? 'coach' : row.athleteUserId === user.id ? 'athlete' : null;

  // Someone else's mesocycle is reported as missing rather than forbidden:
  // a 403 would confirm that this id exists.
  if (!role) throw notFound('Scheda non trovata.');

  return { mesocycleId: row.id, coachUserId: row.coachUserId, athleteUserId: row.athleteUserId, role };
}

/** The coach owns the structure: days, exercises, weeks, prescriptions. */
export async function requireCoach(user: SessionUser, mesocycleId: string): Promise<MesocycleAccess> {
  const access = await accessToMesocycle(user, mesocycleId);
  if (access.role !== 'coach') throw forbidden('Solo il preparatore può modificare la scheda.');
  return access;
}

/** The athlete owns what happened: sessions, feedback, their own media. */
export async function requireAthlete(user: SessionUser, mesocycleId: string): Promise<MesocycleAccess> {
  const access = await accessToMesocycle(user, mesocycleId);
  if (access.role !== 'athlete') throw forbidden('Solo l’atleta può registrare l’allenamento.');
  return access;
}

// Routes address weeks, slots and sessions directly, so each needs a way
// back up to the mesocycle that governs it.

export async function mesocycleIdOfWeek(weekId: string): Promise<string> {
  const [row] = await db
    .select({ mesocycleId: mesoWeeks.mesocycleId })
    .from(mesoWeeks)
    .where(eq(mesoWeeks.id, weekId))
    .limit(1);
  if (!row) throw notFound('Settimana non trovata.');
  return row.mesocycleId;
}

export async function mesocycleIdOfDay(dayId: string): Promise<string> {
  const [row] = await db
    .select({ mesocycleId: mesoDays.mesocycleId })
    .from(mesoDays)
    .where(eq(mesoDays.id, dayId))
    .limit(1);
  if (!row) throw notFound('Giornata non trovata.');
  return row.mesocycleId;
}

export async function mesocycleIdOfSlot(slotId: string): Promise<string> {
  const [row] = await db
    .select({ mesocycleId: mesoDays.mesocycleId })
    .from(mesoSlots)
    .innerJoin(mesoDays, eq(mesoDays.id, mesoSlots.dayId))
    .where(eq(mesoSlots.id, slotId))
    .limit(1);
  if (!row) throw notFound('Esercizio non trovato.');
  return row.mesocycleId;
}

export async function mesocycleIdOfSession(sessionId: string): Promise<string> {
  const [row] = await db
    .select({ mesocycleId: mesoWeeks.mesocycleId })
    .from(trainingSessions)
    .innerJoin(mesoWeeks, eq(mesoWeeks.id, trainingSessions.weekId))
    .where(eq(trainingSessions.id, sessionId))
    .limit(1);
  if (!row) throw notFound('Allenamento non trovato.');
  return row.mesocycleId;
}
