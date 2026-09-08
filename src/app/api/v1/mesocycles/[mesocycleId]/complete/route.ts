import { contract } from '@/api/contract';
import { completeMesocycle } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.completeMesocycle, { mesocycleId: string }>(
  contract.completeMesocycle,
  async ({ user, params }) => {
    await completeMesocycle(user, params.mesocycleId);
    return { ok: true as const };
  },
);
