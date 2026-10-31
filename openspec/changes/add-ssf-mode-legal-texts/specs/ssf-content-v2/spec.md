## ADDED Requirements

### Requirement: SSF legal text groups remain distinct

The system SHALL manage separate localized content groups for mode 2 consent, mode 3 consent, guest recording release, staff recording release, and recording status messages. Consent and release groups MUST include their full body, heading, and separate affirmative and negative labels. Recording status content MUST include waiting, running, stopped, and renewed-release-required messages.

#### Scenario: Administrator edits mode 2 consent

- **WHEN** an authorized administrator changes the mode 2 consent body
- **THEN** the saved mode 3 consent and both recording releases remain unchanged
- **AND** the resolved runtime configuration identifies each group independently

### Requirement: Legal source and translations are explicit

The system SHALL associate legal content with a source locale, a source-version identifier, and stable localized entries. The source locale MUST remain editable independently of the offered guest languages. Missing translations MUST remain distinguishable from supplied translations. A configured group MUST contain all required fields, and duplicate locale entries MUST be rejected.

#### Scenario: German is the staff language

- **GIVEN** German is excluded from the offered guest languages because it is the staff language
- **WHEN** an administrator configures the German source wording
- **THEN** the editor permits saving the German legal-text localization
- **AND** it does not add German to the guest-language list

#### Scenario: Translation is not supplied

- **WHEN** a legal-text localization lacks a translated group
- **THEN** the group is represented as missing
- **AND** German text is not silently represented as that translation

### Requirement: Legal text editing reuses tenant content controls

The system SHALL manage legal content in the existing system-template and tenant-content editors with their current permissions, rich-text controls, field inheritance, server-side HTML sanitization, and revision calculation. Legal content MUST use existing runtime JSON persistence and MUST NOT require a separate service or table.

#### Scenario: Tenant resets one legal field

- **GIVEN** a tenant overrides a recording-release body
- **WHEN** the administrator resets that field to the system template
- **THEN** the effective body follows the current template
- **AND** other tenant overrides remain unchanged

#### Scenario: Legal content contains executable markup

- **WHEN** an authorized administrator saves a legal body containing a script or event-handler attribute
- **THEN** the stored and resolved body is sanitized by the existing SSF HTML policy

#### Scenario: Effective legal wording changes

- **WHEN** an effective legal-text field changes
- **THEN** the runtime configuration revision changes
- **AND** an inherited no-op does not change the revision

### Requirement: Legal content is backward-compatible editorial data

The system SHALL expose the structured legal content as an optional addition to its existing v2 runtime content response. Existing configurations without the addition MUST remain valid and preserve their behavior. Legal-content writes MUST NOT modify storage mode, retention, the legacy storage question, or recording authorization. Legal content MUST survive storage being disabled.

#### Scenario: Existing content is saved without new legal texts

- **GIVEN** a valid runtime template without legal content
- **WHEN** an administrator updates an existing unrelated text
- **THEN** it remains a valid configuration
- **AND** legal content is not invented or made mandatory

#### Scenario: Storage is disabled after legal texts are configured

- **WHEN** an administrator disables conversation storage
- **THEN** the configured legal texts remain stored and editable
- **AND** the existing disabled-storage policy continues to apply

#### Scenario: Existing SSF consumer receives the extended response

- **WHEN** a v2 consumer that ignores unknown content properties receives structured legal content
- **THEN** the existing policy and display-content parsing remain valid
- **AND** no new recording behavior is enabled by the additional text

### Requirement: Kassel source wording is imported faithfully

The Kassel import SHALL preserve the complete supplied German wording, headings, lists, choice labels, and status messages from counsel's document dated 23 September 2026. The editor MUST identify its draft source and unresolved contact placeholder. The import MUST NOT invent legal approval, translations, retention periods, or a withdrawal contact.

#### Scenario: Source contains an unresolved withdrawal contact

- **GIVEN** the source contains `[Kontakt/Widerrufsmöglichkeit]`
- **WHEN** the German source text is prepared and saved for Kassel
- **THEN** the placeholder remains visible and the source is identified as a draft
- **AND** saving the wording is not treated as production approval or recording consent
