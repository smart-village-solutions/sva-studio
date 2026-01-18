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

### Requirement: RBAC-Based Navigation Filtering (CRITICAL)
Navigation items SHALL respect user permissions; menu items for which the user lacks required capabilities SHALL be completely hidden, not rendered to DOM.

#### Scenario: Hidden menu item for insufficient permissions
- **WHEN** user lacks the required capability for a menu item
- **THEN** the menu item is NOT rendered in the sidebar (completely hidden from DOM)

#### Scenario: Submenu hides if all children are hidden
- **WHEN** all children of a navigation group are hidden due to permissions
- **THEN** the parent group is also hidden

#### Scenario: Navigation filtering happens during render
- **WHEN** Sidebar component renders
- **THEN** for each navigation item, it calls permission check:
  - `canAccess(userCapabilities, navigationItem.requiredCapability)`
  - Only renders item if check returns `true`

#### Scenario: Permission source from Auth-Context
- **WHEN** Sidebar initializes
- **THEN** it reads `currentUser.capabilities` from Auth-Context (or `@cms/auth` package)
- **AND** uses this to filter navigation items

### Requirement: Design Token Sourcing for Sidebar Styling
Sidebar component CSS MUST source colors and spacing from `@cms/ui-contracts` design tokens, not hardcoded values.

#### Scenario: Sidebar uses CSS variables for styling
- **WHEN** Sidebar.module.css is created
- **THEN** it imports design tokens and uses:
  - Colors: `var(--color-sidebar-bg)`, `var(--color-text-primary)` (NOT hardcoded colors)
  - Spacing: `var(--spacing-md)`, `var(--spacing-lg)`
  - Typography: `var(--font-size-sm)`, `var(--font-weight-regular)`
