## ADDED Requirements

### Requirement: Events Plugin Uses Mainserver As Source Of Truth

The Events plugin SHALL use the SVA Mainserver GraphQL API as the source of truth for Event list, detail, create, update, and archive-or-delete operations.

The plugin SHALL keep a specialized Events UI, validation, routes, Studio UI components, and action metadata, but its productive persistence path SHALL be host-owned and Mainserver-backed.

#### Scenario: Events list renders Mainserver data

- **GIVEN** the SVA Mainserver integration is configured for the current instance
- **AND** the user has local permission to read Event content
- **WHEN** the user opens `/plugins/events`
- **THEN** the Events plugin loads items from the host-owned Mainserver-backed data source
- **AND** local IAM content records are not used as the productive Events source

#### Scenario: Event create writes to Mainserver

- **GIVEN** the user has local permission and valid Mainserver credentials
- **WHEN** the user creates an Event through `/plugins/events/new`
- **THEN** the host writes the Event through a typed Mainserver GraphQL mutation
- **AND** no local IAM content record is created as a parallel productive copy

#### Scenario: Mainserver integration is unavailable for Events

- **GIVEN** the current instance has no valid Mainserver configuration or the integration is disabled
- **WHEN** the user opens the Events plugin
- **THEN** the UI shows a deterministic configuration or integration-disabled state
- **AND** the UI does not silently fall back to local IAM content writes

### Requirement: POI Plugin Uses Mainserver As Source Of Truth

The POI plugin SHALL use the SVA Mainserver GraphQL API as the source of truth for Point-of-Interest list, detail, create, update, and archive-or-delete operations.

The plugin SHALL keep a specialized POI UI, validation, routes, Studio UI components, and action metadata, but its productive persistence path SHALL be host-owned and Mainserver-backed.

#### Scenario: POI list renders Mainserver data

- **GIVEN** the SVA Mainserver integration is configured for the current instance
- **AND** the user has local permission to read POI content
- **WHEN** the user opens `/plugins/poi`
- **THEN** the POI plugin loads items from the host-owned Mainserver-backed data source
- **AND** local IAM content records are not used as the productive POI source

#### Scenario: POI create writes to Mainserver

- **GIVEN** the user has local permission and valid Mainserver credentials
- **WHEN** the user creates a POI through `/plugins/poi/new`
- **THEN** the host writes the POI through a typed Mainserver GraphQL mutation
- **AND** no local IAM content record is created as a parallel productive copy

#### Scenario: Mainserver integration is unavailable for POI

- **GIVEN** the current instance has no valid Mainserver configuration or the integration is disabled
- **WHEN** the user opens the POI plugin
- **THEN** the UI shows a deterministic configuration or integration-disabled state
- **AND** the UI does not silently fall back to local IAM content writes

### Requirement: Events And POI Use Host-Owned Data Boundaries

Events and POI plugins SHALL receive Mainserver-backed data through host-owned HTTP or injected data-source contracts that preserve plugin package boundaries.

`@sva/plugin-events` and `@sva/plugin-poi` SHALL NOT import App modules, Auth-Runtime server modules, or `@sva/sva-mainserver/server`.

#### Scenario: Events plugin data facade calls host-owned contract

- **GIVEN** `packages/plugin-events` loads or mutates Events data
- **WHEN** the productive Mainserver-backed implementation is active
- **THEN** it calls a host-owned Events data contract instead of `/api/v1/iam/contents`
- **AND** the plugin package keeps only allowed Workspace dependencies such as `@sva/plugin-sdk` and `@sva/studio-ui-react`

#### Scenario: POI plugin data facade calls host-owned contract

- **GIVEN** `packages/plugin-poi` loads or mutates POI data
- **WHEN** the productive Mainserver-backed implementation is active
- **THEN** it calls a host-owned POI data contract instead of `/api/v1/iam/contents`
- **AND** the plugin package keeps only allowed Workspace dependencies such as `@sva/plugin-sdk` and `@sva/studio-ui-react`

#### Scenario: Fachplugin imports server package directly

- **GIVEN** Events or POI plugin code attempts to import `@sva/sva-mainserver/server`, `@sva/auth-runtime/server`, or `apps/sva-studio-react/src/**`
- **WHEN** dependency boundaries are checked
- **THEN** the build, lint, CI, or review gate rejects the import

### Requirement: Events Plugin Model Maps To Mainserver Event Contract

The Events plugin SHALL maintain an explicit mapping between its form/content model and the SVA Mainserver Event GraphQL contract.

The mapping SHALL define title, description, date model, recurrence fields where supported, category, address/location, contacts, URLs, media, organizer, prices, accessibility information, tags, optional POI reference, identifiers, update timestamps, and status/sichtbarkeit where supported by the Mainserver schema.

#### Scenario: Mainserver Event is displayed in plugin model

- **GIVEN** the Mainserver returns an `EventRecord`
- **WHEN** the host maps it for the plugin
- **THEN** the plugin receives an Events editor-compatible model
- **AND** unsupported or missing optional fields are handled deterministically

#### Scenario: User submits invalid Event payload

- **GIVEN** the user submits an Event form value that cannot be mapped to the Mainserver Event contract
- **WHEN** the host validates the mutation input
- **THEN** the mutation is rejected before the GraphQL call
- **AND** the UI receives field-level or operation-level validation errors

#### Scenario: Event status is not natively supported by Mainserver

- **GIVEN** the plugin has a status value beyond Mainserver visibility support
- **WHEN** the Mainserver contract does not expose an equivalent Event workflow state
- **THEN** the host maps, restricts, or rejects that status deterministically
- **AND** the UI and runbook document the supported status behavior for this rollout

### Requirement: POI Plugin Model Maps To Mainserver POI Contract

The POI plugin SHALL maintain an explicit mapping between its form/content model and the SVA Mainserver Point-of-Interest GraphQL contract.

The mapping SHALL define name, description, mobile description, active state, category, address/location, contact, opening hours, operating company, web URLs, media, prices, certificates, accessibility information, tags, payload, identifiers, update timestamps, and status/sichtbarkeit where supported by the Mainserver schema.

#### Scenario: Mainserver POI is displayed in plugin model

- **GIVEN** the Mainserver returns a `PointOfInterest`
- **WHEN** the host maps it for the plugin
- **THEN** the plugin receives a POI editor-compatible model
- **AND** unsupported or missing optional fields are handled deterministically

#### Scenario: User submits invalid POI payload

- **GIVEN** the user submits a POI form value that cannot be mapped to the Mainserver POI contract
- **WHEN** the host validates the mutation input
- **THEN** the mutation is rejected before the GraphQL call
- **AND** the UI receives field-level or operation-level validation errors

#### Scenario: POI visibility and active state diverge

- **GIVEN** the POI form contains both publication visibility and active state
- **WHEN** the host maps the form to the Mainserver contract
- **THEN** `visible` and `active` behavior is documented and tested separately
- **AND** unsupported combinations are rejected or normalized deterministically
