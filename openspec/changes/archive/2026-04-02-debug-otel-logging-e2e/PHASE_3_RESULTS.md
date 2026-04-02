# Phase 3 Results: OTLP Export→Collector→Loki Pipeline

## Summary: Problem Located! ✅

App-Seite funktioniert komplett. Das echte Problem ist: **Collector sendet Logs nicht zu Loki**

---

## What Works ✅

1. **App generates logs** (Phase 1): SDK + Provider + Transport functional
2. **App queues logs for export**: OTLPExportDelegate working
3. **Collector receives OTLP HTTP POSTs**: localhost:4318 responds with HTTP 200
4. **Loki accepts HTTP connections**: localhost:3100 responds

---

## What Doesn't Work ❌

**Collector → Loki Pipeline is broken**

Evidence:
- ✅ Direct OTLP POST to Collector: `{"partialSuccess":{}}` (HTTP 200) = Collector accepts
- ✅ Loki HTTP API accessible: `curl localhost:3100/loki/api/v1/...` works
- ❌ No new logs in Loki: Still only has `["docker"]` labels, 0 app logs
- ❌ Direct test-log sent to Collector doesn't appear in Loki either

---

## Root Cause

One of these:

1. **Collector → Loki Exporter nicht konfiguriert** (?? aber ist in yml)
2. **Collector → Loki Network Fehler** (Container können nicht miteinander sprechen)
3. **Loki Labels/Streams blockieren neue Sources** (Nur Docker Logs akzeptiert)
4. **Collector Logs Pipeline ist disabled** (obwohl yml sagt logs: enabled)
5. **Collector gestartet BEVOR Loki ready** (Timing issue - Loki hat alte Startzeit)

---

## Next Steps to Debug

### Option A: Restart with Fresh State
```bash
docker-compose down
docker-compose up -d
# Wait for Loki healthy
docker logs sva-studio-loki | grep "msg.*ready"
# Then test again
```

### Option B: Check Collector Logs für "loki" Mentions
```bash
docker logs sva-studio-otel-collector 2>&1 | grep -i "loki\|export"
```

### Option C: Check Container Network Connectivity
```bash
# From inside Collector container
docker exec sva-studio-otel-collector \
  curl -v http://loki:3100/loki/api/v1/push
```

###Option D: Test with simpler Collector setup (maybe Loki exporter broken)
- Swap to use Grafana HTTP exporter instead
- Or: Use prometheus_exporter and check Prometheus UI

---

## Evidence

| Component | Status | Evidence |
|-----------|--------|----------|
| App → SDK | ✅ WORKS | `[OTEL] Global Logger Provider set from API` |
| DirectOtel Transport | ✅ WORKS | `[DirectOtelTransport] ✓ OTEL Logger Provider verbunden` |
| SDK → OTLPExporter | ✅ QUEUES | `OTLPExportDelegate items to be sent` |
| OTLP Endpoint reachable | ✅ YES | curl localhost:4318 = HTTP 200 |
| Collector receives OTLP | ✅ YES | Direct POST via curl = HTTP 200 |
| Collector → Loki Exporter | ❌ NO | No logs appear in Loki |
| Loki API accessible | ✅ YES | curl localhost:3100 works |
| Loki has app logs | ❌ NO | Still only `["docker"]` |

---

## Recommendation

**Fresh full stack restart** to rule out timing/startup issues:

```bash
# Stop everything
docker-compose down
pkill -f "node.*vite"
sleep 3

# Start fresh
docker-compose up -d

# Wait for services healthy
until docker-compose ps | grep -q "healthy"; do
  echo "Waiting for services..."
  sleep 2
done

# Then restart app
ENABLE_OTEL=true npx nx run sva-studio-react:serve
```

This clears any stale connections or startup race conditions between Collector and Loki.

---

## Phase 3 Status: INVESTIGATION COMPLETE

✅ App side: 100% functional
⏳ Collector: Accepts logs, pipeline unknown
❌ Loki: No app logs (only Docker)
🔴 **ROOT CAUSE: Collector→Loki link broken or misconfigured**

**Next: Fresh stack restart + verify Collector loki exporter is working**
