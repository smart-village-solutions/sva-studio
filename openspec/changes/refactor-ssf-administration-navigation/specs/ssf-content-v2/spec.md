## ADDED Requirements

### Requirement: SSF fields have one page owner per administration scope

SSF administration SHALL reorganise the existing editable fields according to the
following ownership. Each existing field MUST have exactly one editing location per scope. Creating a
new root guest language MUST collect its mandatory initial explanation/feedback
content within the language-creation operation; after saving, those text fields
MUST be editable only under Default content. An existing valid runtime template
MUST be required; absent-template creation is outside this change.
The existing content contracts, validation limits, allowed values, reset actions,
HTML sanitization and read-only access MUST remain binding. Tenant configuration
rights MUST NOT confer recording, reviewer or recovery-custodian rights.

| Scope/page | Owned fields |
| --- | --- |
| Tenant Appearance and content | branding logo/icon URL and alternative text; staff dashboard/load/new-conversation texts; guest explanation HTML |
| Tenant Languages | staff locale; template-constrained guest activation; guest nativeName, staffName and icon |
| Tenant Recordings | recording enablement/settings; retention/reset and technical fields; recording wording; legal source/version/localisations and all five legal groups |
| Tenant Feedback | staff.feedback and guest-language feedback, using only current supported controls |
| Root Default configuration | template staff/guest language membership/metadata; recording behaviour excluding tenant enablement; retention and technical settings |
| Root Default content | installation branding/legal links/localisation/start/login/feedback; template branding/staff/guest texts/recording wording/legal wording/feedback |

#### Scenario: Administrator changes staff language

- **WHEN** a tenant administrator edits staff.locale
- **THEN** the field is edited only on Languages
- **AND** the Appearance and content editor shows the configured locale without a second editor

#### Scenario: Root edits Default content

- **WHEN** a root administrator changes Installation and Tenant template tabs
- **THEN** Save commits both tabs as one page operation or neither
- **AND** template language membership and behaviour remain owned by Default configuration

#### Scenario: Disabled tenant recording is prepared

- **WHEN** an authorised tenant configuration manager edits recording/legal wording
- **THEN** the fields remain editable while recording is disabled
- **AND** recording is enabled only by explicit tenant enablement, never a root default
- **AND** existing retention hours, maximum, reset and template-conflict checks remain

#### Scenario: Feedback contains a supported but uneditable question

- **WHEN** an administrator saves changes to a supported visible feedback field
- **THEN** other valid question IDs, types, numeric bounds and unedited form fields survive
- **AND** no question creation, deletion, reordering or analytics is introduced

### Requirement: SSF page saves use atomic administrative revision preconditions

Existing content-v2 administration GET/PUT endpoints SHALL expose saved-state
revisions in X-SSF-Content-Revision and require exact
X-SSF-Expected-Content-Revision preconditions. Revisions MUST represent raw stored
administrative state, including explicit overrides and relevant template, bound to
the current scope and tenant. The revision check, current-state validation,
sanitization, persistence and saved response capture MUST occur under the existing
repository transaction lock. GET data and revision MUST represent one snapshot.
Every supported writer of these aggregates MUST participate. These headers MUST
NOT be used as HTTP representation validators for independently fetched catalogue
data. Effective runtime
configurationRevision MUST remain separate.

Missing preconditions MUST fail with 428; stale revisions MUST fail with 412 and
no mutation. Wildcard/malformed preconditions MUST be rejected without mutation.
Existing 422 configuration/template-conflict responses MUST remain distinguishable.
No new database or domain service SHALL be introduced for page splitting.

#### Scenario: Concurrent editors save the same loaded aggregate

- **GIVEN** two editors loaded the same saved-state token
- **WHEN** the first commits and the second submits its now-stale token
- **THEN** the second receives 412 without overwriting the first write
- **AND** the second draft remains available for explicit reconciliation or discard

#### Scenario: Template changes after a tenant loads

- **WHEN** a tenant saves against an earlier runtime template
- **THEN** the stale token is rejected even if that tenant's overrides did not change
- **AND** validation of an accepted write uses the current transaction-bound template

#### Scenario: Same effective content has distinct override provenance

- **WHEN** a stored explicit override changes but effective runtime output stays equal
- **THEN** the administrative token reflects the raw state change
- **AND** the runtime configurationRevision retains its existing effective-content semantics

#### Scenario: Successful sanitized save response

- **WHEN** an accepted write sanitizes submitted HTML
- **THEN** the response contains that committed sanitized aggregate and matching token
- **AND** the editor restores its baseline from that response, not a post-commit racing reread

### Requirement: Page projections preserve unrelated content and inheritance

Each SSF editing page SHALL own a projection of the current aggregates. Its PUT
payload MUST apply only that page's edits and explicit resets to its loaded raw
state, preserving all unrelated stored fields, valid uneditable fields and
explicit overrides. Save and Discard MUST cover every tab and language on that
page. Failed or stale writes MUST retain drafts and MUST NOT silently retry using
a new token. No cross-page draft store or autosave SHALL be introduced.

#### Scenario: Guest feedback and explanation have different page owners

- **WHEN** Feedback saves a guest feedback text
- **THEN** the guest explanation, metadata, enabled membership and other overrides remain unchanged
- **AND** Appearance can subsequently edit the explanation without replacing feedback

#### Scenario: Reset one field to inheritance

- **WHEN** a tenant resets one branding or text field to the template
- **THEN** only that field's override is removed
- **AND** unrelated explicit overrides, including values equal to the template, survive

#### Scenario: Discard across hidden tabs and languages

- **WHEN** an administrator discards a page with edits in multiple tabs/languages
- **THEN** all those page edits revert to the saved baseline
- **AND** switching between tabs/languages before discarding never reloads or resets them

### Requirement: Language collections retain existing independent semantics

Guest languages, recording-wording entries and legal localisations SHALL remain
independent collections with their existing creation/removal constraints. Legal
wording MUST retain sourceLocale, version and all mode2Consent, mode3Consent,
guestRecordingRelease, staffRecordingRelease and recordingStatus fields. Missing
translations MUST remain missing, never be displayed as authored fallback content.
Tenant guest activation MUST remain template-constrained, with existing staff/guest
exclusion and at-least-one rules.

#### Scenario: Legal source is not a guest language

- **WHEN** the configured legal source locale is excluded from guest languages
- **THEN** legal editing still selects and edits that source locale
- **AND** it does not add the source locale to the guest collection

#### Scenario: Recording wording locale is incomplete or renamed

- **WHEN** a new recording-wording entry has no locale or its locale is being edited
- **THEN** it remains selectable using a stable draft identity
- **AND** reordering or selecting another language cannot attach its draft to another entry

### Requirement: SSF overview is saved configuration rather than operational status

Tenant and root overview pages SHALL derive configuration facts and authorised
editing links from the same saved aggregates as the editors. They MUST distinguish
unconfigured values from read failures with retry. They MUST NOT introduce a new
status store, readiness badges, translation scores or legal/administrative approval.
Recording enablement summaries MUST describe configured enablement only.

#### Scenario: Configuration read fails

- **WHEN** the overview cannot read saved configuration
- **THEN** it shows an error and retry action
- **AND** it does not describe the configuration as empty, healthy or ready

#### Scenario: Unsaved recording change exists

- **WHEN** an editor has changed recording enablement without a successful save
- **THEN** overview values continue to reflect saved configuration
- **AND** they make no archive/key/runtime availability claim

### Requirement: Legacy administration retirement preserves supported consumers and authored values

SSF administration SHALL remove version-selection tabs and legacy editors without
retaining a hidden compatibility editor. Exclusive browser helpers, translations,
handlers and internal consumers MUST be removed or updated together after dependency
review. Runtime endpoint/storage retirement MUST be separately justified by current
supported-consumer evidence. Required disabled conversation-storage compatibility
output MUST remain valid, and its retired controls MUST NOT return.

#### Scenario: Image verification uses a retired browser endpoint

- **WHEN** legacy browser admin handlers are removed
- **THEN** image verification probes the current V2 admin paths with equivalent wrong-scope denial
- **AND** required runtime service contracts remain available

#### Scenario: Legacy-only authored data exists

- **WHEN** retirement discovers authored values absent from the current content model
- **THEN** deletion waits for explicit precedence/mapping and conflict handling
- **AND** any required migration is repeatable and has a documented tested rollback
- **AND** obsolete storage wording is not inferred to be recording consent

#### Scenario: Supported service still requires V1 persistence

- **WHEN** a supported runtime consumer still reads legacy settings/locales
- **THEN** required service endpoints and storage/read helpers remain with a documented consumer/removal condition
- **AND** their old browser editor is still removed

#### Scenario: Supported V1 consumer needs future configuration edits

- **WHEN** a retained V1 service consumer requires changes through administration
- **THEN** its last configuration writer is not removed until that consumer migrates
  or a compatible explicit mapping/projection is proven
- **AND** freezing legacy rows without an intentional consumer decision is insufficient
