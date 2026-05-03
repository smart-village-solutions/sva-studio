## ADDED Requirements

### Requirement: Full News Model Preserves Plugin Package Boundary

The expanded News data model SHALL preserve the package boundary between `@sva/plugin-news`, the host app, auth runtime, and the server-only Mainserver package.

`@sva/plugin-news` SHALL continue to depend only on allowed plugin-facing packages and SHALL NOT import `apps/**`, `@sva/auth-runtime/server`, or `@sva/sva-mainserver/server`.

#### Scenario: Plugin needs full News fields

- **GIVEN** the News plugin needs full Mainserver News fields
- **WHEN** it loads, creates, or updates News
- **THEN** it uses the host-owned HTTP facade
- **AND** it does not import server-only Mainserver adapters or auth runtime server helpers

#### Scenario: Boundary check runs

- **GIVEN** a developer accidentally imports a server-only module from `@sva/plugin-news`
- **WHEN** lint, build, plugin-boundary, or review gates run
- **THEN** the invalid dependency is rejected

### Requirement: Full News Model Reuses Studio UI Foundation

The expanded News editor SHALL use `@sva/studio-ui-react` and the existing Studio UI foundation for full-model fields.

The implementation SHALL NOT introduce a parallel base component system in `@sva/plugin-news`.

#### Scenario: Nested News fields are rendered

- **GIVEN** the News editor renders nested categories, content blocks, media references, source URLs, and address fields
- **WHEN** UI controls are implemented
- **THEN** they use the Studio UI primitives and patterns already established for plugin UI
- **AND** plugin-local UI is limited to composition and field-specific behavior
