# Design: Keycloak-Integration und IAM-Service-Architektur

## Kontext

Das SVA Studio muss eine robuste, sichere und skalierbare Identitäts- und Zugriffsverwaltung aufbauen. Die Anforderungen stammen aus der konzeptionierten Benutzer- und Rechteverwaltung sowie der Systemarchitektur (siehe `concepts/konzeption-cms-v2/`).

**Stakeholder:**
- System-Administratoren (Keycloak-Pflege)
- CMS-Administratoren (Nutzer- und Rollenzuweisung)
- Redakteure (Inhalts-Erstellung mit Zugriffsbeschränkung)
- App-Manager (Organisationsverwaltung)
- IT-Sicherheit (Audit, Compliance, DSGVO)

**Constraints:**
- Bestehende Keycloak-Instanz (Version als deferred bis Produktivbetrieb dokumentiert, siehe Task 1.1.6)
- Postgres für IAM-Daten (lokal via Docker, kein Supabase)
- Monorepo-Architektur (packages/auth, packages/core, apps/studio)
- Typsicher (TypeScript strict-mode)
- Performance-Anforderung: Permission-Checks < 50 ms (siehe Child D)

---

## Ziele & Non-Ziele

### Ziele

1. **Sicherheit & Governance:**
   - Zentrale Authentifizierung via Keycloak
   - Single-Sign-On für App und CMS
   - Granulare rollenbasierte Zugriffskontrolle
   - Audit-Trails für alle IAM-Events

2. **Mandantenfähigkeit:**
   - Multi-Organization Support
   - Hierarchische Org-Strukturen
   - Row-Level Security für Datenisolation

3. **Benutzerfreundlichkeit:**
   - Nahtlose Login-Erfahrung
   - Self-Service-Profil-Verwaltung
   - Klare Rollen und Permissions

4. **Skalierbarkeit:**
   - Caching-Strategie für Permissions
   - Effiziente Datenbank-Queries
   - Horizontale Skalierbarkeit

### Non-Ziele (Phase 1–3)

- Externe IdP-Integration (AD, BundID, SAML) – später
- Advanced Workflows (Approval-Prozesse, Change-Requests) – später
- DSGVO-Löschanfrage-Management – später
- Reporting-Dashboards mit KPIs – später
- Passkey-Support (WebAuthn) – später (Keycloak-Feature)

---

## Technische Entscheidungen

### 1. Authentifizierung: Keycloak + OIDC

**Entscheidung:** Verwende Keycloak als central IdP via OpenID Connect.

**Rationale:**
- ✅ Bereits vorhanden (Bestands-System)
- ✅ Unterstützt SSO, 2FA, Passkeys, Social Login
- ✅ Open Source, aktiv gepflegt
- ✅ Separates Identity Layer (Clean Architecture)
- ✅ Ermöglicht zukünftige SAML/LDAP/AD-Integration

**Alternativen betrachtet:**
- Auth0 – Zu teuer, Cloud-Lock-In
- Okta – Zu teuer, overkill für Kommunen
- Custom JWT → Verletzung von Best Practices

**Implementierung:**
- OIDC Client im Keycloak konfigurieren
- Token-Validierung Backend-seitig (RS256 Signature)
- Frontend: OIDC-Autorisierungscode-Flow (nicht Implicit)
- Session-Management: JWT + Refresh-Token

---

### 2. Datenhaltung (Child-A-Relevanz)

> **Hinweis:** Das vollständige IAM-Datenbankschema (Tabellen, RLS, Migrationen, Seeds) wird in **Child B** (`add-iam-core-data-layer`) spezifiziert und umgesetzt. Hier wird nur die für Child A relevante Identity-Basis dokumentiert.

**Entscheidung:** IAM-Daten in Postgres mit Row-Level Security. Kanonischer Mandanten-Scope ist `instanceId` (Masterplan-Beschluss). Organisationen sind Untereinheiten innerhalb einer Instanz.

**Child-A-relevante Entität:**

```sql
-- Accounts (User + Keycloak-Mapping) – wird in Child A für JIT-Provisioning benötigt
iam.accounts (
  id UUID PRIMARY KEY,
  keycloakId TEXT UNIQUE NOT NULL,
  instanceId UUID NOT NULL,  -- kanonischer Mandanten-Scope
  email TEXT,
  displayName TEXT,
  createdAt TIMESTAMP,
  ...
)
```

**Verweis auf nachgelagerte Child-Changes:**
- Schema-Design, RLS, Migrationen, Seeds → `add-iam-core-data-layer` (Child B)
- Rollen, Permissions, Zuordnungstabellen → `add-iam-core-data-layer` (Child B)
- Activity Logs → `add-iam-governance-workflows` (Child E)

---

### 3. Berechtigungsmodell (außerhalb Child-A-Scope)

> **Hinweis:** Das RBAC/ABAC-Berechtigungsmodell mit hierarchischer Vererbung wird in den folgenden Child-Changes detailliert:
> - **Child C** (`add-iam-authorization-rbac-v1`): RBAC v1, Authorize-API, Reason-Codes
> - **Child D** (`add-iam-abac-hierarchy-cache`): ABAC-Erweiterung, Hierarchie-Vererbung, Cache-Strategie
>
> Die jeweiligen `design.md`-Dokumente dieser Children enthalten die Architekturentscheidungen, Pseudocode und Datenflüsse.

---

### 4. Permission-Caching (außerhalb Child-A-Scope)

> **Hinweis:** Die Redis-basierte Caching-Strategie für Permission-Snapshots wird in **Child D** (`add-iam-abac-hierarchy-cache`) spezifiziert.
> Masterplan-Beschluss: Cache-Invalidierung primär über Postgres NOTIFY mit TTL-/Recompute-Fallback.
> Cache-Key-Design, Invalidation-Events und Failure-Modes → siehe Child D `design.md`.

---

### 5. Frontend-Authentication: OIDC Authorization Code Flow

**Entscheidung:** OIDC Authorization Code Flow mit PKCE.

**Rationale:**
- ✅ Sichere Variante (Implicit Code ist deprecated)
- ✅ Token bleibt Backend-side
- ✅ Refresh-Token ermöglicht Long-Session
- ✅ PKCE schützt vor Code-Interception

**Sequenzdiagramm:**

```
User              Frontend         Backend              Keycloak
 │                   │               │                    │
 ├─── Login Click ──→│               │                    │
 │                   ├─ set/request_id, read traceparent │
 │                   ├─ Generate PKCE Challenge          │
 │                   ├─ Redirect to Keycloak Auth  ───→ │
 │                   │  (client_id, redirect_uri, pkce) │
 │                   │                                    ├─ Login UI
 │◄── Browser Redirect ──────────────────────────────────┤
 │    (User logs in)                                      │
 │                   │◄─── Auth Code + PKCE ────────────┤
 │                   ├─ Exchange Code + PKCE ──→ │
 │                   │                            ├─ Verify PKCE
 │                   │◄─── Access + Refresh Token ┤
 │                   ├─ Store in HttpOnly Cookie │
 │◄── Redirect ──────┤ (Secure, SameSite)        │
 │                   ├─ Redirect to /dashboard   │
 │                   │                           │
 │                   ├─ GET /api/user ──→ │
 │                   │   (Cookie) ────────┤
 │                   │   (request_id + trace_id)         │
 │                   │◄─ User Profile ────┤
 │                   │                    │
 └───────────────────┴────────────────────┴────────────────
```

---

### 6. Org-Assignment Workflow

**Entscheidung:** Zwei Modi: Admin-Zuweisung + Self-Registration (später).

**Rationale (Phase 1–3):**
- ✅ Admin-Zuweisung für Governance & Compliance
- ✅ Just-in-Time Provisioning vereinfacht First-Login
- ✅ Self-Registration später als separate Feature

**Workflow:**

```
1. User logs in via Keycloak
2. Backend: Check iam.accounts[keycloakId] exists?
   - If NO: Create account (Just-in-Time Provisioning)
   - Extract email → Guess default org (optional)
3. Check iam.account_organizations[userId, orgId] exists?
   - If NO: Prompt admin or auto-assign (config)
4. Set cookies + redirect to Dashboard
5. Dashboard loads with User's Orgs
```

---

### 7. Error Handling & Security

**Token-Fehler Handling:**

```typescript
enum TokenError {
  INVALID = "token_invalid",           // Signature mismatch
  EXPIRED = "token_expired",           // exp claim < now
  NOTBEFORE = "token_notbefore",       // nbf claim > now
  AUDIENCE = "token_audience_mismatch", // aud != this service
  ISSUER = "token_issuer_mismatch",    // iss != keycloak
}

// Retry-Strategie:
// - INVALID, AUDIENCE, ISSUER → Reject 401
// - EXPIRED → Try refresh (if available) else 401
// - NOTBEFORE → Reject 401
```

**Logging bei Token-Fehlern (Masterplan-Leitplanke):**

Jeder `TokenError`-Fall erzeugt einen SDK Logger `warn`-Eintrag:

```typescript
import { createSdkLogger } from '@sva/sdk';

const logger = createSdkLogger({ component: 'iam-auth' });

// Bei Token-Validierungsfehler:
logger.warn('Token validation failed', {
  workspace_id: ctx.instanceId,
  operation: 'token_validate',
  error_type: tokenError,        // z.B. 'token_expired'
  has_refresh_token: !!refreshToken,
  request_id: ctx.requestId,
  // ❌ NICHT: token-Werte, session_id, email
});
```

**Security Measures:**

- ✅ HTTPS only (API + Frontend)
- ✅ Token nicht in URL/LocalStorage (HttpOnly Cookies)
- ✅ CSRF-Token für state-changing operations
- ✅ Rate-Limiting auf Auth-Endpoints
- ✅ Login-Attempt-Logging (für Brute-Force-Detection später)

---

## Architektur-Komponenten

### Backend (packages/auth)

```
packages/auth/src/   # Ist-Stand (Child A)
├── oidc.server.ts            # OIDC-Discovery + Client-Init
├── auth.server.ts            # Serverseitige Auth-Flows
├── routes.server.ts          # Auth-Route-Handler
├── config.ts                 # Auth-Konfiguration (Env)
├── redis-session.server.ts   # Session-/Login-State via Redis
└── ...
```

**Zielstruktur (nach Abschluss Child A):**

```
packages/auth/src/
├── token/
│   ├── validator.ts          # JWT-Validierung
│   ├── parser.ts             # Claims-Extraktion
│   └── refresher.ts          # Token-Refresh
├── identity/
│   ├── user-context.ts       # User + Instanz-Context
│   └── account-resolver.ts   # JIT-Provisioning
├── middleware/
│   ├── authenticate.ts       # Auth-Middleware
│   └── error-handler.ts
├── session/
│   └── redis-session.ts      # Session-Management
└── config/
    └── keycloak-config.ts    # OIDC Config
```

> **Hinweis:** Access-Control-Module (`rbac-engine`, `abac-engine`, `permission-checker`, `authorize-middleware`) werden in Child C/D ergänzt. Data-Layer-Schemas und Migrationen in Child B.

### Frontend (apps/studio) – Child-A-Scope

```
src/
├── auth/
│   ├── OIDCProvider.tsx      # OIDC Context
│   ├── LoginPage.tsx         # Login UI
│   ├── useAuth.ts            # Auth-Hook
│   └── api-client.ts         # Authenticated Requests
├── components/
│   └── ProtectedRoute.tsx    # Gated Routes
└── stores/
    └── user-store.ts         # Auth-State
```

---

## Performance-Anforderungen

| Operation | Target | Strategie | Child-Change |
|-----------|--------|-----------|-------------|
| Login Flow | < 1s total | Keycloak + HTTP/2 | **Child A** |
| Token-Validierung | < 10ms | RS256 + JWKS-Caching | **Child A** |
| Permission Check | < 50ms | Redis Cache + Optimized Queries | Child C/D |
| List Orgs for User | < 200ms | Indexed Query + Caching | Child B |
| Org Hierarchy Query | < 500ms | Recursive CTE + Caching | Child B/D |

**Monitoring & Observability (gemäß ADR-006 / Masterplan-Leitplanke):**
- SDK Logger (`createSdkLogger({ component: 'iam-auth' })`) für alle operativen Logs
- OTEL-Pipeline (SDK → Collector → Loki) für Echtzeit-Monitoring und Grafana-Dashboards
- Korrelations-IDs: `X-Request-Id` + OTEL Trace-Context in allen Auth-Flows
- Dual-Write: Audit-Events in DB + OTEL-Pipeline
- APM (Application Performance Monitoring) für IAM-Operations
- Redis Memory Usage & Hit-Rate
- DB Query Performance (slow query log)

**Log-Level-Konvention (Child A):**

| Operation | Level | Pflichtfelder |
|-----------|-------|---------------|
| Erfolgreicher Login | `info` | `workspace_id`, `operation: 'login'`, `request_id` |
| Account-Erstellung (JIT) | `info` | `workspace_id`, `operation: 'account_created'`, `request_id` |
| Token-Validierungsfehler | `warn` | `workspace_id`, `operation: 'token_validate'`, `error_type`, `request_id` |
| Token-Refresh | `debug` | `workspace_id`, `operation: 'token_refresh'`, `has_refresh: boolean` |
| Session-Erstellung | `debug` | `workspace_id`, `operation: 'session_create'`, `ttl_seconds` |
| OIDC-Discovery-Fehler | `error` | `component: 'iam-auth'`, `operation: 'oidc_discovery'`, `error` |

---

## Risks & Mitigations

| Risk | Severity | Mitigation |
|------|----------|-----------|
| Keycloak Downtime → App Unresponsive | High | Local JWT cache (1h) + Grace Period |
| Permission-Cache Stale → User sees wrong UI | Medium | TTL + Invalidation Events + Fallback |
| RLS Policy Misconfiguration → Data Leak | Critical | Code Review + Integration Tests |
| N+1 Queries in Permission-Check | High | Single Query with Joins + Caching |
| Token Leak in Frontend Code | Medium | HttpOnly Cookies + CSP Headers |

---

## Migration Plan

### Phase 1 Rollout

1. **Dev Environment:** Keycloak + Schema + Token-Validator (optional gate behind feature flag)
2. **Staging:** Full Phase 1 Integration, load testing
3. **Production:** Parallel auth (Keycloak + Legacy) für Rollback

### Rollback Strategy

- Feature-Flag für IAM-Middleware (Default: OFF)
- Keep Legacy Auth Stack während Parallel-Run
- Gradual Rollout (10% → 50% → 100% Users)

---

## Offene Fragen (Child A)

- ℹ️ Keycloak-Version bleibt bis Produktivbetrieb deferred (siehe Task 1.1.6)
- 🤔 Keycloak-Realm-Strategie (Single vs. Multi)?
- 🤔 Token-Lifespan-Policy (15m Access, 7d Refresh)?
- 🤔 Rate-Limiting Backend? (WAF vs. App-Layer)

**Bereits geklärt / in nachgelagerten Children:**
- ✅ Redis-Setup vorhanden (Session-Store, Child D erweitert um Permission-Cache)
- ✅ `instanceId` als kanonischer Mandanten-Scope (Masterplan-Beschluss)
- ✅ Cache-Invalidierung via Postgres NOTIFY (Masterplan-Beschluss, Detail in Child D)

---

**Document Version:** 3.0
**Last Updated:** 26. Februar 2026
**Scope-Bereinigung:** Abschnitte 2–4 auf Child-A-Scope reduziert; Verweise auf Child B–E ergänzt.
**Logging-Review:** Observability-Abschnitt, Korrelations-IDs, Token-Error-Logging und Log-Level-Konvention ergänzt (26.02.2026).
