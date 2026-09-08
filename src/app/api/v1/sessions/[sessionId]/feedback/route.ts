import { contract } from '@/api/contract';
import { upsertFeedback } from '@/core/programs';
import { authed } from '@/server/api';

export const PUT = authed<typeof contract.setFeedback, { sessionId: string }>(
  contract.setFeedback,
  async ({ user, params, body }) => {
    await upsertFeedback(user, { sessionId: params.sessionId, ...body });
    return { ok: true as const };
  },
);
