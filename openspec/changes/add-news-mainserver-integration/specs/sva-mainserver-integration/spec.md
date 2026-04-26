## ADDED Requirements

### Requirement: Typed News GraphQL Adapters

The system SHALL expose typed, server-only SVA Mainserver adapters for News list, detail, create, update, and delete-or-archive operations.

The adapters SHALL use the existing per-user SVA Mainserver delegation chain and SHALL NOT expose a generic GraphQL executor to browser code, plugin code, or app UI components.

#### Scenario: News list is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and Mainserver credentials
- **WHEN** the News list is requested
- **THEN** the host calls a typed server-side News list adapter in `@sva/sva-mainserver/server`
- **AND** the adapter performs OAuth2 and GraphQL calls through the existing Mainserver service path
- **AND** the browser receives only the mapped News list model

#### Scenario: Plugin attempts generic GraphQL access

- **GIVEN** `@sva/plugin-news` needs News data
- **WHEN** the plugin code is built or reviewed
- **THEN** it does not import `@sva/sva-mainserver/server`
- **AND** it does not receive a raw GraphQL endpoint, token, secret, or generic query executor

### Requirement: News GraphQL Documents Follow Snapshot Contract

The system SHALL derive News GraphQL documents from the checked-in SVA Mainserver schema snapshot and verify schema drift before production rollout.

#### Scenario: News operation uses schema-backed document

- **GIVEN** a News GraphQL operation is added
- **WHEN** the operation is committed
- **THEN** its query or mutation document matches types present in `packages/sva-mainserver/src/generated/schema.snapshot.json`
- **AND** unit tests cover the expected response shape and invalid response handling

#### Scenario: Mainserver schema drifts

- **GIVEN** the Staging Mainserver schema no longer supports a News operation used by Studio
- **WHEN** the schema-diff gate runs
- **THEN** the change is reported before rollout
- **AND** the News adapter is not treated as compatible until the document or mapping is updated

### Requirement: Mainserver News Errors Are Deterministic

The system SHALL map Mainserver News integration failures to deterministic Studio error codes without exposing credentials, tokens, raw payloads, or full upstream responses.

#### Scenario: User credentials are missing

- **GIVEN** the current user has no usable Mainserver application ID or secret in Keycloak
- **WHEN** a News operation is requested
- **THEN** the operation fails with a deterministic missing-credentials error
- **AND** logs contain workspace, operation, request, and trace context without secret values

#### Scenario: GraphQL returns errors

- **GIVEN** the Mainserver GraphQL response contains an `errors` array
- **WHEN** a News adapter handles the response
- **THEN** the adapter returns a deterministic GraphQL error classification
- **AND** the Plugin UI can render an i18n-backed error state

### Requirement: News Mutations Preserve Per-User Delegation

The system SHALL execute News create, update, publish/archive, and delete-or-archive mutations with the current user's Mainserver credentials rather than shared instance credentials.

#### Scenario: User creates News

- **GIVEN** a user has local Studio permission and Mainserver permission to create News
- **WHEN** the user submits a valid News form
- **THEN** the server obtains an access token using that user's Keycloak-stored Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting News item is mapped back to the Plugin News model

#### Scenario: Mainserver denies mutation

- **GIVEN** the user has local Studio permission but the Mainserver denies the delegated mutation
- **WHEN** the mutation response indicates unauthorized or forbidden
- **THEN** Studio surfaces a deterministic authorization error
- **AND** Studio does not retry with shared or elevated credentials
