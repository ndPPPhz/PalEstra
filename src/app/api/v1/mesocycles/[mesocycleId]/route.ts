import { contract } from '@/api/contract';
import { mesocycleGrid } from '@/core/programs';
import { gridToDto } from '@/api/mappers';
import { authed } from '@/server/api';

export const GET = authed<typeof contract.getMesocycle, { mesocycleId: string }>(
  contract.getMesocycle,
  async ({ user, params }) => gridToDto(await mesocycleGrid(user, params.mesocycleId)),
);
