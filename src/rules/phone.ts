import { hmacForValue } from './hmac.js';
import type { RuleFn } from './types.js';

/** Deterministic E.164-like phone (+1 + 10 digits, NANP-plausible). NULL stays NULL. */
export const fakePhone: RuleFn = (value, ctx) => {
  if (value === null || value === undefined) return null;
  const hex = hmacForValue(ctx.key, ctx.table, ctx.column, String(value));
  // 13 hex chars (~52 bits) → unique national numbers for subset-scale inputs.
  const n = BigInt(`0x${hex.slice(0, 13)}`);
  const national = (n % 8_000_000_000n) + 2_000_000_000n; // 2_000_000_000 … 9_999_999_999
  return `+1${national.toString()}`;
};
