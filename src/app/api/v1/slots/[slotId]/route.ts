import { contract } from '@/api/contract';
import { removeSlot } from '@/core/programs';
import { authed } from '@/server/api';

export const DELETE = authed<typeof contract.removeSlot, { slotId: string }>(
  contract.removeSlot,
  async ({ user, params }) => {
    await removeSlot(user, params.slotId);
    return { ok: true as const };
  },
);
