import type { AppConfig } from '../config.js';
import { loadCatalog } from '../db/catalog.js';
import { createPgLookup } from '../db/lookup.js';
import { openSource } from '../db/source.js';
import { planSubset as buildPlan } from '../plan/subset.js';
import { fail, ok, type ToolResult } from './result.js';

export type PlanSubsetInput = {
  table: string;
  primaryKey: unknown[];
  maxRows?: number;
};

export async function planSubsetTool(config: AppConfig, input: PlanSubsetInput): Promise<ToolResult> {
  try {
    const source = await openSource(config.sourceUrl);
    try {
      const catalog = await loadCatalog(source);
      const pkByTable = new Map(catalog.tables.map(t => [t.name, t.primaryKey]));
      const lookup = createPgLookup(source, pkByTable);
      const plan = await buildPlan({
        catalog,
        seeds: [{ table: input.table, primaryKeyValues: input.primaryKey }],
        lookup,
        maxRows: input.maxRows,
      });
      return ok({
        tables: plan.tables.map(t => ({ table: t.table, rowCount: t.rowCount })),
        totalRows: plan.totalRows,
        truncated: plan.truncated,
      });
    } finally {
      await source.end();
    }
  } catch (error) {
    return fail(error);
  }
}
