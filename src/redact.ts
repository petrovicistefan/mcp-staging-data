const URI_LIKE =
  /(?:postgres(?:ql)?|postgresql):\/\/[^\s"'\\]+|\/\/[^\s"'\\]*:[^\s"'\\]*@[^\s"'\\]+/gi;
const KEY_VALUE_SECRET =
  /((?:password|passwd|secret|hmac[_-]?key|api[_-]?key)\s*[=:]\s*)([^\s"',;]+)/gi;
/** Postgres DETAIL / CONSTRAINT payloads that embed cell values. */
const PG_KEY_DETAIL = /Key\s*\(([^)]+)\)=\(([^)]*)\)/gi;

/**
 * Scrub connection strings, secrets and Postgres value payloads from messages
 * before they leave a tool.
 */
export function redact(message: string): string {
  return message
    .replace(URI_LIKE, '[REDACTED_URI]')
    .replace(KEY_VALUE_SECRET, '$1[REDACTED]')
    .replace(PG_KEY_DETAIL, 'Key ($1)=([REDACTED_VALUE])');
}

export function redactError(error: unknown): Error {
  if (error instanceof Error) {
    const scrubbed = new Error(redact(error.message));
    scrubbed.name = error.name;
    return scrubbed;
  }
  return new Error(redact(String(error)));
}

/** Deep-redact string leaves in a JSON-compatible value (for structuredContent). */
export function redactStructured<T>(value: T): T {
  return JSON.parse(redact(JSON.stringify(value))) as T;
}
