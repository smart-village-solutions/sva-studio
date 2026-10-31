## 1. Review

- [x] 1.1 Inspect the existing SSF content editor, contract, resolver, override model, and local counsel source.
- [x] 1.2 Prepare the scope, design, acceptance scenarios, and verification requirements.
- [x] 1.3 Obtain approval of the proposed extension before implementation.

## 2. Implementation

- [x] 2.1 Add failing tests for legacy compatibility, separate text groups, missing translations, sanitization, and revisions.
- [x] 2.2 Extend runtime-content schemas and resolution using existing JSON persistence and transactions.
- [x] 2.3 Preserve tenant field inheritance, reset behavior, and stable locale identities for the legal content.
- [x] 2.4 Extend the existing shared editor with legal-text sections, source/draft information, and German/English UI labels.
- [x] 2.5 Add focused editor and authorization tests, including independent source-language editing and no storage-policy changes.
- [x] 2.6 Update the runtime JSON schema/example, content-editor documentation, and relevant arc42 sections.
- [x] 2.7 Run the smallest relevant unit/type checks and required runtime/build checks; record results for the exact change.

## 3. Kassel content and delivery

- [x] 3.1 Prepare the complete German Kassel payload from the local DOCX without adding local mails or source text as public test fixtures.
- [x] 3.2 Compare all paragraphs, choice labels, and status messages against the source and retain the draft/contact caveat.
- [ ] 3.3 Deploy through the established process when authorized and available, preserve the prior content, and import through the administration API.
- [ ] 3.4 Read back the saved texts, verify tenant isolation and unchanged storage policy, and report Studio availability separately from SSF consumer display.


## Verification evidence (31 October 2026)

- Plugin unit suite: 210 tests passed; the 12 PostgreSQL tests were intentionally excluded from this unit run and all passed in the isolated integration target. An additional editor test for missing translations was subsequently added and checked in the focused editor run.
- `pnpm nx run plugin-ssf:test:integration`: 12 tests passed, including legal-content persistence, sanitization, tenant isolation, and rollback of the temporary database schema.
- `pnpm nx run plugin-ssf:test:types` and `pnpm nx run plugin-ssf:build`: passed with their dependency builds.
- Node ESM import of the built `packages/plugin-ssf/dist/server/index.js`: passed.
- Plugin lint: no errors. Existing and test-only non-null-assertion warnings are reported by the repository's warning-level rule.
- JSON Schema 2020-12 validation: public example, legacy response without legal content, and complete private Kassel content accepted. Zod separately validated all URL formats and the complete private source content.
- The actual deployed SSF gateway parser and the local SSF source parser both accepted the extended response. The complete parsed runtime result was identical to the result for the same response without `legalTexts`; existing policy and display content are unchanged. This was a read-only parser invocation, not a production content write.
- Independent code review found no confirmed correctness, security, or data-loss defect. Its request for legacy-consumer compatibility evidence was resolved by the real-parser checks above.
- OpenSpec strict validation, file placement, and plugin UI boundary checks passed. The architecture boundary command reports existing review signals in unrelated plugin paths and `plugin-ssf/src/server.ts` without failing.
- The private Kassel file is prepared under `/root/projects/sva-studio-ssf/legal-texts-20261031/`; 100 source paragraphs, labels, and status messages matched the local DOCX. No private mail text is committed.

## Delivery status

Implementation and local verification are complete. Production deployment and the live Kassel import are pending; no running service, storage policy, or production database was changed. The SSF build workflow currently accepts `main` only, so the feature must be integrated before the established build/rollout path can deliver it. The separate SSF consumer interaction remains outside this approved Studio change.
