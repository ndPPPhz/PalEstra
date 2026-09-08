import { formatted, toIso } from './dto';
import type { mesocycleGrid, athleteDayView, athleteWeekView } from '@/core/programs';

type Grid = Awaited<ReturnType<typeof mesocycleGrid>>;
type DayView = Awaited<ReturnType<typeof athleteDayView>>;
type WeekView = Awaited<ReturnType<typeof athleteWeekView>>;

/**
 * Read models use Maps for O(1) cell lookup in the grid component; JSON has
 * no Map, so the REST layer flattens them into arrays here rather than
 * bending the domain to the wire format.
 */
export function gridToDto(grid: Grid) {
  return {
    role: grid.role,
    mesocycle: {
      id: grid.mesocycle.id,
      title: grid.mesocycle.title,
      createdAt: toIso(grid.mesocycle.createdAt)!,
      completedAt: toIso(grid.mesocycle.completedAt),
      athleteId: grid.mesocycle.athleteId,
      athleteName: grid.mesocycle.athleteName,
      athleteHandle: grid.mesocycle.athleteHandle,
    },
    days: grid.days.map((day) => ({
      id: day.id,
      position: day.position,
      label: day.label,
      slots: day.slots.map((slot) => ({
        id: slot.id,
        position: slot.position,
        name: slot.name,
        exerciseId: slot.exerciseId,
        description: slot.description,
      })),
    })),
    weeks: grid.weeks.map((week) => ({
      id: week.id,
      position: week.position,
      label: week.label,
      publishedAt: toIso(week.publishedAt),
      completedAt: toIso(week.completedAt),
    })),
    cells: [...grid.prescriptions.entries()].map(([key, cell]) => {
      const [weekId, slotId] = key.split(':');
      return {
        weekId: weekId!,
        slotId: slotId!,
        rawText: cell.rawText,
        formatted: formatted(cell.parsed),
        coachNote: cell.coachNote,
      };
    }),
    feedbacks: [...grid.feedbacks.entries()].map(([key, rawText]) => {
      const [weekId, slotId] = key.split(':');
      return { weekId: weekId!, slotId: slotId!, rawText };
    }),
    sessions: [...grid.sessions.values()].map((session) => ({
      id: session.id,
      weekId: session.weekId,
      dayId: session.dayId,
      note: session.note,
      performedOn: session.performedOn,
      completedAt: toIso(session.completedAt),
    })),
  };
}

export function dayViewToDto(view: DayView) {
  return {
    role: view.role,
    mesocycleId: view.mesocycleId,
    session: {
      id: view.session.id,
      note: view.session.note,
      completedAt: toIso(view.session.completedAt),
      performedOn: view.session.performedOn,
      weekId: view.session.weekId,
      weekLabel: view.session.weekLabel,
      dayLabel: view.session.dayLabel,
      mesocycleTitle: view.session.mesocycleTitle,
    },
    rows: view.rows.map((row) => ({
      slotId: row.slotId,
      position: row.position,
      name: row.name,
      exerciseId: row.exerciseId,
      description: row.description,
      prescription: row.rawText,
      formatted: formatted(row.parsed),
      coachNote: row.coachNote,
      feedback: row.feedback,
      previousPrescription: row.previous.prescription,
      previousFeedback: row.previous.feedback,
    })),
  };
}

export function weekViewToDto(view: WeekView) {
  return {
    role: view.role,
    mesocycleId: view.mesocycleId,
    week: {
      id: view.week.id,
      position: view.week.position,
      label: view.week.label,
      publishedAt: toIso(view.week.publishedAt),
      completedAt: toIso(view.week.completedAt),
    },
    days: view.days.map((day) => ({
      dayId: day.dayId,
      label: day.label,
      position: day.position,
      sessionId: day.sessionId,
      note: day.note,
      completedAt: toIso(day.completedAt),
      performedOn: day.performedOn,
      exerciseCount: day.exerciseCount,
    })),
  };
}
