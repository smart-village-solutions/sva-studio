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

### Requirement: Theme Toggle (Button Only, No Persistence in Phase 1)
The header theme toggle button SHALL display a toggle for light/dark mode (UI only - no functionality yet).

#### Scenario: Theme toggle button is displayed
- **WHEN** the header renders
- **THEN** a theme toggle button is visible with icon or label: `t('common.theme')`

#### Scenario: Theme toggle is keyboard-accessible
- **WHEN** user tabs to theme toggle
- **THEN** it receives visible focus, has `aria-label`, and Space/Enter can interact with it

### Requirement: Language Selector (UI Only, No Persistence in Phase 1)
The header language selector button/dropdown SHALL display available languages (UI only - no language switching logic yet).

#### Scenario: Language selector displays available options
- **WHEN** user clicks the language selector
- **THEN** a dropdown appears showing "Deutsch" and "English" (from translations)

#### Scenario: Language selector is keyboard-accessible
- **WHEN** user tabs to language selector
- **THEN** it opens with Enter/Space, items navigate with arrow keys
- **AND** Escape closes and returns focus to selector

### Requirement: User Menu (Placeholder, No Logout Logic in Phase 1)
The header user menu button SHALL display a placeholder for user avatar and menu items (UI only - no auth logic yet).

#### Scenario: User avatar placeholder is displayed
- **WHEN** the header renders
- **THEN** a placeholder avatar/initials button is visible

#### Scenario: User menu dropdown displays placeholder items
- **WHEN** user clicks the avatar
- **THEN** a dropdown menu appears with hardcoded items:
  - `t('common.profile')`
  - `t('common.settings')`
  - `t('common.logout')`

#### Scenario: User menu is keyboard-accessible
- **WHEN** user clicks avatar
- **THEN** menu items are keyboard-navigable (arrows, Enter to select)
- **AND** Escape closes and returns focus to avatar

### Requirement: Design Token Sourcing for Header Styling
Header component CSS MUST source colors and spacing from `@sva-studio/ui-contracts` design tokens, not hardcoded values.

#### Scenario: Header uses CSS variables for styling
- **WHEN** Header.module.css is created
- **THEN** it imports design tokens from `@sva-studio/ui-contracts` and uses:
  - Colors: `var(--color-header-bg)`, `var(--color-text-primary)` (NOT `#fff`, `#000`, `rgb(...)`)
  - Spacing: `var(--spacing-md)`, `var(--spacing-lg)` (NOT `16px`, `24px`)
  - Typography: `var(--font-size-base)`, `var(--font-weight-medium)`

### Requirement: Accessible Interactive Components in Header
All header buttons and dropdowns SHALL be keyboard-operable and have proper ARIA labels.

#### Scenario: Search input is labeled
- **WHEN** the search bar renders
- **THEN** it has either a visible label or `aria-label="Search"`

#### Scenario: All dropdowns are keyboard-navigable
- **WHEN** user tabs through header
- **THEN** all interactive elements receive focus and are operable with keyboard

---

## Note: Phase 1.5+ Features (Deferred)
- Theme toggle actual switching (CSS class application)
- Theme preference persistence (localStorage/backend)
- Language selector actual language switching (i18n re-render)
- Language preference persistence
- User menu logout functionality (Auth-Context integration)
- User avatar from Auth-Context (currently hardcoded)
