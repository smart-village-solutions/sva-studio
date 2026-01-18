# Change: Add Basic GUI Shell (React) – Proof of Concept

## Why
The CMS needs a minimal UI shell that demonstrates the framework structure. This PoC provides layout placeholders (sidebar, header, content area) and validates SDK registry integration. It serves as a foundation for the plugin system and allows continued development with real components.

## What Changes
- **NEW:** Basic GUI shell with React implementation (`apps/sva-studio-react/`)
- **NEW:** Root layout component with sidebar, header, and content structure
- **NEW:** Sidebar with navigation registry integration (hardcoded demo data)
- **NEW:** Header with search bar, theme toggle, language selector, user menu (placeholders)
- **BREAKING:** Rename `apps/studio/` to `apps/sva-studio-react/`

## Impact
- Affected code: `apps/studio/` → `apps/sva-studio-react/`, SDK integrations
- Enables: Plugin system can now render routes into the shell
- Dependencies (MUST EXIST):
  - `@sva-studio/sdk` - Navigation registry interface
  - `@sva-studio/app-config` - App configuration
  - `@sva-studio/ui-contracts` - Design tokens (CSS variables)
- No new packages required (Auth-Context extracted later in Phase 1.5)

## Implementation Order (Phase 1: PoC)
1. Rename app folder to `sva-studio-react`
2. Implement RootLayout component (semantic HTML: `<header>`, `<nav>`, `<main>`)
3. Implement Sidebar with navigation registry integration (hardcoded demo data)
4. Implement Header with placeholder components
5. Integrate i18n for all UI labels (CRITICAL - DEVELOPMENT_RULES)
6. Integrate CSS design tokens (CRITICAL - no hardcoded colors)
7. Wire up basic keyboard navigation

## Phase 1 Scope: Proof of Concept (UI Shell Only)

### ✅ Included in Phase 1
- **Layout Structure:** RootLayout with sidebar, header, content area
- **Navigation Registry Rendering:** Sidebar fetches and displays menu items (hardcoded demo data, no RBAC yet)
- **Placeholder Components:** Search bar, Theme toggle button, Language selector, User menu (UI only, no functionality)
- **i18n Keys:** All labels via `t()` function (DEVELOPMENT_RULES 2.1 compliant)
- **Design Tokens:** All styling via CSS variables from `@sva-studio/ui-contracts` (no hardcoded colors)
- **Keyboard Navigation:** Tab/Enter/Escape work on buttons, menus, inputs
- **Semantic HTML:** Proper landmarks (`<header>`, `<nav>`, `<main>`), visible focus indicators

### ⏳ Deferred to Phase 1.5+
- **Auth-Context** (login/logout, user data, session management)
- **RBAC Navigation Filtering** (permission checks, hide menu items)
- **Theme Switching** (actual light/dark CSS application)
- **Preferences Persistence** (localStorage/backend sync)
- **Language Switching** (actual i18n re-render)
- **Search Bar Functionality** (real search integration)
- **User Menu Logic** (logout, profile navigation)
- **Full Accessibility Audit** (WCAG 2.1 AA compliance testing)

## Critical Requirements for Phase 1 (Non-Negotiable)

### Requirement 1: i18n Integration (DEVELOPMENT_RULES 2.1)
All UI text MUST use translation keys; no hardcoded strings allowed.
- Header labels: search placeholder, theme label, language label → `t('...')`
- Language names: "Deutsch", "English" → fetched from translations
- Sidebar: navigation labels → from registry

### Requirement 2: Design Token Sourcing
CSS Modules MUST import design variables from `@sva-studio/ui-contracts` package.
- No hardcoded colors
- Colors via CSS variables: `var(--color-primary)`, `var(--color-sidebar-bg)`
- Spacing via tokens: `var(--spacing-sm)`, `var(--spacing-md)`, `var(--spacing-lg)`

### Requirement 3: Semantic HTML & Keyboard Navigation
UI MUST use semantic landmarks and be keyboard-operable.
- Structure: `<header>`, `<nav>`, `<main>` landmarks
- All interactive elements Tab-accessible
- Visible focus indicators

### Requirement 4: Error Handling (Staging Stability)
Registry failures MUST NOT crash the UI (blank page).
- Catch `navigationRegistry.getItems()` errors
- Log errors to console (for developer debugging)
- Display fallback message: "Navigation unavailable" with manual reload button
