## ADDED Requirements

### Requirement: News Plugin Uses Complete Mainserver News Model

The News plugin SHALL use a plugin-owned model that covers the complete SVA Mainserver News data model available through the host-owned News facade.

The editable model SHALL include scalar mutation fields, nested mutation fields, operation options, and the existing News payload. The detail/list model SHALL additionally include read-only and derived Mainserver fields.

#### Scenario: Existing Phase-1 News item is edited

- **GIVEN** an existing Mainserver News item only contains the Phase-1 fields `title`, `publishedAt`, and `payload`
- **WHEN** the editor loads it after the full model expansion
- **THEN** the editor renders valid defaults for all newly supported optional fields
- **AND** saving the item preserves compatibility with the existing Mainserver update path

#### Scenario: Full News item is edited

- **GIVEN** a Mainserver News item includes scalar fields, categories, source URL, address, content blocks, media references, and read-only metadata
- **WHEN** the editor loads the item
- **THEN** all editable fields are represented in form state
- **AND** read-only metadata is available without becoming mutable input

### Requirement: News Editor Covers Snapshot-backed Mutation Fields

The News editor SHALL provide user-facing controls for all approved editable `createNewsItem` fields.

Editable fields SHALL include `title`, `author`, `keywords`, `externalId`, `fullVersion`, `charactersToBeShown`, `newsType`, `publicationDate`, `publishedAt`, `showPublishDate`, `categoryName`, `categories`, `sourceUrl`, `address`, `contentBlocks`, `pointOfInterestId`, and the operation option `pushNotification`.

#### Scenario: User creates a full News item

- **GIVEN** the user has permission to create News
- **WHEN** the user completes the full News form and submits it
- **THEN** the plugin sends the complete editable model to the host-owned News facade
- **AND** the host writes only validated snapshot-backed fields to Mainserver
- **AND** the UI shows success feedback after the Mainserver response is mapped back

#### Scenario: User submits invalid full News form

- **GIVEN** the user submits invalid URLs, invalid dates, invalid `charactersToBeShown`, or invalid nested list values
- **WHEN** the form or host validates the input
- **THEN** the request is rejected before GraphQL execution
- **AND** the UI shows localized validation feedback

### Requirement: News Payload Does Not Hide Dedicated Mainserver Fields

The News plugin SHALL NOT store Mainserver fields with dedicated GraphQL arguments inside generic `payload`.

`payload` SHALL be treated as a legacy read fallback only. The plugin SHALL NOT send `payload` during create or update. `author`, `keywords`, `externalId`, `newsType`, `sourceUrl`, `address`, `categories`, `contentBlocks`, `pointOfInterestId`, and publication controls are represented as first-class fields.

#### Scenario: Plugin saves News with source URL and address

- **GIVEN** the user fills `sourceUrl` and `address`
- **WHEN** the News item is saved
- **THEN** those values are sent as `sourceUrl` and `address` mutation variables
- **AND** `payload` is not sent with the mutation

#### Scenario: Legacy payload contains overlapping values

- **GIVEN** an old News payload contains keys that overlap with dedicated Mainserver fields
- **WHEN** the item is loaded
- **THEN** the plugin normalizes legacy payload content into first-class editor fields such as `contentBlocks`
- **AND** save behavior follows the dedicated Mainserver fields without writing `payload`

### Requirement: News ContentBlocks Are The Leading Content Model

The News plugin SHALL treat `contentBlocks` as the leading News content model.

Existing payload-only News SHALL remain readable by mapping legacy payload values into a virtual content block on load. Saves SHALL write `contentBlocks` and SHALL NOT write payload.

#### Scenario: Legacy payload-only News is loaded

- **GIVEN** an existing Mainserver News item has no `contentBlocks` but contains legacy payload body data
- **WHEN** the editor loads the item
- **THEN** the editor shows a content block derived from the legacy payload
- **AND** the next save writes the block through `contentBlocks`
- **AND** the next save does not write payload

#### Scenario: User edits multiple content blocks

- **GIVEN** the user edits multiple content blocks with media URL references
- **WHEN** the item is saved
- **THEN** the host sends the complete `contentBlocks` list as the new Mainserver state
- **AND** individual block IDs are not required because `ContentBlockInput` does not expose IDs

### Requirement: News Read-only Metadata Is Visible Or Documented

The News plugin SHALL either display or explicitly document read-only Mainserver News metadata returned by the host facade.

Read-only metadata includes `id`, `createdAt`, `updatedAt`, `visible`, `dataProvider`, `settings`, `announcements`, `likeCount`, `likedByMe`, and `pushNotificationsSentAt`.

#### Scenario: News has Mainserver metadata

- **GIVEN** the Mainserver returns read-only metadata for a News item
- **WHEN** the editor/detail view is rendered
- **THEN** the metadata is available to the user or documented as intentionally hidden
- **AND** it is not sent back as mutable input

### Requirement: News Facade Keeps Security Gates For Full Model Mutations

The host-owned News facade SHALL apply the same security gates to full-model News mutations as to the Phase-1 News mutations.

The facade SHALL validate session, instance context, local content primitives, CSRF, idempotency for create, Mainserver credentials, request shape, and plugin-facing error mapping before executing Mainserver writes.

#### Scenario: Full News create is retried

- **GIVEN** a user submits a full News create request with an `Idempotency-Key`
- **WHEN** the request is retried with the same payload
- **THEN** the host returns the idempotent replay response
- **AND** no duplicate Mainserver News item is created

#### Scenario: Full News mutation fails upstream

- **GIVEN** Mainserver rejects or fails a full News create request after idempotency reservation
- **WHEN** the host maps the error
- **THEN** the idempotency record is completed as failed
- **AND** the UI receives a stable plugin-facing error response
