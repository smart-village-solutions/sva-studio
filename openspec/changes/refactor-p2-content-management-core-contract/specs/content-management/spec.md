## ADDED Requirements

### Requirement: Minimal Content Core Contract
The system SHALL define a minimal host-owned content core contract for identity, type, status, ownership scope, validation state, publication state, history references, and audit-relevant metadata.

#### Scenario: Content item uses core fields
- **GIVEN** a content item is created for any registered content type
- **WHEN** the item is persisted
- **THEN** the host stores the required core fields independently from plugin-specific payload fields

#### Scenario: Plugin attempts to redefine core semantics
- **GIVEN** a plugin declares a field or workflow that changes host-owned content status semantics
- **WHEN** the content type is registered
- **THEN** the host rejects the contribution or requires a documented host migration

