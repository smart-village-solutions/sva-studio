## ADDED Requirements

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
