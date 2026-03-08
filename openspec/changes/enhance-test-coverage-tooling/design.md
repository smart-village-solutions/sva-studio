# Technical Design

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Nx Workspace Layer                        │
├─────────────────────────────────────────────────────────────┤
│  nx.json                                                     │
│  ├─ targetDefaults.test:coverage (cache + inputs/outputs)  │
│  └─ namedInputs.testing (test-specific dependencies)       │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                  Vitest Workspace Layer                      │
├─────────────────────────────────────────────────────────────┤
│  vitest.workspace.ts (Root)                                 │
│  ├─ Global config (reporters, coverage settings)           │
│  ├─ Discovery: apps/*/vitest.config.ts                     │
│  └─ Discovery: packages/*/vitest.config.ts                 │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│              Project-Level Test Execution                    │
├─────────────────────────────────────────────────────────────┤
│  project.json (per app/package)                             │
│  ├─ test:unit → pnpm exec vitest run                       │
│  └─ test:coverage → pnpm exec vitest run --coverage        │
│                                                              │
│  Coverage Output: {projectRoot}/coverage/                   │
│  ├─ coverage-summary.json                                   │
│  └─ lcov.info                                               │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│                Coverage Gate (CI)                            │
├─────────────────────────────────────────────────────────────┤
│  scripts/ci/coverage-gate.ts (TypeScript)                   │
│  ├─ Input: tooling/testing/coverage-policy.json            │
│  ├─ Input: tooling/testing/coverage-baseline.json          │
│  ├─ Input: */coverage/coverage-summary.json (discovered)   │
│  ├─ Logic: Floor checks + Baseline delta checks            │
│  ├─ Output: Colored terminal + GitHub Step Summary         │
│  └─ Exit: 0 (pass) | 1 (fail)                              │
└─────────────────────────────────────────────────────────────┘
                           ↓
┌─────────────────────────────────────────────────────────────┐
│          Visualization & Reporting Layer                     │
├─────────────────────────────────────────────────────────────┤
│  Option A: Codecov Integration                              │
│  ├─ Upload lcov.info to Codecov                            │
│  ├─ PR Comments with Coverage Diff                         │
│  └─ Trend Dashboards                                        │
│                                                              │
│  Option B: GitHub Actions Summary (Manual)                  │
│  ├─ Extended Markdown Summary                               │
│  ├─ ASCII-Art Trend Charts                                  │
│  └─ Delta Indicators (🟢/🔴)                                │
└─────────────────────────────────────────────────────────────┘
```

## Key Design Decisions

### 1. Nx Caching Strategy

**Decision:** Use `targetDefaults` with explicit `inputs`, `outputs`, and `cache: true`

**Rationale:**
- Nx can hash inputs (source code, test files, vitest config) and reuse cached coverage
- Drastically speeds up CI for affected packages (30-50% improvement expected)
- Plays well with Nx Cloud (if enabled later)

**Implementation:**
```json
{
  "targetDefaults": {
    "test:coverage": {
      "cache": true,
      "inputs": [
        "default",           // Project source files
        "^production",       // Dependent projects
        "{workspaceRoot}/vitest.config.ts",
        "{workspaceRoot}/vitest.workspace.ts"
      ],
      "outputs": ["{projectRoot}/coverage"]
    }
  },
  "namedInputs": {
    "testing": [
      "{projectRoot}/**/*.test.{ts,tsx}",
      "{projectRoot}/**/*.spec.{ts,tsx}",
      "{workspaceRoot}/vitest.config.ts"
    ]
  }
}
```

**Trade-offs:**
- ✅ Pro: Massive CI speedup for unchanged packages
- ✅ Pro: Deterministic cache invalidation
- ⚠️ Consideration: False cache hits if input definitions are incomplete
  - **Mitigation:** Include all relevant config files in `inputs`
  - **Validation:** `--skip-nx-cache` flag to bypass cache in debugging

---

### 2. Vitest Workspace Architecture

**Decision:** Centralized `vitest.workspace.ts` with per-project overrides

**Rationale:**
- **DRY Principle:** Coverage reporters, thresholds, and global config defined once
- **Consistency:** All packages use same reporter formats (critical for gate-script)
- **Maintainability:** Changes to coverage strategy require single file edit
- **Flexibility:** Projects can still override via local `vitest.config.ts`

**Structure:**
```
vitest.workspace.ts         (Root)
├─ Global coverage config
├─ Reporter defaults
└─ Project discovery globs

apps/sva-studio-react/
└─ vitest.config.ts        (Minimal, project-specific only)

packages/sdk/
└─ vitest.config.ts        (Minimal, project-specific only)
```

**Example Root Config:**
```typescript
// vitest.workspace.ts
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    test: {
      globals: true,
      environment: 'node',
      coverage: {
        provider: 'v8',
        reporter: ['text-summary', 'json-summary', 'lcov'],
        reportsDirectory: './coverage',
        exclude: [
          '**/node_modules/**',
          '**/dist/**',
          '**/*.config.*',
          '**/coverage/**'
        ]
      }
    }
  },
  'apps/*/vitest.config.ts',
  'packages/*/vitest.config.ts'
]);
```

**Migration Path:**
1. Create workspace config with current settings
2. Simplify project configs (remove duplicated settings)
3. Test each project: `npx nx test:coverage [project]`
4. Validate coverage output locations remain unchanged

**Trade-offs:**
- ✅ Pro: Single source of truth for coverage settings
- ✅ Pro: Eliminates `cwd` parameter in project.json targets
- ⚠️ Consideration: Breaking change if projects have divergent configs
  - **Mitigation:** Projects keep local configs for legitimate overrides
  - **Example override:** Different test environment (jsdom vs node)

---

### 3. TypeScript Migration for Coverage-Gate

**Decision:** Migrate `coverage-gate.mjs` to `coverage-gate.ts` with strict types

**Rationale:**
- **Type Safety:** Policy/Baseline structure is validated at compile-time
- **Refactoring:** IDE support (rename, find references) improves maintainability
- **Documentation:** Types serve as inline documentation
- **Future-Proof:** Easier to extend (e.g., per-metric targets, trend analysis)

**Type Hierarchy:**
```typescript
// Core Domain Types
type CoverageMetric = 'lines' | 'statements' | 'functions' | 'branches';

interface MetricFloors {
  lines: number;
  statements: number;
  functions: number;
  branches: number;
}

// Configuration Types
interface CoveragePolicy {
  version: number;
  metrics: CoverageMetric[];
  globalFloors: MetricFloors;
  maxAllowedDropPctPoints: number;
  exemptProjects: string[];
  perProjectFloors: Record<string, MetricFloors>;
}

interface CoverageBaseline {
  projects: Record<string, MetricFloors>;
}

// Runtime Types
interface CoverageSummary {
  total: {
    lines: { pct: number };
    statements: { pct: number };
    functions: { pct: number };
    branches: { pct: number };
  };
}

interface GateResult {
  passed: boolean;
  errors: string[];
  globalCoverage: MetricFloors;
  projects: Record<string, MetricFloors>;
}
```

**Runtime Execution:**
```json
// package.json
{
  "scripts": {
    "coverage-gate": "tsx scripts/ci/coverage-gate.ts"
  },
  "devDependencies": {
    "tsx": "^4.21.0"
  }
}
```

**Migration Strategy:**
1. Create `.ts` file alongside existing `.mjs`
2. Port logic incrementally with types
3. Add unit tests for typed functions
4. Update CI to use TypeScript version
5. Remove `.mjs` after validation period (1 week)

**Trade-offs:**
- ✅ Pro: Compile-time validation prevents runtime errors
- ✅ Pro: Better tooling support (autocomplete, refactoring)
- ✅ Pro: Self-documenting code via types
- ⚠️ Consideration: Adds `tsx` dependency
  - **Mitigation:** `tsx` is widely used, minimal footprint (~2MB)
  - **Alternative:** Pre-compile to JS (adds build step complexity)

---

### 4. Colored Terminal Output

**Decision:** Use ANSI escape codes directly (no external library)

**Rationale:**
- **Zero Dependencies:** Avoid adding `chalk` or similar for simple use case
- **Control:** Full control over color scheme and formatting
- **Performance:** No function call overhead
- **Compatibility:** ANSI codes work in all modern terminals and CI systems

**Implementation:**
```typescript
const colors = {
  reset: '\x1b[0m',
  green: (text: string) => `\x1b[32m${text}\x1b[0m`,
  red: (text: string) => `\x1b[31m${text}\x1b[0m`,
  yellow: (text: string) => `\x1b[33m${text}\x1b[0m`,
  blue: (text: string) => `\x1b[34m${text}\x1b[0m`,
  bold: (text: string) => `\x1b[1m${text}\x1b[0m`,
};

// Usage
console.log(colors.green('✅ Coverage gate passed'));
console.error(colors.red('❌ Coverage gate failed:'));
console.warn(colors.yellow('⚠️  Warning: No summaries found'));
```

**Emoji Strategy:**
- ✅ Success (green)
- ❌ Failure (red)
- ⚠️ Warning (yellow)
- 📊 Summary (blue)
- 🎯 Target (highlight important metrics)

**Trade-offs:**
- ✅ Pro: Zero dependencies, lightweight
- ✅ Pro: Works universally (GitHub Actions, GitLab, local terminals)
- ⚠️ Consideration: No color in dumb terminals (e.g., `TERM=dumb`)
  - **Mitigation:** Check `process.stdout.isTTY` and disable colors if false
  - **Fallback:** Plain text with ASCII markers [PASS] [FAIL]

---

### 5. Codecov vs. Manual Visualization

**Decision:** Implement Codecov, keep manual Summary as fallback

**Rationale:**
- **Codecov Advantages:**
  - Industry-standard, trusted by OS projects
  - Rich UI (trends, sunburst, diff view)
  - PR comments automated
  - Minimal setup (GitHub Action + token)
  - Free for open source

- **Manual Summary Advantages:**
  - No external dependencies
  - Full control over presentation
  - Data stays in GitHub ecosystem
  - Works without internet access (self-hosted runners)

**Hybrid Approach:**
```yaml
# CI Workflow
- name: Upload to Codecov
  uses: codecov/codecov-action@v4
  with:
    token: ${{ secrets.CODECOV_TOKEN }}
    fail_ci_if_error: false  # Don't block on Codecov failures

- name: Generate GitHub Summary (always runs)
  run: pnpm coverage-gate
```

**Codecov Configuration:**
```yaml
# codecov.yml
coverage:
  status:
    project:
      default:
        target: auto          # Smart target based on history
        threshold: 0.5%       # Allow 0.5% drop
    patch:
      default:
        target: 80%           # New code should be well-tested

comment:
  layout: "diff, files, footer"
  require_changes: true       # Only comment if coverage changed
```

**Trade-offs:**
- ✅ Pro: Best of both worlds (rich UI + always-available fallback)
- ✅ Pro: Codecov failures don't block CI (`fail_ci_if_error: false`)
- ⚠️ Consideration: Codecov token management
  - **Mitigation:** Token as GitHub Secret, rotate periodically
  - **Fallback:** If token expires, manual Summary continues working

---

### 6. CI Workflow Concurrency

**Decision:** Cancel in-progress runs for non-main branches

**Rationale:**
- **Resource Efficiency:** Avoid redundant CI runs when developer pushes multiple commits
- **Faster Feedback:** Most recent code gets priority
- **Cost Saving:** Especially relevant for GitHub Actions minute limits

**Implementation:**
```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

**Behavior:**
- **PR Branch:** Push new commit → Cancel old run, start new one
- **Main Branch:** Never cancel (preserve deployment, artifact generation)
- **Scheduled Runs:** Each run has unique `github.ref`, no cancellation

**Trade-offs:**
- ✅ Pro: Saves ~50% CI minutes on active PRs
- ✅ Pro: Developers see results faster (no queue)
- ⚠️ Consideration: Could hide intermittent failures in cancelled runs
  - **Mitigation:** Main branch runs full suite, catches all issues
  - **Best Practice:** Squash commits before merge to reduce churn

---

## Data Flow Diagram

```
┌──────────────┐
│  Developer   │
│  runs:       │
│  pnpm test:  │
│  coverage    │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Nx Task Runner                      │
│  ├─ Check cache (inputs hash)       │
│  ├─ Cache hit? → Restore coverage/  │
│  └─ Cache miss? → Run vitest        │
└──────┬───────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────┐
│  Vitest (via workspace config)       │
│  ├─ Run tests (per project)         │
│  ├─ Collect coverage (v8 provider)  │
│  └─ Write: coverage/coverage-        │
│            summary.json              │
└──────┬───────────────────────────────┘
       │
       ▼ (CI only)
┌──────────────────────────────────────┐
│  Coverage Gate Script                │
│  ├─ Find all coverage-summary.json  │
│  ├─ Load policy + baseline           │
│  ├─ Calculate: floors, drops, global │
│  ├─ Generate: colored output + MD    │
│  └─ Exit: 0 (pass) | 1 (fail)       │
└──────┬───────────────────────────────┘
       │
       ├──────────────────┬─────────────┐
       ▼                  ▼             ▼
┌──────────────┐  ┌──────────────┐  ┌─────────────┐
│  Terminal    │  │  GitHub      │  │  Codecov    │
│  (colored)   │  │  Step        │  │  (trends)   │
│              │  │  Summary     │  │             │
└──────────────┘  └──────────────┘  └─────────────┘
```

---

## Error Handling Strategy

### Gate Script Errors

| Error Type | Handling | Exit Code |
|-----------|----------|-----------|
| Policy file missing | Hard fail, clear message | 1 |
| Baseline file missing | Warn, continue with empty baseline | 0 |
| No coverage summaries found + `REQUIRE_SUMMARIES=1` | Hard fail | 1 |
| No coverage summaries found (default) | Warn, skip gate | 0 |
| Coverage below floor | Hard fail, list violations | 1 |
| Coverage dropped > threshold | Hard fail, list violations | 1 |
| Invalid JSON in policy/baseline | Hard fail, show parse error | 1 |
| Expected project missing summary | Hard fail, list missing | 1 |

### Nx Cache Errors

| Error Type | Handling | Mitigation |
|-----------|----------|------------|
| Cache corruption | Nx invalidates, reruns task | Use `--skip-nx-cache` to bypass |
| False cache hit | Manual `nx reset` clears cache | Monitor cache hit rate in CI |
| Distributed cache auth | Falls back to local cache | Validate `NX_CLOUD_AUTH_TOKEN` |

### Vitest Workspace Errors

| Error Type | Handling | Mitigation |
|-----------|----------|------------|
| Circular project dependencies | Vitest fails with clear error | Validate workspace with `vitest --run` |
| Config syntax error | Runtime error, stack trace | Use TypeScript for config (type checking) |
| Missing coverage provider | Runtime error | Check `@vitest/coverage-v8` in dependencies |

---

## Performance Considerations

### Nx Cache Impact

**Assumptions:**
- Average package has ~50 test files
- Coverage run takes ~30s per package
- Workspace has ~10 packages
- Average PR touches 2 packages (affected)

**Before (no cache):**
- Run all affected: 2 packages × 30s = **60s**
- False positives (non-code changes trigger tests): +20% = **72s**

**After (with cache):**
- Cache hit rate: ~70% (config rarely changes)
- Effective run: 30% of packages = 2 × 0.3 × 30s = **18s**
- **Improvement: 75% faster** 🚀

### Vitest Workspace Overhead

**Considerations:**
- Workspace discovery adds ~100-200ms startup time
- Negligible for test runs >5s
- Shared config reduces overall CI YAML size

**Baseline:**
```bash
# Before (individual configs)
time pnpm -r test:coverage
→ 120s total (10 packages × 12s avg)

# After (workspace)
time pnpm test:coverage
→ 115s total (5s saved from consistent config)
```

### Coverage Gate Performance

**Current (.mjs):**
- Directory traversal: O(n) files in workspace
- JSON parsing: O(m) summaries found
- Total: ~200-500ms for workspace with 10k files

**After (.ts):**
- Minimal runtime overhead (<10ms for type checks)
- Same algorithmic complexity
- Optimized traversal (workspace roots only): ~50-100ms

**Optimization Applied:**
```typescript
// Before: traverses entire repo
findCoverageSummaries(process.cwd());

// After: scoped to workspace roots
['apps', 'packages'].flatMap(root => findCoverageSummaries(root));
```

---

## Security Considerations

### Codecov Token

**Storage:** GitHub Repository Secret (`CODECOV_TOKEN`)
**Scope:** Upload-only, no read/write access to code
**Rotation:** 90-day policy recommended
**Mitigation:** `fail_ci_if_error: false` prevents token issues from blocking CI

### TypeScript Execution (tsx)

**Risk:** Arbitrary code execution if `coverage-gate.ts` is compromised
**Mitigation:**
- File reviewed in every PR
- No external inputs executed (only reads JSON files)
- Runs in ephemeral CI environment (no persistent state)

### Git Fetch Depth

**Current:** `fetch-depth: 0` (full history for affected commands)
**Consideration:** Exposes full Git history
**Mitigation:**
- Partial clone available if security concern: `fetch-depth: 10`
- Affected commands need base commit (usually within 10 commits)

---

## Rollback Plan

Each enhancement is designed to be independently reversible:

| Component | Rollback Procedure | Risk |
|-----------|-------------------|------|
| Nx Caching | Set `cache: false` in nx.json | Low - immediate effect |
| Vitest Workspace | Revert to individual configs | Medium - requires config updates |
| TypeScript Gate | Switch back to .mjs in workflow | Low - swap script path |
| Colored Output | Remove ANSI codes, keep logic | Low - cosmetic only |
| Codecov | Remove workflow step | Low - independent feature |
| Concurrency | Remove concurrency block | Low - no side effects |
| DEVELOPMENT_RULES | Revert documentation changes | Low - documentation only |

**Full Rollback:**
```bash
git revert <enhancement-pr-sha>
pnpm install  # Restore dependencies
nx reset      # Clear potentially corrupted cache
```

---

## Future Extensions

Potential follow-ups after initial enhancement:

1. **Coverage Trends Database**
   - Store historical coverage in SQLite/PostgreSQL
   - Chart long-term trends in Grafana
   - Alert on sustained drops

2. **AI-Powered Test Suggestions**
   - Analyze uncovered code paths
   - Generate test stubs for critical functions
   - Prioritize coverage improvements

3. **Per-Metric Targets**
   - Different floors for different metrics (e.g., branches 70%, lines 90%)
   - Weighted scoring (functions count more than lines)

4. **Progressive Enforcement**
   - Gradually raise floors (e.g., +1% per month)
   - Automated baseline updates (with team approval)

5. **Integration with Feature Flags**
   - Require >95% coverage for code behind feature flags
   - Lower threshold for experimental code

---

## References

- [Nx Caching Documentation](https://nx.dev/concepts/how-caching-works)
- [Vitest Workspace](https://vitest.dev/guide/workspace.html)
- [Codecov Uploader](https://docs.codecov.com/docs/codecov-uploader)
- [GitHub Actions Concurrency](https://docs.github.com/en/actions/using-jobs/using-concurrency)
- [ANSI Escape Codes](https://en.wikipedia.org/wiki/ANSI_escape_code#Colors)
