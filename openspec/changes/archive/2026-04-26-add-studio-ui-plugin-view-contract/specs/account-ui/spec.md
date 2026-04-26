## ADDED Requirements

### Requirement: Shared Studio UI React Package
The system SHALL provide `@sva/studio-ui-react` as the shared React UI package for host pages and plugin custom views.

#### Scenario: Host page uses shared UI
- **GIVEN** a host-owned overview or detail page is implemented
- **WHEN** the page needs reusable Studio layout, controls, actions, or state components
- **THEN** it imports them from `@sva/studio-ui-react`
- **AND** it does not import reusable Studio UI from app-internal component paths

#### Scenario: Plugin custom view uses shared UI
- **GIVEN** a plugin provides a custom React view
- **WHEN** the view renders Studio page structure, form controls, actions, or feedback states
- **THEN** it uses `@sva/studio-ui-react` components
- **AND** it does not define a parallel basis control system for buttons, inputs, tables, tabs, dialogs, or alerts

#### Scenario: Plugin uses domain wrapper around shared UI
- **GIVEN** a plugin needs a domain-specific field, action, or status component
- **WHEN** the component is implemented
- **THEN** it composes primitives from `@sva/studio-ui-react`
- **AND** it does not redefine shared visual variants, focus behavior, ARIA semantics, or design tokens

### Requirement: Studio UI React Overview and Detail Templates
The system SHALL provide reusable overview and detail templates that encode the Studio page standards for headings, resource identity, actions, navigation, work surfaces, and state handling.

#### Scenario: Overview page renders with standard structure
- **GIVEN** a host or plugin overview page uses `StudioOverviewPageTemplate`
- **WHEN** the page is rendered
- **THEN** the visible structure contains page heading, optional primary action, toolbar slot, content slot, and pagination or result-state slot
- **AND** loading, empty, error, and forbidden states are rendered through shared Studio state components

#### Scenario: Detail page renders with standard structure
- **GIVEN** a host or plugin detail page uses `StudioDetailPageTemplate`
- **WHEN** the page is rendered
- **THEN** the visible structure contains return or breadcrumb context, page heading, primary action slot, resource header slot, detail navigation slot, and active work surface
- **AND** resource identity, status badges, metadata, and destructive actions follow shared Studio patterns

### Requirement: Studio UI React Form Controls
The system SHALL provide form composition primitives that standardize labels, required markers, descriptions, validation states, and accessible field relationships.

#### Scenario: Field with validation error
- **GIVEN** a Studio form field has a validation error
- **WHEN** the field is rendered
- **THEN** the control exposes `aria-invalid`
- **AND** the field error is associated through `aria-describedby`
- **AND** the visual state is consistent across host and plugin forms

#### Scenario: Plugin form uses specialized field
- **GIVEN** a plugin needs a specialized editor such as upload, rich text, media, color, icon, rating, or geo selection
- **WHEN** the specialized editor is implemented
- **THEN** it is wrapped as a Studio component or composed from `@sva/studio-ui-react` primitives
- **AND** it preserves label, description, validation, disabled, and read-only semantics

### Requirement: Plugin Custom Views Preserve Studio UX Contracts
The system SHALL allow plugin custom views only when they preserve Studio shell, layout, accessibility, action, and state contracts through `@sva/studio-ui-react`.

#### Scenario: Plugin custom view is accepted
- **GIVEN** a plugin registers or exports a custom admin view
- **WHEN** the host validates or reviews the view integration
- **THEN** the view uses `@sva/studio-ui-react` for common layout, controls, actions, and states
- **AND** any deviation from shared Studio UI is documented as an architecture decision

#### Scenario: Plugin custom view imports app internals
- **GIVEN** a plugin custom view imports from `apps/sva-studio-react/src/components`
- **WHEN** lint, boundary, or CI checks run
- **THEN** the check fails with a message that directs the plugin to `@sva/studio-ui-react`

#### Scenario: Plugin defines duplicate basis control
- **GIVEN** a plugin defines or exports a reusable basis control that duplicates an available Studio UI component
- **WHEN** lint, CI, or review checks run
- **THEN** the contribution is rejected or changed to compose `@sva/studio-ui-react`
- **AND** domain-specific wrappers remain allowed when they preserve shared Studio UI semantics
