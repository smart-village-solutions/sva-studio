## ADDED Requirements

### Requirement: Plugin application navigation supports one generic group level

The plugin platform SHALL allow plugins to contribute one application group level
through the existing navigation contract. Groups MUST belong to one plugin and
access scope, contain addressable leaf routes and be composed only after each
leaf's existing access and module checks. The registry MUST validate group
ownership, consistent metadata, section, scope and leaf targets. The shell MUST
preserve existing flat plugin navigation, omit empty groups and MUST NOT hardcode
SSF child routes. Both SSF scopes MUST use existing application branding.

#### Scenario: Tenant has access to SSF configuration

- **WHEN** SSF tenant navigation is resolved in an authorised tenant context
- **THEN** its five page links appear in an application group using existing branding
- **AND** direct routes and server handlers retain their existing tenant access checks

#### Scenario: Group contains no authorised leaves

- **WHEN** all leaf contributions are rejected by access or module checks
- **THEN** no empty group is displayed
- **AND** unrelated authorised plugin links remain available

#### Scenario: Invalid cross-plugin or mixed-scope group

- **WHEN** a plugin contributes a foreign group ID or conflicting group scope/metadata
- **THEN** registry validation rejects the contribution
- **AND** a group never grants the access required by one of its leaves

#### Scenario: Existing flat and header navigation

- **WHEN** an existing plugin contributes no group metadata
- **THEN** its current navigation and access behaviour remains valid
- **AND** header contributions cannot use application grouping

#### Scenario: Platform and tenant rights coexist

- **WHEN** a principal has platform and tenant roles
- **THEN** the active host scope selects the corresponding SSF application presentation
- **AND** platform rights alone do not grant tenant configuration or recording access
