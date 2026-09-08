import { contract } from '@/api/contract';
import { buildStructure } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.buildStructure, { mesocycleId: string }>(
  contract.buildStructure,
  async ({ user, params, body }) => buildStructure(user, params.mesocycleId, body.days),
);
