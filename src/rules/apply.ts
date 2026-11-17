import { fakeEmail } from './email.js';
import { hash } from './hash.js';
import { keep } from './keep.js';
import { fakeName } from './name.js';
import { nullRule } from './null.js';
import { fakePhone } from './phone.js';
import type { ColumnRule, RuleContext, RuleFn, RuleType } from './types.js';

const RULES: Record<RuleType, RuleFn> = {
  hash,
  fake_name: fakeName,
  fake_email: fakeEmail,
  fake_phone: fakePhone,
  null: nullRule,
  keep,
};

export function getRule(type: RuleType): RuleFn {
  const rule = RULES[type];
  if (!rule) throw new Error(`Unknown rule type: ${String(type)}`);
  return rule;
}

export function applyRule(rule: ColumnRule, value: unknown, ctx: RuleContext): unknown {
  return getRule(rule.type)(value, ctx);
}

export { RULES };
