import type { SourceClient } from './source.js';
import type { Catalog, CatalogColumn, CatalogTable, ForeignKey } from '../plan/types.js';
import { redactError } from '../redact.js';

type PgRow = Record<string, unknown>;

/**
 * Load tables, columns, primary keys and foreign keys from a read-only source.
 */
export async function loadCatalog(source: SourceClient, schema = 'public'): Promise<Catalog> {
  try {
    const tablesRes = await source.query(
      `SELECT c.relname AS name
       FROM pg_class c
       JOIN pg_namespace n ON n.oid = c.relnamespace
       WHERE n.nspname = $1 AND c.relkind = 'r'
       ORDER BY c.relname`,
      [schema],
    );

    const pkRes = await source.query(
      `SELECT tc.table_name, kcu.column_name, kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = $1 AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY tc.table_name, kcu.ordinal_position`,
      [schema],
    );

    const colRes = await source.query(
      `SELECT table_name, column_name, data_type, udt_name, is_nullable, ordinal_position
       FROM information_schema.columns
       WHERE table_schema = $1
       ORDER BY table_name, ordinal_position`,
      [schema],
    );

    const fkRes = await source.query(
      `SELECT
         tc.constraint_name AS name,
         tc.table_name AS from_table,
         kcu.column_name AS from_column,
         ccu.table_name AS to_table,
         ccu.column_name AS to_column,
         kcu.ordinal_position
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage ccu
         ON ccu.constraint_name = tc.constraint_name
        AND ccu.table_schema = tc.table_schema
       WHERE tc.table_schema = $1 AND tc.constraint_type = 'FOREIGN KEY'
       ORDER BY tc.constraint_name, kcu.ordinal_position`,
      [schema],
    );

    const pkMap = new Map<string, string[]>();
    for (const row of pkRes.rows as PgRow[]) {
      const table = String(row.table_name);
      const list = pkMap.get(table) ?? [];
      list.push(String(row.column_name));
      pkMap.set(table, list);
    }

    const tables: CatalogTable[] = (tablesRes.rows as PgRow[]).map(row => ({
      name: String(row.name),
      primaryKey: pkMap.get(String(row.name)) ?? [],
    }));

    const columns: CatalogColumn[] = (colRes.rows as PgRow[]).map(row => ({
      table: String(row.table_name),
      name: String(row.column_name),
      dataType: String(row.data_type),
      udtName: String(row.udt_name),
      isNullable: String(row.is_nullable).toUpperCase() === 'YES',
      ordinalPosition: Number(row.ordinal_position),
    }));

    const fkGrouped = new Map<string, ForeignKey>();
    for (const row of fkRes.rows as PgRow[]) {
      const name = String(row.name);
      let fk = fkGrouped.get(name);
      if (!fk) {
        fk = {
          name,
          fromTable: String(row.from_table),
          fromColumns: [],
          toTable: String(row.to_table),
          toColumns: [],
        };
        fkGrouped.set(name, fk);
      }
      fk.fromColumns.push(String(row.from_column));
      fk.toColumns.push(String(row.to_column));
    }

    return {
      tables,
      columns,
      foreignKeys: [...fkGrouped.values()],
    };
  } catch (error) {
    throw redactError(error);
  }
}
