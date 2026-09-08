import { contract } from '@/api/contract';
import { archiveExercise, updateExercise } from '@/core/exercises';
import { toIso } from '@/api/dto';
import { authed } from '@/server/api';

export const PATCH = authed<typeof contract.updateExercise, { exerciseId: string }>(
  contract.updateExercise,
  async ({ user, params, body }) => {
    const row = await updateExercise(user, params.exerciseId, body);
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      isOwn: true,
      createdAt: toIso(row.createdAt)!,
    };
  },
);

export const DELETE = authed<typeof contract.archiveExercise, { exerciseId: string }>(
  contract.archiveExercise,
  async ({ user, params }) => {
    await archiveExercise(user, params.exerciseId);
    return { ok: true as const };
  },
);
