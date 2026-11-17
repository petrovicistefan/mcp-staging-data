# Marketplace plugin (copy after npm publish)

1. Publish `mcp-staging-data@0.1.0` (or the current version) to npm.
2. Copy this folder to `mcp-marketplace/plugins/staging-data/`.
3. Set the `.mcp.json` pin to the published `package@version`.
4. Add an entry to `mcp-marketplace/.claude-plugin/marketplace.json`.
5. Run `npm run check:rules` in `mcp-marketplace` (must match `npm view`).

Until publish, keep these files here so the pin check in the marketplace repo stays green.
