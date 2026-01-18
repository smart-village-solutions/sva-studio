## Findings: @cms/ References in sva-studio Project

### Total References Found: 48 occurrences

### Breakdown by Location:

#### 1. openspec/changes/add-basic-gui-react/ (32 occurrences)
- `proposal.md` (10)
- `tasks.md` (10)
- `ARCHITECTURE_REVIEW.md` (8)
- `specs/header/spec.md` (3)
- `specs/navigation/spec.md` (2)
- `specs/layout/spec.md` (5)

#### 2. Documentation (konz-cms-2/Paketarchitektur.md) (16 occurrences)
- All package references in architecture spec
- Code examples with @cms/ imports
- Pattern definitions

### Package Names Found:
- `@cms/sdk` - 15 times
- `@cms/app-config` - 4 times
- `@cms/ui-contracts` - 11 times
- `@cms/auth` - 5 times
- `@cms/auth-context` - 3 times
- `@cms/data` - 2 times
- `@cms/core` - 2 times
- `@cms/search-client` - 1 time
- `@cms/theme-engine` - 1 time
- `@cms/ui-react` - 2 times
- `@cms/ui-vue` - 1 time

### Recommendation:

**SHOULD BE DONE BEFORE Phase 1 Implementation starts** because:
1. Easier to refactor now (limited codebase)
2. Prevents merge conflicts during implementation
3. Establishes correct naming from the start
4. Aligns with project branding

### Action Items:
1. ✅ Create refactoring change proposal
2. ⏳ Update all references to `@sva-studio/`
3. ⏳ Update pnpm-workspace.yaml and nx.json
4. ⏳ Update tsconfig.base.json paths
5. ⏳ Update .npmrc for scoped packages
6. ⏳ Global find-replace in imports
7. ⏳ Verify no broken references
