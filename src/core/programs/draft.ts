import { badRequest } from '@/core/errors';

/**
 * Turns the text a coach types (or pastes from wherever their programme
 * lives today) into days and exercise rows.
 *
 * The shape mirrors the sheet it replaces, so it needs no explaining:
 * a blank line starts a new day, and if the first line of a block looks
 * like a day marker it becomes the label, otherwise the day is numbered
 * automatically and that line is just the first exercise.
 *
 *     DAY 1              -> label "DAY 1"
 *     Trazioni              exercises: Trazioni, HSPU
 *     HSPU
 *                        (blank line = next day)
 *     Squat              -> label null (caller names it "DAY 2")
 *     Stacco                exercises: Squat, Stacco
 */

export interface DraftDay {
  /** Null when the coach did not name it: the caller assigns `DAY n`. */
  label: string | null;
  exercises: string[];
}

export const MAX_DAYS = 20;
export const MAX_EXERCISES_PER_DAY = 60;
export const MAX_NAME_LENGTH = 160;

const DAY_MARKER = /^(day|giorno|gg)\b/i;

export function parseStructureDraft(text: string): DraftDay[] {
  const blocks = text
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        // Tolerate list markers, so pasting a bulleted list just works.
        .map((line) => line.trim().replace(/^[-*•\d]+[.)]?\s+/, '').trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length > 0);

  const days: DraftDay[] = [];

  for (const lines of blocks) {
    const first = lines[0]!;
    const hasLabel = DAY_MARKER.test(first);
    const exercises = (hasLabel ? lines.slice(1) : lines).map((name) => name.slice(0, MAX_NAME_LENGTH));

    // A lone "DAY 3" with nothing under it is a typo, not an empty day.
    if (exercises.length === 0) continue;

    days.push({ label: hasLabel ? first.slice(0, 60) : null, exercises });
  }

  return days;
}

/** Shared by the client preview and the server, so both agree on the limits. */
export function validateStructureDraft(days: DraftDay[]): DraftDay[] {
  if (days.length === 0) {
    throw badRequest('Scrivi almeno una giornata con i suoi esercizi.');
  }
  if (days.length > MAX_DAYS) {
    throw badRequest(`Massimo ${MAX_DAYS} giornate per scheda.`);
  }
  for (const day of days) {
    if (day.exercises.length > MAX_EXERCISES_PER_DAY) {
      throw badRequest(`Massimo ${MAX_EXERCISES_PER_DAY} esercizi per giornata.`);
    }
  }
  return days;
}
