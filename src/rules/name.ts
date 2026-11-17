import { hmacForValue } from './hmac.js';
import type { RuleFn } from './types.js';

const FIRST = [
  'Alex',
  'Blake',
  'Casey',
  'Drew',
  'Eden',
  'Finn',
  'Gray',
  'Harper',
  'Indigo',
  'Jordan',
  'Kai',
  'Logan',
  'Morgan',
  'Noah',
  'Parker',
  'Quinn',
];

const LAST = [
  'Adler',
  'Brooks',
  'Chen',
  'Diaz',
  'Evans',
  'Foster',
  'Garcia',
  'Hayes',
  'Ito',
  'Jones',
  'Khan',
  'Lee',
  'Morris',
  'Nguyen',
  'Ortiz',
  'Patel',
];

function pick(list: readonly string[], nibble: number): string {
  const item = list[nibble % list.length];
  if (item === undefined) throw new Error('name list empty');
  return item;
}

/** Deterministic fake personal name. NULL stays NULL. Max length 63. */
export const fakeName: RuleFn = (value, ctx) => {
  if (value === null || value === undefined) return null;
  const hex = hmacForValue(ctx.key, ctx.table, ctx.column, String(value));
  const a = Number.parseInt(hex.slice(0, 2), 16);
  const b = Number.parseInt(hex.slice(2, 4), 16);
  const name = `${pick(FIRST, a)} ${pick(LAST, b)}`;
  return name.slice(0, 63);
};
