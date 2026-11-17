import { createHmac } from 'node:crypto';

/** Deterministic HMAC-SHA256 hex digest for rule inputs. */
export function hmacHex(key: string, material: string): string {
  return createHmac('sha256', key).update(material, 'utf8').digest('hex');
}

/** Canonical material: `table.column:value`. */
export function ruleMaterial(table: string, column: string, value: string): string {
  return `${table}.${column}:${value}`;
}

export function hmacForValue(key: string, table: string, column: string, value: string): string {
  return hmacHex(key, ruleMaterial(table, column, value));
}
