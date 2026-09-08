import { contract } from '@/api/contract';
import { addWeek } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.addWeek, { mesocycleId: string }>(
  contract.addWeek,
  async ({ user, params, body }) => {
    const { week, copiedFrom } = await addWeek(user, params.mesocycleId, body);
    return {
      id: week.id,
      label: week.label,
      position: week.position,
      copiedFromWeekId: copiedFrom?.id ?? null,
    };
  },
);
