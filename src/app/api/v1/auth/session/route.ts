import { cookies } from 'next/headers';
import { contract } from '@/api/contract';
import { revokeSession, verifyOtp } from '@/core/auth';
import { authed, open } from '@/server/api';
import { SESSION_COOKIE, sessionCookieOptions, tokenFromRequest } from '@/server/session';

export const POST = open(contract.createSession, async ({ body, request }) => {
  const result = await verifyOtp(body.email, body.code, request.headers.get('user-agent') ?? undefined);

  // Two transports, one token: the browser gets it as an httpOnly cookie it
  // cannot read, a native client reads it from the body and stores it in
  // the Keychain. Same row in auth_sessions either way.
  (await cookies()).set(SESSION_COOKIE, result.token, sessionCookieOptions);

  return { token: result.token, user: result.user, isNewUser: result.isNewUser };
});

export const DELETE = authed(contract.deleteSession, async ({ request }) => {
  const token = await tokenFromRequest(request);
  if (token) await revokeSession(token);
  (await cookies()).delete(SESSION_COOKIE);
  return { ok: true as const };
});
