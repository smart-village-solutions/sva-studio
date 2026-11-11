## ADDED Requirements

### Requirement: Complete tenant administrator permissions

The plugin module IAM contract SHALL register all tenant-local recording permission IDs. Tenant provisioning and reconciliation SHALL grant the protected tenant-local `system_admin` the complete permission set of the assigned module. Historical exclusion metadata MUST NOT reduce these grants. Root-only actions SHALL remain outside tenant module permissions.

#### Scenario: Recording permission registration preserves tenant administrator access

- **WHEN** the SSF plugin registers its five tenant-local recording permissions
- **THEN** provisioning and reconciliation grant those permissions to tenant-local `system_admin`
- **AND** existing SSF configuration-management grants remain available
- **AND** ordinary roles still require explicit recording grants
- **AND** recording enablement, competence and sensitive-action step-up remain independent checks

### Requirement: Host supplied live permission directory capability

The existing plugin server composition path SHALL supply SSF with a narrowly typed host-owned permission-directory reader. Core/IAM SHALL own live tenant-isolated account, profile and effective-permission access. The plugin SHALL own the SSF response schema and endpoint. Absent capabilities SHALL make the directory unavailable without disabling unrelated handlers. Workspace and installed-package server entry points SHALL expose the same bindings, without adding SSF runtime dependencies to the ordinary Studio distribution.

#### Scenario: Missing directory source

- **WHEN** the SSF server module is loaded without its host directory capability
- **THEN** the recording directory returns an unavailable error
- **AND** existing configuration handlers remain bound
