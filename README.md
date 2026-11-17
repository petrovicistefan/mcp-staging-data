<!-- mcp-name: io.github.petrovicistefan/mcp-staging-data -->

# MCP Staging Data

**GDPR-safe PostgreSQL subset + anonymization for AI coding agents (Claude Code, Cursor)** — copy a small, referentially complete slice of production into staging, mask PII in memory, and never show clear production rows to the model.

Reproduce data-dependent bugs (“order 4812”) with real-shaped data: no raw emails, names, or phones in agent context. Local-first MCP server over stdio.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> **Part of the [petrovicistefan MCP suite](https://github.com/petrovicistefan/mcp-marketplace)** — local-first guardrails for AI coding agents.  
> Status: v0.1 complete locally. npm / MCP Registry publish stays with the maintainer.

---

## Why MCP Staging Data?

Teams often dump production Postgres into a laptop to debug one order — and leak PII into git, Slack, and AI chats. Hosted anonymizers and CLI subsetters are not wired for agents. This server is:

| Need | What you get |
|------|----------------|
| **Agent-safe** | Tools return schema, plans, counts, verify status — **never source row values** |
| **GDPR-minded** | Anonymize **in memory** before any target write; fail closed without rules |
| **Referentially complete** | FK walk from a root row (parents + descendants, cycle-safe) |
| **Deterministic** | HMAC pseudonyms so joins keep working across tables |
| **Local-first** | stdio MCP; connections only from env; no telemetry |

### Search / discovery keywords

PostgreSQL staging data, database subset for developers, PII anonymization MCP, GDPR-safe test data, production data masking for AI agents, referentially complete subset, deterministic fake email/name/phone, Claude Code Postgres staging, Cursor MCP database anonymizer.

---

## What it does (and does not)

**Does:** inspect schema + likely PII columns → set per-column rules → plan a subset from a root primary key → extract (read-only source, anonymize, write target) → verify masks on the target.

**Does not:** full DB replication, backup, MySQL (v0.1), synthetic generation, or a general SQL client for production. The agent is not meant to browse clear production rows.

---

## Quick start (local / unpublished)

```bash
cp .env.example .env   # edit URLs + HMAC key
npm ci && npm run build
node dist/server.js
```

### Cursor

Add to `~/.cursor/mcp.json`:

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

### Claude Code

```bash
claude mcp add staging-data --env STAGING_DATA_SOURCE_URL=... --env STAGING_DATA_TARGET_URL=... --env STAGING_DATA_HMAC_KEY=... -- node /absolute/path/to/mcp-staging-data/dist/server.js
```

After publish: `npx -y mcp-staging-data@<version>` with the same `env` block.

---

## Use cases & example prompts

```
Inspect the source schema and list columns that look like PII.
Set fake_email on users.email and fake_name on users.full_name.
Plan a subset for orders where ids=[4812] and show row counts only.
Extract that subset into staging, then verify no clear emails remain.
```

Typical workflows: bug reproduction on one order/user, GDPR-safer local fixtures, CI policy checks on `staging-data.rules.json`, shared deterministic masks via `STAGING_DATA_HMAC_KEY`.

---

## Safety in one paragraph

Connections come only from environment variables. The source session is read-only. The target must not be the same host+port+database as the source (`localhost` ≡ `127.0.0.1`). Rows are anonymized **in memory** before anything is written. Tools never return source cell values. Extract refuses unless **every** column in the planned tables has an explicit rule (PII `keep` also needs a `reason`).

---

## Environment

| Variable | Required | Purpose |
|----------|----------|---------|
| `STAGING_DATA_SOURCE_URL` | yes | Read-only Postgres URL |
| `STAGING_DATA_TARGET_URL` | yes | Writable staging/local URL |
| `STAGING_DATA_HMAC_KEY` | yes | ≥16 chars; deterministic pseudonyms |
| `STAGING_DATA_RULES_PATH` | no | Defaults to `staging-data.rules.json` |

Prefer a Postgres role with `SELECT`-only grants on the source.

---

## Tools

| Tool | Kind | Returns |
|------|------|---------|
| `inspect_schema` | read | Tables, FKs, PII-flagged columns |
| `set_rules` | write (local file) | Writes/merges `staging-data.rules.json` |
| `plan_subset` | read | Related tables + row counts for a root row (`table` + `ids`) |
| `extract` | write (target) | Anonymized subset load; counts only |
| `verify` | read | Whether target PII columns look ruled/masked |

Connection strings are never tool arguments.

---

## Anonymization rules

| Type | Behaviour |
|------|-----------|
| `hash` | HMAC-SHA256 hex (64 chars) |
| `fake_email` | Stable `…@example.test` |
| `fake_name` | Stable `First Last` from a fixed list |
| `fake_phone` | Stable `+1…………` NANP-shaped |
| `null` | Always `NULL` |
| `keep` | Pass-through; on PII columns requires `"reason"` |

Same HMAC key + input ⇒ same output (joins hold). Rotate the key ⇒ all pseudonyms change.

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

Every extracted column needs a rule. Free-text types (`text`, `citext`, `json`, `jsonb`, `xml`) are treated as PII risks by heuristics; false positives are expected.

---

## How it compares

| Approach | Agent-safe (no clear rows) | Referential subset | In-memory anonymize | MCP-native |
|----------|----------------------------|--------------------|---------------------|------------|
| Raw `pg_dump` / copy | ❌ | ❌ (usually full) | ❌ | ❌ |
| CLI subsetters | ❌ (logs/CLI) | ✅ | varies | ❌ |
| Query-result maskers | masks output only | ❌ | n/a | sometimes |
| **MCP Staging Data** | ✅ | ✅ | ✅ | ✅ |

---

## Demo (fake data only)

```bash
docker compose -f docker-compose.test.yml up -d
npm run demo
```

Seeds compose “source” from `test/fixtures/`, plans/extracts order `10`, verifies the target, asserts clear fixture emails/names are gone.

---

## Threat model

### Assets

- Production row values (PII and business data)
- Connection strings and `STAGING_DATA_HMAC_KEY`
- Agent / MCP client context (must not receive clear source rows)

### Trust boundaries

- Operator machine running the MCP server (trusted to hold env secrets)
- Source Postgres (untrusted content; network as configured by the operator)
- Target Postgres (receives anonymized rows)
- MCP client / model (untrusted; schemas, plans, counts, verify only)

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
| Reversible pseudonyms | HMAC keyed by local secret |
| Prompt injection via DB content | Agent never sees source row payloads |

### Out of scope (v0.1)

- Malicious operator with valid env credentials
- Perfect PII detection (heuristics + verify reduce risk)
- DNS-alias identity beyond loopback normalization
- MySQL / synthetic generation / full-DB copy

### Residual risk

Heuristic PII detection can miss columns. Review `staging-data.rules.json` in PRs; rotate `STAGING_DATA_HMAC_KEY` if leaked.

---

## FAQ

**Does the agent see production emails?** No. Tools return metadata and counts; extract writes only anonymized values to the target.

**Is this a backup tool?** No. It copies small subsets (thousands of rows), not whole databases.

**Why HMAC?** Deterministic masks keep FK/join shape stable without shipping a reversible cipher in v0.1.

**Can target equal source?** No. Same host+port+database is refused (`localhost` and `127.0.0.1` match).

---

## Development

```bash
npm run check && npm run check:rules && npm test && npm run build
docker compose -f docker-compose.test.yml up -d
npm run test:integration
```

Node ≥ 22.18. Runtime deps: `@modelcontextprotocol/sdk`, `zod`, `pg` only.

---

## Marketplace

Plugin manifests to copy after npm publish: [`docs/marketplace-plugin/`](docs/marketplace-plugin/). Do not pin an unpublished version in `mcp-marketplace`.

## More MCP servers by the author

See the [petrovicistefan MCP marketplace](https://github.com/petrovicistefan/mcp-marketplace): security-guard, database-doctor, api-guardian, dependency-doctor, cost-optimizer, seo-auditor, and more.

## License

MIT
