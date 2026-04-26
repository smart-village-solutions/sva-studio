## ADDED Requirements

### Requirement: Content Actions Declare Capabilities
The system SHALL require mutating content actions to declare their domain capability so that UI availability, API authorization, diagnostics, and audit classification use the same mapping.

Read-only navigation MAY continue to use existing read permissions directly. Any action that creates, updates, deletes, publishes, archives, restores, bulk-edits, or changes review state SHALL declare a supported capability.

#### Scenario: Content action declares capability
- **GIVEN** a content action declares a supported domain capability
- **WHEN** the action is rendered or executed
- **THEN** the host uses the mapped primitive action for availability and authorization
- **AND** the action metadata exposes enough information for audit classification without allowing plugin-owned audit emission

#### Scenario: Content action omits capability
- **GIVEN** a mutating content action has no declared capability
- **WHEN** the content type is registered
- **THEN** the host rejects the action declaration with `capability_mapping_missing`
- **AND** the action is not published in the registry snapshot

#### Scenario: Content action declares unsupported capability
- **GIVEN** a content action declares a capability that is not supported by the host mapping
- **WHEN** the content phase validates plugin or core content contributions
- **THEN** validation fails before admin UI materialization
- **AND** the diagnostic includes the content type, action identifier, declared capability, and owning namespace when available

#### Scenario: Bulk action applies one mapping consistently
- **GIVEN** a user triggers a bulk content action for multiple content items
- **WHEN** the host evaluates the action
- **THEN** the same declared domain capability is resolved once per authorization context
- **AND** every affected item remains within the authorized scope before the bulk mutation is executed
