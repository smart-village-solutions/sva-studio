## ADDED Requirements

### Requirement: Events And POI Are Separate Plugin Packages

The monorepo SHALL provide Events and POI editing as two separate plugin packages with distinct package names, namespaces, routes, action IDs, content types, tests, and ownership boundaries.

#### Scenario: Events plugin package is registered

- **WHEN** the Events plugin is added to the workspace
- **THEN** it uses package name `@sva/plugin-events`
- **AND** it uses canonical namespace `events`
- **AND** it registers routes under `/plugins/events`
- **AND** it does not share its plugin identity with News or POI

#### Scenario: POI plugin package is registered

- **WHEN** the POI plugin is added to the workspace
- **THEN** it uses package name `@sva/plugin-poi`
- **AND** it uses canonical namespace `poi`
- **AND** it registers routes under `/plugins/poi`
- **AND** it does not share its plugin identity with News or Events

#### Scenario: Host build-time registry includes both plugins

- **GIVEN** News, Events, and POI plugins are present in the workspace
- **WHEN** the host build-time registry is created
- **THEN** it registers all three plugins deterministically
- **AND** duplicate plugin IDs, route IDs, navigation IDs, content types, or action IDs are rejected by existing registry guardrails

### Requirement: Events And POI Plugins Preserve SDK And UI Boundaries

Events and POI plugin packages SHALL consume host metadata through `@sva/plugin-sdk` and shared React UI through `@sva/studio-ui-react`.

They SHALL NOT depend on app-internal modules, server-only runtime modules, or another fachplugin for core behavior.

#### Scenario: Allowed plugin dependencies

- **WHEN** `@sva/plugin-events` or `@sva/plugin-poi` declares Workspace dependencies
- **THEN** it lists allowed dependencies with `workspace:*`
- **AND** runtime imports use ESM-strict `.js` endings for relative runtime paths

#### Scenario: Plugin depends on another fachplugin

- **GIVEN** the Events editor optionally references a POI identifier
- **WHEN** dependencies are evaluated
- **THEN** `@sva/plugin-events` does not import `@sva/plugin-poi` for runtime behavior
- **AND** cross-domain selection, if implemented, is mediated by a host-owned data contract or explicit shared SDK capability

#### Scenario: Plugin duplicates base UI controls

- **WHEN** Events or POI plugin code needs buttons, inputs, tables, dialogs, tabs, or form primitives
- **THEN** it uses `@sva/studio-ui-react`
- **AND** it does not introduce a parallel reusable base-control system inside the plugin package
