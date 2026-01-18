## 0. Pre-Implementation (Setup Dependencies)
- [ ] 0.1 Ensure `@cms/sdk` package exports NavigationRegistry interface
- [ ] 0.2 Ensure `@cms/app-config` package exports theme/language config types
- [ ] 0.3 Ensure `@cms/ui-contracts` package exists with design token definitions
- [ ] 0.4 Create `@cms/ui-contracts/design-tokens.css` with CSS variables (colors, spacing, typography)
- [ ] 0.5 Create Auth-Context or integration point with `@cms/auth` package for RBAC
- [ ] 0.6 Verify i18n system is set up (`react-i18next` configuration)

## 1. Folder Restructuring
- [ ] 1.1 Rename `apps/studio/` to `apps/sva-studio-react/`
- [ ] 1.2 Update references in `nx.json` project configuration
- [ ] 1.3 Update tsconfig paths in `tsconfig.base.json`
- [ ] 1.4 Update all import paths in the project

## 2. Root Layout Component
- [ ] 2.1 Create `apps/sva-studio-react/src/components/layout/RootLayout.tsx`
- [ ] 2.2 Implement flex layout structure (sidebar + header + content)
- [ ] 2.3 Add Outlet for plugin routes
- [ ] 2.4 Create CSS module: `RootLayout.module.css`
- [ ] 2.5 Style with CSS variables from `@cms/ui-contracts` (no hardcoded colors)
- [ ] 2.6 Implement responsive breakpoint (768px) for mobile sidebar collapse
- [ ] 2.7 Export RootLayout from layout index

## 3. Sidebar Component (with RBAC Filtering)
- [ ] 3.1 Create `apps/sva-studio-react/src/components/sidebar/Sidebar.tsx`
- [ ] 3.2 Integrate `navigationRegistry.getItems()` from SDK
- [ ] 3.3 **CRITICAL:** Filter items by user capabilities (RBAC)
  - [ ] 3.3a Get user context (Auth-Context or props)
  - [ ] 3.3b Check each item against `userCapabilities`
  - [ ] 3.3c Hide items without required capability
  - [ ] 3.3d Hide parent if all children hidden
- [ ] 3.4 Implement expanded/collapsed state (localStorage MVP)
- [ ] 3.5 Create `SidebarToggle.tsx` for collapse button
- [ ] 3.6 Create `SidebarNav.tsx` for recursive menu rendering
- [ ] 3.7 Create `Sidebar.module.css` (CSS variables from design tokens)
- [ ] 3.8 Responsive design for mobile (hide labels, show icons only)

## 4. Header Component (with i18n)
- [ ] 4.1 Create `apps/sva-studio-react/src/components/header/Header.tsx`
- [ ] 4.2 Create `SearchBar.tsx` component
  - [ ] 4.2a Input with placeholder: `t('common.search')`
  - [ ] 4.2b Keyboard shortcut (Cmd+K / Ctrl+K)
  - [ ] 4.2c Placeholder text from i18n (NOT hardcoded)
- [ ] 4.3 Create `LanguageSelector.tsx` component
  - [ ] 4.3a Integrate with `useTranslation()` hook
  - [ ] 4.3b Get available languages from `@cms/app-config`
  - [ ] 4.3c Language names from translations (NOT hardcoded "Deutsch", "English")
  - [ ] 4.3d Store selection in localStorage (MVP)
- [ ] 4.4 Create `ThemeToggle.tsx` component (light/dark mode)
  - [ ] 4.4a Toggle button label: `t('common.theme')` or icon
  - [ ] 4.4b Apply dark/light CSS class
  - [ ] 4.4c Store preference in localStorage (MVP, Phase 2 → backend)
- [ ] 4.5 Create `UserMenu.tsx` component
  - [ ] 4.5a Display user avatar/initials (from Auth-Context)
  - [ ] 4.5b Menu items: Profile (`t('common.profile')`), Settings (`t('common.settings')`), Logout (`t('common.logout')`)
  - [ ] 4.5c All labels via i18n
  - [ ] 4.5d Logout clears auth context
- [ ] 4.6 Create `Header.module.css` (CSS variables from design tokens)
- [ ] 4.7 All UI labels use `t()` function (CRITICAL - DEVELOPMENT_RULES)

## 5. Content Area Component
- [ ] 5.1 Create `apps/sva-studio-react/src/components/layout/ContentArea.tsx`
- [ ] 5.2 Implement scrollable container
- [ ] 5.3 Create `ContentArea.module.css` (CSS variables from design tokens)
- [ ] 5.4 No hardcoded spacing/colors

## 6. Root Route Integration
- [ ] 6.1 Update `apps/sva-studio-react/src/routes/root.tsx` to use RootLayout
- [ ] 6.2 Ensure RootLayout wraps all child routes
- [ ] 6.3 Create default dashboard/home route

## 7. i18n Integration (CRITICAL - DEVELOPMENT_RULES)
- [ ] 7.1 Set up `react-i18next` configuration
- [ ] 7.2 Create translation keys file with German (de) and English (en):
  - [ ] 7.2a `common.search`
  - [ ] 7.2b `common.theme`, `common.themeDark`, `common.themeLight`
  - [ ] 7.2c `common.profile`, `common.settings`, `common.logout`
  - [ ] 7.2d Language names: `common.language`, `common.languageDe`, `common.languageEn`
  - [ ] 7.2e Navigation/sidebar labels (if not from registry)
- [ ] 7.3 Verify NO hardcoded strings in components
- [ ] 7.4 All user-facing text uses `t('key')` function

## 8. Design Token Integration (CRITICAL)
- [ ] 8.1 Create/verify `@cms/ui-contracts/design-tokens.css`
  - [ ] 8.1a Color tokens: `--color-primary`, `--color-sidebar-bg`, `--color-header-bg`, `--color-text-*`
  - [ ] 8.1b Spacing tokens: `--spacing-xs`, `--spacing-sm`, `--spacing-md`, `--spacing-lg`, `--spacing-xl`
  - [ ] 8.1c Typography: `--font-size-*`, `--font-weight-*`
- [ ] 8.2 All CSS Modules import from design-tokens.css
- [ ] 8.3 NO hardcoded colors (e.g., `#2563eb`, `rgb(0,0,0)`)
- [ ] 8.4 NO hardcoded spacing values
- [ ] 8.5 Use CSS variables throughout: `var(--color-primary)`, `var(--spacing-md)`

## 9. Auth/RBAC Integration (CRITICAL)
- [ ] 9.1 Set up Auth-Context (or use `@cms/auth` package)
  - [ ] 9.1a Auth-Provider wraps RootLayout
  - [ ] 9.1b Provides `currentUser` and `userCapabilities`
  - [ ] 9.1c Provides `logout()` function
- [ ] 9.2 Integration in Sidebar component:
  - [ ] 9.2a Filter navigation items by capability
  - [ ] 9.2b Hide items user cannot access
- [ ] 9.3 Integration in UserMenu:
  - [ ] 9.3a Display current user name/avatar
  - [ ] 9.3b Logout function calls Auth-Provider
- [ ] 9.4 Document Auth-Context interface for Phase 1.5 extraction

## 10. Testing & Validation
- [ ] 10.1 Test sidebar render with registry navigation
- [ ] 10.1a Test nested menu items
- [ ] 10.1b Test permission-based hiding
- [ ] 10.2 Test theme toggle (light/dark CSS)
- [ ] 10.3 Test language selector (i18n re-render)
- [ ] 10.4 Test responsive layout (768px breakpoint, mobile sidebar)
- [ ] 10.5 Test user menu (profile display, logout)
- [ ] 10.6 Verify NO hardcoded text strings (use grep for hardcoded quotes)
- [ ] 10.7 Verify CSS only uses design tokens (no hardcoded colors)
- [ ] 10.8 Test Cmd+K / Ctrl+K search bar focus

## 11. Documentation
- [ ] 11.1 Update README.md with new folder structure
- [ ] 11.2 Document RootLayout component structure and composition
- [ ] 11.3 Document design token usage (CSS Modules imports)
- [ ] 11.4 Document i18n key structure and translation process
- [ ] 11.5 Document Auth-Context interface (pending Phase 1.5)
- [ ] 11.6 Document RBAC filtering logic in Sidebar

## Phase 1.5+ (Deferred)
- [ ] Extract Auth-Context to `@cms/auth-context` package
- [ ] Migrate localStorage preferences to backend (User Profile)
- [ ] Implement full-text search (wire Search bar to `@cms/search-client`)
- [ ] WCAG 2.1 AA compliance audit
- [ ] Storybook entries for components
