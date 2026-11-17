import type { AppConfig } from '../config.js';
import { openTarget } from '../db/target.js';
import { detectPiiColumns } from '../pii/detect.js';
import { loadRulesFile, ruleForColumn } from '../rules/store.js';
import { fail, ok, type ToolResult } from './result.js';

export type VerifyInput = {
  /** Tables to check; defaults to all public base tables. */
  tables?: string[];
};

type PgRow = Record<string, unknown>;

/**
 * Verify target: every PII-flagged column has a rule, and sample values are not
 * equal to known clear patterns when a transforming rule is set.
 * Does not return row payloads to the agent — only pass/fail and column names.
 */
export async function verifyTool(config: AppConfig, input: VerifyInput = {}): Promise<ToolResult> {
  try {
    const rules = loadRulesFile(config.rulesPath);
    const target = await openTarget(config.targetUrl);
    try {
      const colRes = await target.query(
        `SELECT table_name, column_name, data_type, udt_name
         FROM information_schema.columns
         WHERE table_schema = 'public'
         ORDER BY table_name, ordinal_position`,
      );
      let columns = (colRes.rows as PgRow[]).map(row => ({
        table: String(row.table_name),
        name: String(row.column_name),
        dataType: String(row.data_type),
        udtName: String(row.udt_name),
      }));
      if (input.tables?.length) {
        const allow = new Set(input.tables);
        columns = columns.filter(c => allow.has(c.table));
      }

      const pii = detectPiiColumns(columns);
      const missingRules: string[] = [];
      const unmasked: string[] = [];

      for (const flag of pii) {
        const rule = ruleForColumn(rules, flag.table, flag.column);
        if (!rule) {
          missingRules.push(`${flag.table}.${flag.column}`);
          continue;
        }
        if (rule.type === 'keep') continue;
        if (rule.type === 'null') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM "${flag.table}" WHERE "${flag.column}" IS NOT NULL`,
          );
          if ((res.rows[0] as PgRow).n !== 0) {
            unmasked.push(`${flag.table}.${flag.column}`);
          }
          continue;
        }

        // For transforming rules, refuse if any non-null value still looks like a clear email/name
        // when the rule is fake_email / fake_name / etc. Heuristic: fake_email must end with @example.test.
        if (rule.type === 'fake_email') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM "${flag.table}"
             WHERE "${flag.column}" IS NOT NULL
               AND "${flag.column}"::text NOT LIKE '%@example.test'`,
          );
          if ((res.rows[0] as PgRow).n !== 0) unmasked.push(`${flag.table}.${flag.column}`);
        } else if (rule.type === 'hash') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM "${flag.table}"
             WHERE "${flag.column}" IS NOT NULL
               AND "${flag.column}"::text !~ '^[0-9a-f]{64}$'`,
          );
          if ((res.rows[0] as PgRow).n !== 0) unmasked.push(`${flag.table}.${flag.column}`);
        } else if (rule.type === 'fake_phone') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM "${flag.table}"
             WHERE "${flag.column}" IS NOT NULL
               AND "${flag.column}"::text !~ '^\\+1[2-9][0-9]{9}$'`,
          );
          if ((res.rows[0] as PgRow).n !== 0) unmasked.push(`${flag.table}.${flag.column}`);
        }
      }

      const okResult = missingRules.length === 0 && unmasked.length === 0;
      return ok({
        ok: okResult,
        missingRules,
        unmaskedColumns: unmasked,
        piiColumnCount: pii.length,
      });
    } finally {
      await target.end();
    }
  } catch (error) {
    return fail(error);
  }
}
