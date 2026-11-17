import { loadCatalog } from '../db/catalog.js';
import { openSource } from '../db/source.js';
import { detectPiiColumns } from '../pii/detect.js';
import type { AppConfig } from '../config.js';
import { fail, ok, type ToolResult } from './result.js';

export async function inspectSchema(config: AppConfig): Promise<ToolResult> {
  try {
    const source = await openSource(config.sourceUrl);
    try {
      const catalog = await loadCatalog(source);
      const pii = detectPiiColumns(
        catalog.columns.map(c => ({
          table: c.table,
          name: c.name,
          dataType: c.dataType,
          udtName: c.udtName,
        })),
      );
      return ok({
        tables: catalog.tables.map(t => ({
          name: t.name,
          primaryKey: t.primaryKey,
          columns: catalog.columns
            .filter(c => c.table === t.name)
            .map(c => ({
              name: c.name,
              dataType: c.dataType,
              isNullable: c.isNullable,
            })),
        })),
        foreignKeys: catalog.foreignKeys.map(fk => ({
          name: fk.name,
          fromTable: fk.fromTable,
          fromColumns: fk.fromColumns,
          toTable: fk.toTable,
          toColumns: fk.toColumns,
        })),
        piiColumns: pii,
      });
    } finally {
      await source.end();
    }
  } catch (error) {
    return fail(error);
  }
}
