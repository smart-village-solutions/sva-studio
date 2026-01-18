## ADDED Requirements

### Requirement: Navigation Registry Integration
The sidebar SHALL fetch and render menu items from the SDK's navigation registry, enabling plugins to register menu items declaratively.

#### Scenario: Navigation items render from registry
- **WHEN** the application initializes
- **THEN** `navigationRegistry.getItems()` is called and menu items are rendered

#### Scenario: Navigation items include labels and icons
- **WHEN** a navigation item is fetched from the registry
- **THEN** it includes `label`, `icon`, and optional `route` properties

#### Scenario: Nested navigation items support variable depth
- **WHEN** a navigation item has a `children` array
- **THEN** it renders as an expandable submenu that can nest multiple levels deep

### Requirement: Navigation Item Click Handling
Clicking a navigation item SHALL trigger routing to the item's associated plugin route.

#### Scenario: User clicks a navigation item with a route
- **WHEN** user clicks a navigation item that has a `route` property
- **THEN** the application router navigates to that route

#### Scenario: User clicks a navigation group without a route
- **WHEN** user clicks a navigation item without a `route` property
- **THEN** the submenu expands/collapses without navigation

### Requirement: Design Token Sourcing for Sidebar Styling
Sidebar component CSS MUST source colors and spacing from `@sva-studio/ui-contracts` design tokens, not hardcoded values.

#### Scenario: Sidebar uses CSS variables for styling
- **WHEN** Sidebar.module.css is created
- **THEN** it imports design tokens and uses:
  - Colors: `var(--color-sidebar-bg)`, `var(--color-text-primary)` (NOT hardcoded colors)
  - Spacing: `var(--spacing-md)`, `var(--spacing-lg)`
  - Typography: `var(--font-size-sm)`, `var(--font-weight-regular)`

### Requirement: Accessible Navigation and Keyboard Interaction
The sidebar navigation SHALL be fully keyboard-operable with visible focus indicators.

#### Scenario: Navigation items are keyboard-accessible
- **WHEN** user tabs through navigation
- **THEN** all menu items are reachable with visible focus indicators
- **AND** pressing Enter navigates to the item's route

#### Scenario: Menu groups are keyboard-operable
- **WHEN** user focuses a menu group with children
- **THEN** Space or Enter toggles expansion

#### Scenario: Sidebar toggle is accessible
- **WHEN** sidebar toggle is focused
- **THEN** it has visible focus, `aria-label`, and Space/Enter toggles state

---

## Note: Phase 1.5+ Features (Deferred)
- RBAC-based navigation filtering (requires Auth-Context)
- Permission-based menu item hiding
- Screen reader announcements with `aria-expanded`
