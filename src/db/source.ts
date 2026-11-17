import pg from 'pg';
import { redactError } from '../redact.js';

const { Client } = pg;

export type SourceClient = {
  query: pg.Client['query'];
  end: () => Promise<void>;
};

/**
 * Open a source connection that is read-only for the session.
 * Only this module opens source connections (AGENTS.md rule 6).
 */
export async function openSource(connectionString: string): Promise<SourceClient> {
  const client = new Client({ connectionString });
  try {
    await client.connect();
    await client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY');
    await client.query('SET default_transaction_read_only = on');
  } catch (error) {
    try {
      await client.end();
    } catch {
      // ignore
    }
    throw redactError(error);
  }

  return {
    query: client.query.bind(client) as pg.Client['query'],
    end: async () => {
      await client.end();
    },
  };
}

/** Run work inside an explicit read-only transaction. */
export async function withReadOnlyTransaction<T>(
  source: SourceClient,
  fn: (query: pg.Client['query']) => Promise<T>,
): Promise<T> {
  await source.query('BEGIN READ ONLY');
  try {
    const result = await fn(source.query.bind(source) as pg.Client['query']);
    await source.query('COMMIT');
    return result;
  } catch (error) {
    try {
      await source.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw redactError(error);
  }
}
