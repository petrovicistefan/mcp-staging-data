import pg from 'pg';
import { insertOrder } from '../plan/graph.js';
import type { Catalog } from '../plan/types.js';
import { redactError } from '../redact.js';

const { Client } = pg;

export type TargetClient = {
  query: pg.Client['query'];
  end: () => Promise<void>;
};

export async function openTarget(connectionString: string): Promise<TargetClient> {
  const client = new Client({ connectionString });
  try {
    await client.connect();
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

export type InsertBatch = {
  table: string;
  columns: string[];
  rows: unknown[][];
};

/**
 * Insert anonymized rows in FK-safe order inside a single transaction.
 */
export async function writeBatches(
  target: TargetClient,
  catalog: Catalog,
  batches: InsertBatch[],
): Promise<{ inserted: Record<string, number> }> {
  const order = insertOrder(catalog);
  const byTable = new Map(batches.map(b => [b.table, b]));
  const inserted: Record<string, number> = {};

  await target.query('BEGIN');
  try {
    for (const table of order) {
      const batch = byTable.get(table);
      if (!batch || batch.rows.length === 0) continue;
      const cols = batch.columns.map(c => quoteIdent(c)).join(', ');
      for (const row of batch.rows) {
        const placeholders = row.map((_, i) => `$${i + 1}`).join(', ');
        await target.query(
          `INSERT INTO ${quoteIdent(table)} (${cols}) VALUES (${placeholders})`,
          row,
        );
      }
      inserted[table] = batch.rows.length;
    }
    await target.query('COMMIT');
  } catch (error) {
    try {
      await target.query('ROLLBACK');
    } catch {
      // ignore
    }
    throw redactError(error);
  }

  return { inserted };
}

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('Invalid SQL identifier');
  }
  return `"${name}"`;
}
