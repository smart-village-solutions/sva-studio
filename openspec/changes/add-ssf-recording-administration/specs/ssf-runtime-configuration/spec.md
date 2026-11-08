## ADDED Requirements

### Requirement: Studio recording retention inheritance

Studio SHALL resolve recording retention from a tenant override, otherwise the installation default, otherwise 720 hours. Explicit values SHALL be integers from 1 to 8760 hours. Studio SHALL return the effective value as `recording.retentionHours` and revise `configurationRevision` whenever effective recording policy changes. Default changes SHALL NOT rewrite existing archive expiry dates.

#### Scenario: No configured retention
- **WHEN** neither installation nor tenant has a recording retention value
- **THEN** an explicitly configured recording policy receives `retentionHours` 720
- **AND** recording is not automatically enabled

#### Scenario: Tenant override and reset
- **WHEN** the installation default is 1440 hours and the tenant override is 240 hours
- **THEN** Studio returns 240 hours for that tenant
- **AND** removing the override restores 1440 hours

#### Scenario: Invalid explicit duration
- **WHEN** an administrator submits zero, a non-integer or a value above 8760
- **THEN** Studio rejects the write without replacing the previous configuration

### Requirement: Explicit recording policy administration

Studio SHALL administer the consumer's recording fields, default tenant enablement to false, and return a complete valid policy only after explicit configuration. Missing or invalid recording policy SHALL leave recording unavailable in SSF. Legal wording SHALL NOT grant permissions or enable recording. Audit retention SHALL be at least recording retention.

#### Scenario: Texts without recording configuration
- **WHEN** an organisation supplies legal wording without enabling a valid recording policy
- **THEN** SSF can display the wording and recording remains unavailable

#### Scenario: Inconsistent audit duration
- **WHEN** a configured recording duration exceeds audit retention
- **THEN** Studio rejects publishing that policy

#### Scenario: Recording enablement survives content resolution
- **WHEN** an administrator explicitly enables a complete tenant recording policy
- **THEN** Studio preserves `recording.enabled=true` in its runtime response
- **AND** generic content suppression metadata does not remove that policy field

#### Scenario: Installation template cannot enable a tenant
- **WHEN** an installation template contains recording defaults and a tenant has no explicit recording enablement
- **THEN** recording stays disabled for that tenant

### Requirement: Organisation recording texts

Studio SHALL support versioned per-language organisation consent and release wording using the existing `legalTexts` contract and consumer-supported `recording.texts`. Missing configuration SHALL preserve SSF draft-text fallback and the existing explicit source-language fallback behavior. Edits SHALL change the effective configuration revision.

#### Scenario: Organisation edits consent
- **WHEN** an organisation updates its localized recording consent
- **THEN** the next runtime read returns the updated wording and a new revision
- **AND** SSF's existing stale-consent checks remain applicable

### Requirement: Recording identity and live directory

Studio SHALL administer `ssf.recording.request`, `ssf.recording.review`, `ssf.recording.review.sworn`, `ssf.recording.supervise` and `ssf.recording.recovery.custodian`. It SHALL project effective permissions as `ssf_permissions` and reviewer languages as `ssf_languages` in the intended staff tokens. It SHALL provide `/internal/plugins/ssf/v2/recording-directory` with `contractVersion`, `tenantId`, `directoryRevision` and users containing `sub`, `displayName`, `permissions` and `languages`. The service SHALL authorize the technical caller, isolate tenants and resolve live effective permissions. No permission alone SHALL grant decryption access.

#### Scenario: Grant revoked
- **WHEN** a user's recording permission is revoked
- **THEN** the next directory read reflects the remaining effective permissions or omits the user if none remain

#### Scenario: Directory unavailable
- **WHEN** Studio cannot resolve authoritative permissions
- **THEN** it returns the consumer-supported unavailable error rather than stale success

#### Scenario: Tenant isolation
- **WHEN** the service reads the directory for tenant A
- **THEN** no tenant B user appears

#### Scenario: Administrator baseline does not grant recording privileges
- **WHEN** Studio provisions or reconciles the SSF tenant administrator role
- **THEN** its existing configuration-management grants do not implicitly add any recording permission

#### Scenario: Language-only update
- **WHEN** an administrator changes a reviewer's competence languages without changing permissions
- **THEN** the next live directory response reflects the change
- **AND** authorization reconciliation projects the changed `ssf_languages` value into newly issued staff tokens

### Requirement: Studio managed optional login MFA

Studio SHALL manage optional or required ordinary-login MFA per organisation through Keycloak provisioning and reconciliation. The default SHALL be optional with voluntary enrollment. Required MFA SHALL enforce enrollment and a second factor for ordinary login. Optional login MFA SHALL NOT bypass existing SSF sensitive-action MFA checks or mislabel password-only authentication as `acr=mfa`.

Studio Core/IAM SHALL authorize tenant administrators to manage only their own tenant realm policy through its management path. It SHALL persist desired state separately from verified applied state and expose pending or failed reconciliation without claiming successful enforcement. This authentication policy SHALL NOT be stored in SSF plugin content.

#### Scenario: Optional ordinary login
- **WHEN** a tenant uses optional MFA and a user has no enrolled factor
- **THEN** the user can complete ordinary login
- **AND** a sensitive recording action still requires fresh MFA

#### Scenario: Voluntary enrollment
- **WHEN** a user voluntarily configures OTP in an optional-MFA tenant
- **THEN** ordinary login requests that configured second factor

#### Scenario: Required MFA reconciliation
- **WHEN** an administrator requires MFA for a tenant
- **THEN** Studio applies the Keycloak configuration through an audited reconciliation
- **AND** Studio reports it applied only after success

#### Scenario: Keycloak application fails
- **WHEN** the desired mode is required and Keycloak application or read-back fails
- **THEN** Studio retains the desired mode and reports failed reconciliation
- **AND** its applied mode remains the last verified mode or unknown if none was verified
- **AND** Studio does not report required MFA as applied

### Requirement: Retired storage controls and truthful guest wording

Studio SHALL remove the legacy conversation-storage choice from administration and remove obsolete fixed 180-day storage promises from active guest content. Compatibility output, if still required, SHALL use `conversationContentStorage.mode=disabled`, null legacy retention and null storage questions. Guest recording information SHALL agree with the effective recording policy.

#### Scenario: Old tenant configuration
- **WHEN** an existing tenant still has the retired storage choice
- **THEN** Studio no longer offers or emits it as an active choice
- **AND** no recording is enabled through migration of that choice
