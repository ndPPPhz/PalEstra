import { sql as client, db } from '@/db';
import { requestOtp, verifyOtp, type SessionUser } from '@/core/auth';
import { acceptInvite, createInvite } from '@/core/relationships';

/** Empties every table between tests, keeping the schema. */
export async function resetDatabase() {
  await client`
    truncate table
      feedbacks, prescriptions, training_sessions, meso_weeks, meso_slots, meso_days,
      mesocycles, coaching_relationships, invites, exercises, auth_sessions, otp_codes,
      coach_profiles, users
    restart identity cascade
  `;
}

export async function closeDatabase() {
  await client.end();
}

/** Creates a user through the real OTP flow, so login is covered too. */
export async function createUser(email: string, displayName?: string): Promise<SessionUser & { token: string }> {
  const { devCode } = await requestOtp(email);
  if (!devCode) throw new Error('devCode assente: i test devono girare fuori da produzione');

  const { token, user } = await verifyOtp(email, devCode);
  if (displayName) {
    const { users } = await import('@/db/schema');
    const { eq } = await import('drizzle-orm');
    await db.update(users).set({ displayName }).where(eq(users.id, user.id));
  }
  return { ...user, displayName: displayName ?? user.displayName, token };
}

/** Coach invites athlete, athlete accepts. Returns the active relationship. */
export async function link(coach: SessionUser, athlete: SessionUser, label = 'Test') {
  const { invite } = await createInvite(coach, label);
  return acceptInvite(athlete, invite.code);
}
