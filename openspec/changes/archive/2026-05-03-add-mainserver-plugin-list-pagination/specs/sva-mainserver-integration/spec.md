## ADDED Requirements

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
