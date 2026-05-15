# external-interface-registry Specification

## Purpose
TBD - created by archiving change add-external-interface-registry. Update Purpose after archive.
## Requirements
### Requirement: Host-Owned External Interface Registry

The system SHALL persist externally managed technical interfaces in a central, host-owned registry.

#### Scenario: Mainserver, S3 and Supabase share one registry path

- **WHEN** an instance stores a `sva_mainserver`, `s3` or `supabase` interface
- **THEN** the configuration is persisted in the central external-interface registry
- **AND** the host remains responsible for default resolution, status projection and authorization boundaries

### Requirement: Encrypted Secret Storage

The system SHALL store secret interface fields only in encrypted form.

#### Scenario: Secret fields are persisted as ciphertext

- **WHEN** an interface contains technical secrets such as API keys, database URLs or service-role keys
- **THEN** the host stores these values only as encrypted secret blocks
- **AND** browser-facing read models expose at most configured markers, never secret plaintexts

### Requirement: Plugin-Declared Interface Types

The system SHALL allow plugins to declare additional interface-type metadata without delegating persistence ownership.

#### Scenario: Plugin contributes an interface type

- **WHEN** a plugin declares an `externalInterfaceType`
- **THEN** the host validates and materializes the type metadata in its build-time registry
- **AND** the plugin does not gain direct access to host DB, secret storage or interface resolver internals

