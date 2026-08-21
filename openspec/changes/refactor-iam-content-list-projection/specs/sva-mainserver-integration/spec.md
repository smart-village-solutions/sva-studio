## ADDED Requirements

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
