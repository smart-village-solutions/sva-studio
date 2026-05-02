## ADDED Requirements

### Requirement: Standard Content Plugins Use A Shared CRUD Registration Path
The system SHALL treat CRUD-style content plugins as standard plugins that register their productive list, detail, and editor UI through the shared host-owned admin resource path.

Standard plugins SHALL use canonical host routes, host-owned guard evaluation, host-owned save and mutation dispatch, and host-owned global page actions.

#### Scenario: Standard content plugin registers admin resource
- **GIVEN** a content plugin exposes a normal CRUD workflow
- **WHEN** it is integrated productively into the Studio host
- **THEN** it registers through the shared admin resource path instead of relying on plugin-local top-level CRUD routes
- **AND** the host owns the canonical route tree for list, create, and detail

#### Scenario: Standard plugin tries to keep plugin-local CRUD route as productive path
- **GIVEN** a CRUD-style content plugin also declares free plugin routes for the same productive list, create, or detail workflow
- **WHEN** the shared content plugin contract is validated
- **THEN** the host rejects or flags that setup as an invalid bypass of the standard path
- **AND** the plugin must move the productive CRUD path to the shared host-owned resource contract

### Requirement: Registered Content View Bindings
The system SHALL allow standard content plugins to provide specialized content list, detail, and editor bindings only through an explicit content UI registration contract while preserving host-owned content core semantics.

The registration contract SHALL identify the affected admin resource or `contentType`, the binding kind (`list`, `detail`, or `editor`), and the React binding component or host-approved binding reference used for materialization.

#### Scenario: Package registers specialized editor binding
- **GIVEN** a package registers a specialized editor binding for its namespaced content type
- **WHEN** the host validates and publishes the content registry snapshot
- **THEN** the binding is attached to that content type through the content UI registration contract
- **AND** host-owned validation, permissions, persistence, and save behavior remain unchanged

#### Scenario: Package registers unsupported binding kind
- **GIVEN** a package attempts to register a binding outside the supported kinds `list`, `detail`, or `editor`
- **WHEN** the contract is validated
- **THEN** the registration is rejected with deterministic diagnostics

#### Scenario: Package replaces host-owned content core behavior
- **GIVEN** a package binding attempts to replace host-owned status, publication, history, or persistence behavior
- **WHEN** the UI contribution is validated
- **THEN** the host rejects the contribution as outside the specialization boundary

### Requirement: Existing Content Plugins Are The Reference Migration For The Standard Path
The system SHALL use the existing content plugins `@sva/plugin-news`, `@sva/plugin-events`, and `@sva/plugin-poi` as the reference migration set for the specialized content binding contract.

#### Scenario: Existing content plugins register specialized bindings
- **GIVEN** `@sva/plugin-news`, `@sva/plugin-events`, and `@sva/plugin-poi` expose their existing list, detail, or editor pages
- **WHEN** the migration to the new contract is completed
- **THEN** those bindings are registered through the shared host-owned admin resource and content UI registration contract
- **AND** the productive Mainserver-backed data path of each plugin remains unchanged

#### Scenario: Reference migration preserves host-owned responsibilities
- **GIVEN** one of the existing content plugins uses specialized bindings under the new contract
- **WHEN** a user loads, edits, saves, or deletes an item in that plugin
- **THEN** the host continues to own routing, guards, authorization, mutation dispatch, and global page actions
- **AND** the plugin contributes only the specialized binding surface

#### Scenario: Further content plugin reuses the same contract
- **GIVEN** a future content plugin is added after the reference migration
- **WHEN** it needs a specialized list, detail, or editor binding
- **THEN** it uses the same content UI registration contract
- **AND** it does not require a plugin-specific host extension path outside the shared mechanism

### Requirement: Exception Path Remains Available For Non-CRUD Plugin Flows
The system SHALL continue to allow free `plugin.routes` for documented non-CRUD plugin flows that do not fit the shared admin resource model.

#### Scenario: Plugin defines non-CRUD exception route
- **GIVEN** a plugin needs a wizard, dashboard, or another domain-specific workflow that is not a normal list-create-detail CRUD path
- **WHEN** it declares such a route through `plugin.routes`
- **THEN** the route remains allowed as an explicit exception path
- **AND** the exception does not become the productive CRUD path for the plugin's main content administration
