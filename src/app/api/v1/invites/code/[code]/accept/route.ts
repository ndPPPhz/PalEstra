import { contract } from '@/api/contract';
import { acceptInvite } from '@/core/relationships';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.acceptInvite, { code: string }>(
  contract.acceptInvite,
  async ({ user, params }) => {
    const relationship = await acceptInvite(user, params.code);
    return { relationshipId: relationship.id };
  },
);
