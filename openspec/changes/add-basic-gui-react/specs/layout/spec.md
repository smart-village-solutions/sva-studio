## ADDED Requirements

### Requirement: Root Layout Container
The CMS SHALL provide a root layout component that combines sidebar, header, and content area into a cohesive application shell.

#### Scenario: Layout renders with sidebar and header
- **WHEN** the root route is accessed
- **THEN** the page displays a sidebar on the left, header at the top, and content area filling the remaining space

#### Scenario: Layout is responsive
- **WHEN** the viewport width is less than 768px
- **THEN** the sidebar collapses automatically or uses a mobile menu pattern

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

#### Scenario: Sidebar toggle state persists
- **WHEN** user collapses the sidebar and navigates
- **THEN** the collapsed state is preserved across page loads (stored in localStorage)

### Requirement: Theme Switcher in Header
The CMS header SHALL provide a theme toggle (light/dark mode) accessible to all users.

#### Scenario: User switches theme from light to dark
- **WHEN** user clicks the theme toggle button
- **THEN** the application applies dark theme CSS and saves preference

#### Scenario: Theme preference persists
- **WHEN** user closes and reopens the application
- **THEN** the previously selected theme is applied automatically

### Requirement: Language Selector in Header
The CMS header SHALL provide a dropdown language selector that changes the UI language across the entire application.

#### Scenario: User selects a different language
- **WHEN** user selects a language from the language dropdown
- **THEN** the entire UI updates to display text in the selected language

#### Scenario: Language preference persists
- **WHEN** user logs in again
- **THEN** the previously selected language is applied

### Requirement: User Menu in Header
The CMS header SHALL provide a user menu with profile, settings, and logout options.

#### Scenario: User opens the user menu
- **WHEN** user clicks their avatar/name in the header
- **THEN** a dropdown menu appears with profile, settings, and logout options

#### Scenario: User logs out
- **WHEN** user clicks logout
- **THEN** the session ends and the user is redirected to login page

### Requirement: Search Bar in Header
The CMS header SHALL provide a search input field for global content search (placeholder for future full-text search integration).

#### Scenario: Search input is accessible
- **WHEN** the header is rendered
- **THEN** a search bar is visible with placeholder text

#### Scenario: Search bar focuses on keyboard shortcut
- **WHEN** user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the search input receives focus

### Requirement: Framework-Agnostic Layout Structure
The layout components and styling SHALL be designed to support future migration from React to Vue (or other frameworks) without requiring changes to core business logic.

#### Scenario: Layout uses CSS modules for styling
- **WHEN** the sidebar, header, and content area components are implemented
- **THEN** they use CSS modules (not Tailwind classes) for styling, enabling easy framework migration

#### Scenario: Layout imports from SDK, not host-specific modules
- **WHEN** layout components are implemented
- **THEN** they import only from `@cms/sdk`, `@cms/app-config`, and `@cms/ui-contracts`, never from `apps/sva-studio-react/src/routes` or internal host logic
