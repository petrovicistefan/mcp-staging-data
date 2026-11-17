# Security review (v0.1)

Date: 2026-11-18. Branch reviewed: `feat/m6-release-prep` (includes M1–M5 plus release-prep fixes).

Automated agent review plus maintainer follow-up. Publishing still requires Stefan’s sign-off.

## Findings and disposition

| Severity | Finding | Disposition |
|----------|---------|-------------|
| High | Unruled columns copied clear (`if (!rule) return value`) | **Fixed.** Coverage now requires a rule for every planned column; extract throws if a rule is missing at apply time. Regression in `coverage.test.ts`. |
| High | Postgres `DETAIL: Key (…)=(…)` could leak cell values through `fail()` | **Fixed.** `redact` strips `Key (cols)=(vals)`. Regression in `redact.test.ts`. |
| Medium | `varchar` mentioned but not flagged as free-text | **Clarified.** Only unconstrained free-text types (`text`, `citext`, `json`, `jsonb`, `xml`) are auto-flagged; every column still needs an explicit rule before extract. |
| Medium | `ok()` redacted text but not `structuredContent` | **Fixed.** `redactStructured` applied to structured payloads. |
| Medium | `verify` interpolated identifiers without validation | **Fixed.** Uses `quoteIdent`. |
| Medium | `verify` skipped `fake_name` shape checks | **Fixed.** Rejects values that look like emails/phones or non `First Last`. |
| Medium | Source≠target host alias bypass beyond loopback | **Accepted residual risk** for v0.1; documented in README threat model. |

## Controls verified by tests

- Read-only source (INSERT fails)
- `localhost` vs `127.0.0.1` same DB refused
- Extract refuses empty rules / unruled columns
- Verify fails on clear email under `fake_email`
- Tool output lacks fixture PII and connection strings
- `check:rules` blocks connection-like tool fields and stdio `console.*`

## Still open for Stefan

- External/manual review before first public release
- npm + MCP Registry publish
- Marketplace pin after the package exists on npm
