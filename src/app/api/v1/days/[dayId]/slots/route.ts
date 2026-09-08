import { contract } from '@/api/contract';
import { addSlot } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.addSlot, { dayId: string }>(
  contract.addSlot,
  async ({ user, params, body }) => {
    const slot = await addSlot(user, params.dayId, body);
    return { id: slot.id, position: slot.position };
  },
);
