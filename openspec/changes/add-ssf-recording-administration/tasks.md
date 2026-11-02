## 1. Contract and administration

- [x] 1.1 Carry the reviewed producer obligations into the Studio OpenSpec change and update the API schema/examples.
- [x] 1.2 Implement 720-hour installation retention default, tenant override and effective-policy resolution with 1..8760 validation.
- [x] 1.3 Add recording administration with explicit tenant enablement, independent legal texts and configuration revisions.
- [x] 1.4 Resolve the recording subtree outside the generic content merge; verify enabled true/false preservation, installation-default isolation and editor override/reset round trips.

## 2. Identity and directory

- [x] 2.1 Add recording permission IDs and reviewer languages to IAM administration and Keycloak projection.
- [x] 2.2 Implement the live tenant recording-directory endpoint and matching authorization/error contract.
- [x] 2.3 Register grants and endpoint in the plugin descriptor and `server/index.ts`; keep recording grants out of the automatic tenant-admin role baseline.
- [x] 2.4 Extend the host-owned authoritative IAM reader with display names and competence languages; inject it through the existing server capability composition, without plugin access to IAM tables.
- [x] 2.5 Carry language-only changes through projection comparison, reconciliation and Keycloak read-back; verify workspace/installed server binding parity.

## 3. MFA and cleanup

- [x] 3.1 Implement optional/required ordinary-login MFA through Core/IAM realm provisioning and reconciliation.
- [x] 3.2 Verify voluntary MFA, required enrollment and sensitive-action step-up against a real Keycloak realm.
- [x] 3.3 Remove legacy storage editing and obsolete 180-day guest promises; preserve necessary disabled compatibility fields.
- [x] 3.4 Extend Core/IAM's tenant-authorized settings DTO, persistence, UI and audit with MFA desired/applied state; use existing realm jobs and verify read-back, retry and custom-flow conflicts.

## 4. Integration and release

- [x] 4.1 Run Studio unit, type, database and runtime checks and the focused SSF consumer suites.
- [ ] 4.2 Complete two-tenant staging acceptance, retention inheritance and permission-revocation evidence.
- [ ] 4.3 Follow existing release procedures and enable recording only after operational prerequisites are confirmed.
- [x] 4.4 Update Studio arc42 sections 04, 05, 06 and 08 and the IAM ADR reference in section 09; update schema reference files for any Core/IAM migration.

Execution detail and acceptance matrices: [implementation plan](https://github.com/smart-village-solutions/smart-speech-flow/blob/291f613f/docs/superpowers/plans/2026-11-02-studio-recording-settings.md).
