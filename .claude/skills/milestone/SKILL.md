---
name: milestone
description: Implement one milestone from docs/PLAN.md end to end (branch, tests first, code, all gates, commit, report). Use when asked to build, continue or finish a milestone, or "the next step" of the plan.
---

# Implement a milestone

1. Read `AGENTS.md`, `docs/PRODUCT.md`, `docs/DECISIONS.md`, `docs/PLAN.md`. Pick the milestone named by the user, or the first one not marked done in `docs/PLAN.md`.
2. Branch from the latest milestone branch (or `docs/initial-plan` for M1): `git checkout -b feat/m<N>-<slug>`.
3. Write the tests first. Pure logic (`src/plan/`, `src/rules/`, `src/pii/`) gets unit tests with no DB. DB behaviour gets integration tests against `docker-compose.test.yml` with fake data only.
4. Implement the smallest code that passes. Stay inside the milestone's scope; anything else goes to the report as a question.
5. For every safety rule the milestone touches (AGENTS.md rules 3–12), make sure its check or named test exists and prove it fails on a deliberate violation, then revert the violation.
6. Run all gates and keep the real output:
   `npm run check && npm run check:rules && npm test && npm run build && npm run test:integration`
   If Docker is not available, say so; never report integration tests as passed.
7. Update `CHANGELOG.md` under `Unreleased`, mark the milestone done in `docs/PLAN.md` (`- [x]`), add an ADR to `docs/DECISIONS.md` for any new decision.
8. Commit in small commits with the author from `AGENTS.md`. Do not push.
9. Report: what was built, gate output per command, what was NOT verified, open questions for Stefan.

Stop and ask instead of guessing when: a new runtime dependency is needed, a safety rule blocks the plan, or the plan conflicts with `docs/PRODUCT.md`.
