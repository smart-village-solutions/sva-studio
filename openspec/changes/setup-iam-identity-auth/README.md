# 🔐 IAM Initiative: Keycloak-Integration & Berechtigungssystem

## Überblick

Diese Änderung etabliert die **komplette Identity & Access Management (IAM) Architektur** für das SVA Studio. Sie umfasst drei integrierte Phasen:

1. **Phase 1:** Keycloak-Integration + OIDC-Authentication
2. **Phase 2:** Mandantenfähige Organisationsstruktur
3. **Phase 3:** Rollenmodell + RBAC/ABAC + Audit-Logging

---

## 📋 Proposal Details

| Feld | Wert |
|------|------|
| **Change-ID** | `setup-iam-identity-auth` |
| **Status** | 🟡 Proposal (bereit für Review) |
| **Impact** | Foundation für alle nachfolgenden Module |
| **Scope** | 3 Phasen, ~100 Task-Items |
| **Validation** | ✅ Passed (openspec validate --strict) |

---

## 📁 Struktur

```
openspec/changes/setup-iam-identity-auth/
├── proposal.md              # Geschäftsziele, Impact, Why/What
├── design.md                # Technische Architektur & Entscheidungen
├── tasks.md                 # Detaillierte Implementierungs-Checkliste (100 Items)
└── specs/                   # Spec-Deltas pro Capability
    ├── iam-core/
    │   └── spec.md          # Keycloak, Token-Validation, SSO
    ├── iam-organizations/
    │   └── spec.md          # Org-Hierarchien, Multi-Tenancy, RLS
    ├── iam-access-control/
    │   └── spec.md          # RBAC, ABAC, 7-Personas, Permissions
    └── iam-auditing/
        └── spec.md          # Immutable Logs, Retention, Queries
```

---

## 🎯 Kernziele

### ✅ Sicherheit & Governance
- Zentrale Authentifizierung via Keycloak (OIDC)
- Single Sign-On für App + CMS
- Granulare rollenbasierte Zugriffskontrolle (RBAC)
- Attributbasierte Zugriffskontrolle (ABAC)
- Revisionssichere Audit-Logs

### ✅ Mandantenfähigkeit
- Multi-Organization Support mit hierarchischen Strukturen
- Row-Level Security (RLS) für Datenisolation
- Automatische Benutzer-Zuordnung (Just-in-Time Provisioning)

### ✅ Benutzerfreundlichkeit
- Nahtlose Login-Erfahrung
- 7 vordefinierte Personas (Rollen)
- Selbstverwaltung von Profilen

### ✅ Skalierbarkeit
- Permission-Caching mit Redis (< 50ms)
- Effiziente Datenbank-Queries
- Horizontale Skalierbarkeit

---

## 📊 Phasen-Übersicht

### 🔹 Phase 1: Keycloak-Integration

**Fokus:** Authentifizierung & Token-Management

- OIDC-Client-Konfiguration im Keycloak
- Token-Validator im Backend
- Frontend Login-Flow
- SSO/2FA-Aktivierung
- Backend-Middleware für Protected Routes

**Deliverables:**
- ✅ Benutzer kann sich anmelden
- ✅ Token wird validiert
- ✅ User-Context ist verfügbar
- ✅ Logout funktioniert

**Tasks:** 1.1–1.5 (≈20 Items)

---

### 🔹 Phase 2: Organisationen & Benutzer-Mapping

**Fokus:** Datenbankschema, Multi-Tenancy, JIT Provisioning

- `iam.organizations` Tabelle (hierarchisch)
- `iam.accounts` Tabelle (Keycloak-Mapping)
- Row-Level Security (RLS) Policies
- First-Login Account-Erstellung
- Organization-Zuweisung für Nutzer

**Deliverables:**
- ✅ Admin kann Nutzer zu Orgs zuordnen
- ✅ Org-Isolation funktioniert (RLS)
- ✅ Just-in-Time Provisioning aktiv
- ✅ Multi-Org Memberships möglich

**Tasks:** 2.1–2.4 (≈20 Items)

---

### 🔹 Phase 3: Rollen, Permissions & Audit

**Fokus:** Berechtigungslogik, 7-Personas, Audit-Logging

- 7 System-Personas (Administrator, App-Manager, Designer, Redakteur, etc.)
- RBAC-Engine (rollenbasierte Zugriffskontrolle)
- ABAC-Engine (attributbasierte Zugriffskontrolle)
- Hierarchische Rechte-Vererbung
- Immutable Activity Logs
- Permission-Caching (Redis)

**Deliverables:**
- ✅ Ein Redakteur kann mit seiner Rolle News erstellen
- ✅ Ein Admin sieht vollständige Org-Hierarchie
- ✅ Permission-Checks < 50ms (Cache)
- ✅ Audit-Logs dokumentieren alles

**Tasks:** 3.1–3.8 (≈60 Items)

---

## 🏗️ Technische Architektur

### Backend Stack

```
packages/core/src/iam/
├── token/           → JWT-Validierung, Token-Refresh
├── identity/        → User-Context, Account-Resolver
├── access-control/  → RBAC/ABAC Engine, Permission-Checker
├── middleware/      → Express Auth-Middleware
└── config/          → Keycloak-Konfiguration
```

### Datenbank (Postgres/Supabase)

```sql
iam.organizations        -- Hierarchische Org-Strukturen
iam.accounts             -- User + Keycloak-Mapping
iam.account_organizations -- Many-to-Many Memberships
iam.roles                -- System + Custom Rollen
iam.permissions          -- Permissions
iam.role_permissions     -- Role ↔ Permission Mapping
iam.account_roles        -- User ↔ Role mit Temporal Constraints
iam.activity_logs        -- Immutable Audit-Logs
```

### Cache (Redis)

```
iam:permissions:{userId}:{organizationId}  → Set<Permission>
iam:roles:{userId}:{organizationId}        → Set<RoleId>
iam:user_orgs:{userId}                     → Set<OrgId>
```

---

## 🚀 Nächste Schritte

### 1. Review & Approval (jetzt)
- [ ] Stakeholder Review des Proposals
- [ ] Tech-Review des Designs (Architektur, Security)
- [ ] Klärung der Open Questions (siehe design.md)

### 2. Vorbereitung
- [ ] Keycloak-Instanz + Admin-Zugriff verfügbar?
- [ ] Postgres/Supabase-Schema-Migrations-Workflow?
- [ ] Redis-Cluster für Production?
- [ ] Team-Assignments für 3 Phasen?

### 3. Implementierung (geplant)
- [ ] Phase 1 vollständig (mit Tests & Integration)
- [ ] Phase 2 vollständig (mit RLS-Validation)
- [ ] Phase 3 vollständig (mit Performance-Tests)

---

## 🔒 Security Considerations

- ✅ **Token Storage:** HttpOnly Cookies (nicht LocalStorage)
- ✅ **CSRF Protection:** CSRF-Token für state-changing Ops
- ✅ **RLS Enforcement:** Datenbank-Level Isolation
- ✅ **Audit Trail:** Immutable Logs für forensics
- ✅ **Permission Caching:** TTL + Invalidation-Events

---

## 📖 Dokumente

- **proposal.md** – Geschäftliche Begründung und Impact-Analyse
- **design.md** – Technische Entscheidungen, Architektur, Risks & Mitigations
- **tasks.md** – Implementierungs-Checkliste (100 Items, nach Phase gegliedert)
- **specs/** – Detaillierte Requirements mit Szenarien

---

## ✨ Approval Gate

Bitte bestätigen Sie folgende Punkte vor Start der Implementierung:

- ❓ Ist die dreiphasige Aufteilung sinnvoll?
- ❓ Sind die technischen Entscheidungen (Keycloak, Redis, RLS) akzeptabel?
- ❓ Sind die 7 Personas und deren Permissions korrekt?
- ❓ Gibt es noch Fragen zum Design?

---

**Created:** 21. Januar 2026  
**Validation:** ✅ Passed (openspec validate --strict)  
**Status:** 🟡 Ready for Review
