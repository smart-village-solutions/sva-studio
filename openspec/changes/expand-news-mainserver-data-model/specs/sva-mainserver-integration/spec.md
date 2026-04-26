## ADDED Requirements

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
