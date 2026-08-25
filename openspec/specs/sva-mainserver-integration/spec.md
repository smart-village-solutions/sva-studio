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

Das System MUST typed, server-only SVA-Mainserver-Adapter für Point-of-Interest-Liste, Detail, Create, Update und Archive-or-Delete bereitstellen.

Die Adapter MUST die policy-gesteuerte SVA-Mainserver-Credential-Resolution-Chain des effektiven Organisationskontexts verwenden und dürfen keinen generischen GraphQL-Executor an Browsercode, Plugincode oder App-UI-Komponenten exponieren.

#### Scenario: POI list is loaded through typed adapter

- **WENN** ein Benutzer eine gültige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** die POI-Liste angefordert wird
- **DANN** ruft der Host einen typed serverseitigen POI-List-Adapter in `@sva/sva-mainserver/server` auf
- **UND** führt der Adapter die GraphQL-Abfrage `pointsOfInterest` über den bestehenden Mainserver-Servicepfad aus
- **UND** erhält der Browser nur das gemappte Plugin-POI-Listenmodell

#### Scenario: POI detail is loaded through typed adapter

- **WENN** ein Benutzer eine gültige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** ein einzelner POI angefordert wird
- **DANN** ruft der Host einen typed serverseitigen POI-Detail-Adapter in `@sva/sva-mainserver/server` auf
- **UND** führt der Adapter die GraphQL-Abfrage `pointOfInterest(id: ID!)` mit typed Variablen aus
- **UND** werden fehlende oder invalide Antwortdaten auf einen deterministischen Integrationsfehler gemappt

#### Scenario: POI update preserves structured editor sections

- **WENN** ein Benutzer einen POI in Studio über den redaktionsorientierten Voll-Editor bearbeitet
- **UND** der Host die Mainserver-Mutation vorbereitet
- **DANN** bewahrt der typed POI-Adapter strukturierte Bereiche für `addresses`, `contact`, `priceInformations`, `openingHours`, `operatingCompany`, `webUrls`, `mediaContents`, `certificates`, `accessibilityInformation`, `tags`, `payload` und editorseitig verantwortete `location`-Daten
- **UND** bleiben diese strukturierten Daten über Host-Route, Service-Adapter, GraphQL-Dokument und Mapping-Layer hinweg typed

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

The typed full News adapter SHALL select and map all stable `NewsItem` fields from the checked-in schema snapshot: `id`, `title`, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `publishedAt`, `showPublishDate`, `payload`, `sourceUrl`, `address`, `categories`, `contentBlocks`, `visible`, `createdAt`, `updatedAt`, `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe`, and `pushNotificationsSentAt`.

The dedicated News Projection-List adapter SHALL use a smaller typed selection and SHALL treat both `publicationDate` and `publishedAt` as optional.

#### Scenario: Full NewsItem is loaded

- **GIVEN** the Mainserver returns a `NewsItem` containing scalar, nested, read-only, and nullable fields
- **WHEN** Studio maps the response through the full adapter in `@sva/sva-mainserver/server`
- **THEN** all snapshot-backed fields are represented in the typed News DTO
- **AND** nullable optional fields are normalized deterministically without rejecting the entire response
- **AND** read-only fields are preserved for plugin display or diagnostics

#### Scenario: Mainserver omits optional NewsItem fields

- **GIVEN** the Mainserver returns a valid `NewsItem` with missing optional nested or publication fields
- **WHEN** the full or Projection-List adapter maps the response
- **THEN** missing optional fields are represented as `undefined`, empty arrays, or documented defaults
- **AND** a stable identifier remains required
- **AND** missing `publicationDate` and `publishedAt` do not reject the item or its containing page

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

### Requirement: Mainserver-Inhalte sind hostseitig in die kanonische Content-Liste projiziert

Das System SHALL Mainserver-News, -Events und -POI hostseitig in das kanonische Inhaltslistenmodell für `GET /api/v1/iam/contents` projizieren, ohne einen Browser-Vollscan oder ein lokales Dual-Write nach `iam.contents` vorauszusetzen.

#### Scenario: News erscheinen in der kanonischen Content-Liste

- **GIVEN** eine Instanz hat lesbare Mainserver-News und keine korrespondierenden lokalen IAM-Content-Datensaetze
- **WHEN** `GET /api/v1/iam/contents` fuer sichtbare Typen aufgerufen wird
- **THEN** projiziert der Host die Mainserver-News serverseitig in das gemeinsame Inhaltslistenmodell
- **AND** die Browser-Antwort enthaelt diese Eintraege ohne lokale Browser-Aggregation

#### Scenario: Events und POI erscheinen in der kanonischen Content-Liste

- **GIVEN** eine Instanz hat lesbare Mainserver-Events oder Mainserver-POI und keine korrespondierenden lokalen IAM-Content-Datensaetze
- **WHEN** `GET /api/v1/iam/contents` fuer sichtbare Typen aufgerufen wird
- **THEN** projiziert der Host die Mainserver-Events und -POI serverseitig in das gemeinsame Inhaltslistenmodell
- **AND** die Browser-Antwort enthaelt diese Eintraege ohne lokale Browser-Aggregation

#### Scenario: Mainserver-Projektion bleibt innerhalb der Host-Grenze

- **GIVEN** die kanonische Content-Liste benoetigt Mainserver-Daten
- **WHEN** die Listenanfrage verarbeitet wird
- **THEN** die Host-Runtime laedt und projiziert die Mainserver-Daten serverseitig
- **AND** Browser-Code und Plugin-Code erhalten keinen generischen GraphQL-Zugriff und keinen direkten Server-Bypass

### Requirement: Aggregierte Mainserver-Content-Liste unterstuetzt serverseitige Query-Semantik

Das System SHALL fuer Mainserver-projizierte Inhaltstypen serverseitige Pagination, Sortierung und Filterung innerhalb der kanonischen Content-Liste bereitstellen.

#### Scenario: Aggregierte Liste respektiert sichtbare Typen

- **GIVEN** die Listenanfrage enthaelt mehrere `visibleType`-Werte
- **WHEN** der Host die kanonische Content-Liste bildet
- **THEN** beruecksichtigt er nur die fuer die Anfrage sichtbaren Mainserver- und IAM-Inhaltstypen
- **AND** nicht sichtbare Typen erscheinen nicht in der Antwort

#### Scenario: Aggregierte Liste respektiert Seite und Seitengroesse

- **GIVEN** die Listenanfrage enthaelt `page` und `pageSize`
- **WHEN** der Host die kanonische Content-Liste fuer Mainserver-Inhalte berechnet
- **THEN** liefert er nur die angeforderte Seite im gemeinsamen Listenmodell zurueck
- **AND** die Antwort enthaelt eine dazu passende Pagination-Metadatenstruktur

#### Scenario: Aggregierte Liste respektiert Sortierung und Filter

- **GIVEN** die Listenanfrage enthaelt `q`, `type`, `status`, `sortBy` oder `sortDirection`
- **WHEN** der Host die kanonische Content-Liste fuer Mainserver-Inhalte berechnet
- **THEN** wendet er diese Query-Semantik serverseitig auf die aggregierte Liste an
- **AND** der Browser muss keine lokale Nachfilterung oder Nachsortierung ueber den Gesamtbestand ausfuehren

### Requirement: Aggregierte Mainserver-Content-Liste bleibt deterministisch bei Fehlern und Rechten

Das System SHALL Fehler, Sichtbarkeit und Rechte fuer serverseitig projizierte Mainserver-Inhalte in derselben Host-Antwort deterministisch behandeln.

#### Scenario: Mainserver-Quelle schlaegt fehl

- **GIVEN** eine fuer die angefragte kanonische Content-Liste benoetigte Mainserver-Quelle kann nicht erfolgreich geladen werden
- **WHEN** der Host die Listenanfrage verarbeitet
- **THEN** beendet er die Anfrage mit einem deterministischen Fehlervertrag
- **AND** der Browser verbleibt nicht in einem unendlichen Ladezustand

#### Scenario: Lokale Leseberechtigung fehlt fuer projizierten Inhalt

- **GIVEN** ein Mainserver-Inhalt ist technisch ladbar, aber lokal nicht fuer `content.read` freigegeben
- **WHEN** der Host die kanonische Content-Liste bildet
- **THEN** wendet er die bestehende hostseitige Rechtepruefung auf den projizierten Inhalt an
- **AND** der Inhalt erscheint nicht als unautorisiert sichtbarer Eintrag in der Antwort

### Requirement: Tenant-owned Karten- und Geocoding-Interfaces kapseln Provider-Konfiguration

Das System MUST tenant-owned Interfaces für Karten- und Geocoding-Fähigkeiten bereitstellen, damit Providerwahl, Stil-Konfiguration, Secret-Referenzen, Rate-Limits, Timeouts und Fallback-Verhalten in der Tenant-Integrationsschicht statt in Plugin- oder Browserlogik gesteuert werden.

#### Scenario: POI editor consumes normalized tenant-owned capabilities

- **WENN** ein Tenant Karten- und Geocoding-Fähigkeiten über ein tenant-owned Interface konfiguriert hat
- **UND** der POI-Editor Adressvorschläge, Geocoding, Reverse-Geocoding oder Karten-Rendering benötigt
- **DANN** konsumiert er ausschließlich normierte Operationen und normierte Ergebnisformen
- **UND** greift nicht auf provider-spezifische Secrets, Keys, Endpunkte oder Rohverträge zu
- **UND** wird provider-spezifische Konfiguration über das tenant-owned Interface und dessen hostseitige Implementierung aufgelöst

#### Scenario: Tenant changes provider without editor contract change

- **WENN** ein Tenant den konfigurierten Geocoding-Provider oder die Kartenimplementierung ändert
- **UND** der POI-Editor danach genutzt wird
- **DANN** bleibt der Editor-Vertrag unverändert
- **UND** bleiben provider-spezifische Konfiguration und Secret-Handling im tenant-owned Interface und dessen Adapter isoliert

### Requirement: Studio-POI-Write-Pfad deckt den relevanten Mainserver-Vertrag vollständig ab

Das System MUST die von Studio gepflegten POI-Editor-Daten an den typed Mainserver-POI-Mutationspfad weiterleiten, ohne unterstützte, editorseitig verantwortete POI-Felder stillschweigend zu verwerfen.

#### Scenario: Full POI editor data reaches the typed write path

- **WENN** der Studio-POI-Editor `addresses`, `contact`, `openingHours`, `priceInformations`, `operatingCompany`, `webUrls`, `mediaContents`, `certificates`, `accessibilityInformation`, `tags`, `payload` und optionale `location`-Daten erfasst
- **UND** ein Benutzer den POI speichert
- **DANN** baut der hostseitige POI-Write-Pfad ein typed `SvaMainserverPoiInput`
- **UND** enthält dieses alle vorhandenen und gültigen, editorseitig verantworteten Feldgruppen
- **UND** verengt der Adapter die Editor-Payload nicht stillschweigend auf Name, Beschreibung, Kategorie, Minimaladresse und Links

#### Scenario: Unsupported field omission is explicit

- **WENN** ein Studio-POI-Editor-Feld absichtlich nicht auf den typed Mainserver-POI-Input gemappt wird
- **UND** der Write-Pfad reviewed oder getestet wird
- **DANN** ist die Omission explizit, dokumentiert und durch eine deterministische Produktentscheidung gedeckt
- **UND** entsteht sie nicht durch versehentliche Adapter-Unvollständigkeit

#### Scenario: Non-edited structured fields are preserved when declared as passthrough

- **WENN** ein geladener POI strukturierte Mainserver-Daten enthält, die im aktuellen Studio-Slice noch nicht vollständig editierbar sind
- **UND** der Benutzer andere editorseitig verantwortete POI-Bereiche aktualisiert und speichert
- **DANN** bleiben alle als Read/Passthrough markierten Feldgruppen verlustfrei über den Write-Pfad erhalten
- **UND** kollabiert der Adapter mehrwertige oder strukturierte Werte nicht stillschweigend auf die aktuell editierte Teilmenge

### Requirement: Mapping, passthrough, and omissions are deterministic per field group

Das System MUST für jede relevante POI-Feldgruppe festlegen, ob Studio sie als Read/Write, Read/Passthrough oder explizite Omission behandelt, damit Datenverlust und versehentliche Vertragsverengung reviewbar und testbar bleiben.

#### Scenario: Field group mapping mode is reviewable

- **WENN** eine relevante strukturierte Feldgruppe wie `addresses`, `openingHours`, `priceInformations`, `operatingCompany`, `mediaContents`, `certificates`, `accessibilityInformation`, `location`, `tags` oder `payload` reviewed oder getestet wird
- **DANN** besitzt die Feldgruppe einen expliziten Mapping-Modus
- **UND** sind Normalisierung, Kardinalität und Verlustfreiheitsregel für diesen Change dokumentiert

#### Scenario: Explicit omission does not masquerade as support

- **WENN** eine Feldgruppe oder Teilstruktur außerhalb des unterstützten Studio-Scopes dieses Changes liegt
- **UND** der POI-Editor implementiert und getestet wird
- **DANN** ist der nicht unterstützte Scope explizit als Omission oder Passthrough gekennzeichnet
- **UND** stellt das Produkt diese Feldgruppe nicht als voll unterstützt dar, wenn das nicht der Fall ist

### Requirement: Host POI route validates extended structured POI inputs

Das System MUST strukturierte POI-Inputs des erweiterten Studio-POI-Editors in der hostseitigen POI-Route validieren, bevor sie an den typed Mainserver-Service-Adapter weitergereicht werden.

#### Scenario: Extended POI route accepts valid structured sections

- **WENN** der Browser eine POI-Payload mit strukturierten `openingHours`, `priceInformations`, `operatingCompany`, `location`, `certificates` und `accessibilityInformation` übermittelt
- **UND** die hostseitige POI-Route die Anfrage parst
- **DANN** validiert und normalisiert sie diese Bereiche gemäß dem typed Mainserver-Integrationsvertrag
- **UND** leitet das normalisierte Ergebnis über den typed POI-Servicepfad weiter

#### Scenario: Invalid structured POI section is rejected deterministically

- **WENN** der Browser einen ungültigen strukturierten POI-Bereich wie fehlerhafte Geo-Koordinaten oder invalide Teilobjekte übermittelt
- **UND** die hostseitige POI-Route die Anfrage parst
- **DANN** weist die Route die Anfrage mit einem deterministischen Validierungsfehler zurück
- **UND** leitet kein teilweise defektes Objekt an den Mainserver-Write-Pfad weiter

### Requirement: Host POI write and geocoding paths emit structured observability signals

Das System MUST für POI-Write-Validierung, Geocoding-Operationen, Reverse-Geocoding, Nicht-Treffer und Providerfehler strukturierte, PII-bewusste Observability-Signale emittieren, damit Produktionsdiagnose nicht von Roh-Payloads oder geleakten Secrets abhängt.

#### Scenario: Provider and validation outcomes are distinguishable

- **WENN** der Host einen POI-Write oder eine tenant-owned Geocoding-Operation verarbeitet
- **UND** die Operation erfolgreich endet, fehlschlägt, keinen Treffer liefert oder auf einen Fallback wechselt
- **DANN** emittiert der Host ein strukturiertes Outcome, das mindestens `success`, `no_result`, `invalid_input`, `provider_error`, `rate_limited`, `timeout` und `fallback_used` unterscheidet
- **UND** kann das Signal dem betroffenen Host-Pfad zugeordnet werden, ohne Provider-Secrets oder Rohverträge offenzulegen

#### Scenario: Diagnostics stay PII-aware

- **WENN** Geocoding oder POI-Write-Validierung auf ungültige Adressen, Kontaktdaten oder providerseitige Fehler stößt
- **UND** der Host Logs oder Metriken zur Diagnose ausgibt
- **DANN** lässt das Signal Roh-Secrets, Provider-Tokens und unredigierte Provider-Payloads aus
- **UND** stützt sich die Standarddiagnose nicht auf vollständige Suchqueries oder vollständige Kontaktfelder

### Requirement: Mainserver-Projektion trennt Quellkontext von IAM-Ownership

Das System SHALL Mainserver-Quellkontext, DataProvider, Credential-Kontext und externe Organisationswerte getrennt von kanonischer IAM-Ownership führen. Der DataProvider SHALL als unveränderliche ursprüngliche Inhaber- und Autorenidentität geführt werden. `ownerUserId` und `ownerOrganizationId` SHALL ausschließlich aus konfliktfreien automatischen Principal-Bindungen abgeleitet werden.

Credential-Kontext, aktive Abfrageorganisation, freie Autorenwerte, externe Organisationsfelder oder der aktuelle Actor SHALL keine konkurrierende Ownership begründen. Im Modus `credential_visible_compatibility` SHALL die Projektion keine erfundene Owner-Zuordnung persistieren.

#### Scenario: Externe Organisation wird als Quellmetadatum projiziert

- **GIVEN** ein Mainserver-Datensatz enthält eine externe Organisation oder einen DataProvider
- **WHEN** Studio ihn in die Inhaltsliste projiziert
- **THEN** speichert die Projektion diese Werte als Quellmetadaten
- **AND** setzt keinen IAM-Owner allein aufgrund externer Werte

#### Scenario: DataProvider ist automatisch einem Account zugeordnet

- **GIVEN** ein Mainserver-Datensatz enthält DataProvider `dp-user-1`
- **AND** eine konfliktfreie automatische Bindung ordnet ihn Account `account-1` zu
- **WHEN** Studio den Datensatz projiziert
- **THEN** setzt es `sourceDataProviderId = dp-user-1`
- **AND** leitet `ownerUserId = account-1` als rekonstruierbare IAM-Projektion ab
- **AND** setzt keine Organisationsownership aus dem aktiven Kontext

#### Scenario: DataProvider ist automatisch einer Organisation zugeordnet

- **GIVEN** ein Mainserver-Datensatz enthält DataProvider `dp-org-1`
- **AND** eine konfliktfreie automatische Bindung ordnet ihn Organisation `org-1` zu
- **WHEN** Studio den Datensatz projiziert
- **THEN** setzt es `sourceDataProviderId = dp-org-1`
- **AND** leitet `ownerOrganizationId = org-1` als rekonstruierbare IAM-Projektion ab

#### Scenario: Kompatibilitätsmodus erfindet keinen Owner

- **GIVEN** die für den Scope erforderliche automatische Bindung fehlt oder ist konfliktbehaftet
- **WHEN** Studio den Datensatz projiziert
- **THEN** persistiert es DataProvider und Credential-Kontext als Quellmetadaten
- **AND** setzt keinen Owner aus Actor, aktiver Organisation oder Credential-Quelle
- **AND** kennzeichnet die Scope-Auswertung als `credential_visible_compatibility`

#### Scenario: Mutationsprincipal weicht vom ursprünglichen Inhaber ab

- **GIVEN** ein Inhalt besitzt einen DataProvider
- **AND** ein anderer zulässiger Principal führt eine bestätigte Mutation aus
- **WHEN** Studio die Projektion aktualisiert
- **THEN** bleibt die Ownership vom Content-DataProvider abgeleitet
- **AND** dokumentiert `credentialSource` getrennt den Mutationsprincipal

#### Scenario: Ownerloser Mainserver-Datensatz ist im exakten Modus eingeschränkt

- **GIVEN** ein Mainserver-Datensatz besitzt keinen konfliktfrei zugeordneten DataProvider
- **AND** der relevante Scope ist exakt
- **WHEN** ein Benutzer nur `own` oder `organization` besitzt
- **THEN** matcht der Datensatz nicht
- **AND** Zugriff erfordert `all` oder einen Scope im ausdrücklich aktiven Kompatibilitätsmodus

### Requirement: Mainserver-Mutationen verwenden expliziten Organisations- oder Benutzerkontext

Das System SHALL schreibende Mainserver-Mutationen in einem expliziten Principal-Kontext ausführen. Eine Mutation SHALL entweder mit `actingPrincipalType = organization` und validierter aktiver Organisation oder mit `actingPrincipalType = user` und authentifiziertem Account laufen. Die Auswahl SHALL die Credential-Quelle bestimmen. Listenfilter, DataProvider, externe Organisationswerte, andere Memberships oder frühere UI-Auswahlen SHALL die aktive Organisation nicht ersetzen.

Beim Create SHALL `contentAuthorPolicy` die zulässige Wahl begrenzen. Bei bestehenden eigenen oder organisatorischen Inhalten SHALL die konfliktfreie DataProvider-Bindung zusammen mit der Ressourcen-Capability den Principal festlegen. Ein Same-Credential-Pre-Read SHALL die aktuelle Verfügbarkeit und den Content-DataProvider liefern. Update, Veröffentlichung, Archivierung und Wiederherstellung SHALL den DataProvider gemäß bestätigter Typ-/Aktionsmatrix erhalten. Hard Delete SHALL den Provider aus dem Preimage auditieren und keinen Post-Read verlangen.

#### Scenario: Benutzer erstellt Datensatz im Namen der aktiven Organisation

- **GIVEN** die Session enthält eine validierte aktive Organisation
- **AND** deren Credentials sind vollständig
- **WHEN** der Benutzer mit `actingPrincipalType = organization` erstellt
- **THEN** verwendet Studio ausschließlich deren Credentials
- **AND** bestätigt der zurückgelieferte DataProvider ausschließlich die vorab per Identity-Endpunkt verifizierte Bindung dieser Credential-Version
- **AND** berücksichtigt Studio keine andere Membership

#### Scenario: Aktive Organisation fehlt bei Organisationsmutation

- **GIVEN** der Request verwendet `actingPrincipalType = organization`
- **AND** die Session enthält keine validierte aktive Organisation
- **WHEN** die Mutation ausgeführt werden soll
- **THEN** weist Studio sie vor dem Mainserver-Aufruf ab
- **AND** errät keine Organisation aus DataProvider, Memberships oder früherer Auswahl

#### Scenario: Persönlicher Create bleibt persönlich

- **GIVEN** persönliches Handeln ist zulässig
- **WHEN** ein Benutzer mit `actingPrincipalType = user` erstellt
- **THEN** verwendet Studio ausschließlich seine persönlichen Credentials
- **AND** bestätigt der zurückgelieferte DataProvider ausschließlich die vorab per Identity-Endpunkt verifizierte persönliche Bindung
- **AND** setzt Studio keine Organisationsownership

#### Scenario: Persönlicher Bestandsinhalt verwendet den persönlichen Principal

- **GIVEN** ein bestehender Inhalt ist konfliktfrei an den persönlichen DataProvider des aktuellen Benutzers gebunden
- **AND** die aktive Organisation erzwingt bei Creates `content_author_policy = 'org_only'`
- **WHEN** der Benutzer den Inhalt mit passender Ressourcen-Capability mutiert
- **THEN** verwendet Studio `actingPrincipalType = user`
- **AND** ändert oder überträgt es die Ownership nicht

#### Scenario: Organisationsinhalt verwendet den Organisationsprincipal

- **GIVEN** ein bestehender Inhalt ist konfliktfrei an den DataProvider der aktiven Organisation gebunden
- **WHEN** ein berechtigtes Mitglied den Inhalt mutiert
- **THEN** verwendet Studio `actingPrincipalType = organization`
- **AND** bleibt der tatsächliche Benutzer als Actor im Audit erhalten

#### Scenario: Bestehende Mutation verwendet Same-Credential-Pre-Read

- **GIVEN** ein Benutzer möchte einen bestehenden Inhalt aktualisieren
- **WHEN** Studio die Mutation autorisiert
- **THEN** liest es den Inhalt unmittelbar mit dem gebundenen Write-Credential
- **AND** verwendet DataProvider und Verfügbarkeit dieses Reads für die Scope-Entscheidung
- **AND** führt bei fehlendem Zugriff keinen Write aus

#### Scenario: Update erhält bestehenden DataProvider

- **GIVEN** Pre-Read liefert DataProvider `dp-original`
- **AND** die Typ-/Aktionsmatrix bestätigt Immutabilität für dieses Update
- **WHEN** Studio den Write mit einem zulässigen Principal ausführt
- **THEN** erwartet es weiterhin `dp-original`
- **AND** behandelt eine Abweichung als `reconciliation_required`

#### Scenario: Hard Delete verwendet Preimage statt Post-Read

- **GIVEN** Pre-Read liefert DataProvider `dp-original`
- **AND** der Benutzer besitzt die separate Delete-Permission
- **WHEN** der Mainserver den Hard Delete bestätigt
- **THEN** finalisiert Studio den Tombstone mit `dp-original`
- **AND** interpretiert einen fehlenden Post-Delete-Datensatz nicht als Integritätsverletzung

#### Scenario: Persönliche Mutation dokumentiert Credential-Herkunft

- **GIVEN** eine Mutation läuft mit `actingPrincipalType = user`
- **WHEN** Studio Projection, Journal und Audit nachzieht
- **THEN** speichert es `credentialSource = user` oder eine äquivalente Herkunft
- **AND** setzt keine synthetische Organisationsownership

### Requirement: Typed Survey GraphQL Adapters

Das System MUST typed, server-only SVA-Mainserver-Adapter fuer Survey-Liste, Survey-Detail, Survey-Create-or-Update, Survey-Submission, Freitext-Freigabe, Freitext-Loeschung und Ergebnisabruf bereitstellen.

Die Adapter MUST die bestehende policy-gesteuerte Mainserver-Credential-Resolution-Chain verwenden und duerfen keinen generischen GraphQL-Executor an Browsercode, Plugincode oder App-UI-Komponenten exponieren.

#### Scenario: Survey-Liste wird ueber typed Adapter geladen

- **WENN** ein Benutzer eine gueltige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** die Survey-Liste angefordert wird
- **DANN** ruft der Host einen typed serverseitigen Survey-List-Adapter in `@sva/sva-mainserver/server` auf
- **UND** fuehrt der Adapter die neue Survey-Listenabfrage ueber den bestehenden Mainserver-Servicepfad aus
- **UND** erhaelt der Browser nur das gemappte Survey-Listenmodell

#### Scenario: Survey-Detail wird ueber typed Adapter geladen

- **WENN** ein Benutzer eine gueltige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** eine einzelne Survey angefordert wird
- **DANN** ruft der Host einen typed serverseitigen Survey-Detail-Adapter auf
- **UND** fuehrt der Adapter die neue Survey-Detailabfrage mit typed Variablen aus
- **UND** werden fehlende oder invalide Antwortdaten auf einen deterministischen Integrationsfehler gemappt

#### Scenario: Survey-Plugin versucht generischen GraphQL-Zugriff

- **WENN** `@sva/plugin-surveys` Survey-Daten benoetigt
- **DANN** importiert das Plugin nicht `@sva/sva-mainserver/server`
- **UND** erhaelt keinen rohen GraphQL-Endpunkt, kein Secret, kein Token und keinen generischen Query-Executor

### Requirement: Survey GraphQL Documents folgen dem Wunsch-Schema und Snapshot-Vertrag

Das System MUST Survey-GraphQL-Dokumente aus dem eingecheckten Mainserver-Schema-Snapshot und den verifizierten Survey-Operationen ableiten.

Die anfängliche Survey-Integration MUST die im fachlichen Wunsch-Schema beschriebenen neuen Survey-Queries und -Mutations nutzen, soweit diese im Mainserver-Snapshot oder in einem verifizierten Staging-Schema vorliegen.

Das fuer Studio fuehrende Survey-Zielmodell verwendet nur die Statuswerte `DRAFT`, `ACTIVE` und `ARCHIVED` und enthaelt keine redaktionell steuerbare Option `allowsMultipleSubmissionsPerDevice`.

#### Scenario: Survey-Operation nutzt verifizierten GraphQL-Vertrag

- **WENN** eine Survey-GraphQL-Operation hinzugefuegt oder geaendert wird
- **DANN** passen Query oder Mutation, Variablen und selektierte Felder zu den verifizierten Survey-Operationen des Mainservers
- **UND** Unit-Tests decken erwartete Response-Shapes und invalides Upstream-Verhalten ab

#### Scenario: Survey-Snapshot folgt dem vereinfachten Statusmodell

- **WENN** Studio Survey-Typen, Enums oder Mapping-Layer fuer Mainserver-Responses aktualisiert
- **DANN** verwendet das Zielmodell nur `DRAFT`, `ACTIVE` und `ARCHIVED`
- **UND** werden fruehere Statuswerte wie `SCHEDULED` oder `ENDED` nicht als persistierte Studio-Statuswerte weitergefuehrt

#### Scenario: Survey-Snapshot entfernt redaktionelle Mehrfachteilnahme-Option

- **WENN** Studio den Survey-Write- und Read-Vertrag gegen den Mainserver abbildet
- **DANN** fuehrt das Zielmodell keine redaktionell bearbeitbare Option `allowsMultipleSubmissionsPerDevice`
- **UND** werden Mapping, Tests und Dokumentation entsprechend bereinigt

#### Scenario: Mainserver-Schema driftet bei Survey-Operationen

- **WENN** das Staging-Mainserver-Schema eine von Studio verwendete Survey-Operation nicht mehr unterstuetzt
- **DANN** wird der Drift vor dem Rollout gemeldet
- **UND** der betroffene Survey-Adapter gilt nicht als kompatibel, bis Dokument oder Mapping aktualisiert wurden

### Requirement: Survey-spezifische Fehler und Freigabeoperationen bleiben deterministisch

Das System MUST Mainserver- und Fachfehler fuer Survey-Operationen auf deterministische Studio-Fehler und Payload-Zustaende abbilden.

#### Scenario: Fachlicher Survey-Fehler wird strukturiert weitergegeben

- **WENN** eine Survey-Mutation fachlich fehlschlaegt, zum Beispiel wegen ungueltigem Statuswechsel oder unzulaessiger Eingabekombination
- **DANN** mappt der Host die Antwort auf einen deterministischen Studio-Fehlervertrag
- **UND** exponiert keine Secrets, Credentials oder rohen Upstream-Fehlerpayloads

#### Scenario: Freitext-Freigabe nutzt denselben host-owned Adapterpfad

- **WENN** ein berechtigter Benutzer Freitextantworten fuer eine Survey freigibt
- **DANN** erfolgt die Mutation ueber denselben host-owned Survey-Adapterpfad wie andere Survey-Mutationen
- **UND** die Freigabe wird nicht ueber einen pluginseitigen Direktzugriff am Host vorbei ausgefuehrt

#### Scenario: Freitext-Loeschung nutzt denselben host-owned Adapterpfad

- **WENN** ein berechtigter Benutzer eine Freitextantwort einer Survey loescht
- **DANN** erfolgt die Loeschung ueber denselben host-owned Survey-Adapterpfad wie andere Survey-Mutationen
- **UND** wird diese Loeschung nicht ueber einen pluginseitigen Direktzugriff am Host vorbei ausgefuehrt

### Requirement: Mainserver-Projektionslisten verwenden minimale typisierte Abfragen

Das System MUST für News, Events, POIs, Generic Items einschließlich FAQs und Surveys dedizierte typisierte Projection-List-Adapter verwenden, die nur Identität, Tabellendarstellung, erforderliche Zeit-/Statusfelder, minimale Quellmetadaten und sichere Diagnose laden.

Die Adapter MUST die im Design festgelegte Feld-Allowlist einhalten und dürfen keine fachliche Detail-Payload selektieren. Solange `payload_json` im gemeinsamen Tabellenvertrag nicht nullable ist, MUST der Mainserver-Projektionspfad dort ein leeres Objekt persistieren.

Die vollständigen Fachlisten-, Detail- und Mutationsadapter MUST ihre bestehenden snapshot-gestützten Verträge behalten und dürfen durch die reduzierten Projektions-Selections keine Felder verlieren.

#### Scenario: Projektionsrefresh lädt nur benötigte Felder

- **WENN** der Host einen typweiten Mainserver-Projektionsrefresh ausführt
- **DANN** verwendet er den dedizierten Projection-List-Adapter des Inhaltstyps
- **UND** dessen GraphQL-Selection entspricht exakt der typbezogenen Feld-Allowlist
- **UND** persistiert der Projektionspfad ein leeres `payload_json`, ohne dafür fachliche Payload-Felder zu laden
- **UND** lädt sie keine ausschließlich für Detailansicht oder Editor benötigten verschachtelten Felder

#### Scenario: Fachdetail bleibt vollständig

- **WENN** ein Fachplugin eine vollständige Liste, Detailansicht oder Mutation für einen Mainserver-Inhalt lädt
- **DANN** verwendet es weiterhin den vollständigen typisierten Fachadapter
- **UND** stehen alle bisher spezifizierten snapshot-gestützten Felder zur Verfügung

#### Scenario: Selection wächst unbeabsichtigt

- **WENN** ein neues Detailfeld in einen Projection-List-GraphQL-Vertrag aufgenommen wird
- **DANN** verlangt der Selection-Allowlist-Test eine explizite fachliche Begründung
- **UND** verhindert der Test, dass vollständige Detailfragmente still in den Vollscan gelangen

### Requirement: Mainserver-Projektion akzeptiert fehlende Veröffentlichungsdaten typübergreifend

Das System MUST Mainserver-Inhalte aller unterstützten projizierten Inhaltstypen auch dann materialisieren, wenn `publicationDate`, `publishedAt` oder semantisch entsprechende fachliche Veröffentlichungszeitpunkte fehlen.

Der Host MUST fehlende Veröffentlichungszeitpunkte als optionalen Wert normalisieren und darf weder einen einzelnen Datensatz noch den gesamten Typ-Snapshot allein deshalb ablehnen. Er MUST weiterhin unverzichtbare Strukturfelder wie eine stabile Quell-ID deterministisch validieren.

#### Scenario: News besitzt kein Veröffentlichungsdatum

- **GIVEN** eine Mainserver-News enthält weder `publicationDate` noch `publishedAt`
- **WHEN** der Projection-List-Adapter den Datensatz mappt
- **THEN** wird die News mit optionalem `publishedAt` in die lokale Projektion aufgenommen
- **AND** der Refresh setzt die Verarbeitung derselben und folgender Seiten fort

#### Scenario: Anderer Inhaltstyp besitzt keinen Veröffentlichungszeitpunkt

- **GIVEN** ein Event, POI, Generic Item, FAQ oder Survey enthält keinen fachlichen Veröffentlichungszeitpunkt
- **WHEN** der jeweilige Projection-List-Adapter den Datensatz mappt
- **THEN** wird der Inhalt ohne erfundenes Veröffentlichungsdatum materialisiert
- **AND** bleiben vorhandene Erstellungs-, Änderungs-, Status- und Sichtbarkeitsinformationen erhalten

#### Scenario: Unverzichtbare Quell-ID fehlt

- **GIVEN** ein Mainserver-Datensatz enthält keine stabile Quell-ID
- **WHEN** der Projection-List-Adapter ihn validiert
- **THEN** materialisiert der Host nur diesen Datensatz nicht
- **AND** erhöht er `skippedInvalidCount`
- **AND** verarbeitet er valide Datensätze derselben und folgender Seiten weiter
- **AND** protokolliert er Inhaltstyp, Seite und sichere Fehlerklasse ohne Secrets, PII oder Payload

#### Scenario: Page-Struktur ist unbrauchbar

- **GIVEN** eine Mainserver-Response besitzt keine validierbare Page-Struktur oder keine erforderlichen Pagination-Kontrollinformationen
- **WHEN** der Projection-List-Adapter die Response validiert
- **THEN** behandelt der Host die gesamte Seite als fehlgeschlagen
- **AND** finalisiert oder bereinigt er den unvollständigen Snapshot nicht destruktiv

### Requirement: Mainserver-Projektionsrefresh stellt partielle Snapshots progressiv bereit

Das System MUST jede erfolgreich geladene Seite transaktional persistieren und einen erstmaligen Typ-Snapshot nach der ersten erfolgreich persistierten Seite als partiell lesbar bereitstellen, während weitere Seiten im Hintergrund geladen werden.

Vollständigkeit, endgültiger Löschabgleich und endgültige Trefferzahl dürfen erst nach der erfolgreich verarbeiteten letzten Seite und atomarer Bestätigung der weiterhin führenden `refresh_run_id` zugesichert werden.

Der persistierte Sync-State MUST die Zustände `empty`, `partial_running`, `partial_failed`, `complete_fresh`, `complete_refreshing` und `complete_failed` unterscheiden und mindestens Refresh-Run-ID, Phase, abgeschlossene Seite, verfügbare Anzahl, Finalitätskennzeichen und den letzten sicheren Page-Fehler führen.

#### Scenario: Refresh beginnt für einen vollständigen vorhandenen Snapshot

- **GIVEN** ein vollständiger lesbarer Snapshot existiert
- **WHEN** ein neuer Refresh beginnt
- **THEN** wechselt sein Zustand auf `complete_refreshing`
- **AND** bleiben die vorhandenen Zeilen lesbar
- **AND** erhält der Lauf eine neue scope-isolierte `refresh_run_id`

#### Scenario: Erster Snapshot wird partiell lesbar

- **GIVEN** noch kein vollständiger Snapshot existiert
- **WHEN** die erste nichtleere Seite erfolgreich persistiert wurde
- **THEN** wechselt der Zustand auf `partial_running`
- **AND** entsprechen `available_count` und `completed_page` dem persistierten Fortschritt
- **AND** bleibt `is_total_final = false`

#### Scenario: Erste Seite eines erstmaligen Refreshs ist persistiert

- **GIVEN** für einen Mainserver-Inhaltstyp existiert noch kein vollständiger Snapshot
- **WHEN** die erste nichtleere Seite erfolgreich persistiert wurde
- **THEN** liefert `GET /api/v1/iam/contents` die autorisierten Zeilen dieser Seite aus
- **AND** kennzeichnen die Metadaten den Snapshot als partiell und den Refresh als laufend
- **AND** blockiert ein expliziter Typfilter die bereits vorhandenen Zeilen nicht mit einem Missing-Snapshot-Fehler

#### Scenario: Spätere Seite schlägt fehl

- **GIVEN** mindestens eine Seite eines Typ-Refreshs wurde erfolgreich persistiert
- **WHEN** eine spätere Seite fehlschlägt
- **THEN** bleiben die erfolgreich persistierten Zeilen als partieller Snapshot lesbar
- **AND** kennzeichnen die Sync-Metadaten den letzten Page-Fehler und die unvollständige Gesamtmenge
- **AND** führt der Host keinen abschließenden Löschabgleich gegen die unvollständige Quellmenge aus

#### Scenario: Letzte Seite schließt den Snapshot ab

- **GIVEN** alle Seiten eines Typ-Refreshs wurden erfolgreich geladen und persistiert
- **WHEN** der Host den Lauf finalisiert
- **THEN** führt er den Löschabgleich für nicht mehr vorhandene Quellzeilen aus
- **AND** markiert den Snapshot als vollständig und frisch
- **AND** liefert eine endgültige Trefferzahl und Pagination-Metadaten

#### Scenario: Ältere Refresh-Generation erreicht verspätet das Ende

- **GIVEN** ein neuerer Lauf oder ein gezieltes Mutation-Update hat die führende `refresh_run_id` eines Scopes ersetzt
- **WHEN** eine ältere Reconciliation ihre letzte Seite verarbeitet
- **THEN** darf sie weder den Snapshot finalisieren noch Projektionszeilen löschen
- **AND** beendet sie sich ohne weitere Zustandswirkung

#### Scenario: Gezieltes Mutation-Update trifft während Reconciliation ein

- **GIVEN** eine Reconciliation desselben Projektions-Scopes läuft
- **WHEN** ein gezieltes Mutation-Upsert oder Identity-Delete beginnt
- **THEN** invalidiert der Host die ältere Reconciliation-Generation vor der lokalen Änderung
- **AND** kann der ältere Lauf die gezielte Änderung weder überschreiben noch beim Finalisieren löschen

#### Scenario: Mainserver bestätigt einen leeren Typ

- **GIVEN** die erste Seite enthält keine Datensätze
- **WHEN** der Mainserver zugleich belastbar `hasNextPage = false` meldet
- **THEN** finalisiert der Host einen vollständigen leeren Snapshot
- **AND** behandelt er die leere Seite nicht als unbekannten oder dauerhaft partiellen Zustand

### Requirement: Mainserver-Projektionsrefresh begrenzt sequenzielle Roundtrips

Das System MUST die Seitengröße des schlanken, upstream-paginierbaren Projektionspfads für News, Events, POIs und Generic Items einschließlich FAQs nach nachgewiesener Mainserver-Kompatibilität auf 100 Datensätze festlegen oder eine dokumentierte kompatible Fallback-Größe verwenden.

Die Round-Robin-Reihenfolge zwischen sichtbaren Inhaltstypen MUST erhalten bleiben, damit ein großer Typ die erste partielle Seite anderer Typen nicht blockiert.

Surveys MUST von diesem Vertrag ausgenommen bleiben, weil der bestätigte Mainserver-Vertrag für `surveys` keine serverseitige Pagination anbietet. Der Survey-Adapter MUST seine Selection reduzieren, darf lokale Pagination aber nicht als Reduktion der Upstream-Requests darstellen.

#### Scenario: Großer News-Bestand wird projiziert

- **GIVEN** der Mainserver liefert 582 News und unterstützt `pageSize = 100`
- **WHEN** der Host einen vollständigen Projection-List-Refresh ausführt
- **THEN** benötigt er höchstens sechs erfolgreiche News-Page-Requests
- **AND** persistiert er jede Seite vor dem nächsten Round-Robin-Schritt

#### Scenario: Mehrere Typen werden gleichzeitig aufgebaut

- **GIVEN** mehrere sichtbare Mainserver-Inhaltstypen besitzen noch keinen Snapshot
- **WHEN** der progressive Refresh beginnt
- **THEN** versucht der Coordinator die erste Seite jedes sichtbaren Typs, bevor er dessen nächste Seite lädt
- **AND** kann jeder erfolgreich persistierte Typ unabhängig partiell gelesen werden

#### Scenario: Surveys werden projiziert

- **GIVEN** der bestätigte Mainserver-Vertrag bietet für `surveys` weder `limit`/`skip` noch Cursor-Pagination
- **WHEN** der Host Surveys für die Projektion lädt
- **THEN** verwendet er eine schlanke Survey-Selection in einem vollständigen Upstream-Abruf
- **AND** wendet er `pageSize = 100`, partielle Upstream-Seiten und Round-Robin-Fortsetzung nicht auf Surveys an

### Requirement: Hot-Refresh priorisiert die neuesten Inhalte

Das System MUST bei einem manuellen oder interaktiven Refresh zuerst die neueste Projektionsseite jedes angefragten upstream-paginierbaren Inhaltstyps laden und persistieren. Die vollständige Reconciliation MUST anschließend entkoppelt im Hintergrund fortgesetzt werden, sofern sie nicht bereits anderweitig läuft. Für Surveys MUST der einzelne vollständige Upstream-Abruf als typspezifische Hot-Phase gelten.

#### Scenario: Redakteur startet einen Refresh

- **WHEN** ein Redakteur die Aktualisierung mehrerer Inhaltstypen startet
- **THEN** lädt der Coordinator in der Hot-Phase zuerst die neueste Seite jedes angefragten Typs
- **AND** persistiert jede erfolgreiche Seite sofort
- **AND** beantwortet er den interaktiven Request nach Abschluss der Hot-Phase mit dem Zustand der Typen
- **AND** wartet die Antwort nicht auf den vollständigen historischen Scan

#### Scenario: Reconciliation läuft nach der Hot-Phase weiter

- **GIVEN** die Hot-Phase wurde erfolgreich abgeschlossen
- **AND** ältere Quellseiten müssen noch geprüft werden
- **WHEN** der interaktive Request bereits beantwortet wurde
- **THEN** setzt ein entkoppelter Lauf die vollständige Reconciliation fort
- **AND** bleiben die Ergebnisse der Hot-Phase währenddessen lesbar

### Requirement: Projektionsrefresh verwendet nur bestätigte Mainserver-Verträge

Das System MUST für die bestehende Mainserver-Integration vollständige Reconciliation statt eines Delta-Wasserstands verwenden. Es MUST Offset-Pagination nicht als verlustfreien Delta-Sync behandeln und darf ohne bestätigten authentisierten Mainserver-Ereignisvertrag keinen Event-Ingress exponieren.

#### Scenario: Schneller Refresh wird geplant

- **GIVEN** die relevanten Mainserver-Listen bieten keinen stabilen Filter oder Cursor nach `(updatedAt, id)`
- **WHEN** der Coordinator einen schnellen Refresh plant
- **THEN** verwendet er die Hot-Phase mit anschließender vollständiger Reconciliation
- **AND** speichert er keinen vermeintlich verlustfreien Delta-Wasserstand

#### Scenario: Externe Mainserver-Änderung erfolgt

- **GIVEN** der bestätigte Mainserver-Vertrag bietet weder GraphQL-Subscriptions noch einen authentisierten Webhook- oder Message-Bus-Vertrag
- **WHEN** Inhalte außerhalb des Studios geändert oder gelöscht werden
- **THEN** erkennt die nächste vollständige Reconciliation diese Änderung
- **AND** exponiert Studio keinen unbestätigten Mainserver-Ereignisendpunkt

### Requirement: Gezielte Änderungen bleiben der schnellste Projektionspfad

Das System MUST die vorhandenen gezielten Mutation-Projection-Loader für News, Events, POIs, Generic Items und FAQs wiederverwenden und den Vertrag auf Surveys sowie weitere projizierte Typen mit verfügbarer Detailquelle erweitern. Ein erfolgreicher Fachschreibvorgang MUST nicht auf einen nachgelagerten vollständigen Projektionsrefresh warten.

#### Scenario: Unterstützte Studio-Mutation ist erfolgreich

- **WHEN** eine Mutation einen einzelnen Mainserver-Inhalt erfolgreich erstellt, ändert oder löscht
- **THEN** aktualisiert oder entfernt der Host ausschließlich die zugehörige lokale Projektionszeile über den typisierten Detailpfad
- **AND** bleibt eine spätere vollständige Reconciliation das Sicherheitsnetz

#### Scenario: Survey wird im Studio geändert

- **GIVEN** für Surveys steht eine stabile Detailquelle zur Verfügung
- **WHEN** eine Survey-Mutation erfolgreich endet
- **THEN** aktualisiert der Host die betroffene Survey-Projektionszeile gezielt
- **AND** startet er nicht allein deshalb einen blockierenden Vollrefresh des Survey-Bestands

### Requirement: The system SHALL support targeted projection updates after successful Mainserver content mutations

The system SHALL expose enough typed Mainserver integration surface to refresh a single News, Event, or POI projection row after a successful Studio-initiated mutation without forcing a type-wide list rebuild.

#### Scenario: Create or update uses typed detail read for targeted projection refresh

- **GIVEN** Studio has successfully executed a News, Event, or POI mutation against Mainserver
- **WHEN** the host refreshes the content-list projection for the affected record
- **THEN** it loads the affected record through the corresponding typed detail adapter
- **AND** it maps the response through the same typed integration layer used by the full projection path
- **AND** it upserts only the affected projection row instead of rebuilding the whole content type

#### Scenario: Delete uses record identity for targeted projection removal

- **GIVEN** Studio has successfully executed a News, Event, or POI delete against Mainserver
- **WHEN** the host refreshes the content-list projection for the affected record
- **THEN** it removes the projection row by the known record identity and projection scope
- **AND** it does not require a successful list-wide reload of the same content type

### Requirement: Mainserver mutation follow-up refresh failures remain deterministic and non-destructive

The system SHALL classify targeted projection-refresh failures after successful Mainserver mutations deterministically and SHALL preserve the existing periodic reconciliation path instead of turning those follow-up failures into implicit mutation rollbacks.

#### Scenario: Detail read after mutation returns unusable data

- **GIVEN** a Mainserver mutation succeeded but the follow-up typed detail read returns missing or invalid data for the affected News, Event, or POI record
- **WHEN** Studio handles the targeted projection refresh
- **THEN** Studio first performs a short, bounded retry for the typed detail read
- **AND** only after the retry budget is exhausted does it record a deterministic follow-up refresh failure
- **AND** it does not reinterpret the already successful mutation as failed
- **AND** the periodic full reconciliation path remains responsible for eventual consistency

#### Scenario: Mutation refresh is skipped deterministically when actor account resolution breaks

- **GIVEN** Studio has successfully executed a Mainserver mutation
- **AND** `actorAccountId` unexpectedly cannot be resolved for the follow-up projection refresh
- **WHEN** Studio evaluates the targeted refresh path
- **THEN** it keeps the mutation result fachlich successful
- **AND** it skips the projection follow-up refresh for that mutation
- **AND** it records the invariant violation deterministically for later investigation

#### Scenario: Targeted projection refresh preserves credential and scope semantics

- **GIVEN** Studio refreshes a single projection row after a successful Mainserver mutation
- **WHEN** it resolves credentials and projection scope for the follow-up refresh
- **THEN** it uses the same effective credential policy and scope semantics as the typed Mainserver mutation and projection mapping path
- **AND** it does not introduce a separate bypass credential flow for targeted refreshes

### Requirement: Mainserver-backed list projection scope SHALL remain isolated per account and effective credential context

The system SHALL derive the persistent projection scope, sync-state scope, and deduplication scope for Mainserver-backed content lists from the same account-aware context so no two requests with different Mainserver credentials can share a snapshot implicitly.

#### Scenario: Organization context does not collapse two account scopes into one snapshot

- **GIVEN** two users of the same instance act inside the same active organization
- **AND** their `actorAccountId` differs
- **WHEN** Studio loads or refreshes the Mainserver-backed list projection
- **THEN** it derives distinct projection and sync-state scopes for those requests
- **AND** it does not reuse deduplicated rows or refresh progress across the two accounts

#### Scenario: Projection scope contract stays consistent across persistence paths

- **GIVEN** Studio reads, writes, deduplicates, or deletes Mainserver-backed projection rows
- **WHEN** it derives the persistent scope for those operations
- **THEN** it uses the same contract based on `instanceId`, `actorAccountId`, `activeOrganizationId`, and `contentType`
- **AND** it does not persist a `keycloakSubject` fallback as an alternate scope key

#### Scenario: Projection delete uses the same account-aware scope as projection upsert

- **GIVEN** Studio removes a single Mainserver-backed projection row after a successful delete mutation
- **WHEN** it identifies the row to delete
- **THEN** it uses the same account-aware projection scope contract as list reads and targeted upserts
- **AND** it does not remove rows belonging to a different account scope

### Requirement: Mainserver list refresh SHALL fetch newest pages first and continue older pages progressively

The system SHALL support a paginated refresh strategy for News, Events, and POI list projections that loads the newest upstream pages first and persists them before older pages continue.

#### Scenario: First page uses upstream pagination and newest-first sort

- **GIVEN** Studio starts a background refresh for a Mainserver-backed content type
- **WHEN** it requests the first page from the typed Mainserver list adapter
- **THEN** it uses upstream pagination arguments equivalent to `page = 1` and `pageSize = 25`
- **AND** it requests the newest available records first using the snapshot-compatible `updatedAt DESC` sort semantics
- **AND** it persists the returned page before requesting older pages

#### Scenario: Older pages continue only after first pages of all visible types

- **GIVEN** Studio refreshes multiple visible Mainserver-backed content types for the same account-aware scope
- **WHEN** the refresh coordinator schedules follow-up pages
- **THEN** it may continue with older pages only after the first page of each visible type was attempted for that scope
- **AND** it preserves the same credential and projection-scope semantics for every subsequent page

#### Scenario: Refresh continues after a single page failure

- **GIVEN** Studio is running a progressive background refresh for multiple pages of a visible Mainserver-backed content type
- **WHEN** one page request fails deterministically
- **THEN** Studio records the page failure with enough context for observability
- **AND** it does not abort the overall refresh run for the whole scope
- **AND** it continues with the remaining scheduled page work according to the configured refresh strategy

### Requirement: Mainserver-Integration bleibt Adapter über öffentliche Server-Verträge

Das System MUST `@sva/sva-mainserver` als Integrationsgrenze halten, die Auth-, Runtime- und Mainserver-Fachlogik nur über öffentliche Package-Verträge verbindet.

#### Scenario: Mainserver-Code greift auf interne Fachimplementierungen zu

- **WHEN** `@sva/sva-mainserver` einen internen `src`-Pfad aus `@sva/auth-runtime`, `@sva/iam-admin` oder `@sva/instance-registry` importiert
- **THEN** schlagen die statischen Boundary-Gates fehl
- **AND** die Integration muss über öffentliche Adapter, Server-Verträge oder neutrale Runtime-Helfer erfolgen

### Requirement: Mainserver-Inhalte besitzen eine wiederverwendbare hostseitige Referenz

Das System MUST für Studio-initiierte Mutationen eine allgemeine External-Content-Referenz verwenden können, um Idempotenz, Studio-History und lokale Folgearbeit mit einer Mainserver-Entität zu korrelieren. Die Referenz MUST mindestens Instanz, Quellsystem, Quellentitätstyp, externe Entitäts-ID und Reconciliation-Status führen. Sie MUST optional bleiben und darf weder für Read-Pfade noch als fachliche Existenz-, Lifecycle-, Veröffentlichungs-, Autoren- oder Ownership-Quelle verwendet werden.

#### Scenario: Projekt-Create wird erfolgreich gebunden

- **WHEN** der Mainserver ein mit stabiler `externalId` angelegtes Projekt bestätigt
- **THEN** kann der Host die Studio-Mutation idempotent an die Mainserver-ID binden
- **AND** bleibt die Mainserver-ID auch ohne erfolgreiche lokale Bindung fachlich lesbar

#### Scenario: Providerantwort geht nach erfolgreichem Create verloren

- **WHEN** das Create-Ergebnis unbekannt bleibt, obwohl der Mainserver den Datensatz möglicherweise angelegt hat
- **THEN** markiert der Host vorhandene lokale Folgearbeit als `reconciliation_required`
- **AND** sucht der Repair-Pfad über die stabile `externalId`, bevor er eine erneute Anlage zulässt

#### Scenario: Mainserverwerte weichen vom lokalen Begleitzustand ab

- **WHEN** Status, Veröffentlichung, Autor oder Ownership im Mainserver von lokalen Cache- oder History-Metadaten abweichen
- **THEN** bleiben die Mainserverwerte fachlich führend
- **AND** repariert oder verwirft Reconciliation den lokalen Begleitzustand ohne fachliche Mainserver-Felder zu überschreiben

### Requirement: Mainserver-Zugriffe grenzen Featured Projects als eigenen GenericItem-Typ ab

Das System MUST Projekte-Routen auf GenericItems mit `genericType` gleich `FeaturedProject` begrenzen und diese Datensätze als `projects.project` projizieren. Listen MUST vollständig nach dem technischen Diskriminator und dem internen Löschstatus filtern, bevor lokale Pagination angewendet wird. Der frühere Diskriminator `PROJECT` MUST ohne Übergangs- oder Fallback-Verhalten als Fremdtyp gelten.

#### Scenario: Projekte-Liste wird aus gemischten GenericItems erzeugt

- **GIVEN** die Upstream-Seiten enthalten Projekte, gelöschte Projekte und andere GenericItem-Typen
- **WHEN** der Host die Projekte-Liste erzeugt
- **THEN** liest er alle Upstream-Seiten bis zum nachgewiesenen Ende
- **AND** gibt ausschließlich aktive Datensätze mit `genericType` gleich `FeaturedProject` zurück
- **AND** wendet erst danach die lokale Pagination an

#### Scenario: Fremdtyp wird über Projekte-Endpunkt adressiert

- **WHEN** eine ID eines anderen GenericItem-Typs einschließlich `PROJECT` über einen Projekte-Detail- oder Mutationspfad adressiert wird
- **THEN** antwortet der Host wie bei einer unbekannten Projekt-ID
- **AND** führt keine Mutation aus

### Requirement: Mainserver-Adapter bildet FeaturedProject-Felder verlustfrei ab

Das System MUST die kontrollierten FeaturedProject-Felder auf die festgelegten GenericItem-Felder abbilden und bei Studio-Updates alle fachfremden, unmittelbar zuvor gelesenen Felder erhalten. Der Adapter MUST den host-owned Status nach `payload.status` spiegeln sowie `visible` und `publishedAt` daraus ableiten; der Payload-Wert darf nicht zur unabhängigen Lifecycle-Quelle werden. Bildpositionen MUST aus der stabilen `mediaContents`-Reihenfolge abgeleitet werden; `sourceUrl.description` MUST im Projekte-Vertrag als Alternativtext behandelt werden.

#### Scenario: Sichtbare Projektfelder werden aktualisiert

- **GIVEN** ein bestehendes Projekt enthält sichtbare und verborgene GenericItem-Werte
- **WHEN** der Host eine gültige Projekte-Aktualisierung verarbeitet
- **THEN** ersetzt er ausschließlich die vom FeaturedProject-Vertrag kontrollierten Werte
- **AND** erhält alle übrigen GenericItem-Felder und unbekannten Payload-Schlüssel

#### Scenario: Bilder werden über den Projekte-Vertrag gelesen

- **WHEN** der Host die `mediaContents` eines Projekts in den FeaturedProject-Vertrag überführt
- **THEN** bildet er URL, Alternativtext, Bildunterschrift und Credits auf die vereinbarten Bildfelder ab
- **AND** erzeugt er die Position aus der Reihenfolge

#### Scenario: Abgeleitetes Veröffentlichungsfeld wird nicht als Eingabe akzeptiert

- **WHEN** eine Projekte-Mutation das nur lesbare Feld `Published` enthält
- **THEN** weist der Host die Mutation vor dem Mainserver-Aufruf ab
- **AND** leitet er `visible`, `publishedAt` und das ausgegebene Feld `Published` ausschließlich aus dem host-owned Lifecycle ab

### Requirement: V2-Mutationen binden den geladenen Sessionkontext

Das System MUST bei V2-Updates und -Deletes einen nicht autorisierenden Kontext-Bindungswert aus einem aktuellen Detail-Read verlangen und ihn vor dem Provider-Write gegen den authentifizierten Session- und Organisationskontext prüfen. Ein Client ohne vorhandenen Bindungswert MUST das Detail vor der Mutation erneut laden und MUST fail-closed abbrechen, wenn der Read keinen Bindungswert liefert. Requests ohne Vertragsversion dürfen nur im konfigurierten Legacy-Übergang ohne diesen Wert verarbeitet werden.

#### Scenario: V2-Update ohne Kontextbindung wird abgelehnt

- **GIVEN** ein Client sendet Vertragsversion 2
- **WHEN** er ein bestehendes Mainserver-Objekt ohne Kontext-Bindungswert aktualisiert
- **THEN** beginnt kein Provider-Write
- **AND** Studio antwortet mit einem deterministischen Context-Binding-Fehler

### Requirement: Projektionsscopes isolieren explizite Principals

Das System SHALL gezielte Mutation-Refreshes nach `user` und `organization` im Projektionsscope isolieren. Ein automatischer Full-Refresh SHALL nur seinen eigenen Scope ersetzen oder löschen und SHALL keine Zeilen eines expliziten anderen Principal-Scopes entfernen. Listenreads SHALL die für den aktuellen Account und die aktive Organisation zulässigen Principal-Scopes berücksichtigen.

#### Scenario: Persönlicher Full-Refresh erhält organisatorische Mutationsprojektion

- **GIVEN** ein `org_or_personal`-Kontext enthält eine durch eine Organisationsmutation aktualisierte Projektionszeile
- **WHEN** ein impliziter Full-Refresh mit persönlichen Credentials läuft
- **THEN** bleibt die organisatorische Projektionszeile erhalten

### Requirement: Cockpit-Cards-Adapter grenzt GenericItem-Datensätze fachlich ab

Das System MUST Cockpit Cards über den vorhandenen Mainserver-GenericItem-Transport lesen und schreiben. Der Host-Adapter MUST ausschließlich Datensätze mit `genericType` gleich `COCKPIT_CARD` als Cockpit Cards verarbeiten und diesen Wert bei Schreiboperationen erzwingen.

#### Scenario: Liste wird vor lokaler Pagination vollständig gefiltert

- **GIVEN** mehrere Upstream-Seiten mit Cockpit Cards und anderen GenericItems
- **WHEN** ein Benutzer eine Cockpit-Cards-Seite abruft
- **THEN** liest der Adapter alle Upstream-Seiten
- **AND** filtert und sortiert die vollständige Cockpit-Cards-Menge vor der lokalen Pagination

#### Scenario: Fremdtyp-ID kann nicht mutiert werden

- **GIVEN** die ID eines GenericItems mit einem anderen `genericType`
- **WHEN** ein berechtigter Benutzer Detail, Update oder Delete über Cockpit Cards aufruft
- **THEN** liefert der Adapter dieselbe Nichtgefunden-Klassifikation wie bei einer unbekannten ID
- **AND** führt keine Mutation aus

#### Scenario: Schreibvertrag wird serverseitig erzwungen

- **WHEN** eine Cockpit Card angelegt oder aktualisiert wird
- **THEN** erzwingt der Host `genericType` gleich `COCKPIT_CARD`, genau eine Kategorie, ausschließlich gültige optionale HTTPS-Bilder und höchstens einen HTTPS-Link
- **AND** normalisiert er das Öffnungsverhalten ohne Link auf `false`
- **AND** erhält er bei Updates `externalId`, unbekannte Payload-Schlüssel und unterstützte Medienmetadaten
- **AND** weist er fachfremde GenericItem-Felder ab

### Requirement: Nachrichten-Mutationen erhalten und erweitern das Payload

Der Mainserver-Nachrichtenadapter MUST vorhandene Payload-Eigenschaften erhalten und dabei `wasteLocationKeys` gezielt ersetzen oder entfernen.

#### Scenario: Gezielte Nachricht wird gespeichert

- **WHEN** eine Nachricht mit ausgewählten Abholorten gespeichert wird
- **THEN** sendet Create oder Update ein dedupliziertes Array unter `payload.wasteLocationKeys`
- **AND** bleiben nicht zugehörige Payload-Eigenschaften unverändert

#### Scenario: Globale Nachricht wird gespeichert

- **WHEN** eine Nachricht ohne Abholortziele gespeichert wird
- **THEN** wird `wasteLocationKeys` im Payload weggelassen
- **AND** bleiben nicht zugehörige Payload-Eigenschaften unverändert

### Requirement: Organisationszugänge verwenden den bestehenden Benutzer-Provisioning-Endpunkt

Das System SHALL einen organisationsbezogenen Mainserver-Zugang über denselben bestehenden Benutzer-Provisioning-Endpunkt wie persönliche Studioaccounts erzeugen. Es SHALL dafür einen realen, der Organisation instanzgebunden zugeordneten Keycloak-Subject und deterministisch aus Organisation und Tenant abgeleitete Benutzerdaten verwenden. Den Bootstrap-Bearer-Token SHALL es ausschließlich aus persönlichen Mainserver-Credentials des handelnden Administrators laden und dabei keinen Organisations-Credential-Fallback verwenden. Der SVA Mainserver SHALL für diesen Change nicht erweitert oder geändert werden.

#### Scenario: Studio leitet die erforderlichen Benutzerdaten ab

- **GIVEN** eine Organisation benötigt erstmals einen Mainserver-Zugang
- **WHEN** Studio den Provisioning-Payload bildet
- **THEN** verwendet es den realen Keycloak-Subject des zugeordneten Accounts
- **AND** leitet es E-Mail und Username grundsätzlich als normalisierte Form `<org-name>.<tenant-name>@smart-village.app` ab
- **AND** verwendet es Organisations- und Tenant-Anzeigenamen für die erforderlichen Namensfelder
- **AND** ergänzt es bei einer Kollision einen stabilen Organisations-ID-Anteil

#### Scenario: Wiederholung verwendet dieselbe technische Identität

- **GIVEN** eine Organisation besitzt bereits einen zugeordneten Account
- **WHEN** Provisionierung oder Reprovisionierung erneut ausgeführt wird
- **THEN** verwendet Studio denselben Keycloak-Subject und die persistierte E-Mail
- **AND** erzeugt es keinen zweiten Account aufgrund später geänderter Anzeigenamen

#### Scenario: Aktive Organisation beeinflusst den Bootstrap-Principal nicht

- **GIVEN** der handelnde Administrator hat eine aktive Organisation mit `org_only` oder fehlenden Organisations-Credentials
- **WHEN** Studio einen Organisationszugang provisioniert
- **THEN** lädt es den Provisioning-Token ausschließlich mit den persönlichen Credentials des Administrators
- **AND** verwendet es weder die aktive noch die zu provisionierende Organisation als Credential-Quelle

#### Scenario: Erfolgreiche Antwort versorgt Organisation und Principal-Binding

- **WHEN** der Mainserver gültige Application-Credentials und eine `data_provider_id` zurückgibt
- **THEN** speichert Studio Application-ID und Secret verschlüsselt im Organisations-Credential-Speicher
- **AND** exponiert es das Secret nicht über Read-Models, Logs oder Audit
- **AND** erzeugt oder bestätigt es die instanzgebundene DataProvider-Bindung für die Organisation über den bestehenden Binding-Vertrag
- **AND** bleiben die durch den Mainserver geschriebenen Keycloak-Credential-Attribute am zugeordneten Account erhalten

#### Scenario: Provisioning-Antwort begründet die garantierte Erstbindung

- **GIVEN** der Mainserver-API-Vertrag garantiert dieselbe DataProvider-ID in Provisioning-Antwort und `/data_provider.json`
- **WHEN** die Provisioning-Antwort eine gültige `data_provider_id` und vollständige Application-Credentials enthält
- **THEN** darf Studio diese ID als `create_response`-Evidenz für die credential-versionierte Organisations-Erstbindung verwenden
- **AND** verwendet es `/data_provider.json` für spätere Verifikation und Credential-Rotation

#### Scenario: Spätere Identity-Verifikation widerspricht der Erstbindung

- **GIVEN** eine Organisation besitzt eine aus der Provisioning-Antwort erzeugte Bindung
- **WHEN** `/data_provider.json` entgegen dem garantierten Vertrag eine andere DataProvider-ID liefert
- **THEN** überschreibt Studio die bestehende Bindung nicht
- **AND** persistiert es einen Binding-Konflikt und `reconciliation_required`

#### Scenario: Mainserver ist bei Organisationserstellung nicht verfügbar

- **WHEN** der Provisioning-Aufruf nicht konfiguriert ist, timeoutet oder mit einem Fehler antwortet
- **THEN** wird kein Mainserver-Zugang als erfolgreich behauptet
- **AND** wird die bereits erfolgreiche lokale Organisationserstellung nicht zurückgerollt
- **AND** bleibt der Vorgang ohne Credential-Geheimnisse diagnostizierbar und wiederholbar

#### Scenario: Upstream-Erfolg benötigt lokale Reconciliation

- **GIVEN** der Mainserver hat die Provisionierung bestätigt
- **WHEN** die anschließende lokale Credential- oder Binding-Persistenz fehlschlägt
- **THEN** bleibt der Upstream-Vorgang als erfolgreich beobachtet erhalten
- **AND** kennzeichnet Studio die lokale Folgearbeit als `reconciliation_required`
- **AND** meldet es nicht fälschlich einen Providerfehler

#### Scenario: Lost Response verhindert Accountkompensation

- **GIVEN** Studio hat den Mainserver-Provisioning-Request abgesendet
- **WHEN** keine eindeutige Antwort eintrifft
- **THEN** deaktiviert oder löscht Studio den zugeordneten technischen Account nicht automatisch
- **AND** persistiert es die Operation als `reconciliation_required`

### Requirement: Generische Projektionsadapter enthalten jeden GenericItem-Diskriminator

Das System MUST in allen generischen Mainserver-Projektionsadaptern jeden Datensatz vom Typ `GenericItem` unabhängig vom Wert seines Feldes `genericType` als `generic-items.generic-item` abbilden. Schlanker und Legacy-Adapter MUST denselben Inklusionsvertrag erfüllen und dürfen keine Allow- oder Denylist bekannter Fachtypen führen.

#### Scenario: Gemischte GenericItems werden schlank projiziert

- **GIVEN** eine Mainserver-Seite enthält freie GenericItems, FAQs, Kacheln, Featured Projects und einen unbekannten Diskriminator
- **WHEN** der schlanke Adapter die generische Projektion lädt
- **THEN** projiziert er jeden Datensatz als `generic-items.generic-item`
- **AND** behält die Upstream-Pagination unverändert bei

#### Scenario: Legacy-Adapter liefert dieselbe Typmenge

- **GIVEN** dieselbe gemischte Mainserver-Seite wird über den Legacy-Adapter geladen
- **WHEN** die generische Projektion aktualisiert wird
- **THEN** enthält sie dieselben GenericItem-IDs wie der schlanke Adapter
- **AND** filtert weder bekannte noch unbekannte `genericType`-Werte aus

#### Scenario: Fachprojektion bleibt zusätzlich typisiert

- **GIVEN** ein GenericItem erfüllt den Vertrag eines registrierten Fachplugins
- **WHEN** der Benutzer sowohl den generischen als auch den fachlichen Content-Type lesen darf
- **THEN** darf die Inhaltsprojektion getrennte Zeilen für beide Content-Types persistieren
- **AND** kollidieren ihre Projektionsschlüssel nicht

### Requirement: Mainserver ist die fachliche Wahrheit für Mainserver-basierte Content Items

Das System MUST Existenz, Identität, fachliche Felder, Lifecycle, Veröffentlichung, Autor und Ownership eines Mainserver-basierten Content Items ausschließlich aus dem bestätigten typisierten Mainserver-Vertrag ableiten. Lokale Content-Cores, External-Content-References, History- und Listenprojektionen MUST optional und vollständig rekonstruierbar bleiben und dürfen Sichtbarkeit, Detailzugriff oder reguläre Bearbeitung eines autorisierten Mainserver-Inhalts nicht voraussetzen.

#### Scenario: Inhalt wurde außerhalb des Studios erzeugt

- **GIVEN** ein autorisierter API-Client hat einen gültigen Mainserver-Inhalt angelegt
- **AND** im Studio existieren weder Content-Core noch External-Content-Reference oder History
- **WHEN** ein Benutzer mit der typspezifischen Read-Action die Fachliste oder den Detailpfad öffnet
- **THEN** zeigt das Studio den Inhalt aus dem typisierten Mainserver-Vertrag an
- **AND** erzeugt keine fachlichen Ersatzwerte aus lokalen Tabellen

#### Scenario: Lokaler Cache fehlt oder ist veraltet

- **GIVEN** ein Mainserver-Inhalt existiert und der lokale Projektionszustand fehlt oder ist veraltet
- **WHEN** die typisierte Quelle oder vollständige Reconciliation den Datensatz liefert
- **THEN** bleibt der Mainserver-Datensatz fachlich führend
- **AND** kann die lokale Projektion ohne fachliche Datenmigration neu aufgebaut werden

### Requirement: IAM autorisiert Mainserver-Content-Aktionen ohne lokale fachliche Ownership

Das System MUST Studio-IAM-Actions weiterhin vor Listen-, Detail- und Mutationszugriffen prüfen. IAM MUST dabei die erlaubte Aktion und den effektiven Organisations- oder Benutzerkontext bestimmen, darf aber weder die fachliche Existenz noch Status, Autor, Veröffentlichung oder Ownership eines Mainserver-Inhalts aus einem lokalen Content-Core ableiten.

#### Scenario: Read-Action ist vorhanden und lokaler Core fehlt

- **GIVEN** ein Mainserver-Inhalt existiert ohne lokalen Content-Core
- **AND** der Benutzer besitzt die typspezifische Read-Action im effektiven Credential-Kontext
- **WHEN** der Benutzer den Inhalt liest
- **THEN** erlaubt das Studio den typisierten Mainserver-Zugriff
- **AND** verlangt keinen lokalen Owner-Scope als zusätzliche Existenzbedingung

### Requirement: Lokale Folgefehler ändern bestätigte Mainserver-Mutationen nicht

Das System MUST eine vom Mainserver bestätigte Content-Mutation als fachlich erfolgreich behandeln. Nachgelagerte Fehler beim Schreiben von Reference, History oder Projektion MUST beobachtbar und reconciliation-fähig sein, dürfen aber weder einen Provider-Rollback vortäuschen noch dem Client einen fachlichen Mutationsfehler melden.

#### Scenario: Externes Projekt wird ohne lokalen Core aktualisiert

- **GIVEN** ein gültiges `FeaturedProject` existiert ausschließlich im Mainserver
- **AND** der Benutzer besitzt `projects.update`
- **WHEN** der Mainserver das Update bestätigt
- **THEN** antwortet der Projekte-Endpunkt erfolgreich mit dem Mainserver-Zustand
- **AND** ein fehlender oder fehlschlagender lokaler Begleitzustand ändert diesen Erfolg nicht

### Requirement: Root-GenericItems verwenden ausschließlich schreibbare GraphQL-Felder

Der Mainserver-Adapter MUST den Root-GenericItem-Vertrag an den Argumenten der Top-Level-Mutation `createGenericItem` ausrichten. Er MUST `ContentBlockInput.intro` für Einleitungen verwenden und darf `teaser` weder selektieren noch deklarieren, als Variable senden oder in Root-GenericItem-Typen modellieren. Ein in Query- oder verschachtelten Input-Typen historisch vorhandenes Teaser-Feld MUST für den Root-Vertrag ignoriert werden.

#### Scenario: Root-GenericItem wird angelegt oder aktualisiert

- **WHEN** der Adapter eine `createGenericItem`-Mutation für ein Root-GenericItem erzeugt
- **THEN** enthält das Dokument kein Argument und keine Variable `teaser`
- **AND** liegen optionale Einleitungen ausschließlich in `contentBlocks[].intro`

#### Scenario: Schema enthält ein historisches lesbares Teaser-Feld

- **GIVEN** der hinterlegte GraphQL-Snapshot führt `GenericItem.teaser` als lesbares Feld
- **WHEN** der Studio-Client sein GenericItem-Fragment erzeugt
- **THEN** selektiert er dieses Feld nicht
- **AND** bietet es nicht über den Studio-Vertrag an

#### Scenario: Verschachtelter Input besitzt ein Teaser-Feld

- **GIVEN** `GenericItemInput` enthält für verschachtelte GenericItems ein Feld `teaser`
- **WHEN** der Adapter ein Root-GenericItem schreibt
- **THEN** verwendet er dieses verschachtelte Feld nicht als Umgehung des Top-Level-Vertrags

### Requirement: News verwenden den nativen ContentBlockInput-Vertrag

Der Mainserver-Adapter MUST News-Einleitung und -Inhalt über `contentBlocks[].intro/body` lesen und schreiben. Er MUST historische Textfelder im News-Payload ignorieren und darf daraus keinen Fallback-Block synthetisieren.

#### Scenario: News-Antwort enthält historischen Payload-Text

- **GIVEN** der Mainserver liefert `payload.teaser` oder `payload.body`
- **AND** liefert keine Content-Blocks
- **WHEN** der Adapter die News abbildet
- **THEN** enthält die abgebildete News keine daraus erzeugten Content-Blocks

### Requirement: Project creation preserves its contract across internal module boundaries

The system SHALL keep the existing Featured Project create contract stable while separating authorization, idempotency recovery, pure mapping, provider mutation, and local follow-up responsibilities into focused internal modules.

#### Scenario: Invalid or unauthorized create stops before side effects

- **GIVEN** a Project create request fails CSRF, IAM authorization, principal resolution, idempotency-key validation, or payload validation
- **WHEN** the host handles `POST /api/v1/mainserver/projects`
- **THEN** it returns the existing deterministic error response
- **AND** it does not reserve the create or mutate the Mainserver

#### Scenario: Successful create preserves the side-effect sequence

- **GIVEN** a valid and authorized Project create request
- **WHEN** the Mainserver accepts the new Featured Project
- **THEN** the host records the DataProvider observation before changing visibility
- **AND** it performs optional local content and reference follow-up only after the provider write
- **AND** it finalizes the mutation journal before completing local idempotency

#### Scenario: Local follow-up failure does not invent a provider rollback

- **GIVEN** the Mainserver already confirmed Project creation
- **WHEN** visibility or optional local follow-up fails
- **THEN** the host does not issue a compensating provider delete
- **AND** it preserves the existing success or failure response for that exact stage
- **AND** a local-only follow-up failure does not add DataProvider-conflict metadata to the success response

#### Scenario: Replay and recovery keep existing semantics

- **GIVEN** a repeated idempotency key, a prepared external reference, or an unavailable local reservation store
- **WHEN** the Project create route recovers or rejects the operation
- **THEN** it uses the existing external ID and reference semantics
- **AND** it returns the existing replay, conflict, or unavailable error code without duplicate provider creation

### Requirement: Projektionsadapter verwenden die registrierte GenericItem-Zuständigkeit

Das System MUST Slim-, Legacy- und mutationsbezogene Projektionspfade mit derselben aus dem Build-time-Registry-Snapshot abgeleiteten Zuordnung von `genericType` zu `contentType` betreiben. Die Adapter MUST für die gemeinsame Inhaltsübersicht genau den aufgelösten Content-Type persistieren und zuvor vorhandene Geschwisterrepräsentationen bei vollständiger oder zielgerichteter Reconciliation entfernen.

#### Scenario: Vollständiger Refresh bereinigt doppelte Projektionen

- **GIVEN** ein Mainserver-GenericItem besitzt eine generische und eine fachliche Projektionszeile
- **AND** ein registriertes Fachplugin übernimmt seinen `genericType`
- **WHEN** ein vollständiger Projektionsrefresh erfolgreich abgeschlossen wird
- **THEN** bleibt ausschließlich die fachliche Projektionszeile bestehen
- **AND** meldet der abgeschlossene Snapshot keine generische Geschwisterrepräsentation

#### Scenario: Generic-Type wechselt zu einem registrierten Fachtyp

- **GIVEN** ein bislang unbekannter `genericType` wurde generisch projiziert
- **WHEN** eine erfolgreiche Mutation den Wert auf einen registrierten Fachtyp ändert
- **THEN** persistiert der Mutation-Follow-up die fachliche Repräsentation
- **AND** entfernt er die zuvor generische Repräsentation

#### Scenario: Generic-Type verliert seine registrierte Zuständigkeit

- **GIVEN** ein GenericItem wurde fachlich projiziert
- **WHEN** sein `genericType` erfolgreich auf einen nicht registrierten Wert geändert wird
- **THEN** persistiert der Mutation-Follow-up die generische Repräsentation
- **AND** entfernt er die zuvor fachliche Repräsentation

#### Scenario: Adapter erhalten die Zuordnung vom Host

- **WHEN** der Host einen Projektionsadapter initialisiert
- **THEN** übergibt er die aus der Plugin-Registry abgeleitete Zuständigkeitszuordnung über einen expliziten Vertrag
- **AND** importiert der Mainserver-Adapter weder die React-Anwendung noch einzelne Fachplugins

#### Scenario: Fremde Diskriminatoren füllen eine Upstream-Seite

- **GIVEN** eine angeforderte GenericItem-Projektion findet auf der ersten Upstream-Seite keinen passenden Diskriminator
- **AND** eine spätere Upstream-Seite enthält einen passenden Datensatz
- **WHEN** der Adapter die fachliche Projektionsseite lädt
- **THEN** scannt er bis zum passenden Datensatz oder bis zum Upstream-Ende weiter
- **AND** beendet der Host den Snapshot nicht aufgrund der leeren gefilterten Zwischenmenge

#### Scenario: Eine gefilterte Projektion lädt mehrere Folgeseiten

- **GIVEN** ein progressiver Refresh lädt mehrere Seiten derselben GenericItem-Projektion
- **WHEN** der Adapter eine gefilterte Seite mit einer weiteren Folgeseite zurückgibt
- **THEN** liefert er den Upstream-Offset hinter dem letzten ausgegebenen Datensatz mit
- **AND** setzt der nächste Seitenaufruf den Scan an diesem Offset fort, ohne vorherige Upstream-Seiten erneut zu laden

#### Scenario: Registry-Ziel besitzt keine GenericItem-Projektion

- **GIVEN** eine Ownership-Deklaration verweist auf einen Content-Type ohne Mainserver-GenericItem-Projektion
- **WHEN** der Host die serverseitige Zuordnung validiert
- **THEN** schlägt der Registry-Aufbau fail-fast fehl
- **AND** wird der Content-Type nicht für GenericItem-Mutation-Follow-ups verwendet

### Requirement: Mainserver-Detailadapter isolieren optionale Vertragsabweichungen

Das System MUST Mainserver-Detailantworten feldgruppenweise auswerten. Eine sichere Mainserver-ID und typbezogen deklarierte harte Mindestfelder bleiben Voraussetzung; Fehler optionaler Skalare, Listenpositionen oder Unterobjekte MUST als strukturierte Abweichungen neben den weiterhin verwendbaren Daten zurückgegeben werden, statt pauschal den gesamten Datensatz als `invalid_response` abzulehnen.

#### Scenario: Einzelner optionaler Listeneintrag ist ungültig

- **WHEN** eine Mainserver-Detailantwort eine gültige Identität sowie gültige und ungültige Einträge derselben optionalen Liste enthält
- **THEN** erhält der Adapter die sicher interpretierbaren Einträge
- **AND** meldet den ungültigen Eintrag mit stabilem Feldpfad, Abweichungscode, Phase und Behandlung
- **AND** gibt er den übrigen Datensatz erfolgreich zurück

#### Scenario: Anzeige-Default ersetzt keinen Originalwert

- **WHEN** der Adapter für ein abweichendes optionales Feld einen sicheren Anzeige-Default bereitstellt
- **THEN** kennzeichnet er diesen Wert als Default oder ausgelassen
- **AND** verwendet der Schreibpfad ihn nicht automatisch als Ersatz für den unmittelbar zuvor gelesenen Originalwert

#### Scenario: Fachlicher Diskriminator schützt die typisierte Route

- **WHEN** ein GenericItem-Detail nicht den für die aufgerufene Fachroute erforderlichen `genericType` besitzt
- **THEN** behandelt der Adapter den Diskriminator nicht als optionale Abweichung
- **AND** gibt die Route den bestehenden deterministischen Fehler zurück, ohne eine Mutation über das falsche Fachplugin zu ermöglichen

### Requirement: Mainserver-Abweichungen sind strukturiert und datensparsam beobachtbar

Das System MUST jede erkannte Mainserver-Vertragsabweichung serverseitig über den Server-Runtime-Logger mit stabilen, aggregierbaren Metadaten protokollieren. Logs MUST die nach bestehender Logging-Klassifizierung zulässigen und vorhandenen technischen Korrelationsfelder, Inhaltstyp, Operation, Phase, normalisierten Feldpfad, Abweichungscode und Behandlung enthalten und dürfen keine Rohwerte, Payloads, Freitexte, Kontaktdaten oder sonstige potenzielle PII enthalten. Konkrete Listenindizes und freie Payload-Schlüssel MUST aus aggregierbaren Feldpfaden entfernt werden.

#### Scenario: Optionale Feldabweichung wird erkannt

- **WHEN** ein Detailadapter eine optionale Feldabweichung isoliert
- **THEN** emittiert der Server genau einen strukturierten Befund pro Request, Feldpfad und Abweichungsklasse
- **AND** der Befund ist nach Inhaltstyp, Abweichungscode und Behandlung aggregierbar
- **AND** enthält er nicht den abweichenden Rohwert

#### Scenario: Listenabweichungen erzeugen begrenzte Kardinalität

- **WHEN** mehrere Listeneinträge desselben optionalen Felds denselben Vertrag verletzen
- **THEN** normalisiert der Server den Feldpfad ohne konkrete Listenindizes
- **AND** emittiert er höchstens einen Befund pro Request, normalisiertem Feldpfad und Abweichungsklasse

#### Scenario: Zusatzdienst degradiert den Editor

- **WHEN** ein optionaler Zusatzdienst für einen Mainserver-Datensatz fehlschlägt
- **THEN** protokolliert der Host die Phase `enrichment`, den betroffenen Dienst und die Behandlung `temporarily_unavailable`
- **AND** korreliert der Befund über vorhandene Request- oder Trace-IDs, ohne sensible Antwortdaten zu loggen

### Requirement: Mainserver-Updates erhalten bestätigte Passthrough-Feldgruppen

Das System MUST für Mainserver-Updates mit Erhaltungsbedarf unmittelbar vor der Mutation im selben effektiven Credential- und Organisationskontext den aktuellen Datensatz lesen und ausschließlich typbezogen deklarierte Feldgruppen zusammenführen. Der Merge MUST auf Felder begrenzt bleiben, die der bestätigte GraphQL-Lese- und Mutationsvertrag verlustfrei unterstützt. Vor der Migration eines Inhaltstyps MUST eine getestete Feldmatrix harte Mindestfelder, kontrollierte Editorfelder, nur lesbare Felder, Passthrough-Felder und nicht erhaltbare Felder klassifizieren.

#### Scenario: Update erhält unmittelbar zuvor gelesene Werte

- **GIVEN** ein Plugin deklariert kontrollierte und Passthrough-Feldgruppen für seinen Inhaltstyp
- **WHEN** der Host eine gültige Aktualisierung ausführt
- **THEN** liest er den aktuellen Datensatz im selben Instanz-, Account- und Organisationskontext
- **AND** ersetzt kontrollierte Felder aus der validierten Eingabe
- **AND** erhält deklarierte Passthrough-Felder aus dem aktuellen Datensatz
- **AND** sendet ausschließlich vom Mutation-Input unterstützte Variablen

#### Scenario: Read- und Write-Vertrag sind nicht symmetrisch

- **GIVEN** ein für die Erhaltung relevantes Feld kann nicht verlustfrei gelesen oder nicht im Mutation-Input übertragen werden
- **WHEN** der Adapter die Aktualisierung ohne Datenverlust nicht bilden kann
- **THEN** klassifiziert die Feldmatrix das Feld nicht als Passthrough
- **AND** blockiert der Server die betroffene Mutation vor dem Provider-Aufruf

#### Scenario: Parallele externe Änderung bleibt ein dokumentiertes Restrisiko

- **WHEN** sich der Mainserver-Datensatz zwischen dem vorbereitenden Read und der Mutation extern ändert
- **THEN** behauptet das System ohne Revision oder vergleichbare Vorbedingung keine konfliktfreie Zusammenführung
- **AND** stellt Reconciliation nicht als Wiederherstellung bereits überschriebener Providerfelder dar

### Requirement: Detailabweichungen werden rückwärtskompatibel transportiert

Das System MUST Detailabweichungen additiv über den gemeinsamen Host-/SDK-Vertrag bereitstellen. Bestehende typisierte Detailaufrufe, die ausschließlich den Datensatz erwarten, MUST während der Migration unverändert funktionieren; ein Plugin MUST Abweichungsmetadaten explizit über den erweiterten Vertrag anfordern oder aus einer versionierten Response-Hülle lesen.

#### Scenario: Bestehender Plugin-Client wird noch nicht migriert

- **GIVEN** ein Plugin verwendet weiterhin den bestehenden `get(id)`-Vertrag
- **WHEN** der Host den Abweichungsvertrag einführt
- **THEN** erhält der bestehende Client weiterhin den typisierten Datensatz in der bisherigen Form
- **AND** entstehen weder ein ungeplanter Response-Shape-Bruch noch ein erzwungener gleichzeitiger Big-Bang-Rollout aller Plugins

#### Scenario: Migrierter Plugin-Client fordert Detailmetadaten an

- **WHEN** ein migrierter Editor den erweiterten Detailvertrag verwendet
- **THEN** erhält er Datensatz und sichere Abweichungsmetadaten getrennt
- **AND** enthalten die Browser-Metadaten keine Rohwerte oder internen Fehlertexte

### Requirement: FAQ-Adapter grenzt GenericItem-Datensätze fachlich ab

Das System MUST FAQ über den bestehenden Mainserver-GenericItem-Transport lesen und schreiben, ohne eine parallele Mainserver-Datenentität einzuführen. Der Host-Adapter MUST ausschließlich GenericItems mit `genericType` gleich `FAQ` als FAQ verarbeiten und beim Schreiben diesen Diskriminator erzwingen.

#### Scenario: FAQ-Read enthält nur FAQ-Datensätze

- **WHEN** die FAQ-Fachliste oder ein FAQ-Detail geladen wird
- **THEN** liefert der Host-Adapter nur GenericItems mit `genericType` gleich `FAQ`
- **AND** verarbeitet er einen abweichenden Typ nicht als FAQ

#### Scenario: Vollständiges Paging wird vor der FAQ-Pagination gefiltert

- **GIVEN** mehrere Mainserver-Seiten, die sowohl FAQ als auch andere GenericItems enthalten
- **WHEN** ein Benutzer eine FAQ-Seite abruft
- **THEN** liest der Adapter alle Upstream-Seiten, bevor er nach `genericType` gleich `FAQ` filtert und sortiert
- **AND** berechnet er die Seite und Gesamtzahl ausschließlich aus der gefilterten FAQ-Menge

#### Scenario: FAQ-Write erzwingt den Diskriminator

- **WHEN** eine FAQ angelegt oder bearbeitet wird
- **THEN** setzt der Host-Adapter `genericType` auf `FAQ`
- **AND** erlaubt der Client nicht, diesen Wert zu verändern

#### Scenario: Fremdtyp-ID kann nicht über FAQ verändert oder gelöscht werden

- **GIVEN** die ID eines GenericItems mit einem `genericType` ungleich `FAQ`
- **WHEN** ein berechtigter Benutzer dessen FAQ-Detail aufruft oder eine FAQ-Update- beziehungsweise Delete-Operation anfordert
- **THEN** liefert der Adapter dieselbe Nichtgefunden-Klassifikation wie für eine unbekannte ID
- **AND** ruft er keine mutierende Mainserver-Operation auf

### Requirement: Content-list projection SHALL preserve its contract across internal module boundaries

The system SHALL preserve the existing authorization, account isolation,
snapshot, refresh, retry, error and mutation-follow-up semantics while the
host-side content-list projection is separated into focused internal modules.

#### Scenario: Read projection remains account- and permission-isolated

- **GIVEN** two requests differ in actor account, active organization, effective permission or credential context
- **WHEN** Studio resolves and reads their Mainserver-backed content projections
- **THEN** it uses the existing distinct projection and sync-state scopes
- **AND** it does not reuse rows, refresh progress or authorization decisions across those contexts

#### Scenario: Snapshot and refresh behavior remains stable

- **GIVEN** a projection snapshot is fresh, stale, partial, running, failed or missing
- **WHEN** Studio handles a filtered or unfiltered content-list request
- **THEN** it preserves the existing stale-readable and blocking behavior for that state
- **AND** it preserves the existing hot-phase, reconciliation, generation and retry ordering

#### Scenario: Mutation follow-up remains non-destructive

- **GIVEN** a Mainserver create, update or delete has already succeeded
- **WHEN** the targeted projection follow-up writes, removes, retries or fails
- **THEN** it uses the same account-aware target key and source identity as the full projection path
- **AND** it does not reinterpret the confirmed Mainserver mutation as failed
- **AND** periodic reconciliation remains the recovery path

#### Scenario: Internal failures remain fail-closed and observable

- **GIVEN** permission resolution, actor resolution, schema compatibility, DataProvider binding or Mainserver loading fails
- **WHEN** the projection runtime classifies the failure
- **THEN** it returns or records the existing deterministic error identity
- **AND** it adds no permissive Principal, credential or authorization fallback
- **AND** logging remains limited to the existing technical context

### Requirement: SVA-Mainserver-Service-Interna sind modular getrennt bei stabiler Fassade

Das System SHALL die öffentliche serverseitige Mainserver-Service-Fassade stabil halten und Infrastruktur- sowie ressourcenspezifische Implementierungsbelange in interne Module trennen.

Die öffentliche Fassade umfasst `createSvaMainserverService`, die zurückgegebenen Service-Methoden und die bestehenden Top-Level-Helper-Exporte aus `@sva/sva-mainserver/server`.

#### Scenario: Interne Module werden refaktoriert

- **GIVEN** die Mainserver-Serverlaufzeit wird intern gewartet
- **WHEN** Cache, Credential-Laden, Token-Laden, GraphQL-Transport, Telemetrie oder Ressourcen-Mappings geändert werden
- **THEN** liegen diese Verantwortlichkeiten in dedizierten internen Modulen statt in einer monolithischen Service-Datei
- **AND** verwenden Aufrufer weiterhin die unveränderte öffentliche Fassade

#### Scenario: Bestehende Aufrufer behalten ihren Vertrag

- **GIVEN** ein serverseitiger Aufrufer importiert `createSvaMainserverService` oder einen Top-Level-Helper aus `@sva/sva-mainserver/server`
- **WHEN** das refaktorierte Package gebaut und ausgeführt wird
- **THEN** ändern sich keine aufruferseitigen Methodennamen, Parameterverträge oder deterministischen Fehlercodes
- **AND** muss der Aufrufer keine neuen Importe oder eine generische Transport-API übernehmen

#### Scenario: Internes Verhalten bleibt fokussiert testbar

- **GIVEN** Credential-Caching, Token-Erneuerung, Retry-Semantik oder verschachteltes Mainserver-Mapping-Verhalten muss geändert werden
- **WHEN** Tests für dieses Verhalten aktualisiert werden
- **THEN** existieren fokussierte Unit-Tests für das relevante interne Modul
- **AND** prüft eine kleinere Service-Level-Testschicht weiterhin die Verdrahtung der Fassade und das Verhalten des Default-Service

### Requirement: Mainserver-Diagnostik besitzt eindeutige Fehlerownership und semantische Level

Das System MUST das abschließende Mainserver-Ergebnis an genau einer verantwortlichen Grenze protokollieren. Unerwartete interne oder Providerfehler mit 5xx-Ergebnis MUST dort als `error` erscheinen; erwartbare validierte Ablehnungen dürfen höchstens als `warn` erscheinen. Tiefere Clients MUST Fehler klassifiziert propagieren und dürfen dasselbe operative Ergebnis nicht erneut protokollieren.

#### Scenario: Providerfehler führt zu einem 5xx-Ergebnis

- **WHEN** ein unerwarteter Mainserver-Providerfehler als 5xx-Ergebnis beantwortet wird
- **THEN** emittiert die verantwortliche Mainserver-Routengrenze genau ein korreliertes `error`-Ereignis
- **AND** protokollieren tiefere Client- und Mapper-Schichten kein Duplikat desselben Fehlerereignisses

#### Scenario: Validierte Eingabe wird erwartbar abgelehnt

- **WHEN** eine Mainserver-Operation aufgrund eines erwartbaren fachlichen oder Eingabefehlers abgelehnt wird
- **THEN** emittiert die verantwortliche Grenze höchstens ein `warn`-Ereignis
- **AND** klassifiziert sie das Ergebnis mit einem stabilen Fehlercode ohne Payload oder freien Provider-Fehlertext

### Requirement: Routinemäßige Mainserver-Leseaktivität bleibt unterhalb von Info

Das System MUST erfolgreiche routinemäßige GraphQL-Reads, Credential-Cache-Treffer, Pagination- und Konfigurationszugriffe als `debug` protokollieren oder ohne Einzelereignis lassen. Erfolgreiche fachliche Mutationen dürfen an der verantwortlichen Grenze genau ein `info`-Ereignis erzeugen.

#### Scenario: GraphQL-Read und Credential-Cache sind erfolgreich

- **WHEN** ein GraphQL-Lesezugriff mit Credential-Cache-Treffer ohne Abweichung erfolgreich endet
- **THEN** erzeugen Client und Cache kein `info`-Ereignis pro internem Schritt
- **AND** dürfen diagnostische Details ausschließlich auf `debug` erscheinen

#### Scenario: Fachliche Mutation ist erfolgreich

- **WHEN** eine autorisierte Mainserver-Mutation erfolgreich fachlichen Zustand ändert
- **THEN** darf die verantwortliche Grenze genau ein strukturiertes `info`-Ergebnis mit sicheren Korrelationsfeldern emittieren
- **AND** erzeugen interne Cache- und GraphQL-Schritte keine zusätzlichen `info`-Erfolge
