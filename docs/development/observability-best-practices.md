# Observability Best Practices

Dieses Dokument beschreibt Best Practices für Logging, Metriken und Tracing im sva-studio Projekt.

## Logging Best Practices

### Grundprinzipien

- **Nutze immer den SDK Logger**, nicht `console.log`
- **Strukturiertes Logging**: Key-Value Pairs statt Textkonkatenation
- **Workspace Context**: Jedes Log sollte `workspace_id` beinhalten
- **PII-Sicherheit**: Sensible Daten gehören in Message Body, nicht in Labels

### ✅ DO: Strukturiertes Logging mit SDK Logger

```typescript
import { createSdkLogger } from '@sva/sdk';

const logger = createSdkLogger({ component: 'auth-service' });

// ✅ GOOD: Strukturierte Logs mit Labels
logger.info('User authenticated successfully', {
  workspace_id: 'org-123',
  userId: 'user-456',
  method: 'oauth2'
});

// ✅ GOOD: Fehler mit Context
logger.error('Database connection failed', {
  workspace_id: 'org-123',
  component: 'database',
  code: 'ECONNREFUSED',
  retries: 3
});
```

**Vorteile:**
- Automatische Redaction von PII (email, token, api_key, etc.)
- OTEL Integration (logs + metrics + traces)
- Workspace-Kontext automatisch injiziert
- Konsistente Log-Struktur für Aggregation

### ❌ DON'T: Raw console.log mit Text

```typescript
// ❌ BAD: Direkter String mit PII
console.log(`User ${email} signed in from IP ${ip}`);
// → Email und IP könnten sichtbar sein!

// ❌ BAD: Keine Struktur
console.log('Auth completed');
// → Nicht filterbar, kein Context, schwer zu durchsuchen

// ❌ BAD: PII in Labels
logger.info('User login', {
  email: 'john@example.com',  // ← Diese Labels werden gefilmt!
  password: 'secret123'       // ← NIE!
});
```

## PII-Redaction

Das System redacted automatisch **sensible Labels** auf mehreren Ebenen:

### Ebene 1: Application Logging (OTEL SDK)

```typescript
// Diese Labels werden automatisch redacted:
const forbiddenLabels = [
  'user_id', 'session_id', 'email', 'request_id',
  'token', 'authorization', 'api_key', 'secret',
  'ip', 'password', 'card', 'credit', 'ssn'
];

// Diese Labels sind ERLAUBT (Whitelist):
const allowedLabels = [
  'workspace_id',    // ← Mandatory!
  'component',       // Service/Module Name
  'environment',     // dev/test/prod
  'level'            // info/error/warn/debug
];
```

**Email-Masking bei Logs:**
```
john.doe@example.com → j***@example.com
```

### Ebene 2: Log Collection (Promtail)

Promtail scrapet Docker Container Logs und entfernt weitere PII-Labels:

```yaml
# dev/monitoring/promtail/promtail-config.yml
relabel_configs:
  - action: labeldrop
    regex: "(user_id|session_id|email|request_id|...)"
  - action: labelkeep
    regex: "(workspace_id|component|environment|level)"
```

### Ebene 3: Logs in Loki

In Loki landen nur die whitelisted Labels:
```
{workspace_id="org-123", component="auth", environment="production", level="info"} → message
```

## Workspace Context

Der Workspace Context wird automatisch injiziert und sollte immer vorhanden sein:

### Automatic Injection (via Middleware)

```typescript
// packages/auth/routes.server.ts
import { createWorkspaceContextMiddleware } from '@sva/sdk';

app.use(createWorkspaceContextMiddleware({
  headerNames: ['x-workspace-id', 'x-sva-workspace-id'],
  environment: 'production'
}));

// Jetzt ist workspace_id in AsyncLocalStorage verfügbar
```

### Manual Usage in Business Logic

```typescript
import { getWorkspaceContext, setWorkspaceContext } from '@sva/sdk';

export const deleteUserAccount = async (userId: string) => {
  const { workspaceId } = getWorkspaceContext();

  logger.info('User account deletion initiated', {
    workspace_id: workspaceId,  // ← Automatisch injiziert!
    userId,
    action: 'account_deletion'
  });

  // ... Logik ...
};
```

## Business Events (Metriken)

Für geschäftskritische Events nutze die Business Event Counter:

### ✅ DO: Business Events für wichtige Actions

```typescript
import { recordBusinessEvent } from '@sva/monitoring-client';

// Content publikation
recordBusinessEvent('content.published', {
  workspace_id: 'org-123',
  component: 'cms',
  content_type: 'article',
  environment: 'production'
});

// User-Aktion
recordBusinessEvent('user.signed_up', {
  workspace_id: 'org-123',
  component: 'auth',
  signup_method: 'oauth2'
});
```

**Metrik in Prometheus:**
```promql
sva_business_events_total{workspace_id="org-123", event="content.published"}
```

### Beispiel-Queries für Business Intelligence

```promql
# Publikationen pro Workspace (letzte 24h)
sum(rate(sva_business_events_total{event="content.published"}[24h])) by (workspace_id)

# Sign-ups im Zeitverlauf
increase(sva_business_events_total{event="user.signed_up"}[1h])
```

## Error Logging

Fehler sollten vollständig dokumentiert werden:

### ✅ DO: Aussagekräftige Error Logs

```typescript
try {
  await database.query('SELECT * FROM users');
} catch (error) {
  logger.error('Database query failed', {
    workspace_id: 'org-123',
    component: 'database',
    query_type: 'select',
    table: 'users',
    error_code: error?.code,
    error_message: error?.message,
    retry_count: 3,
    // ❌ NIE: error_details: error.stack  → Stack traces sind public!
  });
}
```

### Error Context in Loki

```logql
# Alle Fehler in letzten 5 Minuten
{level="error", workspace_id="org-123"} | json | line_format "{{.error_code}}: {{.error_message}}"

# Fehler pro Komponente
sum(count_over_time({level="error"}[5m])) by (component)
```

## Testing Observability

Unit Tests sollten auch die Observability testen:

### ✅ DO: Test PII-Redaction

```typescript
// packages/monitoring-client/scripts/pii-redaction-test.mjs
import { getSessionFromRedis, createSessionInRedis } from '@sva/sdk';

describe('PII Redaction', () => {
  it('redacts email addresses in logs', async () => {
    const logger = createSdkLogger({ component: 'test' });
    
    logger.info('User login', {
      email: 'john.doe@example.com',  // ← Will be masked
      workspace_id: 'test-ws'
    });
    
    // Verify in Loki that email was masked
    const logs = await queryLoki('{workspace_id="test-ws"}');
    expect(logs[0].email).toBe('j***@example.com');
  });
});
```

### ✅ DO: Test Workspace Context

```typescript
describe('Workspace Context', () => {
  it('propagates workspace_id through async operations', async () => {
    await runWithWorkspaceContext(
      { workspaceId: 'org-123' },
      async () => {
        const context = getWorkspaceContext();
        expect(context.workspaceId).toBe('org-123');
      }
    );
  });
});
```

## Monitoring Stack URLs

Für Entwicklung:

- **Grafana:** http://localhost:3001
- **Prometheus:** http://localhost:9090
- **Loki:** http://localhost:3100
- **OTEL Collector:** http://localhost:4318 (OTLP/HTTP) oder :4317 (gRPC)

## Troubleshooting

### Logs tauchen nicht in Loki auf

1. Prüfe Docker Container Logs: `docker logs sva-studio-promtail`
2. Prüfe Loki Health: `curl http://localhost:3100/ready`
3. Prüfe Promtail Config: Path zum Log File korrekt? (`__path__` in static_configs)

### Metriken fehlen in Prometheus

1. Prüfe OTEL Collector Logs: `docker logs sva-studio-otel-collector`
2. Prüfe OTEL Health: `curl http://localhost:13133/healthz`
3. Prüfe Prometheus Targets: http://localhost:9090/targets (sollte OTEL Collector upstreaming)

### PII wird nicht redacted

1. Test manuell: `pnpm exec node packages/monitoring-client/scripts/pii-redaction-test.mjs`
2. Prüfe Promtail Config regex
3. Prüfe OTEL SDK forbiddenLabels in `packages/monitoring-client/src/otel.ts`

## References

- [OTEL Best Practices](https://opentelemetry.io/docs/concepts/observability-primer/)
- [Logging Strategy (ADR-006)](../openspec/changes/add-docker-monitoring-dev-stack/specs/logging-pipeline/spec.md)
- [Label Schema & PII Policy (ADR-007)](../openspec/changes/add-docker-monitoring-dev-stack/specs/label-schema/spec.md)
- [Loki LogQL Documentation](https://grafana.com/docs/loki/latest/logql/)
- [Prometheus PromQL Documentation](https://prometheus.io/docs/prometheus/latest/querying/basics/)
