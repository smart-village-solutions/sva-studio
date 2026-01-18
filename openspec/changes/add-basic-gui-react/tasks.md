## 0. Pre-Implementation (Setup Dependencies)
- [ ] 0.1 Ensure `@sva-studio/sdk` exports NavigationRegistry interface
- [ ] 0.2 Ensure `@sva-studio/app-config` exports theme/language config types
- [ ] 0.3 Ensure `@sva-studio/ui-contracts` exists with design token definitions
- [ ] 0.4 Create `@sva-studio/ui-contracts/design-tokens.css` with CSS variables (colors, spacing, typography)
- [ ] 0.5 Verify i18n system is set up (`react-i18next` configuration)

## 1. Folder Restructuring & Nx Configuration
- [ ] 1.1 Rename `apps/studio/` to `apps/sva-studio-react/`
- [ ] 1.2 Update `nx.json` project configuration:
  - [ ] 1.2a Create/update `apps/sva-studio-react/project.json` with targets:
    - [ ] `serve` target (vite dev server on port 4200)
    - [ ] `build` target (vite production build)
    - [ ] `lint` target (eslint)
    - [ ] `test` target (vitest, optional for PoC)
  - [ ] 1.2b Add dependencies in project.json: [@sva-studio/sdk, @sva-studio/ui-contracts, @sva-studio/app-config]
- [ ] 1.3 Update tsconfig paths in `tsconfig.base.json`
- [ ] 1.4 Update all import paths in the project

## 2. Root Layout Component
- [ ] 2.1 Create `apps/sva-studio-react/src/components/layout/RootLayout.tsx`
- [ ] 2.2 Implement flex layout structure (sidebar + header + content)
- [ ] 2.3 Add Outlet for plugin routes
- [ ] 2.4 Create CSS module: `RootLayout.module.css`
- [ ] 2.5 Style with CSS variables from `@sva-studio/ui-contracts` (no hardcoded colors)
- [ ] 2.6 Export RootLayout from layout index
- [ ] 2.7 (Optional: Use `nx generate @nx/react:component RootLayout --directory=src/components/layout` for scaffolding)

## 3. Sidebar Component (Registry Rendering)
- [ ] 3.1 Create `apps/sva-studio-react/src/components/sidebar/Sidebar.tsx`
- [ ] 3.2 Integrate `navigationRegistry.getItems()` from SDK
- [ ] 3.3 Render navigation items from registry (hardcoded demo data in Phase 1, no RBAC filtering yet)
- [ ] 3.4 Implement collapsed state toggle (UI state only, no persistence yet)
- [ ] 3.5 Create `SidebarToggle.tsx` for collapse button
- [ ] 3.6 Create `SidebarNav.tsx` for recursive menu rendering
- [ ] 3.7 Create `Sidebar.module.css` (CSS variables from design tokens)
- [ ] 3.8 (Optional: Use `nx generate @nx/react:component Sidebar` for scaffolding)

## 4. Header Component (Placeholders + i18n)
- [ ] 4.1 Create `apps/sva-studio-react/src/components/header/Header.tsx`
- [ ] 4.2 Create `SearchBar.tsx` (placeholder, disabled, no search logic)
  - [ ] 4.2a Input with placeholder: `t('common.search')`
  - [ ] 4.2b Disabled/readonly input for now (no wiring)
- [ ] 4.3 Create `LanguageSelector.tsx` (placeholder)
  - [ ] 4.3a Dropdown showing available languages from i18n
  - [ ] 4.3b Language names from translations (not hardcoded)
  - [ ] 4.3c NO functionality yet (Phase 1.5)
- [ ] 4.4 Create `ThemeToggle.tsx` (placeholder button, no logic)
  - [ ] 4.4a Toggle button with icon or label: `t('common.theme')`
  - [ ] 4.4b NO theme switching logic (Phase 1.5)
- [ ] 4.5 Create `UserMenu.tsx` (placeholder)
  - [ ] 4.5a Hardcoded user name/avatar (no Auth-Context)
  - [ ] 4.5b Menu items as UI only (no logout logic)
  - [ ] 4.5c All labels via i18n
- [ ] 4.6 Create `Header.module.css` (CSS variables from design tokens)
- [ ] 4.7 All UI labels use `t()` function (CRITICAL - DEVELOPMENT_RULES)
- [ ] 4.8 (Optional: Use `nx generate @nx/react:component` for sub-components)

## 5. Content Area Component
- [ ] 5.1 Create `apps/sva-studio-react/src/components/layout/ContentArea.tsx`
- [ ] 5.2 Implement scrollable container
- [ ] 5.3 Create `ContentArea.module.css` (CSS variables from design tokens)
- [ ] 5.4 No hardcoded spacing/colors

## 6. Root Route Integration
- [ ] 6.1 Update `apps/sva-studio-react/src/routes/root.tsx` to use RootLayout
- [ ] 6.2 Ensure RootLayout wraps all child routes
- [ ] 6.3 Create default dashboard/home route

## 7. i18n & Design Tokens Integration (CRITICAL)

### i18n Setup
- [ ] 7.1 Set up `react-i18next` configuration (if not already)
- [ ] 7.2 Create translation files:
  - [ ] `apps/sva-studio-react/src/locales/de.json` with keys:
    - `common.search`, `common.theme`, `common.language`
    - `common.languageDe`, `common.languageEn`
    - `common.profile`, `common.settings`, `common.logout`
  - [ ] `apps/sva-studio-react/src/locales/en.json` with translations
- [ ] 7.3 All UI labels use `t('key')` function (CRITICAL - DEVELOPMENT_RULES)
- [ ] 7.4 Verify NO hardcoded strings in components (grep for quotes)

### Design Tokens Setup
- [ ] 7.5 Verify `@sva-studio/ui-contracts/design-tokens.css` exists with:
  - [ ] Color tokens: `--color-sidebar-bg`, `--color-header-bg`, `--color-text-primary`
  - [ ] Spacing tokens: `--spacing-sm`, `--spacing-md`, `--spacing-lg`
  - [ ] Typography: `--font-size-base`, `--font-weight-regular`
- [ ] 7.6 All CSS Modules import from design-tokens.css
- [ ] 7.7 Grep verification: NO hardcoded colors (`#`, `rgb(`, `hsl(`)

## 8. Error Handling (Staging Stability)
- [ ] 8.1 Wrap `navigationRegistry.getItems()` in try-catch
- [ ] 8.2 On error: log to console with `console.error('Registry error:', error)`
- [ ] 8.3 Display fallback UI: "<nav><p>Navigation unavailable</p><button>Reload</button></nav>"
- [ ] 8.4 Reload button calls location.reload()

## 9. Testing & Validation
- [ ] 9.1 Sidebar renders menu items from registry
- [ ] 9.2 Header displays all placeholder components
- [ ] 9.3 Keyboard: Tab through all interactive elements works
- [ ] 9.4 Keyboard: Focus indicators visible on all buttons/inputs
- [ ] 9.5 Browser console: NO hardcoded text errors (all `t('...')`)
- [ ] 9.6 Registry error: Fallback UI shows instead of blank page
- [ ] 9.7 Semantic HTML: `<header>`, `<nav>`, `<main>` present

## 10. Documentation
- [ ] 10.1 Update README with: "Local PoC GUI Shell - Error handling, i18n keys, design tokens"
- [ ] 10.2 Document: How to trigger registry error for testing
- [ ] 10.3 Document: How to add new i18n keys (de.json + en.json sync)

## Phase 1.5+ (All Logic & Ops Deferred)
- Auth-Context & session management
- RBAC navigation filtering
- Theme/language switching (actual functionality)
- Preferences persistence
- Search bar functionality
- Structured logging & monitoring
- Full accessibility audit
- Responsive breakpoints (768px mobile design)
- Runbook & deployment docs
- Migration guides
