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
- **THEN** Studio records a deterministic follow-up refresh failure
- **AND** it does not reinterpret the already successful mutation as failed
- **AND** the periodic full reconciliation path remains responsible for eventual consistency

#### Scenario: Targeted projection refresh preserves credential and scope semantics
- **GIVEN** Studio refreshes a single projection row after a successful Mainserver mutation
- **WHEN** it resolves credentials and projection scope for the follow-up refresh
- **THEN** it uses the same effective credential policy and scope semantics as the typed Mainserver mutation and projection mapping path
- **AND** it does not introduce a separate bypass credential flow for targeted refreshes
