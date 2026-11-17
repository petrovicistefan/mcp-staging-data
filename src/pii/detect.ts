export type ColumnMeta = {
  table: string;
  name: string;
  dataType: string;
  /** PostgreSQL udt_name or simplified type, lowercased by caller when possible. */
  udtName?: string;
};

export type PiiFlag = {
  table: string;
  column: string;
  reason: string;
};

const NAME_PATTERNS: Array<{ re: RegExp; reason: string }> = [
  { re: /e_?mail|email_?address/i, reason: 'column name looks like email' },
  {
    re: /(^|_)(first_?name|last_?name|full_?name|display_?name|surname|given_?name)(_|$)/i,
    reason: 'column name looks like a personal name',
  },
  { re: /(^|_)(phone|mobile|cell|tel|telephone)(_|$)/i, reason: 'column name looks like a phone number' },
  { re: /(^|_)(address|street|city|postal|zip|postcode|country)(_|$)/i, reason: 'column name looks like an address' },
  { re: /(^|_)(ip|ip_?address|ipv4|ipv6)(_|$)/i, reason: 'column name looks like an IP address' },
  { re: /(^|_)(birth|dob|date_?of_?birth|birthday)(_|$)/i, reason: 'column name looks like a birth date' },
  { re: /(^|_)(iban|account_?number|bank)(_|$)/i, reason: 'column name looks like a bank identifier' },
  { re: /(^|_)(ssn|cnp|national_?id|tax_?id|passport)(_|$)/i, reason: 'column name looks like a national id' },
  { re: /(^|_)(token|api_?key|secret|password|passwd|pwd)(_|$)/i, reason: 'column name looks like a secret or token' },
];

/** Unconstrained free-text types (false positives OK; false negatives are bugs). */
const FREE_TEXT_TYPES = new Set(['text', 'citext', 'json', 'jsonb', 'xml']);

/**
 * Heuristic PII detection by column name and type.
 * False positives are acceptable; false negatives are bugs.
 * Bounded varchar is not auto-flagged; extract still requires an explicit rule per column.
 */
export function detectPiiColumns(columns: ColumnMeta[]): PiiFlag[] {
  const flags: PiiFlag[] = [];
  const seen = new Set<string>();

  for (const col of columns) {
    const key = `${col.table}.${col.name}`;
    for (const { re, reason } of NAME_PATTERNS) {
      if (re.test(col.name)) {
        if (!seen.has(key)) {
          seen.add(key);
          flags.push({ table: col.table, column: col.name, reason });
        }
        break;
      }
    }
    const type = (col.udtName ?? col.dataType).toLowerCase();
    if (FREE_TEXT_TYPES.has(type) && !seen.has(key)) {
      seen.add(key);
      flags.push({
        table: col.table,
        column: col.name,
        reason: 'free-text column may contain personal data',
      });
    }
  }

  return flags;
}

export function isPiiColumn(columns: ColumnMeta[], table: string, column: string): boolean {
  return detectPiiColumns(columns).some(f => f.table === table && f.column === column);
}
