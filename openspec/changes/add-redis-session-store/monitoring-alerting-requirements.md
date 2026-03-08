# Monitoring & Alerting: Redis Session Store
## Anforderungen & Metriken

**Version:** 1.0
**Datum:** 4. Februar 2026
**Status:** Ready for Staging

---

## 1. Monitoring-Anforderungen

### 1.1 Kritische Metriken (MUST-HAVE)

#### Redis-Konnektivität
```
Metrik: redis_connection_status
Type: Gauge (0 = down, 1 = up)
Labels: environment, instance
Alert: Critical wenn status == 0 für >30s
Action: Page-On-Call, Incident erstellen
```

**Implementierung:**
```typescript
const redisHealth = new Gauge({
  name: 'redis_connection_status',
  help: 'Redis connection status (1=connected, 0=down)',
  labels: ['environment', 'instance'],
});

// Bei Connection
redisHealth.set({ environment: 'staging', instance: 'redis-1' }, 1);
// Bei Disconnect
redisHealth.set({ environment: 'staging', instance: 'redis-1' }, 0);
```

#### Session-Operationen
```
Metrik: session_operations_total
Type: Counter
Labels: operation (create|get|update|delete), status (success|error)
Granularität: Pro Request
Alert: Error-Rate > 5% für >5min
```

```typescript
const sessionOps = new Counter({
  name: 'session_operations_total',
  help: 'Total session operations',
  labelNames: ['operation', 'status'],
});

sessionOps.inc({ operation: 'create', status: 'success' });
sessionOps.inc({ operation: 'create', status: 'error' });
```

#### Session-Latenz
```
Metrik: session_operation_duration_seconds
Type: Histogram
Labels: operation, quantiles (0.5, 0.95, 0.99)
Alert: P99 > 500ms für >10min
```

```typescript
const sessionLatency = new Histogram({
  name: 'session_operation_duration_seconds',
  help: 'Session operation latency',
  labelNames: ['operation'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1.0],
});

const end = sessionLatency.startTimer({ operation: 'get' });
// ... operation ...
end();
```

#### Aktive Sessions
```
Metrik: sessions_active
Type: Gauge
Labels: environment
Granularität: Every 60s
Alert: Anomaly detection (spike > 200% in 5min)
Warning: Sessions > 90% of max-capacity
```

```typescript
const activeSessions = new Gauge({
  name: 'sessions_active',
  help: 'Number of active sessions in Redis',
  labelNames: ['environment'],
  async collect() {
    const count = await redis.dbsize(); // oder custom COUNT
    this.set({ environment: 'staging' }, count);
  },
});
```

#### Session-Erstellungs-Rate
```
Metrik: sessions_created_total
Type: Counter
Labels: source (oauth_callback, refresh_token, guest)
Alert: Rate > 100/min (potential attack)
```

```typescript
const sessionsCreated = new Counter({
  name: 'sessions_created_total',
  help: 'Total sessions created',
  labelNames: ['source'],
});

sessionsCreated.inc({ source: 'oauth_callback' });
```

---

### 1.2 Wichtige Metriken (SHOULD-HAVE)

#### Session-TTL-Distribution
```
Metrik: session_ttl_seconds
Type: Histogram
Granularität: Bei Session-Erstellung
Zweck: Überwachen ob TTLs korrekt gesetzt werden
```

#### Encryption-Fehler
```
Metrik: session_encryption_errors_total
Type: Counter
Labels: error_type (encrypt_failed, decrypt_failed, key_missing)
Alert: Error-Rate > 1% (mögliche Misconfiguration)
```

#### Redis-Speichernutzung
```
Metrik: redis_memory_used_bytes
Type: Gauge (von Redis INFO)
Alert: Memory > 80% of max
Warning: Memory > 60% of max
```

#### TLS-Verbindungen
```
Metrik: redis_tls_connections_active
Type: Gauge
Labels: tls_enabled (true|false)
Zweck: Überprüfen ob TLS korrekt läuft
```

---

### 1.3 Optional (NICE-TO-HAVE)

#### Cache-Hit-Rate (falls Local Caching)
```
session_cache_hits_total / session_cache_requests_total
```

#### Token-Validierungs-Fehler
```
tokens_validation_errors_total
Labels: error_type (expired, invalid_signature, malformed)
```

---

## 2. Alerting-Regeln

### 2.1 Critical Alerts (MUST PAGE)

#### Redis Connection Lost
```yaml
Alert: RedisConnectionLost
Condition: redis_connection_status == 0 for 30s
Severity: CRITICAL
Action: PagerDuty trigger (on-call)
Message: "Redis session store unavailable - authentication/sessions down"
Escalation: 15min no ack → Team Lead
Runbook: docs/runbooks/redis-recovery.md
```

#### Session Error Rate Too High
```yaml
Alert: SessionOperationErrorRate
Condition: |
  rate(session_operations_total{status="error"}[5m])
  / rate(session_operations_total[5m]) > 0.05
Duration: 5 minutes
Severity: CRITICAL
Action: PagerDuty trigger
Message: "Session operation error rate > 5%"
Runbook: docs/runbooks/session-debug.md
```

#### Session Creation Rate Spike (DDoS-Indikator)
```yaml
Alert: SessionCreationRateSpike
Condition: |
  rate(sessions_created_total[5m]) > 100
  AND rate(sessions_created_total[5m]) >
  avg_over_time(rate(sessions_created_total[30m])[5m]) * 2
Duration: 5 minutes
Severity: CRITICAL
Action: PagerDuty trigger, Auto-block IPs (if DDoS detected)
Message: "Abnormal session creation rate - possible DDoS/attack"
Runbook: docs/runbooks/ddos-response.md
```

---

### 2.2 High Priority Alerts (NOTIFY TEAM)

#### High Session Latency
```yaml
Alert: HighSessionLatency
Condition: |
  histogram_quantile(0.99, session_operation_duration_seconds) > 0.5
Duration: 10 minutes
Severity: HIGH
Action: Slack notification (#sva-alerts)
Message: "Session operations P99 latency > 500ms"
Investigation: Check Redis CPU, Network, Disk I/O
```

#### Redis Memory Critical
```yaml
Alert: RedisMemoryCritical
Condition: redis_memory_used_bytes / redis_memory_max_bytes > 0.9
Duration: 5 minutes
Severity: HIGH
Action: Slack notification
Message: "Redis memory usage > 90%"
Action: Check session TTL compliance, trigger cleanup
```

#### Encryption Key Missing
```yaml
Alert: EncryptionKeyMissing
Condition: session_encryption_errors_total{error_type="key_missing"} > 0
Duration: Instant
Severity: HIGH
Action: Slack notification
Message: "ENCRYPTION_KEY not set - tokens not encrypted!"
Action: Update .env immediately
```

---

### 2.3 Informational Alerts (LOGGING)

#### Sessions Approaching Capacity
```yaml
Alert: SessionsHighWatermark
Condition: sessions_active > 0.8 * max_capacity
Duration: 30 minutes
Severity: INFO
Action: Log to dashboard
Message: "Session count > 80% capacity"
Investigation: Check for session leaks, adjust TTL if needed
```

#### TLS Connection Errors
```yaml
Alert: TLSConnectionErrors
Condition: redis_tls_errors_total > 0
Duration: Instant
Severity: WARNING
Action: Log + investigate certificate expiry
```

---

## 3. Dashboard-Setup (Grafana)

### 3.1 Overview-Dashboard

**Title:** Redis Session Store - Overview

**Panels:**

1. **Connection Status** (Top-Left)
   - Type: Stat
   - Query: `redis_connection_status`
   - Thresholds: 0=Red, 1=Green
   - Size: 2x1

2. **Error Rate (Last 24h)** (Top-Center)
   - Type: Graph
   - Query: `rate(session_operations_total{status="error"}[5m])`
   - Threshold Line: 5% (red line)
   - Size: 2x1

3. **Active Sessions** (Top-Right)
   - Type: Gauge
   - Query: `sessions_active`
   - Thresholds: 0-60% (green), 60-80% (yellow), 80-100% (red)
   - Size: 2x1

4. **Session Operations (Last Hour)** (Middle-Left)
   - Type: Table
   - Columns: Operation, Success Count, Error Count, Error Rate
   - Size: 2x2

5. **Latency Distribution** (Middle-Center)
   - Type: Heatmap
   - Query: `session_operation_duration_seconds_bucket`
   - Size: 2x2

6. **Memory Usage** (Middle-Right)
   - Type: Graph
   - Query: `redis_memory_used_bytes`, Max line at 80%/90%
   - Size: 2x1

7. **Alerts Status** (Bottom)
   - Type: Alert List
   - Show: Last 24h
   - Size: 4x1

---

### 3.2 Debugging-Dashboard

**Title:** Redis Session Store - Debug

**Panels:**

1. **Operation Timeline**
   - Type: Graph with multiple queries
   - Queries: `rate(session_operations_total{operation="get"}[1m])`, create, update, delete
   - Resolution: 1-minute buckets

2. **Error Detail Breakdown**
   - Type: Pie chart
   - Query: `sum(session_encryption_errors_total) by (error_type)`

3. **Slow Queries**
   - Type: Table
   - Query: `sort(topk(10, session_operation_duration_seconds_bucket))`

4. **Recent Alerts**
   - Type: Alert annotation overlay
   - Shows all alerts on timeline

---

## 4. Health-Check-Endpoint

### Implementation: `/health/redis`

```typescript
// packages/auth/src/health.server.ts

export async function checkRedisHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  redis: {
    connected: boolean;
    latency_ms: number;
    memory_pct: number;
  };
  sessions: {
    active_count: number;
    errors_last_hour: number;
  };
  encryption: {
    enabled: boolean;
    key_present: boolean;
  };
  timestamp: string;
}> {
  const startTime = Date.now();
  const errors: string[] = [];
  let overallStatus: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';

  // 1. Redis Connection
  let redisHealthy = false;
  let redisLatency = 0;
  try {
    const response = await redis.ping();
    redisHealthy = response === 'PONG';
    redisLatency = Date.now() - startTime;
  } catch (error) {
    errors.push(`Redis unavailable: ${error.message}`);
    overallStatus = 'unhealthy';
  }

  // 2. Redis Memory
  let memoryPct = 0;
  if (redisHealthy) {
    try {
      const info = await redis.info('memory');
      const memUsed = parseInt(info.used_memory);
      const memMax = parseInt(info.maxmemory) || 1e9;
      memoryPct = (memUsed / memMax) * 100;
      if (memoryPct > 90) {
        errors.push(`Redis memory critical: ${memoryPct.toFixed(1)}%`);
        overallStatus = 'degraded';
      }
    } catch (error) {
      errors.push(`Could not check Redis memory: ${error.message}`);
    }
  }

  // 3. Active Sessions Count
  let activeSessions = 0;
  try {
    activeSessions = await redis.dbsize();
  } catch (error) {
    errors.push(`Could not count sessions: ${error.message}`);
  }

  // 4. Encryption Key
  const encryptionKeyPresent = !!process.env.ENCRYPTION_KEY;
  if (!encryptionKeyPresent) {
    errors.push('ENCRYPTION_KEY not set');
    overallStatus = 'degraded';
  }

  // 5. Session Errors (Last Hour)
  let sessionErrors = 0;
  try {
    // Query metrics from prometheus or local counter
    sessionErrors = 0; // TODO: Implement metrics query
  } catch (error) {
    // Silently fail if metrics unavailable
  }

  return {
    status: overallStatus,
    redis: {
      connected: redisHealthy,
      latency_ms: redisLatency,
      memory_pct: memoryPct,
    },
    sessions: {
      active_count: activeSessions,
      errors_last_hour: sessionErrors,
    },
    encryption: {
      enabled: encryptionKeyPresent,
      key_present: encryptionKeyPresent,
    },
    timestamp: new Date().toISOString(),
  };
}
```

**HTTP Endpoint:**
```typescript
export async function handleHealthCheck(request: Request) {
  const health = await checkRedisHealth();

  const statusCode = health.status === 'unhealthy' ? 503 :
                     health.status === 'degraded' ? 200 : 200;

  return json(health, { status: statusCode });
}

// Usage:
// GET /api/health/redis → Status + Details
// GET /api/health/redis?detailed=true → Full metrics
```

**Kubernetes Probes:**
```yaml
livenessProbe:
  httpGet:
    path: /api/health/redis
    port: 3000
  initialDelaySeconds: 10
  periodSeconds: 10
  failureThreshold: 3

readinessProbe:
  httpGet:
    path: /api/health/redis
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
  failureThreshold: 2
```

---

## 5. Logging-Anforderungen

### 5.1 Structured Logging

```typescript
// Bei kritischen Operationen
logger.info('session_created', {
  sessionId,
  userId,
  ttl_seconds: ttl,
  source: 'oauth_callback',
  timestamp: new Date().toISOString(),
});

logger.error('session_operation_failed', {
  operation: 'create',
  error: error.message,
  stack: error.stack,
  sessionId,
  timestamp: new Date().toISOString(),
  severity: 'critical',
});
```

### 5.2 Log-Levels

- **ERROR**: Session-Operationen fehlgeschlagen, Encryption-Fehler
- **WARN**: Hohe Latenz, Memory-Warnung, TLS-Fehler
- **INFO**: Sessions erstellt/gelöscht, Config-Änderungen
- **DEBUG**: Encryption-Details, Redis-Befehle (nur dev)

### 5.3 Log-Aggregation

Empfehlung: ELK Stack oder CloudWatch
- Zentrale Sammlung aller Session-Logs
- Full-text Search
- Alerting basierend auf Patterns

---

## 6. Implementierungs-Roadmap

### Phase 1 (Staging)
- [x] Health-Check-Endpoint
- [ ] Prometheus Metrics (basic: connection, ops count)
- [ ] Critical Alerts (Redis connection, error rate)

### Phase 2 (Production-Ready)
- [ ] Full Prometheus integration
- [ ] Grafana Dashboards
- [ ] All alerts from Section 2
- [ ] Structured logging

### Phase 3 (Optimization)
- [ ] Custom metrics (business-level)
- [ ] Trace correlation
- [ ] Budget-basierte Alerts

---

## 7. Notfall-Runbooks

### When Alert: RedisConnectionLost

```markdown
1. ✅ Verify Redis is running
   $ docker-compose ps redis
   $ redis-cli ping

2. ✅ Check Network Connectivity
   $ ping redis-server-ip
   $ nc -zv redis-server-ip 6379

3. ✅ Check TLS (if enabled)
   $ openssl s_client -connect redis-server:6380 -CAfile certs/ca.pem

4. ✅ Check Credentials
   $ grep REDIS_URL .env.staging
   $ grep REDIS_USERNAME .env.staging
   $ grep REDIS_PASSWORD .env.staging

5. ✅ Restart Redis (if down)
   $ docker-compose restart redis

6. ✅ If still failing
   → Escalate to DevOps Team
   → Check Redis Logs: docker-compose logs redis
```

---

**Nächste Schritte:**
1. Implementiere Health-Check-Endpoint
2. Integriere Prometheus Metrics in Staging
3. Setup Grafana Dashboard
4. Konfiguriere kritische Alerts
