import { contract } from '@/api/contract';
import { requestOtp } from '@/core/auth';
import { open } from '@/server/api';

export const POST = open(contract.requestOtp, async ({ body }) => {
  const { devCode } = await requestOtp(body.email);
  return { ok: true as const, ...(devCode ? { devCode } : {}) };
});
