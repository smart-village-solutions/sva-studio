## MODIFIED Requirements

### Requirement: Host-Enforced Plugin Authorization

The system SHALL evaluate authorization for plugin contributions through host-owned IAM checks and SHALL NOT allow plugins to provide executable authorization decisions.

This requirement applies equally to plugin routes, admin resource actions, server-side request handlers, job handlers, import flows, and integration entry-points.

#### Scenario: Host evaluates plugin route permission
- **GIVEN** a plugin declares a guarded route contribution
- **WHEN** the host materializes or executes the route
- **THEN** the host evaluates the permission through the central IAM contract
- **AND** the plugin receives only the decision result needed to render or continue execution

#### Scenario: Host evaluates plugin job permission
- **GIVEN** a plugin declares a job or import operation that requires a permission
- **WHEN** a user starts the operation through a host endpoint
- **THEN** the host resolves authorization before the plugin handler runs
- **AND** the plugin handler does not evaluate or override the final IAM decision itself

#### Scenario: Plugin attempts custom authorization code path
- **GIVEN** a plugin contribution includes executable authorization logic outside the host contract
- **WHEN** the host validates or reviews the contribution
- **THEN** the integration is rejected or documented as an architecture violation
- **AND** the diagnostics include `plugin_guardrail_authorization_bypass` with plugin namespace and contribution identifier
