## ADDED Requirements

### Requirement: Root Layout Container
The CMS SHALL provide a root layout component that combines sidebar, header, and content area into a cohesive application shell.

#### Scenario: Layout renders with sidebar and header
- **WHEN** the root route is accessed
- **THEN** the page displays a sidebar on the left, header at the top, and content area filling the remaining space

#### Scenario: Layout has collapsible sidebar
- **WHEN** user clicks the sidebar toggle button
- **THEN** the sidebar collapses to icon-only mode (no responsive breakpoint in PoC)

### Requirement: Dynamic Navigation from Registry
The CMS sidebar SHALL render menu items dynamically from the SDK's navigation registry, enabling plugins to register their menu items without modifying the shell.

#### Scenario: Navigation items are fetched from registry
- **WHEN** the application initializes
- **THEN** the sidebar populates menu items by calling `navigationRegistry.getItems()`

#### Scenario: Nested navigation items render as submenus
- **WHEN** a navigation item has `children` property
- **THEN** the sidebar renders it as a submenu with collapsible expansion

#### Scenario: Navigation item links to plugin routes
- **WHEN** user clicks a navigation item with a `route` property
- **THEN** the router navigates to that plugin's route

### Requirement: Sidebar Toggle (Expand/Collapse)
The CMS sidebar SHALL support a toggle between expanded and minimized states to maximize content area space.

#### Scenario: Sidebar collapses to icon-only mode
- **WHEN** user clicks the toggle button
- **THEN** the sidebar collapses to show only icons, and labels are hidden

#### Scenario: Sidebar toggle state persists (Phase 1)
- **WHEN** user collapses the sidebar and navigates
- **THEN** the collapsed state is preserved across page loads (stored in localStorage MVP - Phase 2: backend user profile)

### Requirement: Design Token Sourcing for Layout Styling
Layout components CSS MUST source colors and spacing from `@sva-studio/ui-contracts` design tokens, not hardcoded values.

#### Scenario: Layout uses CSS variables for styling
- **WHEN** the sidebar, header, and content area components are implemented
- **THEN** they import design tokens from `@sva-studio/ui-contracts/design-tokens.css` and use:
  - Colors: `var(--color-sidebar-bg)`, `var(--color-header-bg)`, `var(--color-content-bg)` (NOT `#fff`, `#000`, `rgb(...)`)
  - Spacing: `var(--spacing-sm)`, `var(--spacing-md)`, `var(--spacing-lg)` (NOT `16px`, `24px`)
  - Typography variables

#### Scenario: Design tokens file exists in @sva-studio/ui-contracts
- **WHEN** CSS Module imports from `@sva-studio/ui-contracts/design-tokens.css`
- **THEN** the file contains definitions for:
  - Primary/secondary colors
  - Sidebar/header/content background colors
  - Text/border colors
  - Spacing scale (xs, sm, md, lg, xl)
  - Typography (font-size, font-weight, line-height)

### Requirement: Layout imports from SDK, not host-specific modules
The layout components and styling SHALL support framework migration without touching business logic.

#### Scenario: Layout imports from SDK only
- **WHEN** layout components are implemented
- **THEN** they import only from `@sva-studio/sdk`, `@sva-studio/app-config`, and `@sva-studio/ui-contracts`, never from `apps/sva-studio-react/src/routes` or internal host logic

#### Scenario: No React-specific patterns in styles
- **WHEN** CSS Modules are written
- **THEN** they use pure CSS with CSS variables (no CSS-in-JS, emotion, styled-components) and can be ported to Vue with minimal changes

### Requirement: Semantic HTML and Accessibility Landmarks
The layout SHALL use semantic HTML5 elements (`<header>`, `<nav>`, `<main>`) to define page regions.

#### Scenario: Layout uses semantic landmarks
- **WHEN** the root layout is rendered
- **THEN** it contains: `<header>` for top bar, `<nav>` for sidebar, `<main>` for content area
- **AND** landmarks are properly nested (header and nav as siblings at root level)

### Requirement: Visible Focus Management
All interactive elements SHALL have clearly visible focus indicators.

#### Scenario: Focus indicators are visible
- **WHEN** user tabs through the layout
- **THEN** every focusable element has a visible outline or border
- **AND** focus color is clearly distinguishable
