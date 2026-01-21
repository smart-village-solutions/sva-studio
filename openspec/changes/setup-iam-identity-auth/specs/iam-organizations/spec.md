# Organizations Specification

## ADDED Requirements

### Requirement: Hierarchical Organization Model

The system SHALL support multi-level hierarchical organization structures (e.g., County → Municipality → District → Organization) with parent-child relationships.

#### Scenario: Create hierarchical organization structure

- **WHEN** an administrator creates a new organization
- **THEN** they can optionally specify a parent organization
- **AND** the system records the hierarchical relationship (`parentOrganizationId`)
- **AND** the organization inherits access control policies from its parent unless explicitly overridden

#### Scenario: Query organization tree

- **WHEN** a system administrator requests the full organization tree
- **THEN** the system returns a hierarchical structure (County with nested Municipalities, each with Ortsteile)
- **AND** the query completes in < 500ms even with 1000+ organizations

### Requirement: User-Organization Memberships

The system SHALL support many-to-many relationships between users and organizations, allowing a user to belong to multiple organizations simultaneously.

#### Scenario: User in multiple organizations

- **WHEN** a user (e.g., "Anna") is added to Organization A, B, and C
- **THEN** the system stores these memberships in `iam.account_organizations`
- **AND** Anna can switch between organizations in the CMS interface
- **AND** Anna's visible data changes based on the selected organization

#### Scenario: Join date tracking

- **WHEN** a user joins an organization
- **THEN** the system records `joinedAt` timestamp
- **AND** this timestamp is used for audit purposes (who joined when)

### Requirement: Row-Level Security (RLS)

The system SHALL enforce multi-tenant data isolation through database-level RLS policies on the `organizationId` column.

#### Scenario: RLS policy prevents cross-org data access

- **WHEN** a database query is executed with user context
- **THEN** Postgres RLS policies automatically filter rows to match the user's current organization
- **AND** even if a malicious actor bypasses application logic, the database enforces isolation
- **AND** no RLS bypass is possible without database-level admin access

#### Scenario: RLS policy validation in tests

- **WHEN** integration tests run
- **THEN** a test explicitly verifies that User A (Org A) cannot query data from Org B
- **AND** the test confirms RLS prevents this access at the SQL layer

### Requirement: Organization Membership Assignment

The system SHALL provide mechanisms for administrators to assign users to organizations (via UI, bulk import, or API).

#### Scenario: Assign user to organization via UI

- **WHEN** an administrator navigates to "Manage Users" for Organization X
- **AND** clicks "Add Member"
- **THEN** a dialog appears to select an existing user
- **AND** upon confirmation, the membership is created and logged

#### Scenario: Bulk CSV import

- **WHEN** an administrator uploads a CSV file with rows `(email, organization_name, role)`
- **THEN** the system parses the CSV
- **AND** for each row, attempts to find or create the user account
- **AND** assigns the user to the organization with the specified role
- **AND** returns a report (success/failure per row)

### Requirement: Organization Metadata

The system SHALL store and manage organization-specific metadata (name, contact info, branding, etc.).

#### Scenario: Organization profile

- **WHEN** an administrator edits organization settings
- **THEN** they can update: name, description, logo URL, contact email, phone, address
- **AND** these fields are stored in `iam.organizations`
- **AND** are returned in API responses for rendering in the CMS UI

---

## MODIFIED Requirements

(None for Phase 2.)

---

## REMOVED Requirements

(None for Phase 2.)
