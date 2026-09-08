import { randomBytes } from 'node:crypto';
import { and, desc, eq, gt, isNull, sql } from 'drizzle-orm';
import { config } from '@/config/env';
import { db } from '@/db';
import { coachProfiles, coachingRelationships, invites, mesocycles, users } from '@/db/schema';
import { badRequest, forbidden, notFound } from '@/core/errors';
import type { SessionUser } from '@/core/auth';

const INVITE_TTL_DAYS = 30;

/**
 * The code is the credential, so it comes from a CSPRNG and never from a
 * counter. 8 base32-ish characters keep it short enough to read out loud.
 */
function generateCode(): string {
  const alphabet = 'abcdefghijkmnpqrstuvwxyz23456789'; // no l/o/0/1: ambiguous aloud
  const bytes = randomBytes(8);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
}

export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';

/** Derived, never stored: one less column that can disagree with reality. */
export function inviteStatus(invite: {
  acceptedAt: Date | null;
  revokedAt: Date | null;
  expiresAt: Date;
}): InviteStatus {
  if (invite.acceptedAt) return 'accepted';
  if (invite.revokedAt) return 'revoked';
  if (invite.expiresAt.getTime() <= Date.now()) return 'expired';
  return 'pending';
}

export const inviteUrl = (code: string) => `${config.appUrl}/invite/${code}`;

export async function createInvite(coach: SessionUser, label: string) {
  const trimmed = label.trim();
  if (!trimmed) throw badRequest('Dai un nome all’invito, così sai a chi l’hai mandato.');

  const [invite] = await db
    .insert(invites)
    .values({
      coachUserId: coach.id,
      label: trimmed,
      code: generateCode(),
      expiresAt: new Date(Date.now() + INVITE_TTL_DAYS * 86_400_000),
    })
    .returning();

  if (!invite) throw new Error('Creazione invito fallita');
  return { invite, url: inviteUrl(invite.code) };
}

export async function listInvites(coachUserId: string) {
  const rows = await db
    .select({
      id: invites.id,
      code: invites.code,
      label: invites.label,
      createdAt: invites.createdAt,
      expiresAt: invites.expiresAt,
      revokedAt: invites.revokedAt,
      acceptedAt: invites.acceptedAt,
      acceptedByName: users.displayName,
    })
    .from(invites)
    .leftJoin(users, eq(users.id, invites.acceptedByUserId))
    .where(eq(invites.coachUserId, coachUserId))
    .orderBy(desc(invites.createdAt));

  return rows.map((row) => ({ ...row, status: inviteStatus(row), url: inviteUrl(row.code) }));
}

export async function revokeInvite(coach: SessionUser, inviteId: string) {
  const [row] = await db
    .update(invites)
    .set({ revokedAt: new Date() })
    .where(and(eq(invites.id, inviteId), eq(invites.coachUserId, coach.id), isNull(invites.acceptedAt)))
    .returning();

  if (!row) throw notFound('Invito non trovato, già accettato o non tuo.');
  return row;
}

/** What the public /invite/[code] page shows before the visitor logs in. */
export async function previewInvite(code: string) {
  const [row] = await db
    .select({
      code: invites.code,
      label: invites.label,
      acceptedAt: invites.acceptedAt,
      revokedAt: invites.revokedAt,
      expiresAt: invites.expiresAt,
      coachUserId: invites.coachUserId,
      coachName: users.displayName,
      coachHandle: users.handle,
      coachPublicName: coachProfiles.publicName,
    })
    .from(invites)
    .innerJoin(users, eq(users.id, invites.coachUserId))
    .leftJoin(coachProfiles, eq(coachProfiles.userId, invites.coachUserId))
    .where(eq(invites.code, code))
    .limit(1);

  if (!row) return null;
  return { ...row, status: inviteStatus(row) };
}

/**
 * Claims the invite for this athlete.
 *
 * The claim is a single conditional UPDATE, so opening the link twice (or
 * two people racing on a forwarded link) cannot produce two relationships:
 * exactly one statement finds `accepted_at is null` and the other updates
 * nothing. The relationship is created in the same transaction, so a
 * failure there does not burn the invite.
 */
export async function acceptInvite(user: SessionUser, code: string) {
  return db.transaction(async (tx) => {
    const [claimed] = await tx
      .update(invites)
      .set({ acceptedByUserId: user.id, acceptedAt: new Date() })
      .where(
        and(
          eq(invites.code, code),
          isNull(invites.acceptedAt),
          isNull(invites.revokedAt),
          gt(invites.expiresAt, new Date()),
        ),
      )
      .returning();

    if (!claimed) {
      throw badRequest('Questo invito non è più valido: è già stato usato, revocato o scaduto.');
    }

    if (claimed.coachUserId === user.id) {
      // Rolls back the claim: the coach can still send the link to someone.
      throw badRequest('Non puoi seguire te stesso.');
    }

    await tx
      .insert(coachingRelationships)
      .values({ coachUserId: claimed.coachUserId, athleteUserId: user.id })
      // The partial unique index already forbids two active relationships
      // for a pair; re-accepting simply lands on the existing one.
      .onConflictDoNothing();

    const [relationship] = await tx
      .select()
      .from(coachingRelationships)
      .where(
        and(
          eq(coachingRelationships.coachUserId, claimed.coachUserId),
          eq(coachingRelationships.athleteUserId, user.id),
          isNull(coachingRelationships.endedAt),
        ),
      )
      .limit(1);

    if (!relationship) throw new Error('Creazione relazione fallita');
    return relationship;
  });
}

/** Athletes a coach follows, with a summary of their current programme. */
export async function listAthletes(coachUserId: string) {
  return db
    .select({
      relationshipId: coachingRelationships.id,
      athleteId: users.id,
      displayName: users.displayName,
      handle: users.handle,
      since: coachingRelationships.createdAt,
      activeMesocycles: sql<number>`(
        select count(*)::int from ${mesocycles} m
        where m.relationship_id = ${coachingRelationships.id}
          and m.completed_at is null and m.deleted_at is null
      )`,
    })
    .from(coachingRelationships)
    .innerJoin(users, eq(users.id, coachingRelationships.athleteUserId))
    .where(and(eq(coachingRelationships.coachUserId, coachUserId), isNull(coachingRelationships.endedAt)))
    .orderBy(users.displayName);
}

export async function listCoaches(athleteUserId: string) {
  return db
    .select({
      relationshipId: coachingRelationships.id,
      coachId: users.id,
      displayName: users.displayName,
      handle: users.handle,
      publicName: coachProfiles.publicName,
    })
    .from(coachingRelationships)
    .innerJoin(users, eq(users.id, coachingRelationships.coachUserId))
    .leftJoin(coachProfiles, eq(coachProfiles.userId, users.id))
    .where(and(eq(coachingRelationships.athleteUserId, athleteUserId), isNull(coachingRelationships.endedAt)));
}

export async function requireRelationship(user: SessionUser, relationshipId: string) {
  const [row] = await db
    .select()
    .from(coachingRelationships)
    .where(and(eq(coachingRelationships.id, relationshipId), isNull(coachingRelationships.endedAt)))
    .limit(1);

  if (!row) throw notFound('Relazione non trovata.');
  if (row.coachUserId !== user.id && row.athleteUserId !== user.id) {
    throw forbidden('Questa relazione non ti riguarda.');
  }
  return row;
}
