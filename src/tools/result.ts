import { redact, redactError } from '../redact.js';

export type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
};

export function ok(output: Record<string, unknown>): ToolResult {
  const text = redact(JSON.stringify(output));
  return {
    content: [{ type: 'text', text }],
    structuredContent: output,
  };
}

export function fail(error: unknown): ToolResult {
  const scrubbed = redactError(error);
  return {
    isError: true,
    content: [{ type: 'text', text: scrubbed.message }],
  };
}
