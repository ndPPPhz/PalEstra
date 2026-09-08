import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL ?? 'postgres://palestra:palestra@127.0.0.1:5432/palestra';

  // A dedicated single connection: migrations run once at deploy time and
  // must not borrow (or exhaust) the app's pool.
  //
  // deploy.sh runs this on every deploy, and re-running it is a no-op that
  // Postgres still narrates ("schema drizzle already exists, skipping").
  // Those NOTICEs print as raw objects that read exactly like a crash, so
  // they are dropped: a real failure still throws and exits non-zero.
  const client = postgres(url, { max: 1, onnotice: () => {} });
  await migrate(drizzle(client), { migrationsFolder: 'src/db/migrations' });
  await client.end();

  console.info('Migrazioni applicate.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
