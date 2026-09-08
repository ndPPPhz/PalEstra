import { randomBytes, randomInt, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { config } from '@/config/env';
import { db } from '@/db';
import { authSessions, otpCodes, users } from '@/db/schema';
import { badRequest, tooManyRequests } from '@/core/errors';
import { sendMail } from '@/core/mail';

const OTP_TTL_MINUTES = 10;
const OTP_MAX_ATTEMPTS = 5;
const OTP_RATE_WINDOW_MINUTES = 15;
const OTP_RATE_MAX = 5;
const SESSION_TTL_DAYS = 90;

export interface SessionUser {
  id: string;
  email: string;
  handle: string;
  displayName: string;
}

export const normaliseEmail = (email: string) => email.trim().toLowerCase();

const minutesFromNow = (m: number) => new Date(Date.now() + m * 60_000);
const daysFromNow = (d: number) => new Date(Date.now() + d * 86_400_000);

/**
 * A six-digit code has only a million possibilities, so a leaked table must
 * not be brute-forceable offline: scrypt with a per-row salt, not a bare
 * SHA. Session tokens below are 256 bits of randomness and get a plain
 * SHA-256 instead — there is nothing to guess, and login latency matters.
 */
function hashOtp(code: string, salt: string): string {
  return scryptSync(code, salt, 32).toString('hex');
}

function verifyOtpHash(code: string, stored: string): boolean {
  const [salt, expected] = stored.split(':');
  if (!salt || !expected) return false;
  const actual = hashOtp(code, salt);
  const a = Buffer.from(actual, 'hex');
  const b = Buffer.from(expected, 'hex');
  return a.length === b.length && timingSafeEqual(a, b);
}

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

/** `andrea.rossi@gmail.com` -> `andrea.rossi`, `andrea.rossi2`, ... */
async function uniqueHandle(email: string): Promise<string> {
  const base =
    (email.split('@')[0] ?? 'atleta')
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, '')
      .replace(/^[._-]+|[._-]+$/g, '')
      .slice(0, 24) || 'atleta';

  for (let suffix = 0; suffix < 100; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base}${suffix}`;
    const [taken] = await db.select({ id: users.id }).from(users).where(eq(users.handle, candidate)).limit(1);
    if (!taken) return candidate;
  }
  return `${base}${randomInt(1000, 9999)}`;
}

/**
 * Issues a login code. Returns the code itself outside production so that
 * `npm run dev` and the end-to-end tests do not need a mailbox.
 */
export async function requestOtp(rawEmail: string): Promise<{ devCode?: string }> {
  const email = normaliseEmail(rawEmail);

  const [recent] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), gt(otpCodes.createdAt, minutesFromNow(-OTP_RATE_WINDOW_MINUTES))));

  if ((recent?.count ?? 0) >= OTP_RATE_MAX) {
    throw tooManyRequests('Troppi codici richiesti. Riprova tra qualche minuto.');
  }

  // Any earlier code stops working the moment a new one is requested.
  await db
    .update(otpCodes)
    .set({ consumedAt: new Date() })
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.consumedAt)));

  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  const salt = randomBytes(16).toString('hex');

  await db.insert(otpCodes).values({
    email,
    codeHash: `${salt}:${hashOtp(code, salt)}`,
    expiresAt: minutesFromNow(OTP_TTL_MINUTES),
  });

  await sendMail(
    email,
    'Il tuo codice di accesso a PalEstra',
    `Il tuo codice è ${code}\n\nScade tra ${OTP_TTL_MINUTES} minuti. Se non hai richiesto l'accesso, ignora questa email.`,
  );

  return config.isProduction ? {} : { devCode: code };
}

/** Verifies a code and opens a session. Creates the user on first login. */
export async function verifyOtp(
  rawEmail: string,
  code: string,
  userAgent?: string,
): Promise<{ token: string; user: SessionUser; isNewUser: boolean }> {
  const email = normaliseEmail(rawEmail);
  const invalid = badRequest('Codice non valido o scaduto.');

  const [row] = await db
    .select()
    .from(otpCodes)
    .where(and(eq(otpCodes.email, email), isNull(otpCodes.consumedAt), gt(otpCodes.expiresAt, new Date())))
    .orderBy(desc(otpCodes.createdAt))
    .limit(1);

  if (!row) throw invalid;
  if (row.attempts >= OTP_MAX_ATTEMPTS) {
    throw tooManyRequests('Troppi tentativi. Richiedi un nuovo codice.');
  }

  if (!verifyOtpHash(code.trim(), row.codeHash)) {
    await db
      .update(otpCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(otpCodes.id, row.id));
    throw invalid;
  }

  await db.update(otpCodes).set({ consumedAt: new Date() }).where(eq(otpCodes.id, row.id));

  let [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const isNewUser = !user;
  if (!user) {
    const handle = await uniqueHandle(email);
    [user] = await db
      .insert(users)
      .values({ email, handle, displayName: handle })
      .returning();
  }
  if (!user) throw new Error('Creazione utente fallita');

  const token = await createSession(user.id, userAgent);
  return {
    token,
    isNewUser,
    user: { id: user.id, email: user.email, handle: user.handle, displayName: user.displayName },
  };
}

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const token = randomBytes(32).toString('base64url');
  await db.insert(authSessions).values({
    userId,
    tokenHash: hashToken(token),
    userAgent: userAgent?.slice(0, 300) ?? null,
    expiresAt: daysFromNow(SESSION_TTL_DAYS),
  });
  return token;
}

/**
 * The single lookup behind both transports: the browser's httpOnly cookie
 * and a native app's bearer token are the same string and the same row.
 */
export async function resolveSession(token: string | undefined | null): Promise<SessionUser | null> {
  if (!token) return null;

  const [row] = await db
    .select({
      id: users.id,
      email: users.email,
      handle: users.handle,
      displayName: users.displayName,
      sessionId: authSessions.id,
    })
    .from(authSessions)
    .innerJoin(users, eq(users.id, authSessions.userId))
    .where(
      and(
        eq(authSessions.tokenHash, hashToken(token)),
        isNull(authSessions.revokedAt),
        gt(authSessions.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!row) return null;

  // Cheap last-seen tracking, without a write on every single request.
  void db
    .update(authSessions)
    .set({ lastUsedAt: new Date() })
    .where(and(eq(authSessions.id, row.sessionId), sql`${authSessions.lastUsedAt} is null or ${authSessions.lastUsedAt} < now() - interval '1 hour'`))
    .catch(() => undefined);

  return { id: row.id, email: row.email, handle: row.handle, displayName: row.displayName };
}

export async function revokeSession(token: string): Promise<void> {
  await db
    .update(authSessions)
    .set({ revokedAt: new Date() })
    .where(eq(authSessions.tokenHash, hashToken(token)));
}
