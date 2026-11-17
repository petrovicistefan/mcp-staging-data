# Changelog

## Unreleased

### Added

- Project scaffold: TypeScript strict ESM package, stdio MCP server, version from `package.json`, `check` / `check:rules` / `test` / `build` / `test:integration` scripts.
- Pure subset planner (FK graph, cycle-safe walk, row cap) and PII name/type detector.
- Deterministic HMAC anonymization rules: `hash`, `fake_name`, `fake_email`, `fake_phone`, `null`, `keep`.
- Database layer: read-only source sessions, source≠target guard (localhost ≡ 127.0.0.1), catalog loader, FK-safe target writer, docker-compose test harness with fake fixtures.
