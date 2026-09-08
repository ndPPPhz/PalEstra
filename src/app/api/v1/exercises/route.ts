import { contract } from '@/api/contract';
import { createExercise, listExercises } from '@/core/exercises';
import { toIso } from '@/api/dto';
import { authed } from '@/server/api';

export const GET = authed(contract.listExercises, async ({ user }) => {
  const rows = await listExercises(user.id);
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description,
    isOwn: row.ownerUserId === user.id,
    createdAt: toIso(row.createdAt)!,
  }));
});

export const POST = authed(contract.createExercise, async ({ user, body }) => {
  const row = await createExercise(user, body);
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isOwn: true,
    createdAt: toIso(row.createdAt)!,
  };
});
