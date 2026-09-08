import { contract } from '@/api/contract';
import { updateProfile } from '@/core/users';
import { authed } from '@/server/api';

export const GET = authed(contract.me, async ({ user }) => user);

export const PATCH = authed(contract.updateMe, async ({ user, body }) => updateProfile(user, body));
