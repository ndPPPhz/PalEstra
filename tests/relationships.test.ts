import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { acceptInvite, createInvite, listAthletes, listInvites, revokeInvite } from '@/core/relationships';
import { closeDatabase, createUser, resetDatabase } from './helpers/db';

beforeEach(resetDatabase);
afterAll(closeDatabase);

describe('inviti nominali monouso', () => {
  it('il PT vede a chi ha mandato l’invito prima che venga accettato', async () => {
    const coach = await createUser('pt@example.com', 'Mattia');
    await createInvite(coach, 'Andrea');

    const [pending] = await listInvites(coach.id);
    expect(pending?.label).toBe('Andrea');
    expect(pending?.status).toBe('pending');
    expect(pending?.url).toContain(pending!.code);
  });

  it('accettare crea la relazione attiva', async () => {
    const coach = await createUser('pt2@example.com', 'Mattia');
    const athlete = await createUser('atleta@example.com', 'Andrea');

    const { invite } = await createInvite(coach, 'Andrea');
    const relationship = await acceptInvite(athlete, invite.code);

    expect(relationship.coachUserId).toBe(coach.id);
    expect(relationship.athleteUserId).toBe(athlete.id);

    const athletes = await listAthletes(coach.id);
    expect(athletes.map((a) => a.athleteId)).toEqual([athlete.id]);

    const [used] = await listInvites(coach.id);
    expect(used?.status).toBe('accepted');
    expect(used?.acceptedByName).toBe('Andrea');
  });

  it('un invito è monouso: il secondo atleta trova il link bruciato', async () => {
    const coach = await createUser('pt3@example.com');
    const first = await createUser('primo@example.com');
    const second = await createUser('secondo@example.com');

    const { invite } = await createInvite(coach, 'Andrea');
    await acceptInvite(first, invite.code);

    await expect(acceptInvite(second, invite.code)).rejects.toThrow(/non è più valido/);
    expect(await listAthletes(coach.id)).toHaveLength(1);
  });

  it('due aperture simultanee del link producono una sola relazione', async () => {
    // The UPDATE ... WHERE accepted_at IS NULL is the whole defence: exactly
    // one statement can match, so a forwarded link cannot double-enrol.
    const coach = await createUser('pt4@example.com');
    const a = await createUser('a@example.com');
    const b = await createUser('b@example.com');

    const { invite } = await createInvite(coach, 'Chiunque');
    const results = await Promise.allSettled([acceptInvite(a, invite.code), acceptInvite(b, invite.code)]);

    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await listAthletes(coach.id)).toHaveLength(1);
  });

  it('un invito revocato non è più accettabile', async () => {
    const coach = await createUser('pt5@example.com');
    const athlete = await createUser('atleta5@example.com');

    const { invite } = await createInvite(coach, 'Andrea');
    await revokeInvite(coach, invite.id);

    await expect(acceptInvite(athlete, invite.code)).rejects.toThrow(/non è più valido/);
  });

  it('il PT non può seguire se stesso', async () => {
    const coach = await createUser('pt6@example.com');
    const { invite } = await createInvite(coach, 'Io');

    await expect(acceptInvite(coach, invite.code)).rejects.toThrow(/te stesso/);

    // The rejected transaction must have rolled the claim back, so the
    // coach can still send that link to a real athlete.
    const [row] = await listInvites(coach.id);
    expect(row?.status).toBe('pending');
  });
});
