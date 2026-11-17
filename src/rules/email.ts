import { hmacForValue } from './hmac.js';
import type { RuleFn } from './types.js';

const LOCAL_MAX = 32;
const DOMAIN = 'example.test';

/** Deterministic fake email; unique when inputs are unique. NULL stays NULL. */
export const fakeEmail: RuleFn = (value, ctx) => {
  if (value === null || value === undefined) return null;
  const hex = hmacForValue(ctx.key, ctx.table, ctx.column, String(value));
  const local = hex.slice(0, LOCAL_MAX);
  return `${local}@${DOMAIN}`;
};
