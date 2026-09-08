import { contract } from '@/api/contract';
import { completeWeek } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.completeWeek, { weekId: string }>(
  contract.completeWeek,
  async ({ user, params }) => {
    await completeWeek(user, params.weekId);
    return { ok: true as const };
  },
);
