import { contract } from '@/api/contract';
import { athleteDayView, setSessionNote } from '@/core/programs';
import { dayViewToDto } from '@/api/mappers';
import { authed } from '@/server/api';

export const GET = authed<typeof contract.getSession, { sessionId: string }>(
  contract.getSession,
  async ({ user, params }) => dayViewToDto(await athleteDayView(user, params.sessionId)),
);

export const PATCH = authed<typeof contract.setSessionNote, { sessionId: string }>(
  contract.setSessionNote,
  async ({ user, params, body }) => {
    await setSessionNote(user, params.sessionId, body.note);
    return { ok: true as const };
  },
);
