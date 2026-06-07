# sva-mainserver-integration Specification

## Purpose
This specification defines the host-owned, typed SVA Mainserver integration contract for News, Events, and POI so fachplugins consume Mainserver data and mutations without bypassing package boundaries, per-user delegation, or deterministic validation and error handling.
## Requirements
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

### Requirement: News GraphQL Documents Follow Snapshot Contract

The system SHALL derive News GraphQL documents from the checked-in SVA Mainserver schema snapshot and verify schema drift before production rollout.

The initial News contract SHALL use snapshot-backed fields and operations including `newsItems`, `newsItem`, `createNewsItem`, `createNewsItems`, `changeVisibility`, and `destroyRecord` where applicable.

#### Scenario: News operation uses schema-backed document

- **GIVEN** a News GraphQL operation is added
- **WHEN** the operation is committed
- **THEN** its query, mutation, variables, and selected fields match types present in `packages/sva-mainserver/src/generated/schema.snapshot.json`
- **AND** unit tests cover the expected response shape and invalid response handling

#### Scenario: Mainserver schema drifts

- **GIVEN** the Staging Mainserver schema no longer supports a News operation used by Studio
- **WHEN** the schema-diff gate runs
- **THEN** the change is reported before rollout
- **AND** the News adapter is not treated as compatible until the document or mapping is updated

### Requirement: Mainserver News Update And Archive Semantics Are Explicit

The system SHALL NOT assume dedicated Mainserver `updateNewsItem` or `deleteNewsItem` mutations unless they exist in the checked-in schema snapshot or a documented Staging schema update.

Updates, archives, and deletes SHALL be mapped explicitly to the available Mainserver contract and SHALL be covered by tests and runbook documentation.

#### Scenario: News update uses documented Mainserver operation

- **GIVEN** the user updates a News item in Studio
- **WHEN** the host prepares the Mainserver mutation
- **THEN** it uses a documented update path such as `createNewsItem` with an existing `id` only after the semantics are verified
- **AND** the operation is rejected before GraphQL execution if the update path is not verified

#### Scenario: News archive or delete uses documented Mainserver operation

- **GIVEN** the user archives or deletes a News item in Studio
- **WHEN** the host prepares the Mainserver mutation
- **THEN** it uses the documented operation selected for this rollout, such as `changeVisibility` or `destroyRecord`
- **AND** the chosen `recordType` and expected result shape are covered by tests or Staging verification

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

### Requirement: Event And POI GraphQL Documents Follow Snapshot Contract

The system SHALL derive Event and POI GraphQL documents from the checked-in SVA Mainserver schema snapshot and verify schema drift before production rollout.

The initial Event contract SHALL use snapshot-backed fields and operations including `eventRecords`, `eventRecord`, `createEventRecord`, `changeVisibility`, and `destroyRecord` where applicable.

The initial POI contract SHALL use snapshot-backed fields and operations including `pointsOfInterest`, `pointOfInterest`, `createPointOfInterest`, `createPointsOfInterest`, `changeVisibility`, and `destroyRecord` where applicable.

#### Scenario: Event operation uses schema-backed document

- **GIVEN** an Event GraphQL operation is added
- **WHEN** the operation is committed
- **THEN** its query, mutation, variables, and selected fields match types present in `packages/sva-mainserver/src/generated/schema.snapshot.json`
- **AND** unit tests cover the expected response shape and invalid response handling

#### Scenario: POI operation uses schema-backed document

- **GIVEN** a POI GraphQL operation is added
- **WHEN** the operation is committed
- **THEN** its query, mutation, variables, and selected fields match types present in `packages/sva-mainserver/src/generated/schema.snapshot.json`
- **AND** unit tests cover the expected response shape and invalid response handling

#### Scenario: Mainserver schema drifts

- **GIVEN** the Staging Mainserver schema no longer supports an Event or POI operation used by Studio
- **WHEN** the schema-diff gate runs
- **THEN** the change is reported before rollout
- **AND** the affected adapter is not treated as compatible until the document or mapping is updated

### Requirement: Event And POI Update And Archive Semantics Are Explicit

The system SHALL NOT assume dedicated Mainserver `updateEventRecord`, `deleteEventRecord`, `updatePointOfInterest`, or `deletePointOfInterest` mutations unless they exist in the checked-in schema snapshot or a documented Staging schema update.

Updates, archives, and deletes SHALL be mapped explicitly to the available Mainserver contract and SHALL be covered by tests and runbook documentation.

#### Scenario: Event update uses documented Mainserver operation

- **GIVEN** the user updates an Event in Studio
- **WHEN** the host prepares the Mainserver mutation
- **THEN** it uses a documented update path such as `createEventRecord` with an existing `id` only after the semantics are verified
- **AND** the operation is rejected before GraphQL execution if the update path is not verified

#### Scenario: POI update uses documented Mainserver operation

- **GIVEN** the user updates a POI in Studio
- **WHEN** the host prepares the Mainserver mutation
- **THEN** it uses a documented update path such as `createPointOfInterest` with an existing `id` only after the semantics are verified
- **AND** the operation is rejected before GraphQL execution if the update path is not verified

#### Scenario: Event or POI archive/delete uses documented Mainserver operation

- **GIVEN** the user archives or deletes an Event or POI in Studio
- **WHEN** the host prepares the Mainserver mutation
- **THEN** it uses the documented operation selected for this rollout, such as `changeVisibility` or `destroyRecord`
- **AND** the chosen `recordType` and expected result shape are covered by tests or Staging verification

#### Scenario: Phase 1 delete uses hard destroy path

- **GIVEN** the user deletes an Event or POI in Studio
- **WHEN** the host prepares the Mainserver mutation for this rollout
- **THEN** Event delete uses `destroyRecord(id, recordType: "EventRecord")`
- **AND** POI delete uses `destroyRecord(id, recordType: "PointOfInterest")`
- **AND** the host does not silently switch to `changeVisibility(false)` unless Staging verification invalidates the destroy path

### Requirement: Migration Runtime Diagnostics Preserve Failure Evidence

The migration runtime SHALL retain actionable diagnostics for failed Swarm migration jobs without requiring operators to manually inspect Portainer first.

#### Scenario: Failed migration job includes remote logs

- **GIVEN** a Swarm migration job reaches a failed terminal state
- **WHEN** Studio builds the migration failure error
- **THEN** it attempts to read the failed task container logs via the Portainer Docker API
- **AND** it falls back to service logs if container logs are unavailable
- **AND** the error text includes `containerLogs` and the normalized `taskSnapshot`

#### Scenario: Failed migration job stack can be kept for diagnosis

- **GIVEN** a Swarm migration job fails
- **AND** `SVA_MIGRATION_JOB_KEEP_FAILED_STACK` is truthy
- **WHEN** cleanup would normally remove the migration job stack
- **THEN** the failed job stack is retained for operator diagnosis
- **AND** cleanup continues to remove the stack when the flag is absent or false

#### Scenario: Migration entrypoint reports final Goose status

- **GIVEN** the migration entrypoint runs inside the one-off migration service
- **WHEN** `goose up` completes or fails
- **THEN** the final Goose status remains part of the migration output
- **AND** a separate status check before `up` is not required as a blocking prerequisite

### Requirement: Complete NewsItem Snapshot Coverage

The system SHALL model the SVA Mainserver `NewsItem` GraphQL object with complete snapshot-backed field coverage in the server-only Mainserver adapter layer.

The typed News adapter SHALL select and map all stable `NewsItem` fields from the checked-in schema snapshot: `id`, `title`, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `publishedAt`, `showPublishDate`, `payload`, `sourceUrl`, `address`, `categories`, `contentBlocks`, `visible`, `createdAt`, `updatedAt`, `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe`, and `pushNotificationsSentAt`.

#### Scenario: Full NewsItem is loaded

- **GIVEN** the Mainserver returns a `NewsItem` containing scalar, nested, read-only, and nullable fields
- **WHEN** Studio maps the response through `@sva/sva-mainserver/server`
- **THEN** all snapshot-backed fields are represented in the typed News DTO
- **AND** nullable optional fields are normalized deterministically without rejecting the entire response
- **AND** read-only fields are preserved for plugin display or diagnostics

#### Scenario: Mainserver omits optional NewsItem fields

- **GIVEN** the Mainserver returns a valid `NewsItem` with missing optional nested fields
- **WHEN** the adapter maps the response
- **THEN** missing optional fields are represented as `undefined`, empty arrays, or documented defaults
- **AND** required identifiers and publication fields are still validated before the DTO is returned

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

### Requirement: News Nested GraphQL Types Are Explicit

The system SHALL map News nested GraphQL types with explicit DTOs and validation rather than untyped pass-through objects.

Nested DTOs SHALL cover at least `WebUrl`, `Address`, `GeoLocation`, `Category`, `CategoryInput`, `ContentBlock`, `MediaContent`, `DataProvider`, `Setting`, and an announcement summary for `Shout`.

#### Scenario: News content blocks include media

- **GIVEN** a News item contains `contentBlocks` with nested `mediaContents` and `sourceUrl`
- **WHEN** Studio maps the Mainserver response
- **THEN** each content block and media reference is represented in typed DTOs
- **AND** invalid nested object shapes are mapped to deterministic `invalid_response` errors only when required fields for that nested type are unusable

#### Scenario: News mutation contains nested objects

- **GIVEN** the user submits categories, source URL, address, or content blocks
- **WHEN** the host validates the request
- **THEN** the nested values are validated against the snapshot-backed input shape
- **AND** invalid nested values are rejected before GraphQL execution with stable plugin-facing error codes

### Requirement: News Read-only Mainserver Fields Remain Non-Mutable

The system SHALL read and expose Mainserver read-only or derived News fields without allowing the plugin to mutate them.

Read-only fields SHALL include `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe`, `pushNotificationsSentAt`, `createdAt`, `updatedAt`, and `visible`.

#### Scenario: Plugin tries to write a read-only News field

- **GIVEN** a request body contains a read-only field such as `likeCount`, `dataProvider`, or `pushNotificationsSentAt`
- **WHEN** the host validates the News mutation request
- **THEN** the request is rejected before GraphQL execution
- **AND** the response uses a stable validation error code

#### Scenario: Plugin displays read-only News metadata

- **GIVEN** a News detail response includes read-only metadata
- **WHEN** the News plugin renders the editor or detail context
- **THEN** the metadata is available without becoming editable form state

### Requirement: News Update And Delete Keep Verified Mainserver Semantics

The system SHALL preserve the verified News update and delete semantics while expanding the data model.

Updates SHALL continue to use `createNewsItem` with the existing `id` and `forceCreate: false`. Deletes SHALL continue to use `destroyRecord(id, recordType: "NewsItem")` unless a later approved change replaces that behavior.

#### Scenario: Full model update keeps verified update path

- **GIVEN** a user updates a News item containing the full supported field set
- **WHEN** the host writes the update to Mainserver
- **THEN** the request uses `createNewsItem(id, forceCreate: false)`
- **AND** the full supported input model is passed through that verified update path

#### Scenario: Full model delete keeps hard delete path

- **GIVEN** a user deletes a News item after the model expansion
- **WHEN** the host writes the delete to Mainserver
- **THEN** the request uses `destroyRecord(id, recordType: "NewsItem")`
- **AND** no local IAM fallback, soft delete, or dual-write is performed

### Requirement: Typed Mainserver List Adapters Support Server-Side Pagination

The system SHALL expose typed, server-only SVA Mainserver list adapters for News, Events, and POI that accept explicit pagination input instead of using a fixed collection fetch.

#### Scenario: News list adapter receives page input

- **GIVEN** the News list is requested through the host route
- **WHEN** the caller provides `page` and `pageSize`
- **THEN** the typed News adapter maps them to snapshot-compatible upstream query variables such as `skip` and `limit`
- **AND** it no longer hardcodes a fixed `limit: 100, skip: 0` list fetch

#### Scenario: Event list adapter receives page input

- **GIVEN** the Events list is requested through the host route
- **WHEN** the caller provides `page` and `pageSize`
- **THEN** the typed Event adapter maps them to snapshot-compatible upstream query variables
- **AND** it returns only the requested page slice to the browser contract

#### Scenario: POI list adapter receives page input

- **GIVEN** the POI list is requested through the host route
- **WHEN** the caller provides `page` and `pageSize`
- **THEN** the typed POI adapter maps them to snapshot-compatible upstream query variables
- **AND** it returns only the requested page slice to the browser contract

### Requirement: Mainserver List Routes Return Honest Pagination Metadata

The system SHALL return deterministic pagination metadata for News, Events, and POI list routes without inventing total counts that the current snapshot-backed upstream contract does not provide.

#### Scenario: Upstream can prove there is another page

- **GIVEN** the host list adapter can determine that more records exist after the current page
- **WHEN** the route serializes the response
- **THEN** it returns pagination metadata containing the current `page`, the effective `pageSize`, and `hasNextPage: true`
- **AND** the decision is based on the visible page result after host-side visibility rules are applied

#### Scenario: Upstream cannot provide exact total

- **GIVEN** the current Mainserver snapshot does not provide a trustworthy exact total for the requested collection
- **WHEN** the route serializes the paginated response
- **THEN** it may omit `pagination.total`
- **AND** it does not synthesize an exact total from assumptions or UI expectations

#### Scenario: Invalid page query is normalized

- **GIVEN** a browser calls `/api/v1/mainserver/news`, `/api/v1/mainserver/events`, or `/api/v1/mainserver/poi` with invalid pagination parameters
- **WHEN** the host route parses the query string
- **THEN** it clamps invalid values to deterministic defaults
- **AND** the typed adapter receives normalized pagination input

#### Scenario: Shared page-size policy is enforced

- **GIVEN** a browser requests a Mainserver list with `pageSize`
- **WHEN** the host route validates the query
- **THEN** it uses a default `pageSize` of `25` when none or an invalid value is provided
- **AND** it accepts only the shared page sizes `25`, `50`, or `100`
- **AND** it never forwards a page size greater than `100` to the typed adapter

### Requirement: Mainserver-Konfiguration wird aus zentraler Interface-Registry aufgeloest

The system SHALL resolve instance-specific SVA-Mainserver endpoint configuration from the central external-interface registry.

#### Scenario: Mainserver configuration is loaded for an instance

- **WHEN** a server-side Mainserver operation resolves the active instance configuration
- **THEN** it reads the canonical `sva_mainserver` interface from the external-interface registry
- **AND** disabled or missing records remain fail-closed

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

