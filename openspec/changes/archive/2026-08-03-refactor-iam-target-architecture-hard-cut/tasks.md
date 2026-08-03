## 1. Implementation

- [x] 1.1 Move Authorize contracts, engine and performance contracts from `packages/core/src/iam` to `packages/iam-core/src`.
- [x] 1.2 Update `@sva/iam-core` package exports and tests.
- [x] 1.3 Remove Authorize ownership from `@sva/core` exports.
- [x] 1.4 Migrate `auth-runtime`, `iam-admin`, `iam-governance`, app, routing and script imports to `@sva/iam-core`.
- [x] 1.5 Keep Permission Store, Redis snapshots and DB recompute in `auth-runtime` without additional DB or Redis roundtrips.
- [x] 1.6 Update affected arc42 sections or document that no section text changed.
- [x] 1.7 Run targeted unit, type, server-runtime and performance gates: at minimum `pnpm nx run iam-core:test:unit`, `pnpm nx run iam-core:test:types`, affected `auth-runtime` unit/type gates, `pnpm check:server-runtime`, and the existing Authorize performance-contract tests or a documented cache-hit benchmark artifact.
- [x] 1.8 Run Fallow for circular dependencies and re-export cycles on affected IAM paths.
