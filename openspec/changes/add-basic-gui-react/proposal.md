# Change: Add Basic GUI Shell in React

## Why
The CMS needs a foundational UI shell that can serve as the host application container. This shell provides the layout infrastructure (sidebar, header, content area) and integrates with the SDK registries for navigation, theming, and app configuration. Without this, plugins have no place to render and the CMS cannot function as an application.

## What Changes
- **NEW:** Basic GUI shell with React implementation (`apps/sva-studio-react/`)
- **NEW:** Root layout component combining sidebar, header, and content area
- **NEW:** Navigation registry integration for dynamic menu items
- **NEW:** Theme and language switcher in header
- **NEW:** User menu in header
- **NEW:** Framework-agnostic UI structure ready for Vue adaptation
- **BREAKING:** Rename `apps/studio/` to `apps/sva-studio-react/` to clarify framework-specific implementation

## Impact
- Affected specs: `layout`, `navigation`, `header`, `app-config`, `auth-context` (new)
- Affected code: `apps/studio/` → `apps/sva-studio-react/`, new SDK integrations
- Enables: Plugin system can now render routes and widgets into the shell
- Dependencies (MUST EXIST):
  - `@sva-studio/sdk` - Navigation/Theme/App-Config registries
  - `@sva-studio/app-config` - App configuration and theme settings
  - `@sva-studio/ui-contracts` - Design tokens and CSS variables
  - `@sva-studio/auth` - Basic RBAC for permission checks
- New packages to extract:
  - `@sva-studio/auth-context` - Auth provider and hooks (Phase 1.5)

## Implementation Order (Phase 1: MVP)
1. Rename app folder to `sva-studio-react`
2. Implement RootLayout component with sidebar/header/content structure
3. Wire SDK registries for navigation rendering
4. Add theme and language switcher components (UI with localStorage MVP)
5. Add user menu with logout functionality
6. Implement i18n integration for all UI labels (CRITICAL)
7. Integrate Auth-Context for RBAC navigation filtering (CRITICAL)
8. Implement CSS modules with design token variables (CRITICAL)

## Phase 1 Scope: MVP (Minimal Viable Product)

### ✅ Included in Phase 1
- Static layouts (sidebar, header, content area)
- Navigation registry rendering with permission-based filtering
- Theme toggle (light/dark CSS) with **localStorage persistence** (MVP)
- Language selector (UI) with i18n integration
- User menu with profile info and logout
- Search bar (placeholder, disabled)
- CSS modules sourcing design tokens from `@sva-studio/ui-contracts`
- Basic Auth-Context for permission checks

### ⏳ Deferred to Phase 2+
- **Backend-persisted User Preferences** (currently localStorage MVP, will migrate in Phase 2)
- Full-text search integration (Search bar is placeholder)
- Advanced theme customization (Theme Editor package)
- Auth-Context complete separation into `@sva-studio/auth-context` package
- Multi-device preference sync
- Accessibility audit & WCAG 2.1 AA compliance (in-progress)

## Critical Requirements for Phase 1 (Non-Negotiable)

### Requirement 1: i18n Integration (DEVELOPMENT_RULES 2.1)
All UI text MUST use translation keys; no hardcoded strings allowed.
- Header labels: search placeholder, theme label, language label → `t('...')`
- Language names: "Deutsch", "English" → fetched from translations
- User menu: profile, settings, logout → `t('...')`
- Sidebar: navigation labels → from registry (already i18n-compatible)

### Requirement 2: Design Token Sourcing
CSS Modules MUST import design variables from `@sva-studio/ui-contracts` package.
- No hardcoded colors (e.g., `#2563eb`)
- Colors via CSS variables: `var(--color-primary)`, `var(--color-sidebar-bg)`
- Spacing via tokens: `var(--spacing-sm)`, `var(--spacing-md)`, `var(--spacing-lg)`
- Note: Design tokens in `@sva-studio/ui-contracts` will be created in parallel task

### Requirement 3: RBAC Navigation Filtering
Navigation items filtered by user capabilities during render.
- Each navigation item checked against `userCapabilities` before rendering
- Items without required capability completely hidden (not disabled)
- Parent menu hides if all children hidden
- Permission source: Auth-Context (to be clarified in Phase 1.5)
