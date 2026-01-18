## ADDED Requirements

### Requirement: All packages use @sva-studio namespace
All internal packages SHALL use the `@sva-studio/` namespace prefix (e.g., sdk, core, data, auth, ui-contracts, ui-react, ui-vue, app-config, auth-context) to reflect the project identity and avoid legacy cms scope references.

#### Scenario: SDK imports use new namespace
- **WHEN** importing SDK components in any file
- **THEN** imports use `@sva-studio/sdk` instead of the legacy cms scope

#### Scenario: Internal packages use new namespace
- **WHEN** importing any internal package
- **THEN** imports use `@sva-studio/{package-name}` instead of the legacy cms scope (e.g., `@sva-studio/data`, `@sva-studio/ui-contracts`, `@sva-studio/ui-react`, `@sva-studio/ui-vue`)

#### Scenario: Package manifests updated
- **WHEN** updating `package.json` files across apps and packages
- **THEN** all internal dependencies reference the `@sva-studio/` scope and contain no legacy scope entries

### Requirement: Tooling resolves @sva-studio scope
Build and workspace tooling SHALL resolve the `@sva-studio/*` scope for imports and publishes.

#### Scenario: Path aliases updated
- **WHEN** configuring TypeScript path aliases
- **THEN** `tsconfig.base.json` maps `@sva-studio/*` to the corresponding package directories and contains no legacy aliases

#### Scenario: Workspace and registry config updated
- **WHEN** configuring package resolution (e.g., `.npmrc`, `pnpm-workspace.yaml`, `nx.json`)
- **THEN** scoped package settings reference `@sva-studio` and contain no `@cms` scope entries

### Requirement: Docs and specs use @sva-studio namespace
All documentation and specifications SHALL reference the `@sva-studio/` namespace and must not contain legacy cms-scope examples.

#### Scenario: Docs updated
- **WHEN** reviewing documentation and specs
- **THEN** code examples and text reference `@sva-studio/` packages exclusively and contain zero legacy-scope references

### Requirement: Namespace migration leaves no regressions
After migration, no legacy namespace references SHALL remain in the repository.

#### Scenario: No @cms occurrences after migration
- **WHEN** running repository-wide scans for the legacy scope pattern
- **THEN** no matches are found across source, configs, specs, or docs
