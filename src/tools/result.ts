import { redact, redactError, redactStructured } from '../redact.js';

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function ok(output: Record<string, unknown>): ToolResult {
  const scrubbed = redactStructured(output);
  const text = redact(JSON.stringify(scrubbed));
  return {
    content: [{ type: 'text', text }],
    structuredContent: scrubbed,
  };
}

export function fail(error: unknown): ToolResult {
  const scrubbed = redactError(error);
  return {
    isError: true,
    content: [{ type: 'text', text: scrubbed.message }],
  };
}
