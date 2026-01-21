# Tasks: setup-iam-identity-auth

## Phase 1: Keycloak-Integration und IAM-Service-Architektur

### 1.1 Keycloak-Konfiguration

- [ ] 1.1.1 OIDC-Client im Keycloak für SVA Studio erstellen
- [ ] 1.1.2 Redirect-URIs konfigurieren (dev, staging, prod)
- [ ] 1.1.3 Web Origins für CORS festlegen
- [ ] 1.1.4 Client-Scopes definieren (openid, profile, email, roles, org)
- [ ] 1.1.5 Keycloak-Mappers für Role- und Organization-Claims konfigurieren

### 1.2 IAM-Service-Grundstruktur

- [ ] 1.2.1 `packages/core/src/iam/` Verzeichnis struktu­rieren
- [ ] 1.2.2 Token-Validator implementieren (JWT-Verifizierung mit Keycloak Public Key)
- [ ] 1.2.3 User-Context-Resolver entwickeln (Claims auslesen, User-ID bereitstellen)
- [ ] 1.2.4 Keycloak-Config-Management (URL, Realm, Client-ID)
- [ ] 1.2.5 Error-Handling für invalid/expired Tokens

### 1.3 Frontend-Integration

- [ ] 1.3.1 OIDC-Library wählen (@react-oauth/google oder equivalent)
- [ ] 1.3.2 Login-Flow im SVA Studio implementieren
- [ ] 1.3.3 Session/Token-Speicherung (Memory + localStorage strategy)
- [ ] 1.3.4 Logout-Flow implementieren
- [ ] 1.3.5 Token-Refresh-Mechanik

### 1.4 Backend-Authentication-Middleware

- [ ] 1.4.1 Express/Framework-Middleware für Token-Validierung schreiben
- [ ] 1.4.2 Protected-Routes etablieren
- [ ] 1.4.3 User-Context in Request-Object injizieren
- [ ] 1.4.4 Unit-Tests für Token-Validierung

### 1.5 Security & Testing

- [ ] 1.5.1 HTTPS-Konfiguration für lokal und in allen Umgebungen
- [ ] 1.5.2 SSO-Flow testen (Multi-Tab, Session-Konsistenz)
- [ ] 1.5.3 Token-Expiration und Refresh testen
- [ ] 1.5.4 E2E-Tests für Login-Logout-Szenarios
- [ ] 1.5.5 Security-Audit (Token-Claims, No Secrets in Frontend)

---

## Phase 2: Organisationsstruktur und Benutzer-Mapping

### 2.1 Datenmodellierung

- [ ] 2.1.1 `iam.organizations` Tabelle mit Hierarchie (`parentOrganizationId`)
- [ ] 2.1.2 `iam.accounts` Tabelle mit Keycloak-User-ID-Mapping
- [ ] 2.1.3 `iam.account_organizations` Junction-Tabelle (Many-to-Many)
- [ ] 2.1.4 Row-Level-Security (RLS) Policies für Multi-Tenancy
- [ ] 2.1.5 Indexes für Performance (userId, organizationId, hierarchyLevel)
- [ ] 2.1.6 Migrations-Skripte (Flyway/Alembic)

### 2.2 Account-Synchronisation (Just-in-Time Provisioning)

- [ ] 2.2.1 First-Login-Hook im IAM-Service implementieren
- [ ] 2.2.2 Account aus Keycloak-JWT erstellen (keycloakId → PK)
- [ ] 2.2.3 Basis-Profildaten übernehmen (email, name, preferred_username)
- [ ] 2.2.4 Default-Organisation zuweisen (oder User-Eingabe in UI)
- [ ] 2.2.5 Activity-Log für Account-Erstellung

### 2.3 Organization-Assignment-Logik

- [ ] 2.3.1 UI für Admin: Nutzer zu Organisationen zuweisen
- [ ] 2.3.2 Bulk-Assignment ermöglichen (CSV-Import)
- [ ] 2.3.3 Verification: User kann nur Inhalte seiner Orgs sehen
- [ ] 2.3.4 Query-Scoping implementieren (immer `organizationId` in WHERE-Clause)
- [ ] 2.3.5 Tests für Org-Isolation (Multi-Tenant-Sicherheit)

### 2.4 Hierarchie-Support

- [ ] 2.4.1 Hierarchie-Navigation (Parent/Children) in Datenbank-Abfragen
- [ ] 2.4.2 Ancestor-Lookup für Berechtigungsprüfung
- [ ] 2.4.3 Organization-Tree UI-Komponente
- [ ] 2.4.4 Tests für 3+ Ebenen (County → Municipality → District → Org)

---

## Phase 3: Rollenmodell und Berechtigungslogik

### 3.1 Rollen-Datenmodellierung

- [ ] 3.1.1 `iam.roles` Tabelle (system vs. custom)
- [ ] 3.1.2 `iam.permissions` Tabelle (action, resource_type, scope)
- [ ] 3.1.3 `iam.role_permissions` Junction-Tabelle
- [ ] 3.1.4 `iam.account_roles` mit temporal constraints (validFrom, validTo)
- [ ] 3.1.5 Seed-Daten für 7 System-Personas

### 3.2 7-Personas-System implementieren

- [ ] 3.2.1 System-Administrator Persona (vollständige Rechte)
- [ ] 3.2.2 App-Manager Persona (Org-Management, Accounts)
- [ ] 3.2.3 Designer Persona (Branding, Layout)
- [ ] 3.2.4 Redakteur Persona (Content-CRUD)
- [ ] 3.2.5 Interface-Manager Persona (API, Integrations)
- [ ] 3.2.6 Moderator Persona (Community, Support)
- [ ] 3.2.7 Strategischer Entscheider Persona (Read-Only Reporting)

### 3.3 RBAC Engine

- [ ] 3.3.1 `canUserPerformAction(user, action, resource, context)` Funktion
- [ ] 3.3.2 Role-Lookup aus DB für User + Organization
- [ ] 3.3.3 Permission-Aggregation (alle Rollen mates)
- [ ] 3.3.4 Scope-Matching (org, geo, time-based)
- [ ] 3.3.5 Performance-Optimierung (< 50ms)

### 3.4 ABAC Engine (Attribute-Based Access Control)

- [ ] 3.4.1 Attribute-Definition (action, resource, context-attrs)
- [ ] 3.4.2 Policy-Engine für conditional Permissions
- [ ] 3.4.3 Examples: "edit news only in category:sport", "view reports only 9-17h"
- [ ] 3.4.4 Tests für ABAC-Szenarien

### 3.5 Hierarchische Rechte-Vererbung

- [ ] 3.5.1 Vererbungslogik implementieren (parent org → child org)
- [ ] 3.5.2 Scope-Level definieren (system, county, municipality, org_only)
- [ ] 3.5.3 Override-Mechanik (untere Ebene kann einschränken, aber nicht erweitern)
- [ ] 3.5.4 Vererb­ung-Visualisierung (Admin-UI)
- [ ] 3.5.5 Tests für 3-Level Hierarchien

### 3.6 Audit-Logging

- [ ] 3.6.1 `iam.activity_logs` Tabelle (immutable)
- [ ] 3.6.2 Alle IAM-Events loggen (role change, login, permission update)
- [ ] 3.6.3 Activity-Log Export (CSV, JSON)
- [ ] 3.6.4 Admin-Dashboard für Audit-Queries
- [ ] 3.6.5 Data-Retention-Policy (z.B. 2 Jahre)

### 3.7 Permission-Cache (Redis)

- [ ] 3.7.1 Redis-Cluster-Integration planen
- [ ] 3.7.2 Permission-Snapshot pro User+Org cachen
- [ ] 3.7.3 Cache-Invalidation bei Rollenänderungen
- [ ] 3.7.4 Fallback zu DB bei Cache-Miss
- [ ] 3.7.5 Tests für Cache-Konsistenz

### 3.8 Testing & Documentation

- [ ] 3.8.1 Unit-Tests für alle Personas
- [ ] 3.8.2 Unit-Tests für RBAC/ABAC Engine
- [ ] 3.8.3 Integration-Tests für Vererbung
- [ ] 3.8.4 E2E-Tests für Permission-Denials
- [ ] 3.8.5 Developer-Dokumentation (SDK, API, Examples)
- [ ] 3.8.6 Admin-Dokumentation (Role-Management, Audit)

---

## Acceptance Criteria

- ✅ Phase 1: Ein Nutzer kann sich über Keycloak anmelden, Token wird validiert, User-Context ist verfügbar
- ✅ Phase 2: Nutzer ist automatisch zu seiner Organisation zugeordnet, Org-Isolation funktioniert
- ✅ Phase 3: Ein Redakteur kann mit seiner Rolle News erstellen, sieht nur erlaubte Operationen, Audit-Log dokumentiert alles
- ✅ Alle Unit-Tests grün, E2E-Tests für kritische Flows
- ✅ Performance: Permission-Checks < 50ms

---

**Last Updated:** 21. Januar 2026
