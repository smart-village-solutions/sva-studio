# sva-mainserver-integration Specification

## Purpose
TBD - created by archiving change add-news-mainserver-integration. Update Purpose after archive.
## Requirements
### Requirement: Typed News GraphQL Adapters

The system SHALL expose typed, server-only SVA Mainserver adapters for News list, detail, create, update, and archive-or-delete operations.

The adapters SHALL use the existing per-user SVA Mainserver delegation chain and SHALL NOT expose a generic GraphQL executor to browser code, plugin code, or app UI components.

#### Scenario: News list is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and Mainserver credentials
- **WHEN** the News list is requested
- **THEN** the host calls a typed server-side News list adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `newsItems` GraphQL query through the existing Mainserver service path
- **AND** the browser receives only the mapped plugin News list model

#### Scenario: News detail is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and Mainserver credentials
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

The system SHALL execute News create, update, archive, and delete mutations with the current user's Mainserver credentials rather than shared instance credentials.

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

### Requirement: Typed Event GraphQL Adapters

The system SHALL expose typed, server-only SVA Mainserver adapters for Event list, detail, create, update, and archive-or-delete operations.

The adapters SHALL use the existing per-user SVA Mainserver delegation chain and SHALL NOT expose a generic GraphQL executor to browser code, plugin code, or app UI components.

#### Scenario: Event list is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and Mainserver credentials
- **WHEN** the Events list is requested
- **THEN** the host calls a typed server-side Event list adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `eventRecords` GraphQL query through the existing Mainserver service path
- **AND** the browser receives only the mapped plugin Events list model

#### Scenario: Event detail is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and Mainserver credentials
- **WHEN** a single Event is requested
- **THEN** the host calls a typed server-side Event detail adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `eventRecord(id: ID!)` GraphQL query with typed variables
- **AND** missing or invalid response data is mapped to a deterministic integration error

#### Scenario: Events plugin attempts generic GraphQL access

- **GIVEN** `@sva/plugin-events` needs Event data
- **WHEN** the plugin code is built or reviewed
- **THEN** it does not import `@sva/sva-mainserver/server`
- **AND** it does not receive a raw GraphQL endpoint, token, secret, or generic query executor

### Requirement: Typed POI GraphQL Adapters

The system SHALL expose typed, server-only SVA Mainserver adapters for Point-of-Interest list, detail, create, update, and archive-or-delete operations.

The adapters SHALL use the existing per-user SVA Mainserver delegation chain and SHALL NOT expose a generic GraphQL executor to browser code, plugin code, or app UI components.

#### Scenario: POI list is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and Mainserver credentials
- **WHEN** the POI list is requested
- **THEN** the host calls a typed server-side POI list adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `pointsOfInterest` GraphQL query through the existing Mainserver service path
- **AND** the browser receives only the mapped plugin POI list model

#### Scenario: POI detail is loaded through typed adapter

- **GIVEN** a user has a valid Studio session, instance context, local content permission, and Mainserver credentials
- **WHEN** a single POI is requested
- **THEN** the host calls a typed server-side POI detail adapter in `@sva/sva-mainserver/server`
- **AND** the adapter executes the `pointOfInterest(id: ID!)` GraphQL query with typed variables
- **AND** missing or invalid response data is mapped to a deterministic integration error

#### Scenario: POI plugin attempts generic GraphQL access

- **GIVEN** `@sva/plugin-poi` needs POI data
- **WHEN** the plugin code is built or reviewed
- **THEN** it does not import `@sva/sva-mainserver/server`
- **AND** it does not receive a raw GraphQL endpoint, token, secret, or generic query executor

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

### Requirement: Event And POI Mutations Preserve Per-User Delegation

The system SHALL execute Event and POI create, update, archive, and delete mutations with the current user's Mainserver credentials rather than shared instance credentials.

#### Scenario: User creates Event

- **GIVEN** a user has local Studio permission and Mainserver permission to create Events
- **WHEN** the user submits a valid Event form
- **THEN** the server obtains an access token using that user's Keycloak-stored Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting Event is mapped back to the Events plugin model

#### Scenario: User creates POI

- **GIVEN** a user has local Studio permission and Mainserver permission to create POI
- **WHEN** the user submits a valid POI form
- **THEN** the server obtains an access token using that user's Keycloak-stored Mainserver credentials
- **AND** the GraphQL mutation is executed with that token
- **AND** the resulting POI is mapped back to the POI plugin model

#### Scenario: Mainserver denies mutation

- **GIVEN** the user has local Studio permission but the Mainserver denies the delegated Event or POI mutation
- **WHEN** the mutation response indicates unauthorized or forbidden
- **THEN** Studio surfaces a deterministic authorization error
- **AND** Studio does not retry with shared or elevated credentials

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
- **AND** the mutation is executed through the existing per-user Mainserver delegation path
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

