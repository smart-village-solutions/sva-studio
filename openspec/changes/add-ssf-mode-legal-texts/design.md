# Design: Separate SSF legal texts in the existing content editor

## Existing path and alternatives

The existing v2 editor already supplies rich-text controls, stable locale identities, tenant overrides, server-side HTML sanitization, and content-derived revisions. Extend that path rather than create a legal-document service.

Replacing the single storage question would mix consent and recording release and cannot represent mode 2. A new generic document subsystem would duplicate the current editor and persistence. Structured content within the existing runtime content is the smallest solution that keeps each purpose explicit.

## Content shape

Add an optional `legalTexts` object to runtime content. Existing configurations without it retain their current behavior. Once configured, the object contains:

- `sourceLocale`: the canonical locale of the source wording, initially `de-DE`.
- `version`: an explicit source-document identifier, initially `2026-09-23-draft`; this is a content identifier, not a claim of legal approval.
- `localizations`: entries keyed by stable `locale`, independent of the active guest-language list.

Each localization provides nullable, separately editable groups:

| Group | Contents |
| --- | --- |
| `mode2Consent` | Heading, full consent HTML, accept label, decline label |
| `mode3Consent` | Heading, full consent HTML, accept label, decline label |
| `guestRecordingRelease` | Heading, full release HTML, release label, refusal label |
| `staffRecordingRelease` | Heading, full release HTML, release label, refusal label |
| `recordingStatus` | Waiting for the other side, recording running, stopped, renewed release required |

An absent translation is represented as missing content, never as a translation of the German source. A non-null group requires all its fields. Duplicate locales and an unknown source locale are rejected. Existing supported-language selection is reused, including its unavailable-catalog and retained-language behavior. German remains editable as a source even when German is the staff language and excluded from the guest-language list.

## Editing and inheritance

Add the section to the existing shared runtime editor, available on the system and tenant pages. Use existing rich-text fields for bodies and plain text fields for headings, choice labels, and statuses. Administrator labels use the existing German and English translation resources.

System administrators define the source, locales, and template. Tenant administrators override individual fields and reset them to the template with the existing actions. Locale arrays retain their stable identity through reordering. An absent legal block is initialized only when the administrator explicitly adds it; ordinary saves of existing content do not invent empty legal content.

Legal content is editorial configuration independent of `conversationContentStorage.mode`. Disabling storage must not discard the wording. Saving legal text must not change storage mode, retention duration, guest languages, or existing consent text.

## API, validation, and persistence

Extend the existing v2 runtime schema additively, retaining `contractVersion=2.0`, the existing endpoint, authorization, response-size limit, and revision algorithm. Existing SSF parsing ignores unknown properties; a compatibility test must confirm the legacy consumer remains valid. Updating the SSF consumer to expose these properties is a separate delivery step.

Reuse existing JSON columns and transaction boundaries. Resolve absent blocks before applying sparse overrides so legal fields can inherit correctly. Validate system-template changes against existing tenant overrides as today. Apply the existing sanitizer to every new `*Html` field on write and resolution. Any effective legal-text change participates in `configurationRevision`.

Do not copy legal text into product defaults. Kassel wording is tenant content. Prepare a Kassel-specific payload from the local source document and apply it only through the existing authorized administration path after the implementation is available; never change production rows directly.

## Source wording

Source: the email titled “Wortlaut Einwilligungen und Aufnahmefreigabe (Modus 2 und Modus 3)” and its attachment `23092026_Stadt Kassel_ Entwurf Wortlaut Einwilligungen und Aufnahmefreigabe.docx`, dated 23 September 2026, in the SSF repository's local mail archive.

Preserve the full wording and lists, including the distinctions between modes, roles, consent, and recording release. Convert formatting to supported HTML without paraphrasing. Preserve `[Kontakt/Widerrufsmöglichkeit]` and clearly identify the source as a draft in the editor; do not invent a contact, retention period, translation, or approval. The supplied source is German only. Source files and local mail contents are not added to the public repository as fixtures.

## Critical invariants and evidence

| Invariant | Required evidence |
| --- | --- |
| Existing installations continue to resolve without legal content | Old runtime fixture, round-trip save, and endpoint contract tests |
| Consent and recording release stay distinct | Independent edits and resolved-field assertions for both modes and roles |
| A text save cannot authorize recording or alter storage | Before/after assertions for existing storage fields and legacy consent text |
| Tenant content cannot cross tenant boundaries | Existing permission tests plus legal-field isolation and reset tests |
| Stored HTML remains safe | Script/event-attribute sanitizer tests on all new HTML paths |
| A legal edit invalidates cached content via revision | Effective edit changes revision; inherited no-op does not |
| Missing translations remain identifiable | Nullable-group validation, locale reorder, and source-language tests |
| Counsel wording survives import and editing | Local paragraph/label comparison with the original DOCX and read-back verification |

## Delivery and rollback

1. Review this proposal and design.
2. Implement schema, resolution, inheritance, editors, tests, and current documentation in the existing plugin.
3. Validate the exact implementation with targeted unit/type/runtime checks and build evidence.
4. Prepare the Kassel import and a before-state backup; follow the established deployment and authorized content-write paths.
5. Verify content read-back separately from consumer adoption. Report exactly which texts are stored and whether SSF displays them.

Before downgrading Studio to a version whose strict schema does not recognize `legalTexts`, restore the saved pre-import JSON content. Do not downgrade first and leave unsupported fields in stored content.
