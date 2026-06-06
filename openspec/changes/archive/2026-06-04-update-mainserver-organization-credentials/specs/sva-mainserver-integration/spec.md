## RENAMED Requirements

- FROM: `### Requirement: News Mutations Preserve Per-User Delegation`
- TO: `### Requirement: News Mutations Preserve Policy-Driven Mainserver Delegation`

- FROM: `### Requirement: Event And POI Mutations Preserve Per-User Delegation`
- TO: `### Requirement: Event And POI Mutations Preserve Policy-Driven Mainserver Delegation`

## MODIFIED Requirements

### Requirement: Typed News GraphQL Adapters

The system SHALL expose typed, server-only SVA Mainserver adapters for News list, detail, create, update, and archive-or-delete operations.

The adapters SHALL use the policy-driven SVA Mainserver credential resolution chain defined by the effective organization context and SHALL NOT expose a generic GraphQL executor to browser code, plugin code, or app UI components.

#### Scenario: News list is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and effective Mainserver credentials
- **WHEN** the News list is requested
- **THEN** the host calls a typed server-side News list adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `newsItems` GraphQL query through the existing Mainserver service path
- **AND** the browser receives only the mapped plugin News list model

#### Scenario: News detail is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and effective Mainserver credentials
- **WHEN** a single News item is requested
- **THEN** the host calls a typed server-side News detail adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `newsItem(id: ID!)` GraphQL query with typed variables
- **AND** missing or invalid response data is mapped to a deterministic integration error

#### Scenario: Plugin attempts generic GraphQL access

- **GIVEN** `@sva/plugin-news` needs News data
- **WHEN** the plugin code is built or reviewed
- **THEN** it does not import `@sva/sva-mainserver/server`
- **AND** it does not receive a raw GraphQL endpoint, token, secret, or generic query executor

### Requirement: Mainserver News Errors Are Deterministic

The system SHALL map Mainserver News integration failures to deterministic Studio error codes without exposing credentials, tokens, raw payloads, or full upstream responses.

#### Scenario: Org-scoped credentials are missing for `org_only`

- **GIVEN** the effective organization-scoped `org_only` credential path applies to a News operation
- **WHEN** the active organization has no complete Mainserver credentials
- **THEN** the operation fails with the deterministic error `organization_mainserver_credentials_missing`
- **AND** logs contain workspace, operation, request, and trace context without secret values

#### Scenario: Effective credentials are missing after org-or-personal fallback

- **GIVEN** a News operation resolves credentials through `org_or_personal`
- **WHEN** neither the active organization nor the current user's Keycloak-backed credentials provide a complete credential set
- **THEN** the operation fails with the deterministic error `missing_credentials`
- **AND** logs contain workspace, operation, request, and trace context without secret values

#### Scenario: GraphQL returns errors

- **GIVEN** the Mainserver GraphQL response contains an `errors` array
- **WHEN** a News adapter handles the response
- **THEN** the adapter returns a deterministic GraphQL error classification
- **AND** the Plugin UI can render an i18n-backed error state

### Requirement: News Mutations Preserve Policy-Driven Mainserver Delegation

The system SHALL execute News create, update, archive, and delete mutations with the effective Mainserver credentials resolved for the active organization context. For `org_only`, the mutation path uses only the active organization's credentials. For `org_or_personal`, the mutation path prefers the active organization's credentials and falls back to the current user's Keycloak-backed credentials only when the organization has no complete credential set.

#### Scenario: News mutation uses organization credentials for `org_only`

- **GIVEN** a user has local Studio permission and the active organization's `contentAuthorPolicy` is `org_only`
- **WHEN** the user submits a valid News mutation
- **THEN** the server obtains an access token using the active organization's Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting News item is mapped back to the Plugin News model

#### Scenario: News mutation falls back to user credentials for `org_or_personal`

- **GIVEN** a user has local Studio permission and the active organization's `contentAuthorPolicy` is `org_or_personal`
- **AND** the active organization has no complete Mainserver credentials
- **WHEN** the user submits a valid News mutation
- **THEN** the server obtains an access token using the current user's Keycloak-backed Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting News item is mapped back to the Plugin News model

#### Scenario: Mainserver denies mutation

- **GIVEN** the user has local Studio permission but the Mainserver denies the delegated mutation
- **WHEN** the mutation response indicates unauthorized or forbidden
- **THEN** Studio surfaces a deterministic authorization error
- **AND** Studio does not retry with shared or elevated credentials

### Requirement: Typed Event GraphQL Adapters

The system SHALL expose typed, server-only SVA Mainserver adapters for Event list, detail, create, update, and archive-or-delete operations.

The adapters SHALL use the policy-driven SVA Mainserver credential resolution chain defined by the effective organization context and SHALL NOT expose a generic GraphQL executor to browser code, plugin code, or app UI components.

#### Scenario: Event list is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and effective Mainserver credentials
- **WHEN** the Events list is requested
- **THEN** the host calls a typed server-side Event list adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `eventRecords` GraphQL query through the existing Mainserver service path
- **AND** the browser receives only the mapped plugin Events list model

#### Scenario: Event detail is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and effective Mainserver credentials
- **WHEN** a single Event is requested
- **THEN** the host calls a typed server-side Event detail adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `eventRecord(id: ID!)` GraphQL query with typed variables
- **AND** missing or invalid response data is mapped to a deterministic integration error

### Requirement: Typed POI GraphQL Adapters

The system SHALL expose typed, server-only SVA Mainserver adapters for Point-of-Interest list, detail, create, update, and archive-or-delete operations.

The adapters SHALL use the policy-driven SVA Mainserver credential resolution chain defined by the effective organization context and SHALL NOT expose a generic GraphQL executor to browser code, plugin code, or app UI components.

#### Scenario: POI list is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and effective Mainserver credentials
- **WHEN** the POI list is requested
- **THEN** the host calls a typed server-side POI list adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `pointsOfInterest` GraphQL query through the existing Mainserver service path
- **AND** the browser receives only the mapped plugin POI list model

#### Scenario: POI detail is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and effective Mainserver credentials
- **WHEN** a single POI is requested
- **THEN** the host calls a typed server-side POI detail adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `pointOfInterest(id: ID!)` GraphQL query with typed variables
- **AND** missing or invalid response data is mapped to a deterministic integration error

### Requirement: Event And POI Mutations Preserve Policy-Driven Mainserver Delegation

The system SHALL execute Event and POI create, update, archive, and delete mutations with the effective Mainserver credentials resolved for the active organization context. For `org_only`, the mutation path uses only the active organization's credentials. For `org_or_personal`, the mutation path prefers the active organization's credentials and falls back to the current user's Keycloak-backed credentials only when the organization has no complete credential set.

#### Scenario: Event mutation uses organization credentials for `org_only`

- **GIVEN** a user has local Studio permission and the active organization's `contentAuthorPolicy` is `org_only`
- **WHEN** the user submits a valid Event mutation
- **THEN** the server obtains an access token using the active organization's Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting Event is mapped back to the Events plugin model

#### Scenario: POI mutation uses organization credentials for `org_only`

- **GIVEN** a user has local Studio permission and the active organization's `contentAuthorPolicy` is `org_only`
- **WHEN** the user submits a valid POI mutation
- **THEN** the server obtains an access token using the active organization's Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting POI is mapped back to the POI plugin model

#### Scenario: Event and POI mutations fall back for `org_or_personal`

- **GIVEN** a user has local Studio permission and the active organization's `contentAuthorPolicy` is `org_or_personal`
- **AND** the active organization has no complete Mainserver credentials
- **WHEN** the user submits a valid Event or POI mutation
- **THEN** the server obtains an access token using the current user's Keycloak-backed Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting entity is mapped back to the corresponding plugin model

#### Scenario: Mainserver denies mutation

- **GIVEN** the user has local Studio permission but the Mainserver denies the delegated Event or POI mutation
- **WHEN** the mutation response indicates unauthorized or forbidden
- **THEN** Studio surfaces a deterministic authorization error
- **AND** Studio does not retry with shared or elevated credentials

### Requirement: Complete createNewsItem Mutation Coverage

The system SHALL expose all snapshot-backed `createNewsItem` mutation arguments through a typed server-only News input model.

The input model SHALL support `id`, `forceCreate`, `pushNotification`, `author`, `keywords`, `title`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `publishedAt`, `showPublishDate`, `categoryName`, `categories`, `sourceUrl`, `address`, `contentBlocks`, and `pointOfInterestId`.

#### Scenario: Full News create is submitted

- **GIVEN** a user submits a complete News editor form with scalar and nested fields
- **WHEN** the host prepares the Mainserver mutation
- **THEN** each supported form field is mapped to the matching `createNewsItem` variable
- **AND** the mutation is executed through the effective Mainserver credential resolution path for the active organization context
- **AND** `payload` is not sent with the mutation

#### Scenario: Full News update is submitted

- **GIVEN** a user edits an existing News item with scalar and nested fields
- **WHEN** the host prepares the update mutation
- **THEN** the adapter uses the verified `createNewsItem(id, forceCreate: false)` update path
- **AND** all supported update fields are passed as typed GraphQL variables
- **AND** unsupported or read-only write attempts are rejected before GraphQL execution
- **AND** `pushNotification` is not sent on update

## ADDED Requirements

### Requirement: Mainserver-Credential-Auflösung respektiert den aktiven Organisationskontext

The system SHALL resolve effective SVA Mainserver credentials from the active organization context before any server-side Mainserver adapter performs token acquisition or a GraphQL call. `contentAuthorPolicy` defines whether the adapter uses only organization credentials or falls back from the active organization to the current user's Keycloak-backed credentials.

#### Scenario: `org_only` uses only active organization credentials

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_only`
- **THEN** the adapter uses only the credentials stored for that active organization
- **AND** it does not retry with user credentials if the organization credentials are missing or incomplete

#### Scenario: `org_or_personal` falls back to the current user

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_or_personal`
- **AND** the active organization has no complete Mainserver credentials
- **THEN** the adapter falls back to the current user's Keycloak-backed credentials
- **AND** it continues to reject shared instance credentials or browser-provided credentials

#### Scenario: No active organization context blocks org-scoped credential lookup

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request without `activeOrganizationId`
- **WHEN** credential resolution starts
- **THEN** the adapter does not trigger an organization-scoped lookup
- **AND** it does not search across other memberships, hierarchy nodes, or previously active organization contexts for organization credentials

#### Scenario: No active organization context keeps the org-only path fail-closed

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request without `activeOrganizationId`
- **WHEN** the org-scoped `org_only` resolution path is required
- **THEN** no upstream token or GraphQL request is started
- **AND** the adapter propagates the resolver error code `organization_mainserver_credentials_missing` without remapping it

#### Scenario: Adapter propagates the org-scoped resolver error unchanged

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_only`
- **AND** the active organization has no complete Mainserver credentials
- **THEN** no upstream token or GraphQL request is started
- **AND** the adapter propagates the resolver error code `organization_mainserver_credentials_missing` without remapping it

#### Scenario: Adapter propagates the shared missing-credentials error unchanged

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_or_personal`
- **AND** the active organization has no complete Mainserver credentials
- **AND** the current user has no complete current or legacy Mainserver credentials
- **THEN** no upstream token or GraphQL request is started
- **AND** the adapter propagates the resolver error code `missing_credentials` without remapping it

### Requirement: Mainserver credential and token caches stay isolated per active organization context

The system SHALL include at least `instanceId`, `keycloakSubject`, `activeOrganizationId`, and the effective credential source or an equivalent credential signature in every credential and token cache key used by the SVA Mainserver integration so tokens from one organization context cannot be replayed in another context for the same user and instance.

#### Scenario: Same user switches between two organizations

- **GIVEN** the same authenticated user is a member of two organizations in the same instance
- **WHEN** the user performs Mainserver operations in organization A and then in organization B
- **THEN** credential resolution and token reuse are isolated by `activeOrganizationId`
- **AND** the integration does not reuse a token or credential cache entry from organization A inside organization B

#### Scenario: Cache keys encode the minimum isolation dimensions

- **GIVEN** the integration stores a credential or token cache entry for a Mainserver request
- **WHEN** the cache key is derived
- **THEN** it includes `instanceId`, `keycloakSubject`, `activeOrganizationId`, and the effective credential source or an equivalent credential signature
- **AND** two requests that differ in any of these dimensions do not share the same cache entry
