export type RuleContext = {
  key: string;
  table: string;
  column: string;
  rowKey: string;
};

export type RuleFn = (value: unknown, ctx: RuleContext) => unknown;

export type RuleType = 'hash' | 'fake_name' | 'fake_email' | 'fake_phone' | 'null' | 'keep';

export type ColumnRule = {
  type: RuleType;
  /** Required when type is `keep` on a PII-flagged column. */
  reason?: string;
};
