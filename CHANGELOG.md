# Changelog

## Unreleased

### Added

- Project scaffold: TypeScript strict ESM package, stdio MCP server, version from `package.json`, `check` / `check:rules` / `test` / `build` / `test:integration` scripts.
- Pure subset planner (FK graph, cycle-safe walk, row cap) and PII name/type detector.
- Deterministic HMAC anonymization rules: `hash`, `fake_name`, `fake_email`, `fake_phone`, `null`, `keep`.
- Database layer: read-only source sessions, source≠target guard (localhost ≡ 127.0.0.1), catalog loader, FK-safe target writer, docker-compose test harness with fake fixtures.
- MCP tools: `inspect_schema`, `set_rules`, `plan_subset`, `extract`, `verify` with fail-closed PII coverage.
- Safety tests: no source PII or connection strings in tool output; extract refuses unruled PII and same source/target; verify catches unmasked columns.
- Release prep: README + threat model, demo script, security review notes, marketplace plugin draft (copy after npm publish).
- Fail-closed hardening: every planned column needs a rule; redact Postgres `Key (…)=(…)` details; structuredContent redaction.
- Stronger README / npm / marketplace discovery copy (subset, anonymization, GDPR, agent-safe staging).
