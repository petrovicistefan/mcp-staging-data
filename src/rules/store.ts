import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { rulesFileSchema, type RulesFile } from './schema.js';
import type { ColumnRule } from './types.js';

export function loadRulesFile(path: string): RulesFile {
  if (!existsSync(path)) {
    return { version: 1, columns: {} };
  }
  const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown;
  return rulesFileSchema.parse(raw);
}

export function saveRulesFile(path: string, file: RulesFile): void {
  const parsed = rulesFileSchema.parse(file);
  writeFileSync(path, `${JSON.stringify(parsed, null, 2)}\n`, 'utf8');
}

export function ruleForColumn(
  file: RulesFile,
  table: string,
  column: string,
): ColumnRule | undefined {
  return file.columns[`${table}.${column}`];
}
