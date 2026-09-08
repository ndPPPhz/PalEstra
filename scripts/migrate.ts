import 'dotenv/config';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

async function main() {
  const url = process.env.DATABASE_URL ?? 'postgres://palestra:palestra@127.0.0.1:5432/palestra';

  // A dedicated single connection: migrations run once at deploy time and
  // must not borrow (or exhaust) the app's pool.
  const client = postgres(url, { max: 1 });
  await migrate(drizzle(client), { migrationsFolder: 'src/db/migrations' });
  await client.end();

  console.info('Migrazioni applicate.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
