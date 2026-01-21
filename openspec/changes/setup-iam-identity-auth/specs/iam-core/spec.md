# IAM Core Specification

## ADDED Requirements

### Requirement: Keycloak-OIDC-Integration

The system SHALL provide OIDC-based authentication via Keycloak, enabling secure single sign-on (SSO) for both the SVA Studio CMS and the Smart Village App.

#### Scenario: User logs in via OIDC

- **WHEN** a user navigates to the CMS login page
- **AND** clicks "Login with Keycloak"
- **THEN** the user is redirected to the Keycloak login UI
- **AND** upon successful credential verification
- **THEN** the user is redirected back to the CMS with an authorization code
- **AND** the backend exchanges the code for an access token
- **AND** a user session is established

#### Scenario: Invalid or expired token

- **WHEN** a request includes an invalid JWT token
- **THEN** the backend responds with HTTP 401 Unauthorized
- **WHEN** a request includes an expired access token
- **THEN** the backend attempts to refresh via the refresh token
- **AND** if refresh succeeds, the request is retried
- **AND** if refresh fails, HTTP 401 is returned

### Requirement: Token Validation & User Identity

The system SHALL validate JWT tokens issued by Keycloak and extract user identity claims for authorization decision-making.

#### Scenario: Token signature verification

- **WHEN** a request arrives with a JWT token
- **THEN** the backend verifies the signature using Keycloak's public key
- **AND** validates claims (iss, aud, exp, nbf)
- **AND** if any validation fails, the request is rejected

#### Scenario: User context extraction

- **WHEN** a token is valid
- **THEN** the system extracts `sub` (user ID), `email`, `name` claims
- **AND** loads additional user data from the CMS database (organizations, roles)
- **AND** injects a `UserContext` object into the request for downstream handlers

### Requirement: Session Management

The system SHALL manage user sessions securely, with automatic expiration and token refresh.

#### Scenario: Session expiration

- **WHEN** a user's access token expires
- **THEN** any API request fails with HTTP 401
- **AND** the frontend triggers a token refresh
- **AND** the new access token is stored securely (HttpOnly cookie)

#### Scenario: Logout

- **WHEN** a user clicks "Logout"
- **THEN** the session is invalidated (cookies cleared, tokens revoked)
- **AND** the user is redirected to Keycloak logout endpoint
- **AND** then back to the public CMS home page

### Requirement: Multi-Organization Support

The system SHALL support users belonging to multiple organizations and enforce organization-scoped data access.

#### Scenario: User with multiple org memberships

- **WHEN** a user is member of Organization A, B, and C
- **THEN** the user can switch between organizations in the CMS UI
- **AND** when switched, all data queries are scoped to the selected organization
- **AND** row-level security policies enforce this scoping

#### Scenario: Cross-organization data isolation

- **WHEN** User X (member of Org A) makes a request
- **THEN** the system will NOT return data from Org B or C
- **AND** even if the user directly queries the database with a manual SQL statement, RLS policies prevent access

### Requirement: Audit Logging for IAM Events

The system SHALL log all security-relevant IAM events immutably for compliance and troubleshooting.

#### Scenario: Login attempt logged

- **WHEN** a user successfully logs in
- **THEN** an event is recorded in `iam.activity_logs` with timestamp, user ID, IP address, user agent
- **AND** the log entry CANNOT be modified or deleted after creation

#### Scenario: Account creation triggered by first login

- **WHEN** a user logs in for the first time via a new Keycloak account
- **THEN** a new account record is created in `iam.accounts`
- **AND** the creation event is logged with the Keycloak ID as the link

---

## MODIFIED Requirements

(None for Phase 1 – this is a foundation capability.)

---

## REMOVED Requirements

(None for Phase 1.)
