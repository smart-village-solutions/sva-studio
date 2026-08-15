## ADDED Requirements

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
