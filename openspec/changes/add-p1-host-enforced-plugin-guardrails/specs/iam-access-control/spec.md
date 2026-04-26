## ADDED Requirements

### Requirement: Host-Enforced Plugin Authorization
The system SHALL evaluate authorization for plugin contributions through host-owned IAM checks and SHALL NOT allow plugins to provide executable authorization decisions.

Plugins MAY declare required fully-qualified actions, UI affordance metadata, and action bindings. Plugins SHALL NOT provide guard functions, permission resolvers, role mapping logic, or executable allow/deny decisions.

#### Scenario: Host evaluates plugin action permission
- **GIVEN** a plugin declares a guarded contribution with required actions
- **WHEN** a user opens or executes that contribution
- **THEN** the host evaluates the required fully-qualified actions before access is granted
- **AND** the plugin receives only the host decision result needed to render or execute the contribution

#### Scenario: Plugin provides executable authorization logic
- **GIVEN** a plugin contribution includes custom authorization code
- **WHEN** the contribution is registered
- **THEN** the host rejects the contribution as an invalid guardrail violation
- **AND** the diagnostics include `plugin_guardrail_authorization_bypass` with plugin namespace and contribution identifier

#### Scenario: Plugin declares action requirements without authorization logic
- **GIVEN** a plugin declares a UI action requiring `news.publish`
- **WHEN** the contribution is registered
- **THEN** the host accepts the declarative action requirement
- **AND** IAM evaluates the action through the host authorization path at use time
