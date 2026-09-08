import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { resolveSession, type SessionUser } from '@/core/auth';
import { unauthorized } from '@/core/errors';

export const SESSION_COOKIE = 'palestra_session';
const NINETY_DAYS_SECONDS = 90 * 24 * 60 * 60;

/**
 * The web transport. The token never reaches JavaScript: httpOnly means an
 * XSS can act while the tab is open but cannot steal the token and replay
 * it later from somewhere else. SameSite=Lax closes the CSRF hole the
 * automatic cookie attachment would otherwise open.
 */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: NINETY_DAYS_SECONDS,
} as const;

/**
 * One code path for both clients: a native app sends the token as a bearer
 * header, the browser has it attached automatically as a cookie. Same
 * token, same row in auth_sessions, same revocation.
 */
export async function tokenFromRequest(request?: Request): Promise<string | undefined> {
  const header = request?.headers.get('authorization');
  if (header?.toLowerCase().startsWith('bearer ')) return header.slice(7).trim();
  return (await cookies()).get(SESSION_COOKIE)?.value;
}

export async function currentUser(request?: Request): Promise<SessionUser | null> {
  return resolveSession(await tokenFromRequest(request));
}

/** For API routes: throws an AppError the adapter turns into a 401. */
export async function requireUser(request?: Request): Promise<SessionUser> {
  const user = await currentUser(request);
  if (!user) throw unauthorized();
  return user;
}

/** For pages: sends the visitor to the login screen instead of erroring. */
export async function requireUserPage(returnTo?: string): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect(`/login${returnTo ? `?next=${encodeURIComponent(returnTo)}` : ''}`);
  return user;
}
