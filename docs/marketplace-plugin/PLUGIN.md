# MCP Staging Data

This plugin adds **MCP Staging Data** to Claude Code: GDPR-minded PostgreSQL subset + in-memory PII anonymization for AI agents. Pull a referentially complete slice into staging; the agent gets schemas, plans, counts and verify results — never clear production rows.

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
