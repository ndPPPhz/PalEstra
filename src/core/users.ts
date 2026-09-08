import { eq } from 'drizzle-orm';
import { db } from '@/db';
import { coachProfiles, users } from '@/db/schema';
import { badRequest } from '@/core/errors';
import type { SessionUser } from '@/core/auth';

export async function updateProfile(
  user: SessionUser,
  input: { displayName?: string; publicName?: string | null },
): Promise<SessionUser> {
  let current = user;

  if (input.displayName !== undefined) {
    const displayName = input.displayName.trim();
    if (!displayName) throw badRequest('Il nome non può essere vuoto.');

    const [row] = await db.update(users).set({ displayName }).where(eq(users.id, user.id)).returning();
    if (row) current = { id: row.id, email: row.email, handle: row.handle, displayName: row.displayName };
  }

  // Setting a public name is what makes someone a coach in the UI; there is
  // no global role flag, so this row is simply the coach-facing profile.
  if (input.publicName !== undefined) {
    await db
      .insert(coachProfiles)
      .values({ userId: user.id, publicName: input.publicName?.trim() || null })
      .onConflictDoUpdate({
        target: coachProfiles.userId,
        set: { publicName: input.publicName?.trim() || null },
      });
  }

  return current;
}

export async function getCoachProfile(userId: string) {
  const [row] = await db.select().from(coachProfiles).where(eq(coachProfiles.userId, userId)).limit(1);
  return row ?? null;
}
