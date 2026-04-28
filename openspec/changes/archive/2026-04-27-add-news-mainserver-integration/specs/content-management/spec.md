## ADDED Requirements

### Requirement: News Plugin Uses Mainserver As Source Of Truth

The News plugin SHALL use the SVA Mainserver GraphQL API as the source of truth for News list, detail, create, update, and archive-or-delete operations.

The plugin SHALL keep its specialized News UI, validation, routes, Studio UI components, and action metadata, but its productive persistence path SHALL be host-owned and Mainserver-backed.

#### Scenario: News list renders Mainserver data

- **GIVEN** the SVA Mainserver integration is configured for the current instance
- **AND** the user has local permission to read News content
- **WHEN** the user opens `/plugins/news`
- **THEN** the News plugin loads items from the host-owned Mainserver-backed data source
- **AND** local IAM content records are not used as the productive News source

#### Scenario: News create writes to Mainserver

- **GIVEN** the user has local permission and valid Mainserver credentials
- **WHEN** the user creates a News entry through `/plugins/news/new`
- **THEN** the host writes the News entry through a typed Mainserver GraphQL mutation
- **AND** no local IAM content record is created as a parallel productive copy

#### Scenario: Mainserver integration is unavailable

- **GIVEN** the current instance has no valid Mainserver configuration or the integration is disabled
- **WHEN** the user opens the News plugin
- **THEN** the UI shows a deterministic configuration or integration-disabled state
- **AND** the UI does not silently fall back to local IAM content writes

### Requirement: News Plugin Uses Host-Owned Data Boundary

The News plugin SHALL receive Mainserver-backed data through a host-owned HTTP or injected data-source contract that preserves plugin package boundaries.

`@sva/plugin-news` SHALL NOT import App modules, Auth-Runtime server modules, or `@sva/sva-mainserver/server`.

#### Scenario: Plugin data facade calls host-owned contract

- **GIVEN** `packages/plugin-news/src/news.api.ts` loads or mutates News data
- **WHEN** the productive Mainserver-backed implementation is active
- **THEN** it calls a host-owned News data contract instead of `/api/v1/iam/contents`
- **AND** the plugin package keeps only allowed Workspace dependencies such as `@sva/plugin-sdk` and `@sva/studio-ui-react`

#### Scenario: Plugin imports server package directly

- **GIVEN** plugin code attempts to import `@sva/sva-mainserver/server`, `@sva/auth-runtime/server`, or `apps/sva-studio-react/src/**`
- **WHEN** dependency boundaries are checked
- **THEN** the build, lint, CI, or review gate rejects the import

### Requirement: News Plugin Model Maps To Mainserver News Contract

The News plugin SHALL maintain an explicit mapping between its form/content model and the SVA Mainserver News GraphQL contract.

The mapping SHALL define title, teaser, body, media URL, external URL, category or tags, publication timestamp, identifiers, author/display metadata, update timestamps, and status/sichtbarkeit where supported by the Mainserver schema.

#### Scenario: Mainserver item is displayed in plugin model

- **GIVEN** the Mainserver returns a `NewsItem`
- **WHEN** the host maps it for the plugin
- **THEN** the plugin receives a `NewsContentItem`-compatible model
- **AND** unsupported or missing optional fields are handled deterministically

#### Scenario: User submits invalid mapped payload

- **GIVEN** the user submits a News form value that cannot be mapped to the Mainserver News contract
- **WHEN** the host validates the mutation input
- **THEN** the mutation is rejected before the GraphQL call
- **AND** the UI receives field-level or operation-level validation errors

#### Scenario: Plugin status is not natively supported by Mainserver

- **GIVEN** the plugin has a status value such as `in_review` or `approved`
- **WHEN** the Mainserver contract does not expose an equivalent News workflow state
- **THEN** the host maps, restricts, or rejects that status deterministically
- **AND** the UI and runbook document the supported status behavior for this rollout

### Requirement: Local News Legacy Content Is Explicitly Handled

The system SHALL handle existing local `news.article` or legacy `news` content records through an explicit migration or legacy-read decision before switching the productive News plugin write path to Mainserver-only.

#### Scenario: Legacy content migration is selected

- **GIVEN** existing local News content records must remain available after the Mainserver switch
- **WHEN** the migration path is implemented
- **THEN** it provides a dry-run mode, an operator-readable report, idempotent execution, and deterministic failure records
- **AND** migrated records are not written twice on repeated runs

#### Scenario: Legacy content is not migrated

- **GIVEN** existing local News content records are intentionally not migrated
- **WHEN** the News plugin is switched to Mainserver-backed mode
- **THEN** the behavior is documented
- **AND** the UI or runbook explains that local legacy records are no longer the productive News source

#### Scenario: Dual-write is attempted

- **GIVEN** a News create or update operation succeeds against the Mainserver
- **WHEN** the operation completes
- **THEN** the host does not also write a productive local IAM content copy
- **AND** any optional migration or audit record is clearly separated from the content source of truth
