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
- Bestehende Keycloak-Instanz (Version TBD)
- Postgres/Supabase für IAM-Daten
- Monorepo-Architektur (packages/core, packages/data, apps/studio)
- Typsicher (TypeScript strict-mode)
- Performance-Anforderung: Permission-Checks < 50ms

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

### 2. Datenhaltung: Postgres + RLS

**Entscheidung:** IAM-Daten in Postgres (Supabase) mit Row-Level Security.

**Rationale:**
- ✅ Bereits Setup (Supabase)
- ✅ RLS für Multi-Tenancy (automatische Org-Filtering)
- ✅ ACID-Transaktionen für kritische Ops
- ✅ Audit-Logging auf DB-Ebene
- ✅ Migrations-Management (Flyway/Alembic)

**Schema-Struktur:**

```sql
-- Organizations (hierarchisch)
iam.organizations (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  parentOrganizationId UUID REFERENCES iam.organizations(id),
  type ENUM ('county', 'municipality', 'district', 'organization'),
  createdAt TIMESTAMP,
  ...
)

-- Accounts (User + Keycloak-Mapping)
iam.accounts (
  id UUID PRIMARY KEY,
  keycloakId TEXT UNIQUE NOT NULL,
  email TEXT,
  displayName TEXT,
  internalExternalFlag ENUM ('internal', 'external'),
  createdAt TIMESTAMP,
  ...
)

-- Account ↔ Organization Mapping (Many-to-Many)
iam.account_organizations (
  accountId UUID REFERENCES iam.accounts(id),
  organizationId UUID REFERENCES iam.organizations(id),
  role TEXT,  -- Primary Role in this org (optional)
  joinedAt TIMESTAMP,
  PRIMARY KEY (accountId, organizationId)
)

-- Rollen (global + custom)
iam.roles (
  id UUID PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  type ENUM ('system', 'custom'),
  organizationId UUID REFERENCES iam.organizations(id),  -- NULL for system
  description TEXT,
  ...
)

-- Permissions
iam.permissions (
  id UUID PRIMARY KEY,
  action TEXT,
  resourceType TEXT,
  scope JSONB,  -- {org, geo, time, ...}
  createdAt TIMESTAMP,
  ...
)

-- Role ↔ Permission Mapping
iam.role_permissions (
  roleId UUID REFERENCES iam.roles(id),
  permissionId UUID REFERENCES iam.permissions(id),
  PRIMARY KEY (roleId, permissionId)
)

-- Account ↔ Role Mapping (mit Temporal Constraints)
iam.account_roles (
  accountId UUID REFERENCES iam.accounts(id),
  roleId UUID REFERENCES iam.roles(id),
  validFrom TIMESTAMP DEFAULT NOW(),
  validTo TIMESTAMP,
  assignedBy UUID REFERENCES iam.accounts(id),
  PRIMARY KEY (accountId, roleId, validFrom)
)

-- Activity Logs (immutable)
iam.activity_logs (
  id UUID PRIMARY KEY,
  eventType TEXT,  -- 'account_created', 'role_assigned', 'login', ...
  actor UUID REFERENCES iam.accounts(id),
  subject UUID REFERENCES iam.accounts(id),
  details JSONB,
  createdAt TIMESTAMP NOT NULL
)
```

---

### 3. Berechtigungsmodell: RBAC + ABAC + Hierarchie

**Entscheidung:** Hybrid RBAC/ABAC mit hierarchischer Vererbung.

**Rationale:**
- ✅ RBAC einfach & performant für 80% der Fälle
- ✅ ABAC flexibel für komplexe Policies (z.B. "Freigabe nur 9-17h")
- ✅ Hierarchie abbildbar ohne Query-Explosion

**Permission-Checking Logik:**

```typescript
async function canUserPerformAction(
  userId: string,
  action: string,
  resourceType: string,
  resourceId?: string,
  organizationId?: string,
  context?: Record<string, unknown>
): Promise<boolean> {
  // 1. Load User + Current Org
  const user = await loadUser(userId, organizationId)
  if (!user) return false

  // 2. Collect all Roles (direct + inherited from Org hierarchy)
  const roles = await collectRoles(user, organizationId)

  // 3. Aggregate Permissions
  const permissions = await aggregatePermissions(roles)

  // 4. Match Permission gegen (action, resourceType, scope)
  const matching = permissions.filter(p =>
    p.action === action && p.resourceType === resourceType
  )

  // 5. Apply ABAC (attribute-based conditions)
  for (const perm of matching) {
    if (matchABAC(perm.abacRules, context)) {
      return true
    }
  }

  return false
}
```

**Hierarchie-Vererbung Beispiel:**

```
County Admin (Landkreis XY)
├─ Rolle: "county_admin"
├─ Permissions: ["manage_all_municipalities", "manage_accounts"]
│
├─ Municipal Admin (Gemeinde XY-1)
│  ├─ Erbt: ["view_parent_data"]
│  ├─ Eigene Rolle: "municipal_admin"
│  ├─ Permissions: ["manage_local_content", "manage_local_accounts"]
│
├─ District Admin (Ortsteil XY-1-A)
│  ├─ Erbt: ["view_parent_data"]
│  ├─ Eigene Rolle: "district_admin"
│  ├─ Permissions: ["manage_district_content"]
```

---

### 4. Permission-Caching: Redis

**Entscheidung:** Redis-Cluster für Permission-Snapshot-Caching.

**Rationale:**
- ✅ < 50ms Permission-Checks erfordern Caching
- ✅ Redis performant für Key-Value
- ✅ Einfache Cache-Invalidation via Pub/Sub
- ✅ Horizontal skalierbar

**Cache-Key-Schema:**

```
iam:permissions:{userId}:{organizationId} → Set<Permission>
iam:roles:{userId}:{organizationId} → Set<RoleId>
iam:user_orgs:{userId} → Set<OrgId>
```

**Cache-Invalidation Trigger:**
- Bei Rollenänderung (`account_roles` INSERT/UPDATE/DELETE)
- Bei Permission-Änderung (`role_permissions` UPDATE)
- Bei Organization-Hierarchie-Änderung
- Pub/Sub Message an IAM-Service → Redis-Key löschen

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

**Security Measures:**

- ✅ HTTPS only (API + Frontend)
- ✅ Token nicht in URL/LocalStorage (HttpOnly Cookies)
- ✅ CSRF-Token für state-changing operations
- ✅ Rate-Limiting auf Auth-Endpoints
- ✅ Login-Attempt-Logging (für Brute-Force-Detection später)

---

## Architektur-Komponenten

### Backend (packages/core)

```
src/iam/
├── token/
│   ├── validator.ts          # JWT-Validierung
│   ├── parser.ts             # Claims-Extraktion
│   ├── refresher.ts          # Token-Refresh
│   └── cache.ts              # Token-Caching
├── identity/
│   ├── user-context.ts       # User + Org-Context
│   ├── account-resolver.ts   # DB-Lookup
│   └── organization-loader.ts
├── access-control/
│   ├── rbac-engine.ts        # Role-Based Access
│   ├── abac-engine.ts        # Attribute-Based Access
│   ├── permission-checker.ts # Main API
│   └── cache.ts              # Redis Caching
├── middleware/
│   ├── authenticate.ts       # Express Middleware
│   ├── authorize.ts          # Permission Check Middleware
│   └── error-handler.ts
└── config/
    └── keycloak-config.ts    # OIDC Config
```

### Frontend (apps/studio)

```
src/
├── auth/
│   ├── OIDCProvider.tsx      # OIDC Context
│   ├── LoginPage.tsx         # Login UI
│   ├── useAuth.ts            # Hook
│   └── api-client.ts         # Authenticated Requests
├── components/
│   └── ProtectedRoute.tsx    # Gated Routes
└── stores/
    └── user-store.ts         # Zustand/Redux
```

### Data Layer (packages/data)

```
src/
├── schema/
│   ├── iam-organizations.sql
│   ├── iam-accounts.sql
│   ├── iam-roles.sql
│   ├── iam-permissions.sql
│   └── iam-activity-logs.sql
└── migrations/
    └── 001-iam-foundation.sql
```

---

## Performance-Anforderungen

| Operation | Target | Strategie |
|-----------|--------|-----------|
| Login Flow | < 1s total | Keycloak + HTTP/2 |
| Permission Check | < 50ms | Redis Cache + Optimized Queries |
| List Orgs for User | < 200ms | Indexed Query + Caching |
| Org Hierarchy Query | < 500ms | Recursive CTE + Caching |

**Monitoring:**
- APM (Application Performance Monitoring) für IAM-Operations
- Redis Memory Usage & Hit-Rate
- DB Query Performance (slow query log)

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

## Open Questions

- 🤔 Keycloak-Versionsanforderung?
- 🤔 Redis-Cluster-Setup vorhanden?
- 🤔 Keycloak-Realm Strategy (Single vs. Multi)?
- 🤔 Token-Lifespan Policy (15m Access, 7d Refresh)?
- 🤔 Rate-Limiting Backend? (WAF vs. App-Layer)

---

**Document Version:** 1.0
**Last Updated:** 21. Januar 2026
