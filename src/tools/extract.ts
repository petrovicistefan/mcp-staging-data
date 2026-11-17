import type { AppConfig } from '../config.js';
import { loadCatalog } from '../db/catalog.js';
import { createPgLookup } from '../db/lookup.js';
import { openSource } from '../db/source.js';
import { openTarget, writeBatches, type InsertBatch } from '../db/target.js';
import { assertSourceTargetDistinct } from '../db/urls.js';
import { decodeRowKey } from '../plan/types.js';
import { planSubset as buildPlan } from '../plan/subset.js';
import { applyRule } from '../rules/apply.js';
import { loadRulesFile, ruleForColumn } from '../rules/store.js';
import { checkExtractCoverage } from './coverage.js';
import { fail, ok, type ToolResult } from './result.js';

export type ExtractInput = {
  table: string;
  primaryKey: unknown[];
  maxRows?: number;
};

export async function extractTool(config: AppConfig, input: ExtractInput): Promise<ToolResult> {
  try {
    assertSourceTargetDistinct(config.sourceUrl, config.targetUrl);
    const rules = loadRulesFile(config.rulesPath);

    const source = await openSource(config.sourceUrl);
    const target = await openTarget(config.targetUrl);
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

      const issues = checkExtractCoverage(
        catalog,
        plan.tables.map(t => t.table),
        rules,
      );
      if (issues.length > 0) {
        return fail(
          new Error(
            `extract refused: PII columns lack rules or keep-without-reason: ${issues
              .map(i => `${i.table}.${i.column}`)
              .join(', ')}`,
          ),
        );
      }

      const batches: InsertBatch[] = [];
      for (const planned of plan.tables) {
        const columns = catalog.columns
          .filter(c => c.table === planned.table)
          .sort((a, b) => a.ordinalPosition - b.ordinalPosition);
        const colNames = columns.map(c => c.name);
        const rows: unknown[][] = [];

        for (const rowKey of planned.rowKeys) {
          const pkValues = decodeRowKey(rowKey);
          const values = await lookup.getColumns(planned.table, pkValues, colNames);
          const transformed = colNames.map((col, i) => {
            const rule = ruleForColumn(rules, planned.table, col);
            const value = values[i] ?? null;
            if (!rule) return value;
            return applyRule(rule, value, {
              key: config.hmacKey,
              table: planned.table,
              column: col,
              rowKey,
            });
          });
          rows.push(transformed);
        }

        batches.push({ table: planned.table, columns: colNames, rows });
      }

      const { inserted } = await writeBatches(target, catalog, batches);
      return ok({
        tables: plan.tables.map(t => ({ table: t.table, rowCount: t.rowCount })),
        totalRows: plan.totalRows,
        truncated: plan.truncated,
        inserted,
      });
    } finally {
      await source.end();
      await target.end();
    }
  } catch (error) {
    return fail(error);
  }
}
