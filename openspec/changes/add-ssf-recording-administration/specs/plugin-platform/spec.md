## ADDED Requirements

### Requirement: Explicit plugin administrator permission exclusions

The plugin module IAM contract SHALL support optional `systemAdminPermissionExclusions` for declared module permission IDs. Descriptor validation, normalization, generated registry and host module-contract composition SHALL preserve these exclusions through tenant provisioning and reconciliation. Exclusions SHALL be validated against the owning module's declared permissions. Missing exclusions SHALL preserve existing behavior for other modules.

#### Scenario: Recording permission registration does not grant administrators

- **WHEN** the SSF plugin registers its five recording permissions with administrator exclusions
- **THEN** the normalized plugin contract and host bootstrap resolver retain the exclusions
- **AND** creating or reconciling a tenant administrator does not automatically grant those recording permissions
- **AND** the existing SSF configuration-management grants remain available

### Requirement: Host supplied live permission directory capability

The existing plugin server composition path SHALL supply SSF with a narrowly typed host-owned permission-directory reader. Core/IAM SHALL own live tenant-isolated account, profile and effective-permission access. The plugin SHALL own the SSF response schema and endpoint. Absent capabilities SHALL make the directory unavailable without disabling unrelated handlers. Workspace and installed-package server entry points SHALL expose the same bindings, without adding SSF runtime dependencies to the ordinary Studio distribution.

#### Scenario: Missing directory source

- **WHEN** the SSF server module is loaded without its host directory capability
- **THEN** the recording directory returns an unavailable error
- **AND** existing configuration handlers remain bound
