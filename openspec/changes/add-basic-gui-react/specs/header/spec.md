## ADDED Requirements

### Requirement: Header Layout and Components
The header SHALL display a horizontal bar containing search, theme toggle, language selector, and user menu, aligned left-to-right.

#### Scenario: Header displays all components
- **WHEN** the application loads
- **THEN** the header shows search bar (left), theme toggle, language selector, and user menu (right)

#### Scenario: Header is sticky at top
- **WHEN** user scrolls content area
- **THEN** the header remains visible at the top of the page

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
- **THEN** placeholder text like "Search content..." is visible

### Requirement: Theme Toggle (Light/Dark Mode)
The header theme toggle SHALL switch between light and dark CSS themes and persist the preference.

#### Scenario: User toggles theme
- **WHEN** user clicks the theme toggle button
- **THEN** the application CSS theme changes from light to dark or vice versa

#### Scenario: Theme preference is saved
- **WHEN** user toggles the theme
- **THEN** the preference is stored in `localStorage` under key `cms-theme`

#### Scenario: Theme is applied on load
- **WHEN** the application initializes
- **THEN** the saved theme preference is applied (or system preference if not saved)

### Requirement: Language Selector
The header language selector SHALL display available languages and allow users to switch the UI language.

#### Scenario: Language dropdown shows available languages
- **WHEN** user clicks the language selector
- **THEN** a dropdown appears with available language options (e.g., "Deutsch", "English")

#### Scenario: Language changes on selection
- **WHEN** user selects a language from the dropdown
- **THEN** the entire UI re-renders in the selected language

#### Scenario: Language preference is persistent
- **WHEN** user selects a language and logs out/in
- **THEN** the selected language is applied automatically

### Requirement: User Menu
The header user menu SHALL display the current user's name/avatar and provide quick access to profile, settings, and logout options.

#### Scenario: User avatar is displayed
- **WHEN** the application initializes
- **THEN** the current user's avatar or initials are visible in the header

#### Scenario: User menu dropdown opens
- **WHEN** user clicks their avatar
- **THEN** a dropdown menu appears with profile, settings, and logout options

#### Scenario: User can log out
- **WHEN** user clicks logout
- **THEN** the authentication session ends and user is redirected to login page
