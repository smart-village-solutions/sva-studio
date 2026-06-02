## ADDED Requirements

### Requirement: Mainserver-Credential-Auflösung respektiert den aktiven Organisationskontext

The system SHALL resolve effective SVA Mainserver credentials from the active organization context before any server-side Mainserver adapter performs token acquisition or a GraphQL call. `contentAuthorPolicy` defines whether the adapter uses only organization credentials or falls back from the active organization to the current user's Keycloak-backed credentials.

#### Scenario: `org_only` uses only active organization credentials

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_only`
- **THEN** the adapter uses only the credentials stored for that active organization
- **AND** it does not retry with user credentials if the organization credentials are missing or incomplete

#### Scenario: `org_or_personal` falls back to the current user

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_or_personal`
- **AND** the active organization has no complete Mainserver credentials
- **THEN** the adapter falls back to the current user's Keycloak-backed credentials
- **AND** it continues to reject shared instance credentials or browser-provided credentials

#### Scenario: Adapter propagates the org-scoped resolver error unchanged

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_only`
- **AND** the active organization has no complete Mainserver credentials
- **THEN** no upstream token or GraphQL request is started
- **AND** the adapter propagates the resolver error code `organization_mainserver_credentials_missing` without remapping it

#### Scenario: Adapter propagates the shared missing-credentials error unchanged

- **GIVEN** a server-side Mainserver adapter resolves credentials for a request with `activeOrganizationId`
- **WHEN** the active organization's `contentAuthorPolicy` is `org_or_personal`
- **AND** the active organization has no complete Mainserver credentials
- **AND** the current user has no complete current or legacy Mainserver credentials
- **THEN** no upstream token or GraphQL request is started
- **AND** the adapter propagates the resolver error code `missing_credentials` without remapping it

### Requirement: Mainserver credential and token caches stay isolated per active organization context

The system SHALL include at least `instanceId`, `keycloakSubject`, `activeOrganizationId`, and the effective credential source or an equivalent credential signature in every credential and token cache key used by the SVA Mainserver integration so tokens from one organization context cannot be replayed in another context for the same user and instance.

#### Scenario: Same user switches between two organizations

- **GIVEN** the same authenticated user is a member of two organizations in the same instance
- **WHEN** the user performs Mainserver operations in organization A and then in organization B
- **THEN** credential resolution and token reuse are isolated by `activeOrganizationId`
- **AND** the integration does not reuse a token or credential cache entry from organization A inside organization B

#### Scenario: Cache keys encode the minimum isolation dimensions

- **GIVEN** the integration stores a credential or token cache entry for a Mainserver request
- **WHEN** the cache key is derived
- **THEN** it includes `instanceId`, `keycloakSubject`, `activeOrganizationId`, and the effective credential source or an equivalent credential signature
- **AND** two requests that differ in any of these dimensions do not share the same cache entry
