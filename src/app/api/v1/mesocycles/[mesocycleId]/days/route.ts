import { contract } from '@/api/contract';
import { addDay } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.addDay, { mesocycleId: string }>(
  contract.addDay,
  async ({ user, params, body }) => {
    const day = await addDay(user, params.mesocycleId, body.label);
    return { id: day.id, label: day.label, position: day.position };
  },
);
