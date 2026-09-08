import { contract } from '@/api/contract';
import { listCoaches } from '@/core/relationships';
import { authed } from '@/server/api';

export const GET = authed(contract.listCoaches, async ({ user }) => listCoaches(user.id));
