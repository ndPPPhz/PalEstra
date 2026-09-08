import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { uuidv7 } from 'uuidv7';
import type { ParsedPrescription } from '../core/prescriptions/parser';

/**
 * UUID v7 instead of v4: the timestamp prefix makes the values ordered, so
 * inserts land at the right edge of the B-tree instead of scattering across
 * it. Same opacity as v4 from the outside, much better index locality.
 */
const id = () =>
  uuid()
    .primaryKey()
    .$defaultFn(() => uuidv7());

const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow();

// ─────────────────────────────────────────────────────────── identity ──

export const users = pgTable(
  'users',
  {
    id: id(),
    email: text().notNull(),
    // Public identifier: "@ndppp". Used for the coach's public page later.
    handle: text().notNull(),
    displayName: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    // Emails and handles are compared case-insensitively; storing them
    // lowercased plus a plain unique index keeps that cheap and obvious.
    uniqueIndex('users_email_key').on(t.email),
    uniqueIndex('users_handle_key').on(t.handle),
  ],
);

export const coachProfiles = pgTable('coach_profiles', {
  userId: uuid()
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  // "Callistenics by Perruccio"
  publicName: text(),
  bio: text(),
  createdAt: createdAt(),
});

/**
 * One-time login codes. Only a hash is stored: the codes are short, so a
 * leaked table must not hand out logins. `attempts` caps brute force on a
 * 6-digit code.
 */
export const otpCodes = pgTable(
  'otp_codes',
  {
    id: id(),
    email: text().notNull(),
    codeHash: text().notNull(),
    attempts: integer().notNull().default(0),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    consumedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('otp_codes_email_idx').on(t.email, t.createdAt)],
);

/**
 * One row per logged-in device. The browser holds the token in an httpOnly
 * cookie and a native app in the Keychain, but it is the same token and the
 * same row: revocation and expiry are implemented once for both.
 *
 * Only the hash is stored, for the same reason passwords are hashed.
 */
export const authSessions = pgTable(
  'auth_sessions',
  {
    id: id(),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull(),
    userAgent: text(),
    lastUsedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('auth_sessions_token_key').on(t.tokenHash),
    index('auth_sessions_user_idx').on(t.userId),
  ],
);

// ────────────────────────────────────────────────────── relationships ──

/**
 * Single-use, named invite. The coach generates one per athlete so the
 * pending list can say *who* was invited; a shared reusable link could not.
 * There is deliberately no `max_uses`.
 *
 * State is derived, never stored: accepted / revoked / expired / pending.
 */
export const invites = pgTable(
  'invites',
  {
    id: id(),
    code: text().notNull(),
    coachUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    // Free note from the coach, e.g. "Andrea".
    label: text().notNull(),
    acceptedByUserId: uuid().references(() => users.id, { onDelete: 'set null' }),
    acceptedAt: timestamp({ withTimezone: true }),
    revokedAt: timestamp({ withTimezone: true }),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('invites_code_key').on(t.code),
    index('invites_coach_idx').on(t.coachUserId, t.createdAt),
  ],
);

export const coachingRelationships = pgTable(
  'coaching_relationships',
  {
    id: id(),
    coachUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    athleteUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    // A pair may be coached many times over the years, but only once at a
    // time. A partial unique index says exactly that.
    uniqueIndex('coaching_rel_active_key')
      .on(t.coachUserId, t.athleteUserId)
      .where(sql`${t.endedAt} is null`),
    index('coaching_rel_coach_idx').on(t.coachUserId),
    index('coaching_rel_athlete_idx').on(t.athleteUserId),
  ],
);

// ───────────────────────────────────────────────────── exercise library ──

/**
 * `ownerUserId = null` means a global seed exercise, so not every coach has
 * to retype "Panca piana".
 */
export const exercises = pgTable(
  'exercises',
  {
    id: id(),
    ownerUserId: uuid().references(() => users.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    description: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [index('exercises_owner_idx').on(t.ownerUserId, t.name)],
);

// ──────────────────────────────────────────────────────────── programs ──

export const mesocycles = pgTable(
  'mesocycles',
  {
    id: id(),
    relationshipId: uuid()
      .notNull()
      .references(() => coachingRelationships.id, { onDelete: 'cascade' }),
    // Denormalised from the relationship: every authorisation check and
    // every list query filters on these, and carrying them here keeps those
    // to a single indexed table instead of a join.
    coachUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    athleteUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    title: text().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    // Training history is the value of the product: rows are never deleted.
    deletedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('mesocycles_coach_idx').on(t.coachUserId, t.createdAt),
    index('mesocycles_athlete_idx').on(t.athleteUserId, t.createdAt),
  ],
);

/** A yellow `DAY 1` row in the sheet. */
export const mesoDays = pgTable(
  'meso_days',
  {
    id: id(),
    mesocycleId: uuid()
      .notNull()
      .references(() => mesocycles.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    label: text().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('meso_days_position_key').on(t.mesocycleId, t.position)],
);

/** An exercise row under a day. */
export const mesoSlots = pgTable(
  'meso_slots',
  {
    id: id(),
    dayId: uuid()
      .notNull()
      .references(() => mesoDays.id, { onDelete: 'cascade' }),
    exerciseId: uuid().references(() => exercises.id, { onDelete: 'set null' }),
    // The sheet names an exercise per-programme ("FRONT ONE LEG
    // LEGGERISSIMA"); when set this wins over the library name.
    labelOverride: text(),
    position: integer().notNull(),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('meso_slots_position_key').on(t.dayId, t.position)],
);

/** A `WEEK N` column pair, added incrementally by the coach. */
export const mesoWeeks = pgTable(
  'meso_weeks',
  {
    id: id(),
    mesocycleId: uuid()
      .notNull()
      .references(() => mesocycles.id, { onDelete: 'cascade' }),
    position: integer().notNull(),
    label: text().notNull(),
    // Until published the athlete cannot see it, so the coach can draft
    // next week while this one is still running.
    publishedAt: timestamp({ withTimezone: true }),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex('meso_weeks_position_key').on(t.mesocycleId, t.position)],
);

/**
 * The athlete actually performing one day of one week: the piece the
 * spreadsheet has no room for. Materialised when the week is published.
 */
export const trainingSessions = pgTable(
  'training_sessions',
  {
    id: id(),
    weekId: uuid()
      .notNull()
      .references(() => mesoWeeks.id, { onDelete: 'cascade' }),
    dayId: uuid()
      .notNull()
      .references(() => mesoDays.id, { onDelete: 'cascade' }),
    // The whole-day note: "sta giornata sono un po' stanco".
    note: text(),
    performedOn: date(),
    completedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex('training_sessions_week_day_key').on(t.weekId, t.dayId),
    index('training_sessions_week_idx').on(t.weekId),
  ],
);

/**
 * A green/blue/pink cell: what the coach prescribes for one exercise in one
 * week.
 *
 * `rawText` is always exactly what the coach typed and is the source of
 * truth on screen. The parsed fields are best effort and never block a
 * save. `parsed` keeps full fidelity (a compound like
 * `3x2@50kg+1x6@35kg` is several blocks), while the three flat columns are
 * filled only for the common single-block case, so future progression
 * queries and charts stay plain SQL instead of JSON digging.
 */
export const prescriptions = pgTable(
  'prescriptions',
  {
    id: id(),
    weekId: uuid()
      .notNull()
      .references(() => mesoWeeks.id, { onDelete: 'cascade' }),
    slotId: uuid()
      .notNull()
      .references(() => mesoSlots.id, { onDelete: 'cascade' }),
    rawText: text().notNull(),
    parsed: jsonb().$type<ParsedPrescription>(),
    sets: integer(),
    reps: integer(),
    loadKg: numeric({ precision: 6, scale: 2 }),
    coachNote: text(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('prescriptions_week_slot_key').on(t.weekId, t.slotId)],
);

/** The FEEDBACK cell: what the athlete reports back for that exercise. */
export const feedbacks = pgTable(
  'feedbacks',
  {
    id: id(),
    sessionId: uuid()
      .notNull()
      .references(() => trainingSessions.id, { onDelete: 'cascade' }),
    slotId: uuid()
      .notNull()
      .references(() => mesoSlots.id, { onDelete: 'cascade' }),
    authorUserId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    rawText: text().notNull(),
    createdAt: createdAt(),
    updatedAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [uniqueIndex('feedbacks_session_slot_key').on(t.sessionId, t.slotId)],
);
