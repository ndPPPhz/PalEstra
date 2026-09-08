import { contract } from '@/api/contract';
import { athleteMesocycles, coachMesocycles, createMesocycle } from '@/core/programs';
import { toIso } from '@/api/dto';
import { authed } from '@/server/api';

export const GET = authed(contract.listMesocycles, async ({ user }) => {
  const [asCoach, asAthlete] = await Promise.all([coachMesocycles(user.id), athleteMesocycles(user.id)]);
  return {
    asCoach: asCoach.map((m) => ({
      id: m.id,
      title: m.title,
      createdAt: toIso(m.createdAt)!,
      completedAt: toIso(m.completedAt),
      counterpartName: m.athleteName,
      counterpartHandle: m.athleteHandle,
    })),
    asAthlete: asAthlete.map((m) => ({
      id: m.id,
      title: m.title,
      createdAt: toIso(m.createdAt)!,
      completedAt: toIso(m.completedAt),
      counterpartName: m.coachName,
      counterpartHandle: m.coachHandle,
    })),
  };
});

export const POST = authed(contract.createMesocycle, async ({ user, body }) => {
  const meso = await createMesocycle(user, body);
  return { id: meso.id };
});
