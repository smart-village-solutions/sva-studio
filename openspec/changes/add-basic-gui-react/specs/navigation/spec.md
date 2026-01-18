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

### Requirement: Permission-Based Menu Visibility
Navigation items SHALL respect user permissions; menu items for which the user lacks capabilities SHALL be hidden.

#### Scenario: Hidden menu item for insufficient permissions
- **WHEN** user lacks the required capability for a menu item
- **THEN** the menu item is not displayed in the sidebar

#### Scenario: Submenu hides if all children are hidden
- **WHEN** all children of a navigation group are hidden due to permissions
- **THEN** the parent group is also hidden
