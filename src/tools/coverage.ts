import { detectPiiColumns } from '../pii/detect.js';
import type { Catalog } from '../plan/types.js';
import type { RulesFile } from '../rules/schema.js';
import { ruleForColumn } from '../rules/store.js';

export type CoverageIssue =
  | { kind: 'missing_rule'; table: string; column: string; reason: string }
  | { kind: 'keep_without_reason'; table: string; column: string };

/**
 * Fail-closed checks before extract: every PII column in planned tables needs a rule;
 * `keep` on PII requires an explicit reason.
 */
export function checkExtractCoverage(
  catalog: Catalog,
  plannedTables: string[],
  rules: RulesFile,
): CoverageIssue[] {
  const planned = new Set(plannedTables);
  const columns = catalog.columns.filter(c => planned.has(c.table));
  const pii = detectPiiColumns(
    columns.map(c => ({
      table: c.table,
      name: c.name,
      dataType: c.dataType,
      udtName: c.udtName,
    })),
  );
  const issues: CoverageIssue[] = [];

  for (const flag of pii) {
    const rule = ruleForColumn(rules, flag.table, flag.column);
    if (!rule) {
      issues.push({
        kind: 'missing_rule',
        table: flag.table,
        column: flag.column,
        reason: flag.reason,
      });
      continue;
    }
    if (rule.type === 'keep' && !rule.reason) {
      issues.push({ kind: 'keep_without_reason', table: flag.table, column: flag.column });
    }
  }

  return issues;
}
