import type { AppConfig } from '../config.js';
import { columnRuleSchema, type RulesFile } from '../rules/schema.js';
import { loadRulesFile, saveRulesFile } from '../rules/store.js';
import { fail, ok, type ToolResult } from './result.js';

export type SetRulesInput = {
  columns: Record<string, { type: string; reason?: string }>;
  /** When true, replace the whole file; otherwise merge. */
  replace?: boolean;
};

export async function setRules(config: AppConfig, input: SetRulesInput): Promise<ToolResult> {
  try {
    const current = input.replace ? { version: 1 as const, columns: {} } : loadRulesFile(config.rulesPath);
    const next: RulesFile = { version: 1, columns: { ...current.columns } };

    for (const [key, raw] of Object.entries(input.columns)) {
      if (!/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/.test(key)) {
        throw new Error(`Invalid column key "${key}"; expected table.column`);
      }
      next.columns[key] = columnRuleSchema.parse(raw);
    }

    saveRulesFile(config.rulesPath, next);
    return ok({
      path: config.rulesPath,
      columnCount: Object.keys(next.columns).length,
      columns: Object.keys(next.columns).sort(),
    });
  } catch (error) {
    return fail(error);
  }
}
