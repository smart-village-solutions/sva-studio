## ADDED Requirements

### Requirement: Managed account competence languages

Studio IAM SHALL provide a managed `competenceLanguages` account field, independent of interface language. Authorized tenant user administration SHALL validate, normalize and persist at most 40 language tags. Omitted update fields SHALL leave existing competence unchanged; an empty array SHALL clear it. The field SHALL NOT grant a permission and SHALL NOT be writable through the self-profile update path.

#### Scenario: Managed language update

- **WHEN** an authorized tenant administrator changes an account's competence languages
- **THEN** the updated values are persisted for that tenant and available to live directory reads and subsequent authorization projection
- **AND** the account's interface language remains unchanged

#### Scenario: Tenant and self-service boundaries

- **WHEN** a caller attempts to change another tenant's account or writes competence through self-profile input
- **THEN** the operation is rejected without changing competence

### Requirement: Tenant ordinary login MFA administration

Studio Core/IAM SHALL expose a tenant-authorized authentication policy using `iam.authenticationPolicy.manage`. The tenant system administrator baseline SHALL include this generic management permission without adding recording privileges. The setting SHALL use modes `optional` and `required`, default to optional, and be stored with the realm-owning instance record rather than plugin content. Root host access SHALL NOT substitute for tenant-local authorization.

#### Scenario: Tenant administrator configures MFA

- **WHEN** a tenant administrator with the management permission updates its tenant policy
- **THEN** Studio stores the desired mode, audits the change and queues the existing realm provisioning workflow
- **AND** another tenant's policy is unchanged

### Requirement: Verified authentication policy application

Studio SHALL distinguish desired mode from the last verified applied mode and report pending, applied or failed state using the existing provisioning job evidence. A mode SHALL be marked applied only after independent Keycloak read-back confirms the owned authentication configuration. A stale or superseded worker SHALL NOT mark a newer request applied. Failures SHALL preserve desired state and the last verified applied mode, or unknown if none was verified.

#### Scenario: Desired mode changed while an older job runs

- **WHEN** a worker completes for a superseded desired policy
- **THEN** it does not mark the current desired policy applied
- **AND** the latest desired policy remains pending or failed until its own verified application

### Requirement: Optional and required MFA authentication flows

Studio SHALL reconcile the realm authentication configuration so optional mode supports voluntary factor enrollment and required mode enforces enrollment and factor authentication for existing and new users. Changing to optional SHALL NOT remove enrolled credentials. Existing fresh step-up requests SHALL require a genuine second-factor authentication and SHALL NOT label password-only or reused stale authentication as fresh MFA. Reconciliation SHALL preserve unrelated realm settings and either preserve unmanaged flow bindings or report a visible conflict.

#### Scenario: Optional and required browser login

- **WHEN** a user without a factor logs into an optional-MFA tenant
- **THEN** ordinary password login is allowed
- **AND** changing the tenant to required mode requires enrollment and a second factor before completing ordinary login

#### Scenario: Requested fresh step-up

- **WHEN** a browser with an existing password-only session requests fresh MFA
- **THEN** Keycloak challenges for a second factor and issues accurate authentication level and time claims
- **AND** the session cookie alone cannot satisfy that request
