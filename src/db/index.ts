import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { config } from '@/config/env';
import * as schema from './schema';

/**
 * The app is a long-running process behind systemd, not a serverless
 * function, so a plain connection pool is all that is needed — no HTTP
 * driver, no external pooler.
 *
 * Next.js reloads modules in development, which would otherwise open a new
 * pool on every save until Postgres refuses connections; stashing the
 * client on globalThis keeps exactly one.
 */
const globalForDb = globalThis as unknown as { __palestraSql?: ReturnType<typeof postgres> };

const client = globalForDb.__palestraSql ?? postgres(config.databaseUrl, { max: 10 });
if (!config.isProduction) globalForDb.__palestraSql = client;

export const db = drizzle(client, { schema, casing: 'snake_case' });
export { client as sql };
export type Db = typeof db;
