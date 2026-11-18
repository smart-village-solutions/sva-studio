## 1. Implementation

- [x] 1.1 Add regression tests for defaults, overrides, reset, strict input and effective revisions.
- [x] 1.2 Extend existing recording policy schemas and tenant diff handling.
- [x] 1.3 Add localized installation and tenant controls with plaintext-file guidance.
- [x] 1.4 Update the runtime schema, administration documentation and arc42 section 08.
- [x] 1.5 Run focused unit, type, runtime and OpenSpec validation checks.

Validation: `pnpm nx run plugin-ssf:test:unit` (283 passed, 15 skipped), `pnpm nx run plugin-ssf:test:types`, `pnpm nx run plugin-ssf:lint`, `pnpm check:server-runtime`, `pnpm check:file-placement`, and strict OpenSpec validation passed. The repository-wide PR and browser suites were not run for this isolated setting change.

Integration on current main preserves the independently saved recording page, its content revision checks, and sparse tenant override projection. The final focused page, policy and translation run passed 47 tests; the complexity gate reported no new findings.
