const URI_LIKE =
  /(?:postgres(?:ql)?|postgresql):\/\/[^\s"'\\]+|\/\/[^\s"'\\]*:[^\s"'\\]*@[^\s"'\\]+/gi;
const KEY_VALUE_SECRET =
  /((?:password|passwd|secret|hmac[_-]?key|api[_-]?key)\s*[=:]\s*)([^\s"',;]+)/gi;

/**
 * Scrub connection strings and obvious secrets from messages before they leave a tool.
 */
export function redact(message: string): string {
  return message
    .replace(URI_LIKE, '[REDACTED_URI]')
    .replace(KEY_VALUE_SECRET, '$1[REDACTED]');
}

export function redactError(error: unknown): Error {
  if (error instanceof Error) {
    const scrubbed = new Error(redact(error.message));
    scrubbed.name = error.name;
    return scrubbed;
  }
  return new Error(redact(String(error)));
}
