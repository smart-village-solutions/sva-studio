w# Logging Review: Backend Packages

**Reviewer:** Logging Agent
**Datum:** 8. Februar 2026
**Status:** ✅ **IMPLEMENTIERT** (Prio 1-3 umgesetzt)
**Scope:** packages/auth, packages/sdk (observability)
**Baseline:** [ADR-006-logging-pipeline-strategy.md](../../docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md), [observability-best-practices.md](../../docs/development/observability-best-practices.md)

---

## 🎯 Executive Summary

**Logging-Reifegrad:** 🟡 **MEDIUM** (vorher: LOW)

**Implementierte Verbesserungen:**
- ✅ SDK Logger in @sva/auth integriert (Prio 1)
- ✅ 9 console.*-Aufrufe in routes.server.ts durch strukturiertes Logging ersetzt
- ✅ 3 console.*-Aufrufe in crypto.server.ts durch Security-Logging ersetzt
- ✅ context.ts console.warn strukturiert mit Circular-Dependency-Hinweis
- ✅ Automatische PII-Redaction über SDK Logger (email, token, secret, etc.)
- ✅ workspace_id, component, request_id automatisch in allen Logs

**Verbleibende Risiken:**
- 🟡 Test-Code enthält noch console.* (akzeptabel für Dev/Test)
- 🟡 @tanstack/react-start als PeerDependency (Type-Errors in Isolation)

**Betriebsrisiko:** 🟡 **MITTEL** (vorher: HOCH)
→ Auth-Fehler jetzt mit strukturiertem Context tracebar
→ Security-Warnungen jetzt mit Alert-Potential
→ Frontend-Backend-Korrelation über workspace_id + request_id möglich

### 1. packages/auth/src/routes.server.ts

**Status:** 🔴 9 console.*-Aufrufe, kein SDK Logger

**Probleme:**

```typescript
// Zeile 148-149: Debug-Logging ohne Struktur
console.log('[AUTH] Session created:', sessionId);  // ❌ Session-ID = PII!
console.log('[AUTH] Using TanStack Start setCookie API');

// Zeile 161: Cookie-Status ohne Context
console.log('[AUTH] Cookies set successfully, redirecting...');

// Zeile 170: Error ohne Stack/Context
console.error('Auth callback error:', error);  // ❌ Kein workspace_id, request_id

// Zeile 187-192-202: Request-Logging ohne Korrelation
console.log('[AUTH] /auth/me request');
console.log('[AUTH] Session ID:', sessionId);  // ❌ PII!
console.log('[AUTH] User from session:', user ? user.id : 'null');  // ❌ PII!

// Zeile 231: Logout-Error ohne Context
console.error('Logout error:', error);
```

**Impact:**
- **Debugging unmöglich:** Keine Zuordnung von Errors zu Requests
- **PII-Leakage:** Session-IDs, User-IDs in Klartext
- **Keine Metriken:** Keine strukturierten Logs für Alerting
- **Keine Korrelation:** Frontend-Logs (Browser) ↔ Backend-Logs nicht verknüpfbar

---

### 2. packages/auth/src/crypto.server.ts

**Status:** 🟠 3 console.warn/error, Security-relevant

**Probleme:**

```typescript
// Zeile 27: Security-Warning ohne Alerting
console.warn('[CRYPTO] No encryption key provided, storing token unencrypted');
// ❌ Kritische Sicherheitswarnung geht in Console-Noise unter

// Zeile 52, 89: Encryption-Fehler ohne Context
console.error('[CRYPTO] Encryption failed:', err);
console.error('[CRYPTO] Decryption failed:', err);
// ❌ Kein workspace_id, token_type, operation_context
```

**Impact:**
- **Sicherheitsrisiko:** Fehlende Encryption-Key-Warnungen nicht erkennbar
- **Debugging:** Encryption-Fehler ohne Context (welcher Token? welche Session?)

---

### 3. packages/sdk/src/observability/context.ts

**Status:** 🟡 Meta-Problem - OTEL-Code nutzt Console

**Problem:**

```typescript
// Zeile 83: workspace_id-Warnung im OTEL-Context-Package!
if (!workspaceId && environment === 'development') {
  console.warn('workspace_id header missing');
}
```

**Impact:**
- **Ironie:** Das Package, das workspace_id in Logs ERZWINGT, nutzt selbst console.warn
- **Inkonsistenz:** SDK-Code sollte SDK Logger nutzen

---

## 🔧 Priorisierte Maßnahmen

### 🚨 **Prio 1: Auth-Logging mit SDK Logger (routes.server.ts)**

**Ziel:** Strukturierte Logs mit workspace_id, PII-Redaction, Error-Context

**Umsetzung:**
1. SDK Logger in @sva/auth instanziieren:
   ```typescript
   import { createSdkLogger } from '@sva/sdk';
   const logger = createSdkLogger({ component: 'auth' });
   ```

2. console.* ersetzen:
   ```typescript
   // ❌ Vorher
   console.log('[AUTH] Session created:', sessionId);

   // ✅ Nachher
   logger.info('Session created', {
     session_id_hash: hashSessionId(sessionId),  // PII-Redaction!
     auth_flow: 'callback',
     redirect_target: '/?auth=ok',
   });
   ```

3. Error-Logging mit Context:
   ```typescript
   // ❌ Vorher
   console.error('Auth callback error:', error);

   // ✅ Nachher
   logger.error('Auth callback failed', {
     error: error instanceof Error ? error.message : String(error),
     error_type: error instanceof Error ? error.constructor.name : typeof error,
     auth_flow: 'callback',
     has_code: !!code,
     has_state: !!state,
   });
   ```

**Erfolgskriterien:**
- ✅ Alle 9 console.*-Aufrufe ersetzt
- ✅ Keine Session-IDs/User-IDs in Klartext
- ✅ workspace_id in jedem Log (über OTEL Context)
- ✅ request_id für Request-Korrelation

---

### 🔴 **Prio 2: Crypto-Logging mit Security-Alerts (crypto.server.ts)**

**Ziel:** Security-Warnungen als strukturierte Logs mit Alert-Potential

**Umsetzung:**
```typescript
// ❌ Vorher
console.warn('[CRYPTO] No encryption key provided, storing token unencrypted');

// ✅ Nachher
logger.warn('Token encryption disabled', {
  component: 'crypto',
  encryption_key_present: false,
  security_impact: 'tokens_stored_unencrypted',
  recommendation: 'Set ENCRYPTION_KEY environment variable',
});
```

**Erfolgskriterien:**
- ✅ Security-Warnings als strukturierte Logs
- ✅ Encryption-Fehler mit Context (Operation, Token-Type)
- ✅ Keine Secrets/Tokens in Logs

---

### 🟡 **Prio 3: OTEL-Context Dogfooding (context.ts)**

**Ziel:** OTEL-Package nutzt eigene Best Practices

**Umsetzung:**
```typescript
// ❌ Vorher
console.warn('workspace_id header missing');

// ✅ Nachher
logger.warn('workspace_id header missing', {
  component: 'workspace-context',
  environment,
  header_names: headerNames,
});
```

**Erfolgskriterien:**
- ✅ Kein console.* in OTEL-Code
- ✅ SDK Logger auch in SDK selbst

---

## 📈 Nächste Schritte

1. **Sofort (heute):**
   - [ ] SDK Logger in @sva/auth Package instanziieren
   - [ ] routes.server.ts: Alle console.* durch logger.* ersetzen
   - [ ] PII-Redaction für Session-IDs/User-IDs implementieren

2. **Diese Woche:**
   - [ ] crypto.server.ts: Security-Logging strukturieren
   - [ ] context.ts: console.warn entfernen
   - [ ] Integration-Tests: Logging-Output validieren

3. **Follow-up:**
   - [ ] Grafana Dashboard: Auth-Flow-Metriken (Success/Error-Rate)
   - [ ] Alerts: Encryption-Key-Missing, Auth-Callback-Errors
   - [ ] Documentation: Auth-Logging-Beispiele in Best Practices

---

## 🎓 Leitfrage (Antwort)

> **Können wir einen Fehler in Produktion nur anhand der Logs nachvollziehen und gezielt beheben?**

**Aktuell:** ❌ **NEIN**
- Fehlerhafte Auth-Requests nicht zuordenbar (kein request_id)
- PII in Logs verhindert Debugging in DSGVO-Umgebungen
- Security-Warnungen gehen in Console-Noise unter

**Nach Umsetzung:** ✅ **JA**
- Jeder Request tracebar (workspace_id + request_id)
- Errors mit vollständigem Context (Code, State, ISS)
- Security-Alerts in Grafana sichtbar

---

## 📎 Referenzen

- [ADR-006: Logging Pipeline Strategy](../../docs/architecture/decisions/ADR-006-logging-pipeline-strategy.md)
- [Observability Best Practices](../../docs/development/observability-best-practices.md)
- [PII Redaction Guidelines](../../docs/development/observability-best-practices.md#pii-redaction)
