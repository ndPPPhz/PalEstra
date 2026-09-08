import { contract } from '@/api/contract';
import { completeSession, reopenSession } from '@/core/programs';
import { authed } from '@/server/api';

export const POST = authed<typeof contract.completeSession, { sessionId: string }>(
  contract.completeSession,
  async ({ user, params }) => {
    const { weekComplete } = await completeSession(user, params.sessionId);
    return { weekComplete };
  },
);

export const DELETE = authed<typeof contract.reopenSession, { sessionId: string }>(
  contract.reopenSession,
  async ({ user, params }) => {
    await reopenSession(user, params.sessionId);
    return { ok: true as const };
  },
);
