# Proposal: Debug OTEL Logging Pipeline E2E

**Change ID:** `debug-otel-logging-e2e`
**Status:** PROPOSAL (Requires Approval)
**Date:** 2026-02-10
**Impact:** Observability / Logging

## Problem Statement

OTEL SDK initialisiert sich erfolgreich, aber Applikations-Logs erreichen nicht Loki. Die Fehlerursache ist unbekannt, weil die Debugging-Strategie zu diffus war.

**Current Symptoms:**
- ✅ OTEL SDK startet ohne Fehler
- ✅ Trace-Export-404-Fehler behoben
- ✅ Console-Logs funktionieren perfekt
- ✅ App sendet HTTP-Requests (HTTP 302)
- ❌ Loki zeigt nur `["docker"]` - keine App-Logs

**Current State Issues:**
- Mehrere gleichzeitige Debugging-Versuche ohne klare Isolierung
- Keine Unit-Tests für einzelne Komponenten
- Keine Instrumentation zur Fehlerursachen-Diagnose
- Diffuse Integration zwischen SDK, Logger Provider und DirectOtelTransport

## Goal

Ein sauberes, schrittweise testbares Debugging-Workflow mit:
1. **Komponentenisolation** - Jede Komponente einzeln testen
2. **Instrumentation** - Debug-Visibility in jeder Schicht
3. **Systematisches Vorgehen** - Top-down: SDK → Provider → Transport → Exporter → Collector → Loki
4. **Reproducibility** - Jeder Fehler reproduzierbar und dokumentiert
5. **E2E-Validierung** - Am Ende ein vollständiger Logs-Pipeline-Test

## Solution Approach

### Phase 1: Komponententest (Isolation)

#### 1.1 OTEL SDK & Logger Provider Isolation
**Goal:** Verifiziere, dass SDK Logger Provider korrekt erstellt und registriert wird.

```typescript
// test-otel-provider-creation.ts
- Erstelle SDK mit minimaler Config
- Hole Logger Provider via logs.getLoggerProvider()
- Verifiziere: Provider existiert und hat getLogger() Methode
- Verifiziere: Provider ist die gleiche Instanz nach Neustart
```

**Success Criteria:**
- ✅ Provider ist nicht null
- ✅ Provider.getLogger() ist eine function
- ✅ Logger instance wird erstellt
- ✅ Logger hat emit() Methode

---

#### 1.2 Global Provider Storage
**Goal:** Logger Provider wird korrekt global gespeichert und ist abrufbar.

```typescript
// test-global-provider-storage.ts
- Setze Provider via setGlobalLoggerProvider()
- Rufe Provider ab via getGlobalLoggerProvider()
- Verifiziere: Rückgabe ist identische Instanz
- Verifiziere: Funktioniert über Module-Grenzen hinweg
```

**Success Criteria:**
- ✅ Provider wird gespeichert und wiedergegeben
- ✅ Funktioniert beim mehrfachen Zugriff
- ✅ Funktioniert von verschiedenen Module aus

---

#### 1.3 DirectOtelTransport Integration
**Goal:** DirectOtelTransport kann Logger Provider zugreifen und hat aktiven Logger.

```typescript
// test-direct-otel-transport.ts
- Setze Global Provider
- Erstelle DirectOtelTransport
- Schreibe Log über Transport
- Verifiziere: Transport findet Provider
- Verifiziere: Transport hat aktiven Logger
- Verifiziere: emit() wird aufgerufen
```

**Success Criteria:**
- ✅ Transport kann Provider abrufen
- ✅ Transport erstellt Logger instance
- ✅ emit() wird mit korrektem Format aufgerufen
- ✅ Keine Fehler beim Log-Aufruf

---

### Phase 2: Integration Testing

#### 2.1 SDK → Provider → Global Storage
**Goal:** Kompletter Flow von SDK-Start bis Global-Provider-Speicherung.

```
startOtelSdk()
  → createOtelSdk() creates SDK
  → sdk.start()
  → logs.getLoggerProvider() gets Provider
  → setGlobalLoggerProvider() stores globally
  → Verifiziere: getGlobalLoggerProvider() gibt Provider zurück
```

**Test Anleitung:**
```bash
cd packages/monitoring-client
npx vitest run tests/otel-integration.test.ts
```

**Success Criteria:**
- ✅ Flow wird ohne Fehler ausgeführt
- ✅ Provider ist am Ende global verfügbar
- ✅ Funktioniert mit Vite HMR (Dev Server)

---

#### 2.2 Winston Logger → DirectOtelTransport → Provider
**Goal:** Winston Logs fließen durch DirectOtelTransport zum OTEL Provider.

```
createSdkLogger({ enableOtel: true })
  → Winston Transport Chain [DirectOtelTransport, Console]
  → log({ level, message, ... })
  → DirectOtelTransport.log()
    → getGlobalLoggerProvider()
    → provider.getLogger(@sva/winston)
    → otelLogger.emit({ body, attributes, ... })
```

**Test Anleitung:**
```bash
cd packages/sdk
# Unit-Test für Transport
npx vitest run tests/logger/direct-otel-transport.test.ts
# Integration-Test mit echtem Provider
npx vitest run tests/logger/logger-with-otel.test.ts
```

**Success Criteria:**
- ✅ Transport empfängt Logs von Winston
- ✅ Provider wird gefunden
- ✅ emit() wird mit korrektem Format aufgerufen
- ✅ Keine Fehler bei mehreren Logs

---

### Phase 3: End-to-End Testing

#### 3.1 Lokale OTLP Export Chain
**Goal:** Logs fließen vom SDK über OTLP Exporter zum lokalen Collector.

```
OTEL Logger (emit)
  → BatchLogRecordProcessor
  → OTLPLogExporter
  → HTTP POST /v1/logs auf localhost:4318
  → OTEL Collector empfängt Logs
  → Collector sendet zu Loki Exporter
```

**Test Anleitung:**
```bash
# 1. Starte Collector + Loki (Docker Compose verfügbar)
docker-compose up -d

# 2. Starte Test-App
cd apps/sva-studio-react
ENABLE_OTEL=true npx nx run sva-studio-react:serve

# 3. Triggere Auth-Endpoint
curl http://localhost:3000/auth/login

# 4. Prüfe OTLP Export mit Instrumentation
grep "OTLPExporter.*emit\|export" /tmp/dev-server.log

# 5. Prüfe Collector-Logs
docker logs otel-collector | grep "body\|logRecord"

# 6. Prüfe Loki
curl 'http://localhost:3100/loki/api/v1/query?query={component="bootstrap"}'
```

**Success Criteria:**
- ✅ OTLP Exporter sendet Logs (kein 404)
- ✅ Collector empfängt und verarbeitet Logs
- ✅ Loki hat Logs mit component label
- ✅ Logs-Content ist lesbar (nicht korrupt)

---

#### 3.2 Full E2E: App → OTEL → Collector → Loki
**Goal:** Vollständiger Pfad vom App-Log bis Loki-Abfrage.

```bash
# Setup
docker-compose up -d
pnpm install
pkill -f vite || true
sleep 1

# Start App
cd /Users/wilimzig/Documents/Projects/SVA/sva-studio
ENABLE_OTEL=true npx nx run sva-studio-react:serve &
APP_PID=$!
sleep 5

# Trigger Logs
curl -s "http://localhost:3000/auth/login" > /dev/null

# Warte auf Batch (500ms dev, 10s timeout)
sleep 3

# Validation Steps:
# 1. App-Log in Console?
tail -20 /tmp/dev-server.log | grep "info:"

# 2. OTLP Export erfolgreich?
tail -50 /tmp/dev-server.log | grep "Export\|batch"

# 3. Logs in Loki?
curl -s 'http://localhost:3100/loki/api/v1/query?query={component="auth"}' | jq '.data.result | length'

# Cleanup
kill $APP_PID
docker-compose down
```

**Success Criteria:**
- ✅ Console zeigt Logs mit component, level, message
- ✅ OTLP Exporter sendet erfolgreich (Batch-Info in Logs)
- ✅ Loki hat mindestens 1 Log für jede Komponente
- ✅ Attributes sind erhalten (component, environment, workspace_id)
- ✅ Timestamps sind korrekt
- ✅ Kein Daten-Verlust in der Pipeline

---

### Phase 4: Implementation & Debugging

Basierend auf Phase 1-3 Test-Ergebnissen:

**Wenn Phase 1 fehlschlägt:** OTEL SDK Problem
- Untersuche: logger-provider.server.ts
- Debug: SDK-Initialisierung in otel.server.ts
- Fix: LoggerProvider Isolation oder namespace

**Wenn Phase 2 fehlschlägt:** Transport/Provider Integration Problem
- Untersuche: DirectOtelTransport Zugriff
- Untersuche: Global Storage Scope
- Fix: ESM vs CJS Compatibility oder Timing-Issue

**Wenn Phase 3 fehlschlägt:** OTLP Export Pipeline Problem
- Untersuche: BatchLogRecordProcessor (ist Processor richtig konfiguriert?)
- Untersuche: OTLPLogExporter (sendet es wirklich?)
- Untersuche: Collector Config (empfängt es?)
- Fix: Endpoint, Authentifizierung, oder Batch-Timeout

---

## Testing Strategy

### Test Fixtures
```
packages/monitoring-client/tests/
  ├── fixtures/
  │   ├── mock-otel-sdk.ts
  │   ├── mock-logger-provider.ts
  │   └── test-collector-config.yml
  └── ...
```

### Test Levels
```
Level 1 - Unit Tests (< 100ms)
├── Logger Provider creation
├── Global storage API
└── DirectOtelTransport initialization

Level 2 - Integration Tests (< 1s)
├── SDK + Global Storage
├── Winston + DirectOtelTransport
└── BatchProcessor + Retention

Level 3 - E2E Tests (< 30s)
├── Full App + Collector
└── Loki Query Validation
```

### Validation Hooks
```typescript
// Nach jedem Phase, validiere:
✓ Keine console.error() oder unerwartete Exceptions
✓ Logging-Output ist strukturiert (JSON)
✓ Debugging-Messages sind aussagekräftig
✓ Keine Race Conditions (asynce Initialisierung)
✓ Collector hat Logs empfangen (via Docker logs grep)
✓ Loki hat Logs (via HTTP API query)
```

---

## Deliverables

### Phase 1 Deliverables
- [ ] `test-otel-provider-creation.ts` mit Pass/Fail-Kriterien
- [ ] `test-global-provider-storage.ts` mit Cross-Module Test
- [ ] `test-direct-otel-transport.ts` mit Mock-Provider
- [ ] Run-Instructions für jeden Test

### Phase 2 Deliverables
- [ ] `packages/monitoring-client/tests/otel-integration.test.ts`
- [ ] `packages/sdk/tests/logger/direct-otel-transport.test.ts`
- [ ] `packages/sdk/tests/logger/logger-with-otel.test.ts`
- [ ] Instrumentation Debug-Logs in kritischen Code-Pfaden

### Phase 3 Deliverables
- [ ] E2E Test Script (`scripts/test-otel-e2e.sh`)
- [ ] Docker Compose Config für Collector + Loki (falls nicht vorhanden)
- [ ] Validation Script für Loki Abfragen
- [ ] Success/Failure Summary Report

### Phase 4 Deliverables
- [ ] Bug-Fix PR mit Root Cause Analysis
- [ ] Updated Documentation (`docs/logging.md`)
- [ ] Added Monitoring/Observability Section (`docs/observability.md`)

---

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| Tests bestehen, aber E2E schlägt fehl | Unit-Tests zu isoliert - Add Integration Tests in Phase 2 |
| OTLP Exporter funktioniert lokal nicht | Debug: Check Collector Port, Network, Batch Timeout |
| Logs kommen in Collector an, aber nicht Loki | Check: Loki Exporter Pipeline in Collector-Config |
| Race Conditions bei async Init | Add Timing Guards, use Promises korrekt |
| ESM/CJS Module Loading Issues | Nutze Static Imports statt Dynamic require() |

---

## Next Steps

1. **User Review & Approval** dieser Proposal (THIS DOCUMENT)
2. **Phase 1 Implementation** - Test-Scripts isoliert schreiben
3. **Phase 1 Validation** - Fallweise-Debugging basierend auf Test-Ergebnissen
4. **Phase 2-4** - Basierend auf Phase-1-Ergebnissen
5. **Documentation** - Learnings dokumentieren für zukünftige Features

---

## Questions for Approval

Bevor wir starten:

1. ✅ Akzeptiert der Approach, die Fehlerursache schrittweise zu isolieren?
2. ✅ Sollen wir alle Tests schreiben, oder iterativ debugging?
3. ✅ Ist der E2E-Scope korrekt (App → Loki, nichts darüber hinaus)?
4. ✅ Sollen wir Instrumentation/Debug Logs im Production-Code behalten, oder entfernen?
5. ✅ Timeline:  Wie viel Time Budget haben wir für diesen Debugging-Cycle?
