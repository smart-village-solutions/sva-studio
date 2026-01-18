# Change: Refactor Namespace to @sva-studio

## Why
Current packages and documentation use the legacy `cms` scope, which conflicts with the SVA Studio product identity and causes inconsistent imports.

## What Changes
- **BREAKING:** Rename all internal package scopes from the legacy `cms` scope to `@sva-studio/*`
- Update docs and specs to reference the new scope and remove legacy `cms` scope mentions
- Add validation to ensure no legacy scope references remain
- Add validation to ensure no legacy scope references remain

## Impact
- Affected specs: `package-namespace`
- Affected code/config: workspace root configs (`tsconfig.base.json`, `.npmrc`, `pnpm-workspace.yaml`, `nx.json`), package manifests, app imports
- Affected docs: OpenSpec changes, architecture docs, readmes
- Breaking change: All consumers must update imports to `@sva-studio/*`
