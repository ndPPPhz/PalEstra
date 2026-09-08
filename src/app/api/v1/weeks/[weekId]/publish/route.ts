import { contract } from '@/api/contract';
import { publishWeek } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.publishWeek, { weekId: string }>(
  contract.publishWeek,
  async ({ user, params }) => {
    await publishWeek(user, params.weekId);
    return { ok: true as const };
  },
);
