## ADDED Requirements

### Requirement: Plugin Registration Phases
The system SHALL define explicit build-time registration phases for workspace plugins so that content, admin, audit, and routing contributions are collected and validated in a deterministic order before the build-time registry snapshot is published.

The canonical phase order SHALL be contribution preflight, content, admin, audit, routing, and snapshot publication. The preflight step SHALL normalize plugin namespaces and guardrail-safe contribution shapes before domain phases run.

The phases SHALL organize the existing `BuildTimeRegistry` outputs instead of introducing a new public plugin system.

#### Scenario: Plugin contributions follow phase order
- **GIVEN** a plugin declares contributions for multiple phases
- **WHEN** the build-time registry snapshot is created
- **THEN** the host processes preflight, content, admin, audit, routing, and snapshot publication in that order
- **AND** later phases consume only outputs validated by earlier phases

#### Scenario: Plugin declares phase-incompatible contribution
- **GIVEN** a plugin declares a contribution in a phase that does not support it
- **WHEN** the registry snapshot is validated
- **THEN** validation fails with a deterministic `plugin_guardrail_*` diagnostic before the snapshot is published

#### Scenario: Routing consumer receives validated snapshot
- **GIVEN** the build-time registry snapshot was published successfully
- **WHEN** the routing package materializes plugin and admin routes
- **THEN** it can consume validated phase outputs instead of raw plugin definitions
- **AND** existing direct-plugin-definition callers remain supported while they are still validated fail-fast

#### Scenario: Existing build-time registry API remains compatible
- **GIVEN** a consumer calls `createBuildTimeRegistry()` and reads existing fields such as `routes`, `contentTypes`, `auditEvents`, `adminResources`, or `pluginActionRegistry`
- **WHEN** the registry is created through the phased implementation
- **THEN** those existing fields remain available with the same meaning
- **AND** no consumer is required to adopt a new public snapshot type for this change
