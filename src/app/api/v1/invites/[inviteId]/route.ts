import { contract } from '@/api/contract';
import { revokeInvite } from '@/core/relationships';
import { authed } from '@/server/api';

export const DELETE = authed<typeof contract.revokeInvite, { inviteId: string }>(
  contract.revokeInvite,
  async ({ user, params }) => {
    await revokeInvite(user, params.inviteId);
    return { ok: true as const };
  },
);
