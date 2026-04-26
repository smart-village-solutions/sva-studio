## ADDED Requirements

### Requirement: Minimal Content Core Contract
The system SHALL define a minimal host-owned content core contract for identity, content type, owner scope, lifecycle status, validation state, publication metadata, history references, revision references, and audit-relevant metadata.

The host-owned core contract SHALL include at least `contentId`, `contentType`, `instanceId`, optional `organizationId`, optional `ownerSubjectId`, `status`, `validationState`, optional `publishedAt`, optional `publishFrom`, optional `publishUntil`, `createdAt`, `createdBy`, `updatedAt`, `updatedBy`, `historyRef`, optional `currentRevisionRef`, and optional `lastAuditEventRef`.

Plugins MAY contribute payload schemas, field definitions, UI bindings, display metadata, and additional validation rules for their namespaced `contentType`. Plugins SHALL NOT redefine required core fields, lifecycle status semantics, owner-scope semantics, history/revision references, or audit metadata.

#### Scenario: Content item uses core fields
- **GIVEN** a content item is created for any registered content type
- **WHEN** the item is persisted
- **THEN** the host stores the required core fields independently from plugin-specific payload fields
- **AND** the persisted item can be loaded, authorized, listed, audited, and linked to history without interpreting the plugin payload

#### Scenario: Plugin attempts to redefine core semantics
- **GIVEN** a plugin declares a field or workflow that changes host-owned content status semantics
- **WHEN** the content type is registered
- **THEN** the host rejects the contribution with deterministic diagnostics
- **AND** a semantic change to the host-owned core contract requires a documented host migration instead of a plugin-local override

#### Scenario: Plugin contributes payload schema
- **GIVEN** a plugin declares a namespaced `contentType` with a payload schema and display metadata
- **WHEN** the host validates the content contribution
- **THEN** the host attaches the payload schema and display metadata below the content core contract
- **AND** the core fields remain typed, required, and owned by the host

#### Scenario: Existing content type is migrated into the contract
- **GIVEN** existing persisted content lacks one of the new host-owned core metadata fields
- **WHEN** the content model migration is applied
- **THEN** the migration populates or derives the missing core metadata deterministically
- **AND** records that cannot be migrated are reported with content identifier, content type, scope, and reason

### Requirement: Host-Owned Content Lifecycle Invariants
The system SHALL keep content lifecycle transitions, publication rules, validation state, history references, and revision references under host control for all content types.

#### Scenario: Status transition is accepted
- **GIVEN** a user requests a supported transition between host-defined content statuses
- **WHEN** validation and authorization succeed
- **THEN** the host applies the transition and updates validation, publication, history, revision, and audit metadata consistently

#### Scenario: Plugin declares unsupported lifecycle transition
- **GIVEN** a plugin declares a lifecycle transition outside the host-owned status model
- **WHEN** the host validates the plugin registry snapshot
- **THEN** the host rejects the contribution with a deterministic lifecycle diagnostics result

#### Scenario: Published content requires publication metadata
- **GIVEN** a content item is moved to a published state
- **WHEN** the host validates the mutation
- **THEN** required publication metadata is present and internally consistent
- **AND** invalid publication windows or missing required metadata reject the mutation before persistence
