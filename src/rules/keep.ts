import type { RuleFn } from './types.js';

/** Pass-through. Must be set explicitly; refused for PII without a reason at plan/extract time. */
export const keep: RuleFn = value => value;
