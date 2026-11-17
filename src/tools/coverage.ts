import { detectPiiColumns } from '../pii/detect.js';
import type { Catalog } from '../plan/types.js';
import type { RulesFile } from '../rules/schema.js';
import { ruleForColumn } from '../rules/store.js';

export type CoverageIssue =
  | { kind: 'missing_rule'; table: string; column: string; reason: string }
  | { kind: 'keep_without_reason'; table: string; column: string };

/**
 * Fail-closed checks before extract:
 * - every column in planned tables needs an explicit rule (never copy clear by default);
 * - `keep` on PII requires an explicit reason.
 */
export function checkExtractCoverage(
  catalog: Catalog,
  plannedTables: string[],
  rules: RulesFile,
): CoverageIssue[] {
  const planned = new Set(plannedTables);
  const columns = catalog.columns.filter(c => planned.has(c.table));
  const pii = new Set(
    detectPiiColumns(
      columns.map(c => ({
        table: c.table,
        name: c.name,
        dataType: c.dataType,
        ...(c.udtName !== undefined ? { udtName: c.udtName } : {}),
      })),
    ).map(f => `${f.table}.${f.column}`),
  );
  const issues: CoverageIssue[] = [];

  for (const col of columns) {
    const key = `${col.table}.${col.name}`;
    const rule = ruleForColumn(rules, col.table, col.name);
    if (!rule) {
      issues.push({
        kind: 'missing_rule',
        table: col.table,
        column: col.name,
        reason: pii.has(key)
          ? 'PII-flagged column has no rule'
          : 'column has no rule (new/unknown columns are never copied in clear)',
      });
      continue;
    }
    if (rule.type === 'keep' && pii.has(key) && !rule.reason) {
      issues.push({ kind: 'keep_without_reason', table: col.table, column: col.name });
    }
  }

  return issues;
}
