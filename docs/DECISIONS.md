# Decisions

## ADR-001: This server connects to databases (unlike mcp-database-doctor)

Context: the rest of the suite is offline by design. Subsetting needs a live source and target.
Decision: this server opens database connections, under the hard safety rules in PRODUCT.md. It is a separate product so database-doctor keeps its "no connection" promise.
Consequences: higher security bar: security review before every release, and the threat model lives in this repo.

## ADR-002: The agent never sees raw production rows

Context: the main risk is personal data reaching the model context or logs.
Decision: tools return schemas, plans, counts and verification results only. Row samples, if ever returned, come from the anonymized target.
Consequences: some debugging needs a second step (query the target), which is acceptable.

## ADR-003: Anonymize in memory between source and target

Context: anonymizing a clone after copying leaves a window where clear data sits in the target.
Decision: rows are read from the source in a read-only transaction, transformed in process, then written to the target. Clear data is never written anywhere.
Consequences: transformation runs in Node; throughput is limited, fine for v0.1 subset sizes.

## ADR-004: Deterministic, keyed pseudonyms; fail closed

Decision: HMAC-based deterministic replacement keyed by a local secret from env, so joins hold and values cannot be reversed without the key. Any PII-flagged column without a rule stops extraction.
Consequences: users must keep the key out of the repo; changing the key changes all pseudonyms.

## ADR-005: Same suite conventions

Decision: TypeScript strict, stdio, `@modelcontextprotocol/sdk` + `zod` + `pg`, node:test via tsx, version from package.json, MIT, optional hosted path through `mcp-control-plane`.

## ADR-006: Subset walk expands children only from seeds and descendants

Context: Full referential closure (also walking children of parents pulled for FK integrity) pulls sibling rows — e.g. other orders that share a product — and blows past the "one bug / one order" use case.
Decision: Seeds and their child-descendants expand inbound FKs. Rows included only as parents do not expand their other children. Parents are still always included so the target insert stays FK-valid.
Consequences: Shared dimension rows (products, users) appear in the target, but unrelated fact rows that also reference them do not.
