# AGENTS.md

Hard rules for anyone (human or AI agent) changing this repo. Read `docs/PRODUCT.md`, `docs/DECISIONS.md` and `docs/PLAN.md` before writing code. This server touches production personal data: the safety rules are the product. Each rule below must be enforced by `npm run check:rules` (`scripts/check-rules.mjs`, built in milestone 1) or by a named test. Do not weaken a check to make a change pass.

## Rules

1. **Version sync.** `package.json` `version` equals `server.json` `version` and every `server.json` `packages[].version`.
2. **One version source.** `serverInfo.version` comes from `package.json` via `src/version.ts`.
3. **No connection strings in tools.** No tool input schema has a field matching `/url|dsn|conn|host|password|secret|key/i`. Connections come only from `STAGING_DATA_SOURCE_URL` and `STAGING_DATA_TARGET_URL` env vars; the HMAC key only from `STAGING_DATA_HMAC_KEY`.
4. **Never return or log secrets.** Connection strings, passwords and the HMAC key never appear in tool results, errors or logs. `src/redact.ts` scrubs every error message before it leaves a tool. Test: `test/redact.test.ts`.
5. **Agent never sees source rows.** No tool returns row values read from the source. Tools return schema, plans, counts and verify results. Test: `test/no-source-rows.test.ts` asserts no fixture PII value appears in any tool output.
6. **Read-only source.** Every source session runs `SET TRANSACTION READ ONLY` (or `default_transaction_read_only = on`). Only `src/db/source.ts` opens source connections. Test proves an INSERT through it fails.
7. **Source ≠ target.** `extract` refuses when host, port and database of source and target match after normalization. Test covers `localhost` vs `127.0.0.1`.
8. **Fail closed.** `extract` refuses if any PII-flagged column has no rule, or any target table column is not covered by the plan. Clear data is never written to the target.
9. **Deterministic pseudonyms.** Rule outputs are HMAC-based and stable for the same key and input; every rule type has a test proving output ≠ input and output stable across runs.
10. **DB access only in `src/db/`.** Only `src/db/` imports `pg`. Pure logic (`src/plan/`, `src/rules/`, `src/pii/`) has no I/O.
11. **No network** besides Postgres connections in `src/db/` and the opt-in hosted path. **No telemetry.**
12. **No logs on stdio.** `src/server.ts` has no `console.*`; elsewhere only constant strings. Never log row data.
13. **Docs in step.** `AGENTS.md`, `docs/PRODUCT.md`, `docs/DECISIONS.md`, `CHANGELOG.md` exist; CHANGELOG has an `Unreleased` or current-version heading.

## Engineering

- TypeScript strict, ESM, Node >= 22.18. Deps: `@modelcontextprotocol/sdk`, `zod`, `pg`. Ask before adding any other runtime dependency (no faker libraries without approval: write small deterministic generators).
- Pure logic in its own file with a `*.test.ts` next to it (node:test + assert/strict).
- Integration tests use two throwaway Postgres containers from `docker-compose.test.yml` and only fake data from `test/fixtures/`. Never point tests at a real database.
- Every bug fix adds a regression test first. Never edit or skip a test to make it pass.
- Code, comments, commits and docs in English.

## Commands

```bash
npm run check          # tsc --noEmit
npm run check:rules
npm test               # unit, no DB
npm run build
npm run test:integration   # needs docker compose -f docker-compose.test.yml up -d
```

All five must pass before every commit. Report the real output, including if Docker was unavailable.

## Git

- One branch per milestone from `docs/PLAN.md`: `feat/m<N>-<slug>`. Small commits. Never commit on `main`.
- Author: `Stefan Petrovici <5754511+petrovicistefan@users.noreply.github.com>`.
- Never push, never force-push, never publish. Those steps are Stefan's.
- Never commit `.env`, `.DS_Store`, `node_modules`, `dist`, keys, or any data that is not fake.

## Do not

- Add features not in `docs/PRODUCT.md` (no MySQL, no synthetic generation, no full-DB copy in v0.1).
- Connect to any database other than the test containers.
