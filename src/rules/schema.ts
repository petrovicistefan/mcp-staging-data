import { z } from 'zod';

export const columnRuleSchema = z.object({
  type: z.enum(['hash', 'fake_name', 'fake_email', 'fake_phone', 'null', 'keep']),
  reason: z.string().trim().min(1).max(500).optional(),
});

export const rulesFileSchema = z.object({
  version: z.literal(1),
  columns: z
    .record(
      z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*\.[A-Za-z_][A-Za-z0-9_]*$/),
      columnRuleSchema,
    )
    .default({}),
});

export type RulesFile = z.infer<typeof rulesFileSchema>;
