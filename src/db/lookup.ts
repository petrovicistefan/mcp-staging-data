import type { RowLookup } from '../plan/subset.js';
import type { SourceClient } from './source.js';
import { redactError } from '../redact.js';

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('Invalid SQL identifier');
  }
  return `"${name}"`;
}

/**
 * Postgres-backed RowLookup for the subset planner. Returns keys/column values only.
 */
export function createPgLookup(source: SourceClient, pkByTable: Map<string, string[]>): RowLookup {
  return {
    async findKeys(table, equals) {
      try {
        const pk = pkByTable.get(table);
        if (!pk || pk.length === 0) throw new Error(`Table ${table} has no primary key`);
        const entries = Object.entries(equals);
        const where =
          entries.length === 0
            ? 'TRUE'
            : entries.map(([col], i) => `${quoteIdent(col)} = $${i + 1}`).join(' AND ');
        const sql = `SELECT ${pk.map(quoteIdent).join(', ')} FROM ${quoteIdent(table)} WHERE ${where}`;
        const res = await source.query(
          sql,
          entries.map(([, v]) => v),
        );
        return res.rows.map(row => pk.map(col => (row as Record<string, unknown>)[col]));
      } catch (error) {
        throw redactError(error);
      }
    },
    async getColumns(table, primaryKeyValues, columns) {
      try {
        const pk = pkByTable.get(table);
        if (!pk || pk.length === 0) throw new Error(`Table ${table} has no primary key`);
        if (pk.length !== primaryKeyValues.length) {
          throw new Error(`Primary key arity mismatch for ${table}`);
        }
        const where = pk.map((col, i) => `${quoteIdent(col)} = $${i + 1}`).join(' AND ');
        const sql = `SELECT ${columns.map(quoteIdent).join(', ')} FROM ${quoteIdent(table)} WHERE ${where}`;
        const res = await source.query(sql, primaryKeyValues);
        const row = res.rows[0] as Record<string, unknown> | undefined;
        if (!row) return columns.map(() => null);
        return columns.map(col => row[col] ?? null);
      } catch (error) {
        throw redactError(error);
      }
    },
  };
}
