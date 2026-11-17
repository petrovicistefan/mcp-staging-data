---
name: add-anonymization-rule
description: Add or change an anonymization rule type (hash, fake email/name/phone, null, keep, date shift...) or PII column detection. Use when touching src/rules/ or src/pii/.
---

# Add an anonymization rule or PII detector

## Rule types (`src/rules/`)

1. A rule is a pure function `(value, ctx: { key, table, column, rowKey }) => value`. No I/O, no randomness: derive everything from `HMAC-SHA256(key, table + "." + column + ":" + value)`.
2. Keep the column's type and constraints valid: emails stay valid emails and unique when the input is unique; lengths fit `varchar(n)`; NULL stays NULL unless the rule is `null`.
3. Required tests per rule in `src/rules/<rule>.test.ts`:
   - output differs from input for a set of fake values;
   - same key + input gives same output; different key gives different output;
   - type validity (format, max length);
   - uniqueness preserved over 10 000 distinct inputs where the rule claims it.
4. `keep` is the only rule that returns the input. It must be set explicitly per column and is refused for PII-flagged columns unless the rules file carries `"reason"`.
5. Register the rule in the zod schema of `staging-data.rules.json` and in README's rule table.

## PII detection (`src/pii/`)

1. Detection is by column name and type first (email, name, phone, address, ip, birth, iban, token, ssn/cnp, free-text `text` columns). Value sampling, if added, reads from the source inside `src/db/` and returns only a boolean per column, never values.
2. False positives are fine; false negatives are bugs. A missed PII column needs a regression test.
3. Any PII-flagged column without a rule must make `extract` refuse (AGENTS.md rule 8). Add a test for each new detector.

Run the gates from `AGENTS.md` before committing.
