# MCP Staging Data

**Pull a small, referentially complete slice of PostgreSQL into staging — anonymized in memory — without ever showing production rows to the agent.**

Typical use: “reproduce the bug for order 4812” with real-shaped data and no clear emails, names or phones in the model context.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> Status: v0.1 implementation complete locally. npm / MCP Registry publish stays with the maintainer.

---

## Safety in one paragraph

Connections come only from environment variables. The source session is read-only. The target must not be the same host+port+database as the source (`localhost` and `127.0.0.1` count as the same host). Rows are anonymized **in memory** before anything is written. Tools return schemas, plans, counts and verify results — never source row values. Extract refuses unless **every** column in the planned tables has an explicit rule (PII `keep` also needs a `reason`).

## Quick start (local / unpublished)

```bash
cp .env.example .env   # edit URLs + HMAC key
npm ci
npm run build
node dist/server.js
```

Cursor / Claude example (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "staging-data": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-staging-data/dist/server.js"],
      "env": {
        "STAGING_DATA_SOURCE_URL": "postgres://readonly@127.0.0.1:5432/prod_copy",
        "STAGING_DATA_TARGET_URL": "postgres://dev@127.0.0.1:5432/staging",
        "STAGING_DATA_HMAC_KEY": "replace-with-a-long-random-string"
      }
    }
  }
}
```

After publish, prefer `npx -y mcp-staging-data@<version>` with the same `env` block.

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `STAGING_DATA_SOURCE_URL` | yes | Read-only Postgres URL |
| `STAGING_DATA_TARGET_URL` | yes | Writable staging/local URL |
| `STAGING_DATA_HMAC_KEY` | yes | ≥16 chars; deterministic pseudonyms |
| `STAGING_DATA_RULES_PATH` | no | Defaults to `staging-data.rules.json` |

Prefer a Postgres role with `SELECT`-only grants on the source.

## Tools

| Tool | Kind | Returns |
|------|------|---------|
| `inspect_schema` | read | Tables, FKs, PII-flagged columns |
| `set_rules` | write (local file) | Writes/merges `staging-data.rules.json` |
| `plan_subset` | read | Related tables + row counts for a root row |
| `extract` | write (target) | Anonymized subset load; counts only |
| `verify` | read | Whether target PII columns look ruled/masked |

Root rows are selected with `table` + `ids` (primary-key values). Connection strings are never tool arguments.

## Anonymization rules

| Type | Behaviour |
|------|-----------|
| `hash` | HMAC-SHA256 hex (64 chars) |
| `fake_email` | Stable `…@example.test` |
| `fake_name` | Stable `First Last` from a fixed list |
| `fake_phone` | Stable `+1…………` NANP-shaped |
| `null` | Always `NULL` |
| `keep` | Pass-through; on PII columns requires `"reason"` |

Outputs are deterministic for the same HMAC key and input so joins keep working. Changing the key changes all pseudonyms.

Example `staging-data.rules.json`:

```json
{
  "version": 1,
  "columns": {
    "users.id": { "type": "keep" },
    "users.email": { "type": "fake_email" },
    "users.full_name": { "type": "fake_name" },
    "orders.status": { "type": "keep", "reason": "workflow status is not personal data" }
  }
}
```

Every column that will be extracted needs a rule. Free-text (`text` / `citext` / `json` / `jsonb` / `xml`) columns are treated as PII risks by name/type heuristics; false positives are expected.

## Demo (fake data only)

```bash
docker compose -f docker-compose.test.yml up -d
npm run demo
```

Seeds the compose “source” DB from `test/fixtures/`, plans/extracts order `10`, verifies the target, and asserts clear fixture emails/names are gone.

## Threat model

### Assets

- Production row values (PII and business data)
- Connection strings and `STAGING_DATA_HMAC_KEY`
- Agent / MCP client context (must not receive clear source rows)

### Trust boundaries

- Operator machine running the MCP server (trusted to hold env secrets)
- Source Postgres (untrusted content; trusted network only as far as the operator configures)
- Target Postgres (receives anonymized rows)
- MCP client / model (untrusted; must only see schemas, plans, counts, verify status)

### Threats and controls

| Threat | Control |
|--------|---------|
| Agent reads production rows | Tools never return source cell values; tests assert fixture PII absent from tool output |
| Clear data written then masked | Anonymize in memory; only transformed rows are inserted |
| Agent supplies DB credentials | Tool schemas forbid url/dsn/password/secret/key-like fields; URLs from env only |
| Secrets in errors/logs | `src/redact.ts` scrubs URIs, password-like pairs, Postgres `Key (…)=(…)` details; stdio has no `console.*` |
| Target is production | `assertSourceTargetDistinct` (host/port/db; loopback aliases normalized) |
| Writes on source | `SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY` + `default_transaction_read_only` |
| Unruled / new columns copied clear | Extract refuses unless every planned column has a rule |
| Reversible pseudonyms | HMAC keyed by local secret; without the key, values are not designed to be reversed |
| Prompt injection via DB content | Agent never sees row payloads from source; still do not paste target dumps into prompts carelessly |

### Out of scope (v0.1)

- Stopping a malicious operator with valid env credentials
- Perfect PII detection (heuristics + verify reduce risk; free-text can hide PII)
- Multi-hop identity resolution across DNS aliases for the same physical DB
- MySQL / synthetic generation / full-DB copy

### Residual risk

Heuristic PII detection can miss columns. `verify` reduces but does not eliminate risk. Keep source credentials minimal, review `staging-data.rules.json` in PRs, and rotate `STAGING_DATA_HMAC_KEY` if it leaks (expect all pseudonyms to change).

## Development

```bash
npm run check
npm run check:rules
npm test
npm run build
docker compose -f docker-compose.test.yml up -d
npm run test:integration
```

Node ≥ 22.18. Runtime dependencies: `@modelcontextprotocol/sdk`, `zod`, `pg` only.

## Marketplace

Plugin manifests ready to copy after npm publish live under [`docs/marketplace-plugin/`](docs/marketplace-plugin/). Do not pin an unpublished version in `mcp-marketplace` (pin check talks to npm).

## License

MIT
