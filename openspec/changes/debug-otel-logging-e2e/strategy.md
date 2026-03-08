# Debugging Strategy: OTEL Logging Pipeline

Structured debugging approach for the "Logs reach OTEL SDK but not Loki" issue.

## The Black Box Problem

Currently we have:
```
✅ APP generates logs (console works)
  ↓
❓ OTEL SDK initialized (but logs missing)
  ↓
❓ Logger Provider (exists? accessible?)
  ↓
❓ DirectOtelTransport (connected? emitting?)
  ↓
❍ OTLP Exporter (exporting? network ok?)
  ↓
❍ Collector (receiving? processing?)
  ↓
❌ Loki (has no app logs)
```

The chain is long with many unknown states. We're currently trying random fixes at each point.

---

## Better Approach: Funnel Down

Instead of testing the entire pipeline, we test each component **in isolation** with mocks:

### Level 1: Can OTEL SDK create a Logger Provider?
```
Mock: Nothing - use real SDK
Test: In isolation, does SDK create usable Provider?

✅ Provider exists
✅ Provider.getLogger('name', 'version') works
✅ Logger.emit() is callable

If fails → Problem is in SDK/OTEL library level
```

### Level 2: Can we store Provider globally?
```
Mock: Use real Provider from Level 1
Test: Store it, retrieve it from different module

✅ Storage works
✅ Retrieval works across modules
✅ Instance is same reference

If fails → Problem is in module loading (CJS/ESM)
```

### Level 3: Can DirectOtelTransport use the Provider?
```
Mock: Fake Provider with getLogger() method
Test: Can Transport find, create Logger, call emit()?

✅ Transport.log() doesn't crash
✅ getGlobalLoggerProvider() returns Provider
✅ emit() is called with correct shape

If fails → Problem is in Transport implementation or import
```

### Level 4: Does Winston + Transport work together?
```
Mock: Real Provider (or fake from Level 3)
Test: Winston logger → Transport → Provider → emit()

✅ Winston log() calls Transport
✅ Transport gets called with correct level/message
✅ emit() receives all attributes

If fails → Problem is in Winston/Transport integration
```

### Level 5: Does Batch Processor work?
```
Setup: Real Provider + Transport + Batch Processor
Test: Do logs queue and batch export?

✅ Logs are queued (multiple logs don't error)
✅ BatchProcessor exports after timeout
✅ OTLPExporter is called

If fails → Problem is in Batch/Export timing
```

### Level 6: Does OTLP Exporter actually send?
```
Setup: Real SDK with OTLP Exporter
Test: Does HTTP request go to /v1/logs?

✅ POST request with correct payload
✅ 200 response (or error details if 4xx/5xx)
✅ Network path is open

If fails → Problem is network/endpoint/auth
```

### Level 7: Does Collector receive & process?
```
Setup: Collector running locally
Test: Do logs appear in Collector logs?

✅ Collector receives POST /v1/logs
✅ Collector parses JSON log records
✅ Collector sends to Loki exporter

If fails → Problem is Collector config
```

### Level 8: Does Loki receive?
```
Setup: Loki running locally
Test: Can we query logs via HTTP?

✅ Loki query returns results
✅ Logs have correct attributes
✅ Timestamps are correct

If fails → Problem is Loki exporter or Loki config
```

---

## Current Theory

Based on evidence:
- ✅ Level 1 works: SDK starts, createLoggerProvider would work
- ❓ Level 2 suspect: Global storage - is setGlobalLoggerProvider() actually called?
- ❓ Level 3 suspect: DirectOtelTransport - can't access Provider (require issue)
- ❓ Level 4 untested: Winston + Transport integration
- ❓ Level 5-8 untested: Export chain

---

## Systematic Testing Order

1. **Test in isolation** (Level 1-3): Each test has minimal dependencies
2. **Test in sequence** (Level 4-8): Each adds prior level's output
3. **Document findings** at each step - capture what worked, what didn't
4. **Only move forward** if current level passes all assertions
5. **Root cause analysis**: When a level fails, debug that level until it passes

---

## Why This Works

Each level is small enough to:
- Run in < 5 seconds
- Understand completely
- Mock dependencies to isolate problems
- Reproduce reliably
- Know exactly where to focus fix

No more "restart dev server and hope" 🙏

---

## Example: What Testing Level 3 Looks Like

```typescript
// test-direct-otel-transport.ts - Maximum Isolation

import { DirectOtelTransport } from '@sva/sdk/src/logger';

// Create fake Provider that logs what's called
const fakeProvider = {
  getLogger: () => {
    console.log('[TEST] getLogger() called');
    return {
      emit: (record: any) => {
        console.log('[TEST] emit() called with:', JSON.stringify(record, null, 2));
        return Promise.resolve();
      }
    };
  }
};

// Store globally
setGlobalLoggerProvider(fakeProvider);

// Test 1: Transport can find Provider
const transport = new DirectOtelTransport();
const result = transport.log({ level: 'info', message: 'test' }, () => {});

// Expected output:
// [TEST] getLogger() called
// [TEST] emit() called with: { severityText: 'INFO', body: 'test', ... }
```

This test either:
1. ✅ Works - move to Level 4
2. ❌ Errors - we see exactly where (getLogger() not found, emit() not called, etc.)

---

## Questions Answered By Levels

| Q | Level |
|---|-------|
| Does OTEL SDK even support Logger? | 1 |
| Can I store Provider globally? | 2 |
| Can Transport access Provider? | 3 |
| Does Transport talk to Logger correctly? | 4 |
| Does batching work? | 5 |
| Does network export work? | 6 |
| Does Collector accept logs? | 7 |
| Does Loki have the data? | 8 |

If you can answer all 8 with "yes", **logs work end-to-end**. If any is "no", you know exactly where to fix.

---

## Next: Proposal Review

The proposal document outlines:
1. **What** we're testing at each level
2. **How** to test it (scripts/commands)
3. **When** to move to next level (success criteria)
4. **What** to do if a level fails (targeted debugging)

Ready to start Phase 1?
