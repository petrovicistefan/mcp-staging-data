import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

export const SOURCE_URL =
  process.env.STAGING_DATA_SOURCE_URL ??
  'postgres://staging:staging@127.0.0.1:55432/source_db';
export const TARGET_URL =
  process.env.STAGING_DATA_TARGET_URL ??
  'postgres://staging:staging@127.0.0.1:55433/target_db';

export async function resetDatabase(url: string, withSeed: boolean): Promise<void> {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(`
      DROP TABLE IF EXISTS order_items CASCADE;
      DROP TABLE IF EXISTS orders CASCADE;
      DROP TABLE IF EXISTS products CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);
    const schema = readFileSync(join(root, 'test/fixtures/schema.sql'), 'utf8');
    await client.query(schema);
    if (withSeed) {
      const seed = readFileSync(join(root, 'test/fixtures/seed.sql'), 'utf8');
      await client.query(seed);
    }
  } finally {
    await client.end();
  }
}

export async function waitForPostgres(url: string, attempts = 30): Promise<void> {
  let last: unknown;
  for (let i = 0; i < attempts; i++) {
    const client = new pg.Client({ connectionString: url });
    try {
      await client.connect();
      await client.query('SELECT 1');
      await client.end();
      return;
    } catch (error) {
      last = error;
      try {
        await client.end();
      } catch {
        // ignore
      }
      await new Promise(r => setTimeout(r, 500));
    }
  }
  throw new Error(`Postgres not ready at ${url.replace(/:[^:@/]+@/, ':***@')}: ${String(last)}`);
}
