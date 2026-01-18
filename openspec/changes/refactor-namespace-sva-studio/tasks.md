## 1) Workspace configuration
- [x] Update `.npmrc` to include `@sva-studio` scope (registry/resolution)
- [x] Update `pnpm-workspace.yaml` to reflect scope if required (no changes needed)
- [x] Update `tsconfig.base.json` path aliases to map `@sva-studio/*`
- [x] Update `nx.json` project or implicit deps referencing the legacy cms scope (none found)

## 2) Package manifests
- [x] Rename `name` fields in `packages/*/package.json` to `@sva-studio/...`
- [x] Update internal dependency entries to the new scope
- [x] Ensure version ranges stay unchanged

## 3) App and package imports
- [x] Global search/replace imports from the legacy cms scope to `@sva-studio/` across source files
- [x] Verify storybook/demo/test imports follow new scope (if present)

## 4) Documentation and specs
- [x] Update OpenSpec change docs and specs to use `@sva-studio/`
- [x] Update project docs (e.g., Paketarchitektur) to remove legacy cms scope references

## 5) Validation
- [x] Run `openspec validate refactor-namespace-sva-studio --strict`
- [x] Run a repository-wide grep for the legacy scope pattern and ensure zero matches
- [ ] Run `pnpm install` and a representative build (e.g., `nx build sdk`) to confirm resolution
