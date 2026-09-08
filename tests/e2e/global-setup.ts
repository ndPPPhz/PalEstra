import postgres from 'postgres';

/** A clean database before the suite, so the run is repeatable. */
export default async function globalSetup() {
  const sql = postgres('postgres://palestra:palestra@127.0.0.1:5432/palestra_e2e', { max: 1 });
  await sql`
    truncate table
      feedbacks, prescriptions, training_sessions, meso_weeks, meso_slots, meso_days,
      mesocycles, coaching_relationships, invites, exercises, auth_sessions, otp_codes,
      coach_profiles, users
    restart identity cascade
  `;
  await sql.end();
}
