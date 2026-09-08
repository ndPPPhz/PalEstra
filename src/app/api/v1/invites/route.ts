import { contract } from '@/api/contract';
import { createInvite, inviteStatus, listInvites } from '@/core/relationships';
import { toIso } from '@/api/dto';
import { authed } from '@/server/api';

export const GET = authed(contract.listInvites, async ({ user }) => {
  const rows = await listInvites(user.id);
  return rows.map((row) => ({
    id: row.id,
    code: row.code,
    label: row.label,
    url: row.url,
    status: row.status,
    createdAt: toIso(row.createdAt)!,
    expiresAt: toIso(row.expiresAt)!,
    acceptedAt: toIso(row.acceptedAt),
    acceptedByName: row.acceptedByName,
  }));
});

export const POST = authed(contract.createInvite, async ({ user, body }) => {
  const { invite, url } = await createInvite(user, body.label);
  return {
    id: invite.id,
    code: invite.code,
    label: invite.label,
    url,
    status: inviteStatus(invite),
    createdAt: toIso(invite.createdAt)!,
    expiresAt: toIso(invite.expiresAt)!,
    acceptedAt: null,
    acceptedByName: null,
  };
});
