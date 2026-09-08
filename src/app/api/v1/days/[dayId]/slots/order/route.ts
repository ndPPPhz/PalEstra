import { contract } from '@/api/contract';
import { reorderSlots } from '@/core/programs';
import { authed } from '@/server/api';

export const PUT = authed<typeof contract.reorderSlots, { dayId: string }>(
  contract.reorderSlots,
  async ({ user, params, body }) => {
    await reorderSlots(user, params.dayId, body.slotIds);
    return { ok: true as const };
  },
);
