## ADDED Requirements
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
