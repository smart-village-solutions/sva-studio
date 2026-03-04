# 🌐 INTEROPERABILITY & DATA REVIEW: IAM-Proposal (setup-iam-identity-auth)

**Reviewer:** Interoperability & Data Integration Specialist
**Review Date:** 21. Januar 2026
**Status:** 🟡 **CONDITIONAL APPROVAL – mit Nachbesserungen**
**Leitfrage:** "Kann eine Kommune morgen wechseln – ohne Datenverlust und mit voller Funktionalität?" → **TEILWEISE JA, aber nur mit Verbesserungen**

---

## 📊 EXECUTIVE SUMMARY

### Interoperabilitäts-Gesamtbewertung: **MITTEL (65%)**

| Dimension | Rating | Status |
|-----------|--------|--------|
| **API-Versionierung** | 🔴 Low | Keine Strategie definiert |
| **Standards-Compliance (OIDC/JWT/OpenAPI)** | 🟢 High | Gut (OIDC ✅, JWT ✅) |
| **Abwärtskompatibilität** | 🟡 Medium | Nicht adressiert |
| **Datenmigration (Import/Export)** | 🟡 Medium | Teilweise definiert |
| **Externe Integrations-Readiness** | 🔴 Low | Webhook/Event-APIs fehlen |
| **Exit-Fähigkeit (Vendor Lock-in)** | 🟡 Medium | Abhängig von Keycloak, aber offen |
| **Extension-Fähigkeit (Plugins)** | 🔴 Low | Keine Architektur definiert |
| **Datenmodell-Stabilität** | 🟢 High | Gut normalisiert |
| **API-Dokumentation** | 🔴 Low | OpenAPI/GraphQL-Docs fehlen |
| **SDK/CLI-Verfügbarkeit** | 🔴 Low | Keine Erwähnung |

---

## 1. API-VERSIONIERUNG & DEPRECATION-STRATEGIE

### 🔴 **KRITISCHES DEFICIT**

**Aktueller Status:** Keine Versionierungsstrategie dokumentiert.

**Probleme:**

1. **Keine URL-Versionierung**
   - Sollen APIs so strukturiert sein? `/api/v1/users` oder `/api/iam/users`?
   - Keine Aussage zur Versionierungsstrategie

2. **Keine Deprecation-Policy**
   - Wenn ein Endpoint sich ändert, wie werden Partner informiert?
   - Gibt es ein Deprecation-Window (z.B. 6 Monate)?
   - Gibt es ein Communication-Prozess?

3. **Keine Breaking-Change-Management**
   - Was passiert, wenn die Token-Struktur sich ändert?
   - Wie werden externe Systeme nachgewarnt?

### 🎯 **EMPFEHLUNGEN**

```yaml
API-Versionierung Proposal:
  URL-Struktur: |
    /api/iam/v1/users          # Majorversion in URL
    /api/iam/v1/permissions    # Versionsneutral sind:
                               # - Error-Codes (RFC 9110)
                               # - Standard-HTTP-Header

  Versioning-Policy:
    - Semantisches Versionskennzeichen (MAJOR.MINOR.PATCH)
    - Major-Version in URL bei Breaking Changes
    - Minor/Patch kompatibel innerhalb Major-Version

  Deprecation-Policy:
    1. Neuer Endpoint: "X-API-Warn: Deprecated=v1.5.0, Sunset=2026-07-01" Header
    2. Zeitfenster: Min. 6 Monate vor Sunset-Datum
    3. Migration-Guide für jede Deprecation
    4. Email-Benachrichtigung an registrierte Integration-Partner

  Breaking-Change-Process:
    - Changelog mit Migration-Guide
    - Blog-Post für Stakeholder
    - Tech-Support-Telefon-Line während Übergangsphase
    - Parallel-Betrieb (alte + neue API) während Migration
```

---

## 2. JWT-CLAIMS STANDARDISIERUNG

### 🟢 **TEILWEISE GUT – aber Lücken vorhanden**

**Aktueller Status:** Design.md spricht von Token-Mapping, aber keine präzise JWT-Claim-Spezifikation.

**Was dokumentiert ist:**
```typescript
// Design erwähnt:
// - sub (user ID) ✅
// - email ✅
// - name ✅
// - roles (custom Mapper) ✅
// - org (custom Mapper) ✅
```

**Was FEHLT (kritisch):**

1. **Standard OIDC-Claims nicht vollständig**
   ```
   iat (issued-at)       ✅ (implicit von JWT)
   exp (expiration)      ✅ (implicit von JWT)
   nbf (not-before)      ✅ (design erwähnt)
   aud (audience)        ✅ (design erwähnt)
   iss (issuer)          ✅ (design erwähnt)
   jti (JWT-ID)          ❓ Für Revocation-Tracking?
   ```

2. **Organisationales Claims-Schema unklar**
   ```
   "org" → Was ist die Struktur?
   {
     "organizationId": "uuid",
     "organizationName": "string",
     "organizationHierarchy": [...]?  // Voll-Pfad?
   }
   ```

3. **Keine Authorization Context Claims**
   ```
   "scope" → Was ist die Liste? (openid profile email roles)
   "permissions" → Sollten sie in JWT sein oder nur DB-lookup?
   "roles" → Format? ["admin", "redakteur"] oder
             {role: "admin", scope: {...}}?
   ```

### 🎯 **EMPFEHLUNGEN**

```yaml
JWT-Claims Standard-Spezifikation:

Header:
  alg: RS256
  typ: JWT
  kid: <keycloak-key-id>

Payload (Standard OIDC):
  iss: "https://keycloak.sva-studio.de/auth/realms/sva"
  sub: "<keycloak-user-id-uuid>"
  aud: ["sva-studio-client", "sva-studio-api"]
  exp: <unix-timestamp>
  iat: <unix-timestamp>
  nbf: <unix-timestamp>
  jti: "<unique-token-id-uuid>"  # Für Revocation

Payload (SVA-Custom):
  email: "user@example.de"
  email_verified: true
  name: "Max Mustermann"
  given_name: "Max"
  family_name: "Mustermann"

  # Organizations-Claims (neue Mapper-Konfiguration)
  organizations: [
    {
      id: "org-uuid-1",
      name: "Gemeinde München",
      type: "municipality",
      level: 2,
      path: ["county-1", "org-uuid-1"]  # Full ancestor-path
    }
  ]
  current_organization: "org-uuid-1"  # Aktiv in dieser Org

  # Rollen (Keycloak Client-Roles + Org-specific Roles)
  roles: {
    system_roles: ["user"],
    organization_roles: {
      "org-uuid-1": ["redakteur", "moderator"]
    }
  }

  # Scopes (für Consent & Permission-Checking)
  scope: "openid profile email roles organizations"
  acr: "urn:mace:incommon:iap:silver"  # Authentication Context Reference

  # Sicherheits-Kontext
  client_id: "sva-studio-client"
  client_host: "192.168.1.100"
  session_id: "<session-id>"
  auth_time: <unix-timestamp>

Validation-Rules (im Backend):
  - iss muss https://keycloak.* sein
  - aud muss enthalten ["sva-studio-api"]
  - exp > now
  - sub darf nicht null sein
  - organizations-Array darf nicht leer sein (außer Service-Tokens)
  - current_organization muss in organizations-Array enthalten sein
```

---

## 3. API-DESIGN & REST vs. GraphQL ENTSCHEIDUNG

### 🔴 **KEINE ENTSCHEIDUNG DOKUMENTIERT**

**Aktueller Status:** Proposal/Design spricht von "APIs" und "Endpoints", aber es ist unklar:
- Ist es REST?
- Sollte es GraphQL sein?
- Gibt es mehrere API-Styles nebeneinander?

**Probleme:**

1. **Keine Resource-Definition**
   ```
   REST würde erwarten:
   - GET /api/iam/v1/users/{id}
   - POST /api/iam/v1/organizations
   - PATCH /api/iam/v1/roles/{id}/permissions

   Aber: Ist das die Struktur?
   ```

2. **Permission-Checking als Query vs. Operation**
   ```
   REST:
   POST /api/iam/v1/permissions/check
   Body: { userId, action, resourceType }

   GraphQL:
   query {
     checkPermission(userId: "...", action: "create", resourceType: "news") {
       allowed
       reason
     }
   }

   Welcher Ansatz?
   ```

3. **No OpenAPI/GraphQL Schema**
   ```
   Für Integration-Partner braucht es:
   - OpenAPI 3.0+ Spec (REST)
     oder
   - GraphQL Schema + Introspection

   Aktuell: Fehlt komplett
   ```

### 🎯 **EMPFEHLUNG**

```yaml
API-Design-Entscheidung: HYBRID (REST-Primary + GraphQL-Secondary)

Rationale:
  - REST für Simple CRUD-Ops (Users, Orgs, Roles)
  - GraphQL für Complex Queries (Permission-Checks, Audit-Log-Queries)
  - Versionierung über URL-Path
  - Standards-basiert (OpenAPI 3.0 + GraphQL SDL)

REST-API Struktur (Empfehlung):

Base: https://api.sva-studio.de/iam/v1

Endpoints:
  # Users
  GET    /users
  GET    /users/{id}
  POST   /users                  # Admin nur
  PATCH  /users/{id}
  DELETE /users/{id}

  # Organizations
  GET    /organizations
  GET    /organizations/{id}
  POST   /organizations
  PATCH  /organizations/{id}
  GET    /organizations/{id}/users
  POST   /organizations/{id}/users    # Bulk-Add

  # Roles
  GET    /roles
  POST   /roles
  PATCH  /roles/{id}
  DELETE /roles/{id}
  GET    /roles/{id}/permissions

  # Permissions
  GET    /permissions
  POST   /permissions/check            # ABAC-Engine
  GET    /users/{id}/effective-permissions  # Cached

  # Audit Logs
  GET    /audit-logs
  POST   /audit-logs/export             # CSV/JSON
  GET    /audit-logs/{id}

GraphQL-Endpoint (Secondary):
  POST   /graphql

  Schema:
    query {
      user(id: "...") { ... }
      organizations(filter: {...}) { ... }
      checkPermission(userId, action, resource) { ... }
      auditLogs(filter: {...}) { ... }
    }

    mutation {
      assignRole(userId, roleId) { ... }
      createOrganization(...) { ... }
    }
```

---

## 4. ABWÄRTSKOMPATIBILITÄT & UPGRADE-PFADE

### 🟡 **TEIL-ADRESSIERT – aber strategisch unklar**

**Aktueller Status:**
- Design.md: "Parallel auth (Keycloak + Legacy) für Rollback"
- Tasks.md: Keine expliziten Migration-Tasks

**Was gut ist:**
```
✅ Feature-Flag für IAM-Middleware (OFF by default)
✅ Gradual Rollout erwähnt (10% → 50% → 100%)
✅ Legacy-Auth-Stack wird beibehalten
```

**Was fehlt:**

1. **Keine SQL-Migration-Strategie für RLS**
   ```
   Problem: Wenn RLS-Policies falsch sind, können sich Nutzer
   nicht einloggen oder sehen Fremddaten.

   Migration-Strategy nicht dokumentiert:
   - Wie wird `iam.account_organizations` initial befüllt?
   - Wie werden existierende User migriert?
   - Wie wird RLS in Staging getestet?
   ```

2. **Keine Datenbank-Rollback-Strategie**
   ```
   Was passiert, wenn RLS-Policy fehlerhaft ist?
   - Haben wir ein Backup?
   - Können wir auf Version N-1 zurückgehen?
   - Wie lange sind Backups aufbewahrt?
   ```

3. **Keine Token-Refresh-Token-Rotation-Strategie**
   ```
   Wenn wir von Legacy zu Keycloak migrieren:
   - Können alte Tokens noch akzeptiert werden?
   - Wie lange gibt es eine Übergangsphase?
   - Wann werden alte Tokens komplett verweigert?
   ```

### 🎯 **EMPFEHLUNG**

```yaml
Upgrade-Path Proposal:

Phase 1: Parallel Auth (2 Wochen vor Production)
  - Feature-Flag IAM_AUTH_ENABLED = false (default)
  - Keycloak-Stack parallel zu Legacy-Auth
  - Alle E2E-Tests laufen gegen beide Stacks
  - Performance-Tests zeigen keine Degradation

Phase 2: Canary Rollout (Week 1)
  - 10% zufällige User zur Keycloak-Auth
  - Alle anderen nutzen Legacy
  - Monitoring: Error-Rate, Latency, Coverage
  - Automatisches Rollback bei > 1% Error-Rate

Phase 3: Staged Rollout (Week 2–3)
  - 50% → 100% wenn Phase 2 stabil
  - Legacy-Auth bleibt als Fallback erreichbar

Phase 4: Legacy-Sunsetting (3 Monate später)
  - Deprecation-Notification für 6 Wochen
  - Legacy-Auth wird entfernt

Database Migration Strategy:

  Baseline (0h):
    - Schema-Snapshot erzeugt
    - Backup hochgeladen (S3, 30 Tage Retention)
    - RLS-Policies in Staging getestet

  Cutover (1h):
    - Migration-Script (Liquibase/Flyway):
      1. iam.organizations von config/seed eingefüllt
      2. iam.accounts von Keycloak geleert
      3. iam.account_organizations initial leer (JIT Provisioning)
      4. RLS-Policies aktiviert (mit Logging)

    - Post-Migration-Checks:
      1. Alle Tabellen > 0 Rows?
      2. RLS-Policies aktiv?
      3. Test-User kann sich einloggen?

  Rollback-Option (bis 48h nach):
    - Datenbank-Restore aus Snapshot
    - Feature-Flag IAM_AUTH_ENABLED = false
    - Legacy-Auth wird wieder aktiv
    - Incident-Report erstellt

Token-Lifespan-Strategy:

  Legacy-Token (alte Custom-Tokens):
    - Accept bis 2026-02-01
    - Warnings in Logs nach 2026-01-15
    - Komplett rejected nach 2026-02-01

  Keycloak-Token:
    - Access-Token: 15 Min
    - Refresh-Token: 7 Tage
    - Refresh-Token-Rotation: Jeden Refresh

Rollback-Trigger (Automatic):
  - Auth-Error-Rate > 5% (10 Min)
  - Permission-Cache-Hit < 50% (20 Min)
  - Database Connection Pool Exhaustion
```

---

## 5. DATENMIGRATION & IMPORT/EXPORT-VOLLSTÄNDIGKEIT

### 🟡 **TEILWEISE GELÖST – Lücken in Export-Funktionalität**

**Aktueller Status:**
- Audit-Logs Export erwähnt: CSV, JSON ✅
- Organisationen Export: ❓
- Benutzer-Export: ❓
- Permissions-Export: ❓

**Exit-Szenario:** "Gemeinde XY wechselt von SVA-Studio zu Konkurrenz-Plattform ABC"

**Was muss exportierbar sein:**

| Entity | Format | Use-Case | Status |
|--------|--------|----------|--------|
| **Organizations** | JSON, CSV | Re-import in ABC-System | ❓ |
| **Users (Accounts)** | JSON, CSV | Bulk-Import mit Org-Zuordnung | ❓ |
| **Roles** | JSON, YAML | Role-Definition mit Permissions | ❓ |
| **Permissions** | JSON | Permissions mit Scope/ABAC-Rules | ❓ |
| **Role-Assignments** | JSON, CSV | User → Role Mappings | ❓ |
| **Audit-Logs** | JSON, CSV, Parquet | Forensic + Compliance | ✅ |
| **Content (News, Events)** | JSON | Erst-Phase-Daten | ❌ |

### 🎯 **EMPFEHLUNG: Export/Import Framework**

```yaml
IAM Data Export/Import Framework:

Export-Endpoints (alle authenticated, admin-only):

  1. Organizations:
     GET /api/iam/v1/organizations/export?format=json

     Response (JSON):
     {
       version: "1.0",
       exported_at: "2026-01-21T10:00:00Z",
       organizations: [
         {
           id: "org-uuid",
           name: "Gemeinde München",
           parent_id: "parent-org-uuid",
           type: "municipality",
           metadata: { address, phone, email, ... }
         }
       ],
       _metadata: {
         total_count: 42,
         organization_count: 42,
         checksum: "sha256:..."
       }
     }

  2. Users/Accounts:
     GET /api/iam/v1/users/export?format=csv&include_org_assignments=true

     CSV:
     id,email,name,external_flag,created_at,organizations
     user-1,max@example.de,Max Mustermann,internal,2025-01-01,"org-1,org-2"

  3. Roles & Permissions:
     GET /api/iam/v1/roles/export?format=json&include_permissions=true

     Response (JSON):
     {
       roles: [
         {
           id: "role-uuid",
           name: "Redakteur",
           system_role: true,
           permissions: [
             { id: "perm-1", action: "create", resource: "news" }
           ]
         }
       ]
     }

  4. Role-Assignments:
     GET /api/iam/v1/role-assignments/export?format=csv

     CSV:
     user_id,user_email,role_id,role_name,organization_id,valid_from,valid_to
     user-1,max@example.de,role-1,Redakteur,org-1,2025-01-01,

  5. Audit-Logs (bereits definiert):
     GET /api/iam/v1/audit-logs/export?format=csv&date_range=2025-01

Import-Endpoints (admin-only, idempotent):

  1. Organizations Import:
     POST /api/iam/v1/organizations/import

     Body (multipart/form-data):
     - file: export.json
     - mode: "create_or_update" | "create_only" | "dry_run"

     Response:
     {
       status: "success",
       created: 10,
       updated: 5,
       errors: [],
       dry_run: false
     }

  2. Users Import:
     POST /api/iam/v1/users/import

     Body:
     - file: users.csv
     - default_organization_id: "org-uuid"  # Fallback Org
     - create_missing_users: true
     - mode: "dry_run" | "execute"

     Response:
     {
       created_users: 42,
       assigned_organizations: 42,
       errors: [
         { row: 5, email: "invalid@", error: "invalid_email" }
       ]
     }

  3. Roles Import:
     POST /api/iam/v1/roles/import

     Body:
     - file: roles.json
     - conflict_mode: "skip" | "overwrite" | "merge"
     - scope: "system" | "organization"

  4. Role-Assignments Import:
     POST /api/iam/v1/role-assignments/import

     Body:
     - file: assignments.csv
     - mode: "replace" | "merge"  # replace = wipe alte, merge = add to existing

Data Format Standards:

  JSON Schema (für alle exports):
    - Versionierung (version: "1.0")
    - Checksum für Integritätsprüfung
    - Timestamp des Exports
    - Metadata (count, filters applied)

  CSV Format:
    - UTF-8, BOM-less
    - LF line-endings
    - Header-Row mit Datentyp-Hinweisen (# string, # uuid, # timestamp)
    - Referentielle Integrität (z.B. org_id existiert)

  GraphQL-Query Option (für komplexe Szenarien):
    query {
      exportData(format: JSON, includeAuditLogs: true) {
        organizations { ... }
        users { ... }
        roles { ... }
        roleAssignments { ... }
        auditLogs(dateRange: "last_90_days") { ... }
      }
    }

Idempotency & Error-Handling:

  - Alle Import-Operationen idempotent (wenn ID existiert, skip)
  - Dry-Run-Modus für Validierung
  - Detaillierte Error-Reports pro Zeile/Eintrag
  - Transaction-Rollback bei kritischen Fehlern
  - Audit-Logs für alle Import-Operationen
```

---

## 6. OFFENE STANDARDS & FEDERATION

### 🟢 **GUT – OIDC/JWT sind Standards-basiert**

**Was gut dokumentiert ist:**
```
✅ OIDC Authorization Code Flow (RFC 6749)
✅ PKCE (RFC 7636)
✅ JWT (RFC 7519)
✅ RS256 Signature (RSA + SHA-256)
✅ HttpOnly Cookies (Security Best Practice)
```

**Was fehlt (für echte Interoperabilität):**

1. **Keine SAML-Integration erwähnt**
   ```
   Problem: Viele Kommunen verwenden SAML (AD, LDAP)
   Design: "LDAP/SAML später"

   → Roadmap fehlt! Wann genau "später"?
   ```

2. **Keine OAuth 2.0 Device Flow (für CLI/Batch)**
   ```
   UseCase: Migration-Tools, Batch-Scripts
   Status: Nicht erwähnt
   ```

3. **Keine JWT-Private-Claim-Registry**
   ```
   SVA definiert Custom-Claims (org, roles)
   Aber: Wo sind sie dokumentiert?
   Wie vermeiden wir Collisions mit anderen OIDC-Providern?

   RFC 8414 (OIDC Metadata Endpoint) would help:
   GET /.well-known/openid-configuration
   ```

### 🎯 **EMPFEHLUNG: Federation-Roadmap**

```yaml
Federation & External IdP Integration:

Phase 1 (Current – Q1 2026):
  ✅ OIDC via Keycloak
  ✅ JWT-Token mit Standard-Claims
  ✅ Single-Tenant (Keycloak-Realm)

Phase 2 (Q2 2026 – External IdP Support):
  ⏳ SAML 2.0 Integration
    - Kommunen mit AD/Okta können via SAML angebunden werden
    - Keycloak-Feature: SAML Client + Broker

  ⏳ LDAP/AD Backend
    - Direkte LDAP-Sync statt Keycloak-UI
    - User-Provisioning from AD

  ⏳ OAuth 2.0 Device Flow
    - CLI-Tools können sich authentifizieren
    - For batch-scripts & migrations

  ⏳ JWT-Claims Registry
    - Publish /.well-known/sva-iam-claims.json
    - Definition aller Custom-Claims
    - Namespace-Scoping (com.sva-studio.*)

Phase 3 (Q3 2026 – Vendor Portability):
  ⏳ SCIM 2.0 User-Provisioning
    - Partner können User-Management automatisieren
    - Standard RFC 7643 / RFC 7644

  ⏳ Management-APIs in GraphQL + REST
    - Migrate away from Keycloak? Use standard API
    - User/Role-Export über SCIM

  ⏳ IDaaS-Agnostic Permission-Model
    - ABAC-Policies exportierbar in XACML 3.0 oder OPA Rego
    - Portability zu anderen IAM-Systemen

OIDC Metadata Endpoint Spec (Phase 2):

  GET /.well-known/openid-configuration

  Response:
  {
    issuer: "https://keycloak.sva-studio.de/auth/realms/sva",
    authorization_endpoint: "...",
    token_endpoint: "...",
    userinfo_endpoint: "...",
    jwks_uri: "...",
    scopes_supported: ["openid", "profile", "email", "roles", "organizations"],
    response_types_supported: ["code", "code id_token"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
    claims_supported: [
      "sub", "email", "name", "organizations", "roles",
      "iss", "aud", "iat", "exp", "nbf", "jti"
    ]
  }

  GET /.well-known/sva-iam-claims.json (Custom SVA-Claims):

  Response:
  {
    namespace: "com.sva-studio.iam",
    version: "1.0",
    claims: [
      {
        name: "organizations",
        type: "array",
        description: "User's organization memberships",
        scope_required: "organizations"
      },
      {
        name: "current_organization",
        type: "string",
        description: "Currently active organization ID"
      },
      {
        name: "roles",
        type: "object",
        description: "Roles grouped by system and organization scope"
      }
    ]
  }

SCIM 2.0 Endpoints (Phase 3 – wenn ausstehend):

  GET  /scim/v2/Users
  GET  /scim/v2/Users/{id}
  POST /scim/v2/Users
  PUT  /scim/v2/Users/{id}
  PATCH /scim/v2/Users/{id}
  DELETE /scim/v2/Users/{id}

  GET  /scim/v2/Groups
  GET  /scim/v2/Groups/{id}
  ...

  Schema: https://datatracker.ietf.org/doc/html/rfc7643
```

---

## 7. WEBHOOKS & EVENT-APIs FÜR INTEGRATIONS-PARTNER

### 🔴 **VÖLLIG FEHLENDES KONZEPT**

**Aktueller Status:** Keine Webhooks, Event-APIs oder Event-Streaming erwähnt.

**Problem:** Integration-Partner (z.B. Medienverwaltungs-System) müssen auf IAM-Events reagieren:

```
Szenario 1: User Rollback nach Permission-Change
  IAM: Nutzer "Max" → Role "Redakteur" wird entfernt
  Media-System: Max darf nicht mehr News-Images editieren
  → Media-System MUSS informiert werden (synchron oder asynchron)

Szenario 2: Neue Org hinzugefügt
  IAM: Neue Gemeinde XY wird onboarded
  CMS: News-Module muss Template für XY erzeugt werden
  → Cascading-Provisioning erforderlich

Szenario 3: Audit-Compliance
  IAM: Alle Nutzer-Änderungen müssen in zentralem Audit-Log landen
  → Message-Queue für andere Services (Splunk, ElasticSearch, etc.)
```

### 🎯 **EMPFEHLUNG: Event-Streaming-Architektur**

```yaml
Event API & Webhook Framework (neue Spec):

Architektur: Event-driven via Kafka/Redis-Streams

1. Internal Event-Bus (Kafka Topics):

   iam.events.users
   ├── user.created
   ├── user.updated
   ├── user.deleted
   └── user.disabled

   iam.events.roles
   ├── role.assigned
   ├── role.revoked
   ├── role.permissions_changed
   └── role.created

   iam.events.organizations
   ├── organization.created
   ├── organization.updated
   ├── organization.deleted
   └── organization.hierarchy_changed

   iam.events.permissions
   ├── permission.granted
   ├── permission.revoked
   └── permission.scope_changed

   iam.events.auditing
   ├── audit.login
   ├── audit.logout
   └── audit.anomaly_detected

2. Webhook Subscriptions (REST API):

   POST /api/iam/v1/webhooks
   {
     events: ["role.assigned", "role.revoked", "user.deleted"],
     url: "https://media-system.example.de/webhooks/iam",
     auth: {
       type: "bearer_token",
       token: "secret-token-xyz"
     },
     retry_policy: {
       max_attempts: 3,
       backoff_multiplier: 2.0
     }
   }

   Response:
   {
     id: "webhook-uuid",
     created_at: "2026-01-21T...",
     status: "active"
   }

   GET /api/iam/v1/webhooks
   GET /api/iam/v1/webhooks/{id}
   PATCH /api/iam/v1/webhooks/{id}
   DELETE /api/iam/v1/webhooks/{id}

3. Webhook Event Schema:

   POST https://media-system.example.de/webhooks/iam

   Headers:
     X-SVA-Event-ID: <uuid>
     X-SVA-Event-Type: role.assigned
     X-SVA-Timestamp: 2026-01-21T10:00:00Z
     X-SVA-Signature: sha256=<hmac-signature>

   Body:
   {
     event_id: "evt-uuid",
     event_type: "role.assigned",
     timestamp: "2026-01-21T10:00:00Z",
     data: {
       user_id: "user-uuid",
       user_email: "max@example.de",
       role_id: "role-uuid",
       role_name: "Redakteur",
       organization_id: "org-uuid",
       assigned_by: "admin-uuid",
       assigned_at: "2026-01-21T10:00:00Z",
       valid_from: "2026-01-21T10:00:00Z",
       valid_to: null
     }
   }

4. GraphQL Subscription (für Real-Time Clients):

   subscription {
     onRoleAssigned(organizationId: "org-uuid") {
       userId
       roleId
       roleName
       assignedAt
     }
   }

5. Event-Replay API (für Missed Events):

   GET /api/iam/v1/events/replay?from=2026-01-20T00:00:00Z&to=2026-01-21T00:00:00Z

   Response:
   {
     events: [
       {
         event_id: "evt-1",
         event_type: "role.assigned",
         timestamp: "2026-01-20T10:00:00Z",
         data: { ... }
       }
     ],
     continuation_token: "next-page-token"
   }

6. Webhook Delivery Guarantees:

   - At-Least-Once Delivery (keine Guarantie für Exaktheit)
   - Retry auf 5xx / Timeout mit exponential backoff
   - Event-ID für Idempotency (Partner kann Duplikate filtern)
   - Dead-Letter-Queue für unzustellbare Events (nach 3 Versuchen)

7. Managed Integration-Partner SDKs:

   JavaScript:
   ```javascript
   const iamClient = new SVAIAMClient({
     apiKey: "...",
     webhookSecret: "..."
   });

   // Auto-setup Webhook
   await iamClient.subscribeToEvents({
     events: ["role.assigned", "role.revoked"],
     handler: async (event) => {
       if (event.type === "role.assigned") {
         await updateMediaSystemPermissions(event.data);
       }
     }
   });
   ```

   Python:
   ```python
   from sva_iam import IAMClient, WebhookServer

   client = IAMClient(api_key="...")
   webhook_server = WebhookServer(port=3000)

   @webhook_server.on("role.assigned")
   async def on_role_assigned(event):
       await sync_to_media_system(event)

   await webhook_server.start()
   ```
```

---

## 8. EXIT-FÄHIGKEIT & VENDOR LOCK-IN ANALYSE

### 🟡 **MITTEL – Offene Standards, aber prozessual unklar**

**Positiv:**
```
✅ Keycloak ist Open Source (nicht proprietär)
✅ OIDC ist Standard → Portabilität zu anderen IdP
✅ JWT ist Standard → Tokens sind lesbar/validierbar
✅ Postgres RLS ist Standard SQL-Feature
```

**Kritisches Risiko:**

| Aspekt | Lock-In-Grad | Severity |
|--------|-------------|----------|
| **Keycloak-Custom-Mappers** | Medium | Wenn Mappers komplex, migrieren schwer |
| **RLS-Policy-Komplexität** | High | Postgres-spezifisch, nicht portabel |
| **Hierarchisches Org-Modell** | Medium | SVA-spezifisch, Re-Mapping erforderlich |
| **ABAC-Scope-Format** | High | Proprietäres JSONB-Format |
| **Permission-Cache in Redis** | Low | Redis ist Standard |
| **Audit-Log-Schema** | Low | Standard JSON/CSV |

### 🎯 **EMPFEHLUNG: Exit-Readiness Checklist**

```yaml
Exit Strategy & Portability Plan:

Ziel: "Eine Gemeinde kann in 4 Wochen zu Konkurrenz-System wechseln"

Pre-Exit Phase (immer aktiv):

  1. Daten-Exportierbarkeit:
     ✅ Alle Daten müssen täglich in Open-Formats exportiert werden
     ✅ Organizations → JSON (Standard-Struktur)
     ✅ Users → CSV (RFC 4180)
     ✅ Roles/Permissions → YAML (Human-readable)
     ✅ Audit-Logs → Parquet (Analytics-optimiert)

  2. API-Dokumentation:
     ✅ OpenAPI 3.0 Spec (machine-readable)
     ✅ API-Changes documented in Changelog
     ✅ GraphQL Schema published
     ✅ SDK-Quellcode offen (GitHub)

  3. Datenmodell-Stabilität:
     ✅ Keine unerwarteten Schema-Changes
     ✅ Migrations-Scripts versioniert
     ✅ Breaking Changes haben 12-Monatiges Deprecation-Window

Exit Process (wenn Gemeinde geht):

  Week 1: Vorbereitung
    - Full data export (mit Checksums)
    - Mapping-Dokument von SVA → Target-System
    - Test-Import in Target-System (Dry-Run)

  Week 2: Parallel-Operation
    - SVA-Studio läuft weiter
    - Target-System wird parallel betrieben
    - Sync-Mechanik für Doppel-Einträge

  Week 3: Cutover
    - Final-Export von SVA
    - Import in Target-System
    - Rollback-Option (24h window)

  Week 4: Decommission
    - SVA-Daten archiviert (7 Jahre, legal hold)
    - Accounts & Tokens widerrufen
    - Keycloak-Realm gelöscht

Portable Data Formats (nicht-proprietär):

  Organizations:
    JSON Schema (IANA-registered):
    {
      "$schema": "http://json-schema.org/draft-07/schema#",
      "type": "object",
      "properties": {
        "id": { "type": "string", "format": "uuid" },
        "name": { "type": "string" },
        "parent_id": { "type": ["string", "null"] },
        "type": { "enum": ["county", "municipality", "district"] },
        "metadata": {
          "type": "object",
          "properties": {
            "address": { "type": "string" },
            "phone": { "type": "string" },
            "email": { "type": "string" }
          }
        }
      }
    }

  Users (SCIM 2.0 Format – RFC 7643):
    {
      "schemas": ["urn:ietf:params:scim:schemas:core:2.0:User"],
      "externalId": "...",
      "id": "...",
      "userName": "max@example.de",
      "name": {
        "familyName": "Mustermann",
        "givenName": "Max"
      },
      "emails": [{ "value": "max@example.de", "primary": true }],
      "groups": [{ "value": "org-uuid", "display": "Gemeinde München" }]
    }

  Roles & Permissions (XACML 3.0 oder OPA Rego):
    XACML (XML-basiert):
    <Policy PolicyId="edit_news_policy">
      <Target>
        <AnyOf>
          <AllOf>
            <Match MatchId="function:string-equal">
              <AttributeValue DataType="string">edit_news</AttributeValue>
              <AttributeDesignator Category="action" AttributeId="action" />
            </Match>
          </AllOf>
        </AnyOf>
      </Target>
    </Policy>

    OPA Rego (JSON-rules):
    package sva.iam.permissions

    allow_edit_news {
      roles[_] = "redakteur"
      input.action = "edit_news"
      input.resource_type = "news"
    }

Audit Trail für Exit-Compliance:

  - Komplettes Audit-Log bis zum Exit-Datum
  - Digitale Signatur (alle Logs sind signed)
  - Export in CSV + PDF (gerichtsfest)
  - Hash-Verificazione möglich (keine Tampering)

Roadmap-Transparenz:

  - Public Roadmap: https://roadmap.sva-studio.de
  - Feature-Deprecation-Ankündigung: 12 Monate vorher
  - Migration-Guides für jeden deprecated Endpoint
  - Tech-Talks für Integration-Partner (Quarterly)
```

---

## 9. FEHLENDE API-ENDPUNKTE & DATENFORMATE

### 🔴 **KRITISCHE LÜCKEN**

**Folgende kritische Endpoints fehlen komplett:**

| Endpoint | Use-Case | Status | Priorität |
|----------|----------|--------|-----------|
| `PATCH /users/{id}/organization-assignment` | User zu Org hinzufügen | ❌ | P0 |
| `DELETE /users/{id}/organization/{orgId}` | User aus Org entfernen | ❌ | P0 |
| `GET /users/{id}/organizations` | Alle Orgs eines Users | ❌ | P0 |
| `GET /permissions` | Alle Permissions listing | ❌ | P1 |
| `POST /permissions/validate-scope` | ABAC-Scope validieren | ❌ | P1 |
| `GET /organizations/{id}/hierarchy-path` | Full ancestor-path | ❌ | P1 |
| `POST /users/{id}/delegate-authority` | Temporary delegation | ❌ | P2 |
| `POST /audit-logs/anomaly-detection` | Auto-Anomalien flaggen | ❌ | P2 |
| `GET /roles/{id}/implied-permissions` | Alle transitiven Perms | ❌ | P1 |
| `POST /bulk/assign-roles` | Batch-Rollenzuweisung | ❌ | P1 |

### 🎯 **EMPFEHLUNGEN: Fehlende Endpoints**

```yaml
Missing Endpoints – Implementation Roadmap:

Priority P0 (CRITICAL – vor Production):

  1. User ↔ Organization Assignment:

     GET /api/iam/v1/users/{id}/organizations
     Response:
     {
       organizations: [
         {
           id: "org-uuid",
           name: "Gemeinde München",
           role: "redakteur",
           joined_at: "2026-01-01T...",
           primary: true
         }
       ]
     }

     POST /api/iam/v1/users/{id}/organizations
     Body:
     {
       organization_id: "org-uuid",
       role: "redakteur"  # optional
     }

     DELETE /api/iam/v1/users/{id}/organizations/{org_id}

     PATCH /api/iam/v1/users/{id}/organizations/{org_id}
     Body:
     {
       role: "new_role"
     }

  2. Batch Organization Assignment:

     POST /api/iam/v1/organizations/{id}/users/bulk-assign
     Body (multipart/form-data):
     {
       file: <CSV with headers: email, role>,
       mode: "add" | "replace"  # replace = remove others
     }

     Response:
     {
       assigned: 42,
       skipped: 2,
       errors: [
         { row: 5, email: "invalid@", error: "invalid_email" }
       ]
     }

Priority P1 (HIGH – Quarter 1):

  1. Permission Validation & Inquiry:

     GET /api/iam/v1/permissions
     Query params:
       - action: "create" | "edit" | "delete" | "publish"
       - resource_type: "news" | "media" | "pages"
       - organization_id: optional

     Response:
     {
       permissions: [
         {
           id: "perm-uuid",
           action: "create",
           resource_type: "news",
           scope_template: { org: "required", category: "optional" }
         }
       ]
     }

     POST /api/iam/v1/permissions/validate-scope
     Body:
     {
       permission_id: "perm-uuid",
       scope: { org: "org-uuid", category: "sports" }
     }

     Response:
     {
       valid: true,
       conflicts: [],
       warnings: []
     }

  2. Organization Hierarchy Path:

     GET /api/iam/v1/organizations/{id}/hierarchy-path

     Response:
     {
       path: [
         { id: "root-uuid", name: "Freistaat Bayern", level: 0 },
         { id: "county-uuid", name: "Landkreis München", level: 1 },
         { id: "org-uuid", name: "Gemeinde München", level: 2 }
       ]
     }

     GET /api/iam/v1/organizations/{id}/children

     Response:
     {
       children: [
         { id: "child-1", name: "Ortsteil A" },
         { id: "child-2", name: "Ortsteil B" }
       ]
     }

  3. Role Permissions (Transitive):

     GET /api/iam/v1/roles/{id}/effective-permissions
     Query param: ?include_inherited=true

     Response:
     {
       direct_permissions: [...],
       inherited_permissions: [...],
       total: 42
     }

  4. Bulk Role Assignment:

     POST /api/iam/v1/roles/bulk-assign
     Body:
     {
       assignments: [
         { user_id: "user-1", role_id: "role-1", org_id: "org-1" },
         { user_id: "user-2", role_id: "role-2", org_id: "org-1" }
       ],
       mode: "create" | "replace"
     }

     Response:
     {
       created: 42,
       errors: []
     }

Priority P2 (MEDIUM – Quarter 2):

  1. Authority Delegation (Temporary):

     POST /api/iam/v1/users/{id}/delegate-authority
     Body:
     {
       delegate_to_user_id: "user-uuid",
       role_id: "role-uuid",
       valid_from: "2026-01-21T...",
       valid_to: "2026-01-25T...",
       reason: "User on vacation"
     }

     DELETE /api/iam/v1/users/{id}/delegations/{delegation_id}

  2. Anomaly Detection in Audit:

     POST /api/iam/v1/audit-logs/analyze-anomalies
     Body:
     {
       time_window: "24h",
       sensitivity: "high" | "medium" | "low"
     }

     Response:
     {
       anomalies: [
         {
           type: "bulk_permission_grant",
           description: "42 roles assigned in 10 minutes",
           actor_id: "admin-uuid",
           timestamp: "2026-01-21T10:00:00Z",
           severity: "high"
         }
       ]
     }

Standardized Error Responses (alle Endpoints):

  4xx Errors:
    {
      error: "validation_error",
      error_code: "INVALID_ORGANIZATION_ID",
      message: "Organization UUID format invalid",
      details: {
        field: "organization_id",
        value: "not-a-uuid"
      },
      timestamp: "2026-01-21T10:00:00Z",
      request_id: "req-uuid"
    }

  5xx Errors:
    {
      error: "internal_server_error",
      error_code: "DATABASE_CONNECTION_FAILED",
      message: "Unable to connect to database",
      details: {
        retry_after: 30
      },
      timestamp: "2026-01-21T10:00:00Z",
      request_id: "req-uuid"
    }

Rate-Limiting Headers (alle Responses):

  X-RateLimit-Limit: 1000
  X-RateLimit-Remaining: 999
  X-RateLimit-Reset: 1642769100
  X-RateLimit-RetryAfter: 3600
```

---

## 10. DATENMODELL-STABILITÄT & LANGZEIT-WARTBARKEIT

### 🟢 **GUT – Gut normalisiert & extensible**

**Positiv:**
```
✅ Hierarchische Org-Struktur (recursive parent_id)
✅ Many-to-Many User-Org Mapping (flexibel)
✅ JSONB für ABAC-Scopes (extensible)
✅ Separate Audit-Log-Tabelle (immutable)
✅ RLS-Ready (organizationId überall vorhanden)
```

**Risiken:**

1. **Temporal Constraints nicht durchdacht**
   ```
   Design spricht von validFrom/validTo in account_roles
   Aber: Wie werden "temporäre Delegationen" gespeichert?
   Separate Tabelle oder gleiche?
   Wie werden RLS-Policies bei Abfrage berücksichtigt?
   ```

2. **Audit-Log-Retention unklar**
   ```
   Design: "2 Jahre Retention"
   Problem: Wie wird "2 Jahre" enforcement?
   - Automatischer Batch-Delete?
   - Archive in S3?
   - Compliance-Hold override?
   ```

3. **Keine Versioning für Rollen/Permissions**
   ```
   Wenn Rolle "Redakteur" sich ändert:
   - Beeinträchtigt historische Audit-Logs?
   - Können wir alte Permissions rekonstruieren?
   - Time-Travel für Compliance-Audits?
   ```

### 🎯 **EMPFEHLUNG: Schema-Stabilität & Versionierung**

```yaml
Enhanced Datenmodell für Langzeit-Stabilität:

1. Temporal Tables (für Time-Travel Queries):

   CREATE TABLE iam.roles (
     id UUID PRIMARY KEY,
     name TEXT NOT NULL,
     description TEXT,
     valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     valid_to TIMESTAMP,
     system_role BOOLEAN DEFAULT false,
     -- Versioning
     version INT NOT NULL DEFAULT 1,
     parent_version INT REFERENCES iam.roles(id),  # Wenn Rolle sich ändert
     -- Audit
     created_by UUID REFERENCES iam.accounts(id),
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     modified_by UUID REFERENCES iam.accounts(id),
     modified_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   )

   -- Schema Change Tracking
   CREATE TABLE iam.schema_versions (
     version INT PRIMARY KEY,
     applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
     migration_script TEXT,
     rollback_script TEXT,
     applied_by TEXT,
     status ENUM ('pending', 'applied', 'rolled_back')
   )

2. Effective Permissions View (materialized for caching):

   CREATE MATERIALIZED VIEW iam.effective_permissions AS
   SELECT
     ar.account_id,
     ar.role_id,
     rp.permission_id,
     rp.action,
     rp.resource_type,
     rp.scope,
     ar.organization_id,
     CURRENT_TIMESTAMP as computed_at,
     -- TTL metadata for cache invalidation
     EXTRACT(EPOCH FROM NOW()) + 3600 as cache_expires_at
   FROM iam.account_roles ar
   JOIN iam.role_permissions rp ON ar.role_id = rp.role_id
   WHERE ar.valid_from <= CURRENT_TIMESTAMP
     AND (ar.valid_to IS NULL OR ar.valid_to > CURRENT_TIMESTAMP)

   -- Automatisches Refresh bei Änderungen
   CREATE TRIGGER refresh_effective_permissions
   AFTER INSERT OR UPDATE OR DELETE ON iam.account_roles
   EXECUTE FUNCTION refresh_effective_permissions_view()

3. Audit-Log mit Retention Policy:

   CREATE TABLE iam.activity_logs (
     id UUID PRIMARY KEY,
     event_type TEXT NOT NULL,
     actor_id UUID REFERENCES iam.accounts(id),
     subject_id UUID REFERENCES iam.accounts(id),
     organization_id UUID,
     details JSONB,
     -- Retention
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
     retention_expires_at TIMESTAMP,
     legal_hold BOOLEAN DEFAULT false,
     -- Compliance
     digital_signature TEXT,  # SHA256(concat(all fields))
     signature_verified_at TIMESTAMP
   )

   -- Index für Compliance-Queries
   CREATE INDEX idx_activity_logs_retention ON iam.activity_logs(retention_expires_at)
   WHERE legal_hold = false

   -- Automatic Retention Cleanup Job
   CREATE OR REPLACE FUNCTION cleanup_expired_audit_logs() RETURNS void AS $$
   BEGIN
     DELETE FROM iam.activity_logs
     WHERE retention_expires_at < CURRENT_TIMESTAMP
       AND legal_hold = false
       AND created_at < (CURRENT_TIMESTAMP - INTERVAL '2 years');
   END;
   $$ LANGUAGE plpgsql

   -- Run daily at 02:00 UTC
   SELECT cron.schedule('cleanup_audit_logs', '0 2 * * *', 'SELECT cleanup_expired_audit_logs()')

4. Schema Evolution Pattern (für Zero-Downtime Migrations):

   -- Step 1: Add new column (backward-compatible)
   ALTER TABLE iam.users ADD COLUMN phone TEXT DEFAULT NULL

   -- Step 2: Deploy code that writes to both old + new column
   UPDATE iam.users SET phone = ... FROM ...

   -- Step 3: Migrate old data
   UPDATE iam.users SET phone = phone_legacy WHERE phone IS NULL

   -- Step 4: Remove old column (after safe period)
   ALTER TABLE iam.users DROP COLUMN phone_legacy

5. Datenbank-Schema Versioning (in Code):

   migrations/
   ├── 001_initial_schema.sql
   ├── 002_add_organization_hierarchy.sql
   ├── 003_add_audit_logs.sql
   ├── 004_add_temporal_constraints.sql
   ├── ...
   └── migrations.json  # Version-Tracking

   migrations.json:
   {
     current_version: 4,
     migrations: [
       {
         version: 1,
         name: "initial_schema",
         timestamp: "2026-01-01T00:00:00Z",
         status: "applied"
       },
       {
         version: 2,
         name: "add_organization_hierarchy",
         timestamp: "2026-01-05T00:00:00Z",
         status: "applied",
         applied_at: "2026-01-05T10:00:00Z"
       }
     ]
   }

6. Backward-Compatibility für API-Responses:

   // Old API (v1) Response
   GET /api/iam/v1/users/123
   {
     id: "user-123",
     email: "max@example.de",
     roles: ["redakteur"]  # Simple string-array
   }

   // New API (v2) Response
   GET /api/iam/v2/users/123
   {
     id: "user-123",
     email: "max@example.de",
     roles: [  # Object mit Metadaten
       {
         id: "role-uuid",
         name: "redakteur",
         valid_from: "2026-01-01T...",
         valid_to: null,
         organization_id: "org-uuid"
       }
     ]
   }

   // Backward-Compatibility (v1 client nutzt v2 API):
   GET /api/iam/v2/users/123?version=v1
   Response: {"roles": ["redakteur"]}  # Kompatibel
   Header: X-API-Version: v1-compat

7. Change-Data-Capture (CDC) für externe Systeme:

   -- Postgres WAL (Write-Ahead-Log) nutzen für Change-Streaming
   -- Tools: Debezium, Logical Replication

   CREATE PUBLICATION iam_changes FOR TABLE iam.accounts, iam.roles, iam.account_roles

   -- External system (Kafka, Firehose) abonniert diese Publication
   -- → Echtzeitliche Änderungen an Partner-Systeme
```

---

## 11. API-DOKUMENTATION & SDK-QUALITÄT

### 🔴 **NICHT VORHANDEN – Kritisches Deployment-Blocker**

**Aktueller Status:**
```
❌ Kein OpenAPI/Swagger-Spec
❌ Keine GraphQL-Schema-Definition
❌ Keine SDK (Python, JavaScript, Go, etc.)
❌ Keine Postman-Collection
❌ Keine Code-Samples
❌ Keine API-Doku-Website
```

**Impact:** Integration-Partner können nicht produktiv arbeiten.

### 🎯 **EMPFEHLUNG: API-Dokumentations-Roadmap**

```yaml
API Documentation & SDK Framework:

Phase 1 (vor Production):

  1. OpenAPI 3.0 Spec:

     File: openapi/iam-api-v1.yaml

     openapi: 3.0.0
     info:
       title: SVA Studio IAM API
       version: 1.0.0
       description: "Identity & Access Management REST API"
       contact:
         name: SVA Studio Team
         url: https://support.sva-studio.de
         email: api-support@sva-studio.de

     servers:
       - url: https://api.sva-studio.de/iam
         description: Production
       - url: https://staging-api.sva-studio.de/iam
         description: Staging
       - url: http://localhost:3000/iam
         description: Local Development

     tags:
       - name: Users
         description: User management endpoints
       - name: Organizations
         description: Organization management
       - name: Roles
         description: Role & permission management
       - name: Permissions
         description: Permission checking & querying
       - name: Audit
         description: Audit log management

     paths:
       /v1/users:
         get:
           summary: List users
           operationId: listUsers
           tags: [Users]
           parameters:
             - name: organization_id
               in: query
               schema: { type: string, format: uuid }
             - name: role_id
               in: query
               schema: { type: string, format: uuid }
             - name: limit
               in: query
               schema: { type: integer, default: 100, maximum: 1000 }
             - name: offset
               in: query
               schema: { type: integer, default: 0 }
           responses:
             '200':
               description: List of users
               content:
                 application/json:
                   schema:
                     type: object
                     properties:
                       users:
                         type: array
                         items: { $ref: '#/components/schemas/User' }
                       pagination:
                         $ref: '#/components/schemas/Pagination'
             '401':
               description: Unauthorized
               content:
                 application/json:
                   schema: { $ref: '#/components/schemas/Error' }

     components:
       schemas:
         User:
           type: object
           required: [id, email, name]
           properties:
             id:
               type: string
               format: uuid
               description: User unique identifier
             email:
               type: string
               format: email
             name:
               type: string
             created_at:
               type: string
               format: date-time
             organizations:
               type: array
               items: { $ref: '#/components/schemas/Organization' }

         Organization:
           type: object
           required: [id, name]
           properties:
             id:
               type: string
               format: uuid
             name:
               type: string
             parent_id:
               type: [string, "null"]
               format: uuid
             type:
               enum: [county, municipality, district, organization]

         Pagination:
           type: object
           properties:
             limit:
               type: integer
             offset:
               type: integer
             total:
               type: integer
             next_offset:
               type: [integer, "null"]

         Error:
           type: object
           required: [error, message]
           properties:
             error:
               type: string
             message:
               type: string
             error_code:
               type: string
             details:
               type: object

       securitySchemes:
         bearerAuth:
           type: http
           scheme: bearer
           bearerFormat: JWT

  2. Postman Collection:

     File: postman/SVA-IAM-API-v1.json

     {
       "info": {
         "name": "SVA Studio IAM API",
         "version": "1.0.0"
       },
       "item": [
         {
           "name": "Users",
           "item": [
             {
               "name": "List Users",
               "request": {
                 "method": "GET",
                 "url": "{{baseUrl}}/v1/users"
               }
             }
           ]
         }
       ],
       "auth": {
         "type": "bearer",
         "bearer": [
           { "key": "token", "value": "{{accessToken}}" }
         ]
       },
       "variable": [
         { "key": "baseUrl", "value": "https://api.sva-studio.de/iam" }
       ]
     }

  3. GraphQL Schema (SDL):

     File: graphql/schema.graphql

     type Query {
       user(id: ID!): User
       users(first: Int, after: String): UserConnection!
       organization(id: ID!): Organization
       organizations(first: Int, after: String): OrganizationConnection!
       checkPermission(
         userId: ID!
         action: String!
         resourceType: String!
         context: ContextInput
       ): PermissionCheck!
       auditLogs(
         filter: AuditLogFilter
         first: Int
         after: String
       ): AuditLogConnection!
     }

     type Mutation {
       assignRole(userId: ID!, roleId: ID!): RoleAssignment!
       revokeRole(userId: ID!, roleId: ID!): RoleAssignment!
       createOrganization(input: CreateOrganizationInput!): Organization!
     }

     type Subscription {
       onRoleAssigned(organizationId: ID): RoleAssignment!
       onAuditEvent(eventType: String): AuditLog!
     }

Phase 2 (Quarter 1):

  1. SDK Generation (Auto-Generate from OpenAPI):

     Tool: OpenAPI Generator (https://openapi-generator.tech)

     Languages:
     - Python (pip install sva-iam-client)
     - JavaScript/TypeScript (npm install @sva-studio/iam-client)
     - Go (go get github.com/sva-studio/iam-client-go)
     - Java (Maven)
     - Ruby
     - C#
     - PHP

     Auto-Generated SDK Beispiel (TypeScript):

     ```typescript
     import { SVAIAMClient } from "@sva-studio/iam-client"

     const client = new SVAIAMClient({
       apiKey: process.env.SVA_API_KEY,
       baseUrl: "https://api.sva-studio.de/iam"
     })

     // List users
     const users = await client.users.list({
       organizationId: "org-uuid",
       limit: 50
     })

     // Check permission
     const allowed = await client.permissions.check({
       userId: "user-uuid",
       action: "create",
       resourceType: "news",
       context: { organizationId: "org-uuid" }
     })

     // GraphQL Query
     const result = await client.graphql({
       query: `query { user(id: "user-uuid") { email roles { name } } }`
     })
     ```

  2. API Reference Documentation (Generated from OpenAPI):

     Tool: Redoc, Swagger UI

     Website: https://api-docs.sva-studio.de/iam

     Features:
     - Interactive "Try It" buttons (OAuth 2.0 integration)
     - Code snippets in multiple languages (curl, Python, JS, Go)
     - Request/Response examples
     - Error code documentation
     - Deprecation warnings
     - Change log

  3. Developer Portal:

     https://developer.sva-studio.de/

     Sections:
     - Getting Started Guide
     - Authentication Tutorial
     - API Basics (REST, GraphQL)
     - Architecture Diagrams
     - Webhook Setup Guide
     - SDK Docs (auto-generated)
     - Code Examples & Recipes
     - FAQ
     - Support Contact

  4. Code Examples & Recipes:

     Repository: github.com/sva-studio/iam-integration-examples

     Examples:
     - Python: User Management Script
     - JavaScript: React Component for Role Selection
     - Go: CLI Tool for Bulk User Import
     - Shell: Bash Script for Token Refresh
     - Docker: Example Webhook Server

  5. Integration Testing Framework:

     Tool: Dredd (OpenAPI + Server Verification)

     npm install -g dredd

     dredd openapi/iam-api-v1.yaml http://localhost:3000 \
       --hookfiles=./test/hooks.js

     → Verifiziert dass Server OpenAPI-Spec einhält

Phase 3 (Quarter 2):

  1. Multi-Language Docs (Lokalisierung):
     - Deutsch (primary)
     - English (für Integration-Partner)
     - Französisch (EU-Kontext)

  2. Video Tutorials:
     - Authentication Flow (5 Min)
     - Creating Custom Roles (8 Min)
     - Webhook Setup (6 Min)

  3. Runbooks für Häufige Szenarien:
     - "Bulk Import von 1000 Nutzern"
     - "Webhook Retry-Konfiguration"
     - "Performance-Tuning für Permission-Checks"
```

---

## 12. INTEGRATIONS-RISIKEN & MIGRATIONSFÄHIGKEIT

### 🟡 **MITTEL – Viele Risiken identifiziert**

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Third-Party IdP-Integration (AD, SAML) nicht geplant** | High | Roadmap in Phase 2 definieren |
| **Keine Webhooks für Event-Propagation** | High | Event API implementieren (siehe #7) |
| **Fehlende Bulk-APIs** | Medium | Batch-Endpoints hinzufügen |
| **Permission-Cache-Invalidation Race Condition** | Medium | Use Event-driven invalidation |
| **No Data Portability (Export-Gaps)** | Medium | Comprehensive Export-API (siehe #5) |
| **GraphQL/REST API nicht entschieden** | Medium | Hybrid-Approach dokumentieren |
| **Audit-Log-Streaming nicht definiert** | Low | CDC mit Debezium |
| **No CLI Tool für Admin-Ops** | Low | CLI via Python SDK |

### 🎯 **EMPFEHLUNG: Integrations-Readiness Checklist**

```yaml
Pre-Launch Integration Readiness:

Datum: Vor Production-Deployment

Phase 1 Verification:
  ✅ OpenAPI Spec published & validated (Dredd)
  ✅ SDK (Python, JS) auto-generated & tested
  ✅ Postman Collection tested
  ✅ Core Endpoints working
  ✅ Error handling consistent
  ✅ Rate-limiting documented
  ✅ Auth (Bearer Token) working

Phase 2 Verification:
  ✅ Export APIs functional (Users, Orgs, Roles, Logs)
  ✅ Import APIs functional (dry-run + execute modes)
  ✅ Idempotency guaranteed
  ✅ Bulk-operation limits documented
  ✅ Webhook subscriptions working
  ✅ Event schema validated

Phase 3 Verification:
  ✅ GraphQL endpoint functional
  ✅ Subscriptions (real-time) working
  ✅ ABAC-Scope validation working
  ✅ Permission-Check < 50ms (Redis cache)
  ✅ Audit-Log queryable
  ✅ Data retention policy active

Third-Party Integration Test:
  ✅ Mock third-party system (Media-Manager) connects
  ✅ Webhook events delivered reliably
  ✅ Permission-changes reflected in 3rd party system
  ✅ Export-Import cycle succeeds
  ✅ Audit-logs captured correctly

Documentation Completeness:
  ✅ API Reference (OpenAPI UI)
  ✅ Developer Portal launched
  ✅ 5 Code Examples (Python, JS, Go, Bash, Docker)
  ✅ FAQ written (top 20 questions)
  ✅ Runbooks for Ops (Deployment, Troubleshooting, Escalation)
  ✅ Changelog maintained
  ✅ Breaking-Change policy documented

Support Readiness:
  ✅ Support-Email: api-support@sva-studio.de
  ✅ Slack Channel: #iam-integrations
  ✅ Office Hours: Weekly 1h
  ✅ SLA defined (Response Time: 4h, Resolution: 24h)
  ✅ Escalation Path defined
```

---

## 📋 ZUSAMMENFASSUNG & RECOMMENDATIONS

### Gesamtbewertung: **🟡 MITTEL (65%)**

**Go/No-Go für Production:**

```
🟡 CONDITIONAL GO – mit folgenden Verbesserungen:

MUSS VOR LAUNCH (BLOCKER):

  1. ✅ Export/Import APIs (für Exit-Readiness)
     Status: ❌ FEHLT → Task hinzufügen
     Timeline: +3 Wochen

  2. ✅ OpenAPI Spec + SDK
     Status: ❌ FEHLT → Auto-Generated (1 Woche)
     Timeline: +1 Woche

  3. ✅ Event/Webhook Framework
     Status: ❌ FEHLT → New Spec (2 Wochen)
     Timeline: +2 Wochen

  4. ✅ API-Versionierungsstrategie
     Status: 🟡 TEILWEISE → Dokumentieren (3 Tage)
     Timeline: +3 Tage

SOLLTE VOR LAUNCH (HIGH PRIORITY):

  5. ⏳ JWT-Claims Standardisierung
     Status: 🟡 TEILWEISE → Finalisieren
     Timeline: +5 Tage

  6. ⏳ Bulk-Operation APIs
     Status: ❌ FEHLT → Add endpoints
     Timeline: +1 Woche

KANN NACH LAUNCH (ROADMAP):

  7. ⏳ SAML/LDAP/AD Integration
     Timeline: Q2 2026

  8. ⏳ SCIM 2.0 Support
     Timeline: Q2 2026

  9. ⏳ Passkey/WebAuthn Support
     Timeline: Q3 2026
```

### Recommendations nach Priorität:

**P0 (Critical – do not launch without):**

1. **Implement Export/Import Framework** (weeks 1-3)
   - JSON exports for Orgs, Users, Roles
   - CSV import with validation
   - Idempotency guarantees
   - Detailed error reporting

2. **Generate OpenAPI + SDKs** (week 1)
   - OpenAPI 3.0 spec
   - Auto-generate: Python, TypeScript, Go
   - Publish on developer portal

3. **Design Event/Webhook API** (weeks 2-3)
   - Kafka/Redis topic design
   - Webhook subscription REST API
   - GraphQL subscriptions
   - Retry + dead-letter-queue

4. **Document API-Versioning & Deprecation** (days 1-3)
   - URL versioning pattern
   - 6-month deprecation window
   - Communication process

**P1 (High – within Q1 2026):**

5. Finalize JWT Claims Schema
6. Add Bulk-Operation Endpoints
7. GraphQL Schema & Endpoint
8. Permission-Cache implementation verification
9. Rate-limiting policy definition

**P2 (Medium – Q2 2026):**

10. SAML/LDAP/AD Federation
11. SCIM 2.0 Provisioning
12. Multi-language API docs
13. Video tutorials

---

## 🔗 **NEXT STEPS**

1. **Stakeholder Review** (Diese Findings)
   - Architecture Team: API-Design entscheidung
   - Security Team: JWT-Claims validation
   - Operations Team: Event-streaming architecture

2. **Task Integration**
   - Export/Import APIs als neue Tasks hinzufügen (3 Woche)
   - OpenAPI-Generation in CI/CD einbauen
   - Webhook-Implementation in Phase-3-Tasks

3. **Vendor-Readiness Review** (Nach Fixes)
   - Re-Review dieser Interoperability-Findings
   - Go-Decision für Production

4. **Partner-Communication Plan**
   - Ankündigung der API (mit OpenAPI Spec)
   - Developer Portal Launch
   - Webhook Beta-Program starten

---

## 📞 CONTACT & FEEDBACK

**Interoperability Review Lead:** [Name]
**Date:** 21. Januar 2026
**Document Version:** 1.0
**Glossary:** [openspec/AGENTS.md](openspec/AGENTS.md)

**Approval Gate:**
- [ ] Architecture Review
- [ ] Security Review (Cryptography, JWT, RLS)
- [ ] Operations Review (Runbooks, Monitoring)
- [ ] Product Review (Roadmap-Alignment)
- [ ] Stakeholder Sign-off

---

**Status:** 🟡 **CONDITIONAL APPROVAL**
**Recommendation:** Launch mit P0-Fixes, P1-Items in Q1 2026 nachlagern
