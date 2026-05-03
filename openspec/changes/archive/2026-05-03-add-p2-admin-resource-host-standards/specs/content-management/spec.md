## ADDED Requirements

### Requirement: Content Admin Resources Use Host Standards
The system SHALL expose content-management admin resources through the host admin resource standards for list filtering, search, bulk operations, history, and revisions instead of bespoke per-content implementations.

#### Scenario: Content list uses host filters
- **GIVEN** a content type declares host-supported filters
- **WHEN** the content list is opened
- **THEN** the host applies the standard filter model and passes normalized query input to the content data layer

#### Scenario: Content list replaces local-only filter state
- **GIVEN** the content admin resource declares host-managed search, status filters, sorting, or pagination
- **WHEN** the content list renders
- **THEN** the list derives its visible query state from the host resource standard instead of independent component-local filter state

#### Scenario: Content type requests unsupported list behavior
- **GIVEN** a content type declares a list behavior outside the host standard
- **WHEN** the resource is registered
- **THEN** the host rejects the unsupported declaration or marks it unavailable with diagnostics
