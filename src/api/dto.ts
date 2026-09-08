import { z } from 'zod';
import { formatPrescription, type ParsedPrescription } from '@/core/prescriptions/parser';

/**
 * Wire shapes. Timestamps cross the wire as ISO strings, never as Date
 * objects, so that the generated Swift client decodes them predictably.
 */
const iso = z.string();
const isoOrNull = z.string().nullable();

export const toIso = (value: Date | null | undefined) => value?.toISOString() ?? null;

export const UserDto = z.object({
  id: z.string().uuid(),
  email: z.string(),
  handle: z.string(),
  displayName: z.string(),
});

export const InviteDto = z.object({
  id: z.string().uuid(),
  code: z.string(),
  label: z.string(),
  url: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  createdAt: iso,
  expiresAt: iso,
  acceptedAt: isoOrNull,
  acceptedByName: z.string().nullable(),
});

export const InvitePreviewDto = z.object({
  code: z.string(),
  label: z.string(),
  status: z.enum(['pending', 'accepted', 'revoked', 'expired']),
  coachName: z.string(),
  coachHandle: z.string(),
  coachPublicName: z.string().nullable(),
});

export const ExerciseDto = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isOwn: z.boolean(),
  createdAt: iso,
});

export const AthleteDto = z.object({
  relationshipId: z.string().uuid(),
  athleteId: z.string().uuid(),
  displayName: z.string(),
  handle: z.string(),
  since: iso,
  activeMesocycles: z.number().int(),
});

export const CoachDto = z.object({
  relationshipId: z.string().uuid(),
  coachId: z.string().uuid(),
  displayName: z.string(),
  handle: z.string(),
  publicName: z.string().nullable(),
});

export const MesocycleSummaryDto = z.object({
  id: z.string().uuid(),
  title: z.string(),
  createdAt: iso,
  completedAt: isoOrNull,
  counterpartName: z.string(),
  counterpartHandle: z.string(),
});

export const PendingUpdateDto = z.object({
  weekId: z.string().uuid(),
  weekLabel: z.string(),
  completedAt: isoOrNull,
  mesocycleId: z.string().uuid(),
  mesocycleTitle: z.string(),
  athleteName: z.string(),
  athleteHandle: z.string(),
});

export const SlotDto = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  name: z.string(),
  exerciseId: z.string().uuid().nullable(),
  description: z.string().nullable(),
});

export const DayDto = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  label: z.string(),
  slots: z.array(SlotDto),
});

export const WeekDto = z.object({
  id: z.string().uuid(),
  position: z.number().int(),
  label: z.string(),
  publishedAt: isoOrNull,
  completedAt: isoOrNull,
});

export const CellDto = z.object({
  weekId: z.string().uuid(),
  slotId: z.string().uuid(),
  rawText: z.string(),
  /** Human rendering of the parsed form, empty when the cell is free text. */
  formatted: z.string().nullable(),
  coachNote: z.string().nullable(),
});

export const FeedbackCellDto = z.object({
  weekId: z.string().uuid(),
  slotId: z.string().uuid(),
  rawText: z.string(),
});

export const SessionDto = z.object({
  id: z.string().uuid(),
  weekId: z.string().uuid(),
  dayId: z.string().uuid(),
  note: z.string().nullable(),
  performedOn: z.string().nullable(),
  completedAt: isoOrNull,
});

/** The whole grid: the sheet, as JSON. */
export const GridDto = z.object({
  role: z.enum(['coach', 'athlete']),
  mesocycle: z.object({
    id: z.string().uuid(),
    title: z.string(),
    createdAt: iso,
    completedAt: isoOrNull,
    athleteId: z.string().uuid(),
    athleteName: z.string(),
    athleteHandle: z.string(),
  }),
  days: z.array(DayDto),
  weeks: z.array(WeekDto),
  cells: z.array(CellDto),
  feedbacks: z.array(FeedbackCellDto),
  sessions: z.array(SessionDto),
});

export const DayRowDto = z.object({
  slotId: z.string().uuid(),
  position: z.number().int(),
  name: z.string(),
  exerciseId: z.string().uuid().nullable(),
  description: z.string().nullable(),
  prescription: z.string().nullable(),
  formatted: z.string().nullable(),
  coachNote: z.string().nullable(),
  feedback: z.string().nullable(),
  previousPrescription: z.string().nullable(),
  previousFeedback: z.string().nullable(),
});

export const DayViewDto = z.object({
  role: z.enum(['coach', 'athlete']),
  mesocycleId: z.string().uuid(),
  session: z.object({
    id: z.string().uuid(),
    note: z.string().nullable(),
    completedAt: isoOrNull,
    performedOn: z.string().nullable(),
    weekId: z.string().uuid(),
    weekLabel: z.string(),
    dayLabel: z.string(),
    mesocycleTitle: z.string(),
  }),
  rows: z.array(DayRowDto),
});

export const WeekViewDto = z.object({
  role: z.enum(['coach', 'athlete']),
  mesocycleId: z.string().uuid(),
  week: WeekDto,
  days: z.array(
    z.object({
      dayId: z.string().uuid(),
      label: z.string(),
      position: z.number().int(),
      sessionId: z.string().uuid().nullable(),
      note: z.string().nullable(),
      completedAt: isoOrNull,
      performedOn: z.string().nullable(),
      exerciseCount: z.number().int(),
    }),
  ),
});

export const OkDto = z.object({ ok: z.literal(true) });

export const ErrorDto = z.object({
  error: z.object({ code: z.string(), message: z.string() }),
});

/** Renders the confirmation chip once, server-side, for every client. */
export const formatted = (parsed: unknown): string | null =>
  parsed ? formatPrescription(parsed as ParsedPrescription) : null;
