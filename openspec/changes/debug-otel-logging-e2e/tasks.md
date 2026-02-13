# Tasks: Debug OTEL Logging Pipeline E2E

Change ID: `debug-otel-logging-e2e`

## Phase 1: Component Isolation Testing

### Task 1.1: OTEL SDK & Logger Provider Creation Test
- [ ] Create `test-otel-provider-creation.ts` in workspace root
- [ ] Test: SDK initialization with minimal config
- [ ] Test: logs.getLoggerProvider() returns object
- [ ] Test: Logger has getLogger() method
- [ ] Test: Logger instance has emit() method
- [ ] Run and document all success/failure cases
- [ ] **URL:** `test-otel-provider-creation.ts`

### Task 1.2: Global Provider Storage Test
- [ ] Create `test-global-provider-storage.ts` in workspace root
- [ ] Test: setGlobalLoggerProvider() stores reference
- [ ] Test: getGlobalLoggerProvider() retrieves same instance
- [ ] Test: Works across module boundaries
- [ ] Test: Multiple writes don't break reads
- [ ] Run and document results
- [ ] **URL:** `test-global-provider-storage.ts`

### Task 1.3: DirectOtelTransport Initialization Test
- [ ] Create `test-direct-otel-transport.ts` in workspace root
- [ ] Mock Logger Provider with getLogger() + emit()
- [ ] Create DirectOtelTransport instance
- [ ] Call log() method with test data
- [ ] Verify: Provider was accessed
- [ ] Verify: Logger was created
- [ ] Verify: emit() was called with correct format
- [ ] Run and document all edge cases
- [ ] **URL:** `test-direct-otel-transport.ts`

### Task 1.4: Analyze Phase 1 Results
- [ ] Collect results from all 3 tests
- [ ] Identify which component is failing
- [ ] Document root cause hypothesis
- [ ] If all pass → proceed to Phase 2
- [ ] If any fail → start debugging that component
- [ ] **Output:** `PHASE_1_RESULTS.md`

---

## Phase 2: Integration Testing

### Task 2.1: SDK + Global Provider Integration Test
- [ ] Create `packages/monitoring-client/tests/otel-integration.test.ts`
- [ ] Test: startOtelSdk() initializes completely
- [ ] Test: Global provider is set after SDK.start()
- [ ] Test: getGlobalLoggerProvider() works immediately after init
- [ ] Test: Survives HMR in Vite dev server
- [ ] Run: `npx vitest run tests/otel-integration.test.ts`
- [ ] **URL:** `packages/monitoring-client/tests/otel-integration.test.ts`

### Task 2.2: Winston + DirectOtelTransport Integration
- [ ] Create `packages/sdk/tests/logger/direct-otel-transport.test.ts`
- [ ] Mock OTEL Provider + Logger
- [ ] Create SDK logger with `enableOtel: true`
- [ ] Log multiple messages with different levels
- [ ] Verify: Provider was accessed each time
- [ ] Verify: emit() called with correct severity level
- [ ] Verify: Attributes preserved (component, level, message)
- [ ] Run: `npx vitest run packages/sdk/tests/logger/direct-otel-transport.test.ts`
- [ ] **URL:** `packages/sdk/tests/logger/direct-otel-transport.test.ts`

### Task 2.3: Add Instrumentation Logging
- [ ] Add debug console.log() to key locations:
  - [ ] `otel.server.ts` line 181: "Logger Provider set from API"
  - [ ] `logger/index.server.ts` line ~95: "Provider found" + Provider class name
  - [ ] `logger/index.server.ts` line ~100: "Logger created" + Logger class name
  - [ ] `logger/index.server.ts` line ~115: Before emit() call: "Emitting log record"
- [ ] Make logs grep-friendly with consistent prefix: `[OTEL-DEBUG]`
- [ ] Run: `grep -r "[OTEL-DEBUG]" /tmp/dev-server.log`
- [ ] **URL:** Multiple files

### Task 2.4: Analyze Phase 2 Results
- [ ] Run both integration tests
- [ ] If all pass → proceed to Phase 3
- [ ] If any fail → look at Instrumentation logs for clues
- [ ] Document findings in `PHASE_2_RESULTS.md`
- [ ] **Output:** `PHASE_2_RESULTS.md`

---

## Phase 3: End-to-End Testing

### Task 3.1: Create E2E Test Script
- [ ] Create `scripts/test-otel-e2e.sh`
- [ ] Script should:
  - [ ] Start Docker (Collector + Loki)
  - [ ] Wait for services to be healthy (health checks)
  - [ ] Start dev server with ENABLE_OTEL=true
  - [ ] Wait for server ready (curl check)
  - [ ] Trigger auth endpoint to generate logs
  - [ ] Wait for batch processor to flush (sleep 3s)
  - [ ] Query Collector logs for "logRecord"
  - [ ] Query Loki for {component="bootstrap"}
  - [ ] Verify result count > 0
  - [ ] Clean up (kill server, stop docker)
  - [ ] Print summary (PASS/FAIL)
- [ ] Run: `bash scripts/test-otel-e2e.sh`
- [ ] **URL:** `scripts/test-otel-e2e.sh`

### Task 3.2: Create Validation Checklist
- [ ] Create `docs/OTEL_VALIDATION_CHECKLIST.md`
- [ ] Document exact curl commands for each check:
  - [ ] App console logs visible?
  - [ ] OTLP batch exported?
  - [ ] Collector received logs?
  - [ ] Loki has logs with component="xyz"?
  - [ ] Attributes preserved?
- [ ] **URL:** `docs/OTEL_VALIDATION_CHECKLIST.md`

### Task 3.3: Run E2E Test & Document Results
- [ ] Run E2E script
- [ ] Capture all output
- [ ] Run validation checklist manually (if script doesn't cover all)
- [ ] Document:
  - [ ] Which steps passed
  - [ ] Which steps failed
  - [ ] Exact error messages
  - [ ] Collector logs (relevant excerpts)
  - [ ] Loki query results
- [ ] **Output:** `PHASE_3_RESULTS.md`

### Task 3.4: Root Cause Analysis
- [ ] Based on Phase 1-3 results, identify where logs drop
- [ ] If Phase 1 fails: OTEL SDK/Provider issue
- [ ] If Phase 2 fails: Transport/Integration issue
- [ ] If Phase 3 fails: Export/Collector/Loki issue
- [ ] Document hypothesis with evidence
- [ ] **Output:** `ROOT_CAUSE_ANALYSIS.md`

---

## Phase 4: Implementation & Fix

### Task 4.1: Implement Fix (TBD)
- [ ] Based on Root Cause Analysis
- [ ] Fix the identified component
- [ ] Run Phase 1-3 tests again
- [ ] Verify all tests pass
- [ ] Remove debug [OTEL-DEBUG] logs

### Task 4.2: Update Documentation
- [ ] Update `docs/logging.md` if exists, else create
- [ ] Document:
  - [ ] How OTEL logging works in this project
  - [ ] How to debug if logs don't appear
  - [ ] What each component does
  - [ ] Configuration options
- [ ] Create `docs/observability.md` for full monitoring stack

### Task 4.3: Commit & PR
- [ ] Create PR with:
  - [ ] Fix implementation
  - [ ] Tests added/updated
  - [ ] Documentation updated
  - [ ] Root cause analysis in PR description
- [ ] Reference: This proposal document

---

## Execution Checklist

Before starting each phase:

- [ ] All previous phases are documented and approved
- [ ] Understand why previous phase succeeded/failed
- [ ] Have identified specific hypothesis to test
- [ ] Know exact success criteria

During phase execution:

- [ ] Run tests in isolation first
- [ ] Capture full output
- [ ] Don't move to next phase if current phase fails
- [ ] Document findings as you go

After phase completion:

- [ ] Write summary document for phase results
- [ ] Tag all related commits/files
- [ ] Get approval before next phase (first phase only?)
- [ ] Update timeline if needed

---

## Output Documents

| Document | Purpose | When |
|----------|---------|------|
| `PHASE_1_RESULTS.md` | Component Test Results | After Phase 1 |
| `PHASE_2_RESULTS.md` | Integration Test Results | After Phase 2 |
| `PHASE_3_RESULTS.md` | E2E Test Results | After Phase 3 |
| `ROOT_CAUSE_ANALYSIS.md` | Analysis of where logs drop | After Phase 3 |
| `docs/logging.md` | How to use OTEL logging | After Phase 4 |
| `docs/observability.md` | Full monitoring stack guide | After Phase 4 |

---

## Time Estimates

| Phase | Tasks | Estimated Time |
|-------|-------|-----------------|
| 1 | 4 tests, 1 analysis | 1-2 hours |
| 2 | 2 integration tests, 1 instrumentation, 1 analysis | 1-2 hours |
| 3 | 1 e2e script, 1 checklist, 2 analysis & execution | 1-2 hours |
| 4 | Fix + docs + PR | 1-3 hours (TBD) |
| **TOTAL** | | **4-9 hours** |

Depending on root cause complexity.

---

## Success Criteria (Final)

- ✅ All Phase 1 component tests pass
- ✅ All Phase 2 integration tests pass
- ✅ E2E script runs and shows: Logs in Loki with correct attributes
- ✅ Root cause documented
- ✅ Fix implemented
- ✅ Debugging documentation updated
- ✅ No console errors or unhandled rejections

---

## Rollback Plan

If any phase reveals unfixable blockers:

1. Document findings in `PHASE_X_BLOCKERS.md`
2. Identify alternative approaches (different OTEL integration, different logger, etc.)
3. Create new proposal for alternative approach
4. Do NOT attempt hacky workarounds

Examples of potential blockers:
- OTEL SDK has fundamental incompatibility with Vite HMR
- Winston + OTEL instrumentation cannot work together
- Collector config fundamentally incompatible with our needs
