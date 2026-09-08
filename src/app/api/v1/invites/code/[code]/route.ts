import { contract } from '@/api/contract';
import { previewInvite } from '@/core/relationships';
import { notFound } from '@/core/errors';
import { open } from '@/server/api';

// Public on purpose: the athlete must see who is inviting them before
// deciding to log in. It exposes only the coach's public identity.
export const GET = open<typeof contract.previewInvite, { code: string }>(
  contract.previewInvite,
  async ({ params }) => {
    const invite = await previewInvite(params.code);
    if (!invite) throw notFound('Invito non trovato.');
    return {
      code: invite.code,
      label: invite.label,
      status: invite.status,
      coachName: invite.coachName,
      coachHandle: invite.coachHandle,
      coachPublicName: invite.coachPublicName,
    };
  },
);
