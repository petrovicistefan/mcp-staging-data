import { hmacForValue } from './hmac.js';
import type { RuleFn } from './types.js';

/** Replace a value with a stable hex digest (64 chars). NULL stays NULL. */
export const hash: RuleFn = (value, ctx) => {
  if (value === null || value === undefined) return null;
  return hmacForValue(ctx.key, ctx.table, ctx.column, String(value));
};
