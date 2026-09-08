import { contract } from '@/api/contract';
import { coachPendingUpdates } from '@/core/programs';
import { toIso } from '@/api/dto';
import { authed } from '@/server/api';

export const GET = authed(contract.pendingUpdates, async ({ user }) => {
  const rows = await coachPendingUpdates(user.id);
  return rows.map((row) => ({
    weekId: row.weekId,
    weekLabel: row.weekLabel,
    completedAt: toIso(row.completedAt),
    mesocycleId: row.mesocycleId,
    mesocycleTitle: row.mesocycleTitle,
    athleteName: row.athleteName,
    athleteHandle: row.athleteHandle,
  }));
});
