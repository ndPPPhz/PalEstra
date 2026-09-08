import { contract } from '@/api/contract';
import { athleteWeekView, deleteWeek } from '@/core/programs';
import { weekViewToDto } from '@/api/mappers';
import { authed } from '@/server/api';

export const GET = authed<typeof contract.getWeek, { weekId: string }>(
  contract.getWeek,
  async ({ user, params }) => weekViewToDto(await athleteWeekView(user, params.weekId)),
);

export const DELETE = authed<typeof contract.deleteWeek, { weekId: string }>(
  contract.deleteWeek,
  async ({ user, params }) => {
    await deleteWeek(user, params.weekId);
    return { ok: true as const };
  },
);
