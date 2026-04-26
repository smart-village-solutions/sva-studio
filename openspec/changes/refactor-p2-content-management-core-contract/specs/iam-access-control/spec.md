## ADDED Requirements

### Requirement: Content Core Authorization Primitives
The system SHALL authorize content core operations through host-owned, fully-qualified primitive actions that remain stable across plugin-specific content types.

The primitive action namespace SHALL be `content`. The initial primitive action set SHALL include `content.read`, `content.create`, `content.updateMetadata`, `content.updatePayload`, `content.changeStatus`, `content.publish`, `content.archive`, `content.restore`, `content.readHistory`, `content.manageRevisions`, and `content.delete`.

Authorization requests for content core operations SHALL include the resolved `instanceId`, `contentType`, optional `contentId`, optional `organizationId`, requested primitive action, actor subject, and any host-known ownership scope. Plugins MAY declare domain capabilities that map to these primitives in separate capability-mapping contracts, but plugins SHALL NOT replace or shadow the primitive action names.

#### Scenario: User edits content core metadata
- **GIVEN** a user requests a core content mutation
- **WHEN** the host evaluates authorization
- **THEN** the decision uses the stable primitive action for that mutation and the resolved content scope
- **AND** the decision is evaluated through the central IAM authorization path

#### Scenario: Plugin declares custom core permission
- **GIVEN** a plugin declares a permission that replaces a host-owned core content permission
- **WHEN** the contribution is validated
- **THEN** the host rejects the conflicting permission declaration

#### Scenario: Payload update uses primitive action
- **GIVEN** a user updates plugin-specific payload fields for a content item
- **WHEN** the host evaluates authorization
- **THEN** the host checks `content.updatePayload` with the resolved content scope
- **AND** plugin-specific field names are not used as primitive IAM actions

#### Scenario: History access is scoped
- **GIVEN** a user requests the history of a content item
- **WHEN** the host evaluates authorization
- **THEN** the host checks `content.readHistory` for the item's `instanceId`, content type, content identifier, and ownership scope

#### Scenario: Authorization lacks resolved content scope
- **GIVEN** a content core mutation cannot resolve `instanceId` or ownership scope deterministically
- **WHEN** the host prepares the authorization request
- **THEN** the operation is denied before persistence
- **AND** diagnostics identify the missing scope input without exposing plugin payload data
