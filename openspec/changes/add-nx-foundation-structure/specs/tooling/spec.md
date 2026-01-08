## ADDED Requirements
### Requirement: Nx Baseline Projects Scaffolded
The workspace SHALL provide initial Nx projects for the admin app and core packages without feature logic, ensuring lint/test/build targets exist and run.

#### Scenario: Projects scaffolded with targets
- **WHEN** the foundation is set up
- **THEN** `apps/studio` and the packages `sdk`, `core`, `data`, `auth`, `ui-contracts`, `runtime-react`, `theme-engine`, `app-config` exist
- **AND** each project has lint/test/build targets configured
- **AND** targets complete successfully on a clean checkout

### Requirement: Enforced Import Boundaries
The workspace SHALL enforce import boundaries so plugins and packages only depend on allowed layers via `@cms/*` aliases.

#### Scenario: Disallowed host imports are blocked
- **WHEN** a plugin or package attempts to import from host internals
- **THEN** ESLint boundary rules fail the build/lint

#### Scenario: SDK/Core stay UI-free
- **WHEN** code in `sdk` or `core` is checked
- **THEN** UI framework imports (React/Vue) are disallowed by linting

### Requirement: Path Aliases Configured
The workspace SHALL configure TypeScript path mappings for `@cms/*` covering the scaffolded packages.

#### Scenario: Aliases resolve
- **WHEN** packages import siblings via `@cms/<name>`
- **THEN** TypeScript compilation resolves without relative paths

### Requirement: CI Runs Nx Targets
The CI SHALL run Nx lint/test/build targets for the new projects (with graceful handling if no tests are present but targets exist).

#### Scenario: CI executes affected targets
- **WHEN** CI runs on a branch with changes
- **THEN** `nx affected -t lint,test,build` executes (or equivalent explicit target list)
- **AND** the pipeline fails if boundaries or aliases are broken
