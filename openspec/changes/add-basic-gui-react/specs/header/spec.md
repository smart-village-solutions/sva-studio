## ADDED Requirements

### Requirement: Header Layout and Components
The header SHALL display a horizontal bar containing search, theme toggle, language selector, and user menu, aligned left-to-right.

#### Scenario: Header displays all components
- **WHEN** the application loads
- **THEN** the header shows search bar (left), theme toggle, language selector, and user menu (right)

#### Scenario: Header is sticky at top
- **WHEN** user scrolls content area
- **THEN** the header remains visible at the top of the page

### Requirement: Internationalization (i18n) Integration in Header
All header UI text SHALL use translation keys from the i18n system; no hardcoded strings allowed (DEVELOPMENT_RULES 2.1).

#### Scenario: Header labels are translated
- **WHEN** the header renders
- **THEN** all labels use translation keys:
  - Search placeholder: `t('common.search')`
  - Theme toggle: `t('common.theme')`
  - Language selector label: `t('common.language')`
  - User menu items: `t('common.profile')`, `t('common.settings')`, `t('common.logout')`

#### Scenario: Language names are from translations
- **WHEN** the language dropdown displays available languages
- **THEN** language names come from translations, NOT hardcoded:
  - German: `t('common.languageDe')`
  - English: `t('common.languageEn')`

#### Scenario: Theme toggle label reflects current theme
- **WHEN** user hovers over theme toggle
- **THEN** tooltip shows either `t('common.themeDark')` or `t('common.themeLight')` depending on current theme

### Requirement: Search Bar Functionality
The header search bar SHALL provide a text input for global content search with keyboard shortcut support.

#### Scenario: Search bar is focusable
- **WHEN** user clicks the search bar
- **THEN** the input receives focus and displays a cursor

#### Scenario: Keyboard shortcut opens search
- **WHEN** user presses Cmd+K (macOS) or Ctrl+K (Windows/Linux)
- **THEN** the search input is focused and ready for input

#### Scenario: Search placeholder provides guidance
- **WHEN** the search bar is empty
- **THEN** placeholder text from `t('common.search')` is visible

#### Scenario: Search bar is placeholder in Phase 1
- **WHEN** user types in search bar (Phase 1)
- **THEN** nothing happens (placeholder for Phase 2 full-text search integration)

### Requirement: Theme Toggle (Light/Dark Mode)
The header theme toggle SHALL switch between light and dark CSS themes and persist the preference.

#### Scenario: User toggles theme
- **WHEN** user clicks the theme toggle button
- **THEN** the application CSS theme changes from light to dark or vice versa

#### Scenario: Theme preference is saved (Phase 1)
- **WHEN** user toggles the theme
- **THEN** the preference is stored in `localStorage` under key `cms-theme` (MVP - Phase 2: backend sync)

#### Scenario: Theme is applied on load
- **WHEN** the application initializes
- **THEN** the saved theme preference is applied (or system preference if not saved)

### Requirement: Language Selector
The header language selector SHALL display available languages and allow users to switch the UI language via i18n system.

#### Scenario: Language dropdown shows available languages
- **WHEN** user clicks the language selector
- **THEN** a dropdown appears with available language options fetched from `@cms/app-config`

#### Scenario: Language changes on selection
- **WHEN** user selects a language from the dropdown
- **THEN** the entire UI re-renders in the selected language using i18n

#### Scenario: Language preference is persistent (Phase 1)
- **WHEN** user selects a language
- **THEN** the preference is stored in `localStorage` (MVP - Phase 2: user backend profile)

### Requirement: User Menu
The header user menu SHALL display the current user's name/avatar and provide quick access to profile, settings, and logout options.

#### Scenario: User avatar is displayed
- **WHEN** the application initializes
- **THEN** the current user's avatar or initials are visible in the header (from Auth-Context)

#### Scenario: User menu dropdown opens
- **WHEN** user clicks their avatar
- **THEN** a dropdown menu appears with profile (`t('common.profile')`), settings (`t('common.settings')`), and logout (`t('common.logout')`) options

#### Scenario: User can log out
- **WHEN** user clicks logout
- **THEN** the authentication session ends, Auth-Context clears, and user is redirected to login page

### Requirement: Design Token Sourcing for Header Styling
Header component CSS MUST source colors and spacing from `@cms/ui-contracts` design tokens, not hardcoded values.

#### Scenario: Header uses CSS variables for styling
- **WHEN** Header.module.css is created
- **THEN** it imports design tokens from `@cms/ui-contracts` and uses:
  - Colors: `var(--color-header-bg)`, `var(--color-text-primary)` (NOT `#fff`, `#000`, `rgb(...)`)
  - Spacing: `var(--spacing-md)`, `var(--spacing-lg)` (NOT `16px`, `24px`)
  - Typography: `var(--font-size-base)`, `var(--font-weight-medium)`
