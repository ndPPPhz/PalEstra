import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { and, eq, isNull } from 'drizzle-orm';
import { db, sql as client } from '../src/db';
import { coachingRelationships, users } from '../src/db/schema';
import { parseCsv } from '../src/core/csv';
import { createExercise, listExercises } from '../src/core/exercises';
import {
  addDay,
  addSlot,
  addWeek,
  completeSession,
  createMesocycle,
  mesocycleGrid,
  publishWeek,
  upsertFeedback,
  upsertPrescription,
} from '../src/core/programs';
import type { SessionUser } from '../src/core/auth';

/**
 * Imports one tab of ANNINO ALLENAMENTO (exported as CSV) into a mesocycle.
 *
 *   npm run import:sheet -- --file "3 Ciclo.csv" \
 *     --coach pt@example.com --athlete atleta@example.com --title "3 Ciclo"
 *
 * The layout it expects is the sheet's own: column A holds `DAY n` markers
 * and exercise names, and the header row alternates `WEEK n` with
 * `FEEDBACK`. Running it against the real file is the honest test of the
 * prescription parser — it reports how many cells it understood.
 */

interface Args {
  file: string;
  coach: string;
  athlete: string;
  title?: string;
}

function parseArgs(argv: string[]): Args {
  const map = new Map<string, string>();
  for (let i = 0; i < argv.length; i += 2) {
    const flag = argv[i]?.replace(/^--/, '');
    if (flag && argv[i + 1]) map.set(flag, argv[i + 1]!);
  }
  const file = map.get('file');
  const coach = map.get('coach');
  const athlete = map.get('athlete');
  if (!file || !coach || !athlete) {
    throw new Error('Uso: --file <csv> --coach <email> --athlete <email> [--title <titolo>]');
  }
  return { file, coach, athlete, title: map.get('title') };
}

/** Import is an admin tool, so it provisions accounts rather than emailing codes. */
async function findOrCreateUser(email: string): Promise<SessionUser> {
  const normalised = email.trim().toLowerCase();
  const [existing] = await db.select().from(users).where(eq(users.email, normalised)).limit(1);
  if (existing) {
    return {
      id: existing.id,
      email: existing.email,
      handle: existing.handle,
      displayName: existing.displayName,
    };
  }

  const handle = normalised.split('@')[0]!.replace(/[^a-z0-9._-]/g, '') || 'utente';
  const [created] = await db
    .insert(users)
    .values({ email: normalised, handle, displayName: handle })
    .returning();
  if (!created) throw new Error(`Creazione utente fallita: ${normalised}`);
  return {
    id: created.id,
    email: created.email,
    handle: created.handle,
    displayName: created.displayName,
  };
}

async function findOrCreateRelationship(coach: SessionUser, athlete: SessionUser) {
  const [existing] = await db
    .select()
    .from(coachingRelationships)
    .where(
      and(
        eq(coachingRelationships.coachUserId, coach.id),
        eq(coachingRelationships.athleteUserId, athlete.id),
        isNull(coachingRelationships.endedAt),
      ),
    )
    .limit(1);
  if (existing) return existing;

  const [created] = await db
    .insert(coachingRelationships)
    .values({ coachUserId: coach.id, athleteUserId: athlete.id })
    .returning();
  if (!created) throw new Error('Creazione relazione fallita');
  return created;
}

const isDayMarker = (value: string) => /^day\b/i.test(value.trim());

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const rows = parseCsv(readFileSync(args.file, 'utf8')).filter((row) => row.some((cell) => cell.trim()));
  const header = rows[0];
  if (!header) throw new Error('CSV vuoto.');

  // Header: WORK | WEEK 1 | FEEDBACK | WEEK 2 | FEEDBACK | ...
  const weekColumns = header
    .map((cell, index) => ({ label: cell.trim(), index }))
    .filter((column) => /^week/i.test(column.label))
    .map((column, position) => ({
      label: column.label.toUpperCase().replace(/\s+/g, ' '),
      prescriptionIndex: column.index,
      feedbackIndex: column.index + 1,
      position: position + 1,
    }));

  if (weekColumns.length === 0) throw new Error('Nessuna colonna WEEK trovata nella prima riga.');

  const coach = await findOrCreateUser(args.coach);
  const athlete = await findOrCreateUser(args.athlete);
  const relationship = await findOrCreateRelationship(coach, athlete);

  const mesocycle = await createMesocycle(coach, {
    relationshipId: relationship.id,
    title: args.title ?? 'Mesociclo importato',
  });

  // Reuse the coach's library so repeated imports do not duplicate exercises.
  const library = new Map((await listExercises(coach.id)).map((e) => [e.name.toLowerCase(), e.id]));

  let currentDay: { id: string } | null = null;
  const slots: Array<{ id: string; row: string[] }> = [];

  for (const row of rows.slice(1)) {
    const label = (row[0] ?? '').trim();
    if (!label) continue;

    if (isDayMarker(label)) {
      currentDay = await addDay(coach, mesocycle.id, label.toUpperCase());
      continue;
    }
    if (!currentDay) continue;

    let exerciseId = library.get(label.toLowerCase());
    if (!exerciseId) {
      const created = await createExercise(coach, { name: label });
      exerciseId = created.id;
      library.set(label.toLowerCase(), created.id);
    }

    const slot = await addSlot(coach, currentDay.id, { exerciseId });
    slots.push({ id: slot.id, row });
  }

  let cells = 0;
  let parsed = 0;
  const weekIds: string[] = [];

  for (const column of weekColumns) {
    const { week } = await addWeek(coach, mesocycle.id, {
      // Each sheet column is imported literally; copy-forward is for new
      // weeks written in the app, not for reproducing history.
      copyFromPrevious: false,
      label: column.label,
    });
    weekIds.push(week.id);

    for (const slot of slots) {
      const rawText = (slot.row[column.prescriptionIndex] ?? '').trim();
      if (!rawText) continue;
      const saved = await upsertPrescription(coach, { weekId: week.id, slotId: slot.id, rawText });
      cells += 1;
      if (saved?.parsed) parsed += 1;
    }

    await publishWeek(coach, week.id);
  }

  // Feedback hangs off sessions, which only exist once a week is published.
  const grid = await mesocycleGrid(coach, mesocycle.id);
  let feedbackCount = 0;

  for (const [index, column] of weekColumns.entries()) {
    const weekId = weekIds[index]!;
    let weekHadFeedback = false;

    for (const day of grid.days) {
      const session = grid.sessions.get(`${weekId}:${day.id}`);
      if (!session) continue;

      for (const slotRef of day.slots) {
        const source = slots.find((s) => s.id === slotRef.id);
        const rawText = (source?.row[column.feedbackIndex] ?? '').trim();
        if (!rawText) continue;

        await upsertFeedback(athlete, { sessionId: session.id, slotId: slotRef.id, rawText });
        feedbackCount += 1;
        weekHadFeedback = true;
      }

      // A week the athlete answered is a week they trained: closing it puts
      // the last one in the coach's "schede da aggiornare" queue, exactly
      // where the sheet's workflow would have left it.
      if (weekHadFeedback) await completeSession(athlete, session.id);
    }
  }

  console.info(
    [
      `Importato "${mesocycle.title}"`,
      `  giornate:      ${grid.days.length}`,
      `  esercizi:      ${slots.length}`,
      `  settimane:     ${weekColumns.length}`,
      `  prescrizioni:  ${cells} (${parsed} interpretate, ${cells - parsed} testo libero)`,
      `  feedback:      ${feedbackCount}`,
      '',
      `Apri /schede/${mesocycle.id}`,
    ].join('\n'),
  );

  await client.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
