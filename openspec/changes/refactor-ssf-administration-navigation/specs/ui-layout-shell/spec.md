## ADDED Requirements

### Requirement: SSF administration preserves the host navigation and unrelated modules

The Studio shell SHALL preserve its Overview, Applications and System sections
while presenting SSF administration through the branded application group.
Tenant navigation MUST offer Overview, Appearance and content, Languages,
Recordings and Feedback. Root navigation MUST offer Installation overview,
Default configuration and Default content. Authorised existing users, roles,
groups, authentication and tenant administration MUST remain at their Studio
locations. Data management MUST disappear only when it has no required entries.
Branding MUST NOT hide required unrelated module navigation.

#### Scenario: SSF-only configuration has no data-management entries

- **WHEN** the current user's authorised modules produce no data-management links
- **THEN** that empty section is absent
- **AND** the Studio homepage remains separate from the SSF overview

#### Scenario: Mixed installation includes media or App editing

- **WHEN** an SSF user has an explicitly assigned and authorised unrelated module
- **THEN** its required navigation remains discoverable with SSF branding
- **AND** SSF navigation changes do not revoke module assignments or permissions

#### Scenario: User enters a child route directly

- **WHEN** an authorised user refreshes a direct SSF page URL
- **THEN** the matching child and application group indicate the active page
- **AND** desktop and mobile navigation support labelled keyboard interaction

### Requirement: SSF pages reuse Studio form and content-language patterns

SSF pages SHALL reuse existing Studio templates, fields, editor controls and
loading/error/action patterns with DE/EN labels and accessible focus behaviour.
Each multilingual group MUST have one labelled language-version selector over
actual entries. Drafts MUST be identified by locale, with stable draft identities
for incomplete editable recording locales. UI locale, content selection and SSF
configured languages MUST remain independent.

#### Scenario: Hidden language has a validation error

- **WHEN** Save finds an invalid field in a language or tab not currently displayed
- **THEN** the error identifies that language/group and exposes the relevant editor
- **AND** all other language and tab drafts remain intact

#### Scenario: Selected locale disappears

- **WHEN** an existing membership action removes the selected localisation
- **THEN** legal wording selects the remaining source locale and other groups select
  their first remaining entry
- **AND** an existing locale missing from the catalogue is still representable

#### Scenario: Staff or installation has one configured locale

- **WHEN** staff content or installation localisation is edited
- **THEN** the configured single locale is shown
- **AND** the editor does not imply multiple authored translations or translate text

### Requirement: SSF editor departures preserve drafts through the existing shared guard

The existing shared editor-leave contract and host boundary SHALL protect SSF
editing pages through a generic route opt-in. Voluntary route/context departures
MUST offer Save, Discard and Stay. Save MUST proceed only after acknowledged
success; failure MUST retain the draft and prevent departure. Forced session or
scope changes MUST suspend the draft and deny writes in the changed context.
Browser unload MUST use native confirmation. No second guard framework or
cross-page draft store SHALL be introduced.

#### Scenario: Save fails while leaving

- **WHEN** a dirty editor's departure Save fails validation, revision or network checks
- **THEN** navigation remains blocked and every page draft is retained
- **AND** the user can correct the error or explicitly choose Discard or Stay

#### Scenario: Context changes with a dirty page

- **WHEN** an organisation or tenant switch is requested
- **THEN** the dirty page is guarded before the context change is committed
- **AND** Stay or failed Save causes no organisation-context mutation, while successful
  Save or Discard permits exactly one requested switch
- **AND** a forced authentication change suspends the page instead of losing its draft
- **AND** resume requires confirmation of the original actor and context

#### Scenario: Browser close or in-page language change

- **WHEN** a user closes a dirty browser page
- **THEN** native unload protection is used
- **AND** switching tabs or content languages within the page does not save, reset or
  trigger a departure dialog
