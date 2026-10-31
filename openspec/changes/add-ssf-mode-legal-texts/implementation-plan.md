# SSF legal texts implementation plan

**Goal:** Implement the approved design in `design.md` using the existing v2 content path.

**Architecture:** Add optional localized legal content to the existing runtime JSON. Reuse the shared editor, sanitizer, sparse overrides, and canonical content revision. Keep legacy storage behavior unchanged.

**Tech stack:** TypeScript, Zod, React, Vitest, existing SSF JSON persistence.

## 1. Contract and resolution

- [x] Add behavior tests in `packages/plugin-ssf/tests/content-v2-legal.test.ts` for distinct groups, old configurations, missing translations, duplicate locales, stable inheritance, reset, sanitization, and revisions.
- [x] Run `corepack pnpm nx run plugin-ssf:test:unit --testFiles=tests/content-v2-legal.test.ts`; observe rejection of the unimplemented legal block.
- [x] Extend `content-v2-contracts.ts` with an optional `legalTexts` block, complete-or-null groups, source locale validation, and exported inferred types.
- [x] Extend `content-v2-overrides.ts` only where the new optional block needs to be accepted by the existing sparse merger.
- [x] Rerun the legal tests and existing v2 contract/resolution tests.

## 2. Existing editor

- [x] Add editor interaction tests proving independent group edits, German source selection, draft/contact notice, null translation groups, read-only controls, and per-field reset.
- [x] Run the tests before implementation to confirm missing controls.
- [x] Add `admin.content-v2-legal-fields.tsx` as the legal section of the existing shared runtime editor; use existing `SsfV2Field`, `StudioSection`, and locale catalogue controls.
- [x] Add German and English labels to `plugin.translations.ts` and mount the section in `admin.content-v2-runtime-fields.tsx`.
- [x] Rerun editor, contract, admin, and handler tests; run the plugin type target and lint.

## 3. Documentation and Kassel payload

- [x] Extend the existing runtime JSON schema/example and editor/architecture documentation with the approved optional fields and consumer boundary.
- [x] Prepare a private, local Kassel payload from the DOCX, preserving every paragraph and label and the unresolved withdrawal-contact placeholder.
- [x] Compare the generated bodies and labels with source paragraphs; do not commit local mail contents.
- [x] Verify plugin build and focused checks; record evidence and the precise delivery state.
- [ ] Deploy and import only through established authorized routes; if production delivery is unavailable, retain the validated implementation and prepared payload and report the exact remaining step.

## Constraints

- No recording controls, consent ledger, automatic translation, storage-policy change, or new service/table.
- Legal content is not a product default and saving text is not legal approval.
- Existing callers without `legalTexts` continue to work.
- Source text remains German; newly written project documentation is English as instructed by the user.
