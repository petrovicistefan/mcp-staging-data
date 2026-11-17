# Implementation plan (v0.1)

Scope: PostgreSQL to PostgreSQL. See PRODUCT.md for what this is not.

## Milestones

- [x] 1. **Scaffold** — package.json, tsconfig strict, stdio server, version from package.json, `npm run check | test | check:rules | build`, AGENTS.md.
- [x] 2. **Pure logic (no DB)** — FK graph builder from catalog rows, subset planner (walk from root rows, cycle-safe, row cap), PII column detector by name, rule engine (hash, fake name/email/phone, null, keep), deterministic HMAC. All with unit tests.
- [x] 3. **DB layer** — read-only source session (`SET TRANSACTION READ ONLY`), target writer with FK-safe insert order, source≠target guard. Integration tests against two throwaway Postgres containers (docker compose).
- [x] 4. **Tools** — `inspect_schema`, `set_rules` (writes `staging-data.rules.json` in the repo), `plan_subset`, `extract`, `verify`.
- [x] 5. **Safety tests** — connection strings never in tool output or logs; extract refuses with an unruled PII column; extract refuses when target equals source; verify catches an unmasked column.
- [ ] 6. **Release prep** — README with threat model, server.json, demo on a sample schema, security review, marketplace entry. Publishing stays with Stefan.

## Rules to enforce in `check:rules`

- No tool schema has a connection-string or password field.
- No `console.log` of row data in `src/`.
- Every PII rule type has a test proving output differs from input.

## Manual verification

Drive from Claude Code: seed a fake "production" DB with fake users and orders, ask the agent to reproduce a bug for one order, confirm the target has the related rows and no original emails or names.

## Open (Stefan)

- Pricing for Pro (scheduled refresh, CI checks, shared rules).
- Whether to support MySQL later.
- Final name.
