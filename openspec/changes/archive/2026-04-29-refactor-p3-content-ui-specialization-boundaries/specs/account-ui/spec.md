## ADDED Requirements

### Requirement: Specialized Content Bindings Preserve Host UX Contracts
The system SHALL compose specialized content list, detail, and editor bindings inside host-owned admin layout, loading, empty, error, permission, action, and accessibility contracts.

#### Scenario: Specialized editor binding renders inside host template
- **GIVEN** a registered content type provides a specialized editor binding
- **WHEN** a user opens the editor route for that content type
- **THEN** the host renders the binding inside the standard detail or editor template
- **AND** loading, error, forbidden, validation summary, and action placement remain host-owned

#### Scenario: Specialized binding omits required UX integration
- **GIVEN** a specialized binding does not satisfy required accessibility, action-slot, or state integration expectations
- **WHEN** the binding is registered or materialized
- **THEN** the host rejects the registration or falls back to the standard host view
- **AND** the diagnostics identify the affected content type and binding kind

### Requirement: Standard Content Plugins Follow A Shared Host UX Path
The system SHALL treat normal CRUD-style content plugins as standard plugins that use the shared host UX path through canonical admin resources and host-owned templates.

#### Scenario: Standard content plugin uses specialized list inside host shell
- **GIVEN** a standard content plugin registers a specialized list view for its admin resource
- **WHEN** a user opens the canonical admin list route for that plugin
- **THEN** the host renders the specialized list inside the shared Studio shell
- **AND** breadcrumb, heading, loading, error, permission, and primary action placement remain host-owned

#### Scenario: Standard content plugin uses host fallback
- **GIVEN** a standard content plugin omits one of the optional specialized views
- **WHEN** the corresponding route is rendered
- **THEN** the host falls back to the shared standard implementation for that view kind
- **AND** the plugin remains functional without defining a parallel UI path

### Requirement: Host Fallback Remains Functional Without Specialized Bindings
The system SHALL keep host-owned standard list, detail, and editor views as the canonical fallback for registered content types that do not provide specialized bindings.

#### Scenario: Content type has no specialized list binding
- **GIVEN** a content type is registered without a specialized list binding
- **WHEN** a user opens the corresponding content overview
- **THEN** the host renders the standard content overview instead of failing route materialization
- **AND** authorization, pagination, loading, and empty states continue to work through host-owned components
