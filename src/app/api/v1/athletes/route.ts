import { contract } from '@/api/contract';
import { listAthletes } from '@/core/relationships';
import { toIso } from '@/api/dto';
import { authed } from '@/server/api';

export const GET = authed(contract.listAthletes, async ({ user }) => {
  const rows = await listAthletes(user.id);
  return rows.map((row) => ({ ...row, since: toIso(row.since)! }));
});
