# Product: MCP Staging Data

Status: idea, not built. Written 2026-11-18.

## What it is

An MCP server that lets an AI coding agent pull a small, referentially complete slice of a production PostgreSQL database, anonymize it, verify the anonymization, and load it into a local or staging database. Typical use: "reproduce this bug with the data of order 4812" without ever showing production personal data to the agent.

## Why

- No existing MCP server does subset + anonymize + verify. The pieces exist separately: seedcoherent (CLI, not MCP), MCP DB Results Anonymizer (masks query output, makes no copy), and product-specific tools inside other apps.
- Reproducing data-dependent bugs is slow and teams often copy raw production data, which is a GDPR risk.

## What it is NOT

- Not a backup or replication tool. It copies small subsets, not whole databases.
- Not a general SQL client for production. The agent never receives raw production rows.
- Not a synthetic data generator (may come later; not in v0.1).
- Not for databases other than PostgreSQL in v0.1.

## Users

Developers who debug against real-shaped data, and teams that must keep production personal data out of dev machines and AI context.

## Tools (v0.1 plan)

| Tool | Kind | Notes |
|------|------|-------|
| `inspect_schema` | read | Tables, foreign keys, and columns flagged as likely PII |
| `set_rules` | write (local config) | Per-column anonymization rules, stored in the repo |
| `plan_subset` | read | Given root rows (e.g. `orders.id = 4812`), shows which related rows would be copied and row counts |
| `extract` | write (target only) | Runs the plan: read-only on source, anonymize in memory, write to target |
| `verify` | read | Fails if any PII-flagged column in the target is unmasked or has no rule |

## Safety rules (hard)

- Source connection is read-only (read-only transaction, and a read-only role recommended in docs).
- Target must not be the same host and database as the source.
- Anonymization is deterministic (same input, same output) so joins keep working.
- A column flagged as PII with no rule stops `extract`. New schema columns are never copied in clear by default.
- Connection strings come only from environment variables, never from tool arguments, and are never logged or returned.

## Pricing

Undecided (Stefan's decision). Suite pattern: local stdio free; Pro for scheduled refreshes, CI policy checks and shared rule sets, through `mcp-control-plane`.

## Known limitations (expected)

- PII detection by column name and sampling is heuristic; `verify` reduces but does not remove the risk.
- Large subsets are slow; v0.1 targets thousands of rows, not millions.
- Free-text columns can contain personal data that rules do not catch.
