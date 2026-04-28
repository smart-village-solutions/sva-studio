## ADDED Requirements

### Requirement: Events And POI Plugin Actions Are Fully Qualified

Events and POI plugins SHALL declare all authorizable actions with fully-qualified action IDs in their own namespaces.

Events action IDs SHALL use the `events.` namespace. POI action IDs SHALL use the `poi.` namespace. Short action IDs SHALL only be accepted as documented legacy aliases where explicitly declared.

#### Scenario: Events action IDs are namespaced

- **WHEN** the Events plugin registers create, edit, update, or delete actions
- **THEN** the action IDs are `events.create`, `events.edit`, `events.update`, and `events.delete`
- **AND** each action declares an explicit required host action such as `content.read`, `content.create`, `content.updatePayload`, or `content.delete`

#### Scenario: POI action IDs are namespaced

- **WHEN** the POI plugin registers create, edit, update, or delete actions
- **THEN** the action IDs are `poi.create`, `poi.edit`, `poi.update`, and `poi.delete`
- **AND** each action declares an explicit required host action such as `content.read`, `content.create`, `content.updatePayload`, or `content.delete`

#### Scenario: Plugin attempts to use another namespace

- **GIVEN** the Events plugin attempts to register `poi.update`
- **WHEN** plugin action guardrails validate the definition
- **THEN** the action is rejected because it is outside the Events namespace
