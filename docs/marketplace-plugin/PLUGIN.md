# MCP Staging Data

This plugin adds the mcp-staging-data MCP server to Claude Code. It copies a small, referentially complete PostgreSQL subset into a staging database with in-memory anonymization. The agent receives schemas, plans, counts and verify results — not production row values.

## Install (after npm publish)

```
/plugin marketplace add petrovicistefan/mcp-marketplace
/plugin install mcp-staging-data@petrovicistefan-mcp
```

Set `STAGING_DATA_SOURCE_URL`, `STAGING_DATA_TARGET_URL` and `STAGING_DATA_HMAC_KEY` in the MCP server env. Node.js 22.18+ required.

## What data it touches

- **Source Postgres** (read-only session): schema metadata and selected rows, transformed in process
- **Target Postgres**: anonymized inserts only
- **Local file** `staging-data.rules.json`: per-column rules

No telemetry. Connection strings never appear in tool arguments.

## Learn more

See the [project README](https://github.com/petrovicistefan/mcp-staging-data#readme) threat model and tool list.
