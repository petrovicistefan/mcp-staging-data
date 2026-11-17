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

function quoteIdent(name: string): string {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
    throw new Error('Invalid SQL identifier');
  }
  return `"${name}"`;
}

/**
 * Verify target: every PII-flagged column has a rule, and transforming rules look applied.
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

        const table = quoteIdent(flag.table);
        const column = quoteIdent(flag.column);

        if (rule.type === 'null') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM ${table} WHERE ${column} IS NOT NULL`,
          );
          if ((res.rows[0] as PgRow).n !== 0) unmasked.push(`${flag.table}.${flag.column}`);
          continue;
        }

        if (rule.type === 'fake_email') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM ${table}
             WHERE ${column} IS NOT NULL AND ${column}::text NOT LIKE '%@example.test'`,
          );
          if ((res.rows[0] as PgRow).n !== 0) unmasked.push(`${flag.table}.${flag.column}`);
        } else if (rule.type === 'hash') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM ${table}
             WHERE ${column} IS NOT NULL AND ${column}::text !~ '^[0-9a-f]{64}$'`,
          );
          if ((res.rows[0] as PgRow).n !== 0) unmasked.push(`${flag.table}.${flag.column}`);
        } else if (rule.type === 'fake_phone') {
          const res = await target.query(
            `SELECT count(*)::int AS n FROM ${table}
             WHERE ${column} IS NOT NULL AND ${column}::text !~ '^\\+1[2-9][0-9]{9}$'`,
          );
          if ((res.rows[0] as PgRow).n !== 0) unmasked.push(`${flag.table}.${flag.column}`);
        } else if (rule.type === 'fake_name') {
          // Deterministic fake names are "First Last" from a fixed word list — reject emails / raw phones.
          const res = await target.query(
            `SELECT count(*)::int AS n FROM ${table}
             WHERE ${column} IS NOT NULL
               AND (
                 ${column}::text ~* '[@0-9]'
                 OR ${column}::text !~ '^[A-Za-z]+ [A-Za-z]+$'
               )`,
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
