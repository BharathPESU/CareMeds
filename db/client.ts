import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

declare global {
  var _caremedsPgPool: Pool | undefined;
}

export function isPostgresConfigured(): boolean {
  const url = process.env.DATABASE_URL?.trim();
  return Boolean(url && !url.includes('[PROJECT_REF]') && url.startsWith('postgres'));
}

export function getPool(): Pool {
  if (!isPostgresConfigured()) {
    throw new Error('DATABASE_URL is not configured for Supabase Postgres.');
  }

  if (!global._caremedsPgPool) {
    // Supabase Transaction Pooler (port 6543) requires prepared statements disabled
    global._caremedsPgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
      ssl: process.env.DATABASE_URL?.includes('localhost')
        ? false
        : { rejectUnauthorized: false },
    });

    global._caremedsPgPool.on('error', (err) => {
      console.error('Postgres pool idle client error:', err.message);
    });
  }

  return global._caremedsPgPool;
}

let cachedDb: NodePgDatabase<typeof schema> | null = null;

export function getDb(): NodePgDatabase<typeof schema> {
  if (!cachedDb) {
    cachedDb = drizzle(getPool(), { schema });
  }
  return cachedDb;
}
