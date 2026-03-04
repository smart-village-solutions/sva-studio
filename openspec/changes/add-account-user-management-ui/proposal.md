# Change: Account- und User-Management-UI für SVA Studio

## Zusammenfassung

Dieses Proposal führt die vollständige Benutzeroberfläche für Account-Verwaltung, User-Administration und Rollen-Management im SVA Studio ein. Es umfasst sowohl die Frontend-Komponenten als auch die dafür notwendigen Backend-Services (IAM-Service, Keycloak Admin API Integration, Datenbank-Schema). Das Newcms dient als funktionale Referenz – die Implementierung erfolgt nativ nach Studio-Konventionen.

## Why

Das SVA Studio hat bislang **keine Account- oder User-Management-Oberfläche**. Die bestehende Auth-Infrastruktur (`@sva/auth`) deckt nur Login/Logout ab – es fehlen:

- **Self-Service-Profil:** Nutzer können ihr eigenes Profil nicht einsehen oder bearbeiten
- **Zentraler Auth-State:** Kein `useAuth()`-Hook – jede Komponente macht eigene `fetch('/auth/me')`-Aufrufe
- **User-Administration:** Admins können keine Nutzer verwalten (anlegen, bearbeiten, deaktivieren)
- **Rollen-Verwaltung:** Keine UI für die Zuweisung und Verwaltung der 7 Personas bzw. Custom-Rollen
- **Berechtigungs-Übersicht:** Keine Darstellung der effektiven Berechtigungen eines Nutzers

Im Newcms existiert ein funktionierender Mock dieser Features (PersonsView, AccountEditView mit 4 Tabs, RolesView). Dieser dient als bewährte UX-Referenz, wird aber nicht 1:1 portiert, sondern nach Studio-Patterns (TanStack Router, i18n, Tailwind + shadcn/ui) neu implementiert.

## What Changes

### Frontend – Neue Capability `account-ui`

- **AuthProvider + `useAuth()` Hook:** Zentraler React-Context für Auth-State, ersetzt verteilte `fetch('/auth/me')`-Aufrufe
- **Protected-Route-Guard:** Generische rollenbasierte Route-Protection als Wrapper
- **Account-Profilseite (`/account`):** Eigenes Profil anzeigen und Basis-Daten (Name, Telefon, Organisation) bearbeiten; Sicherheits-Daten (Passwort, MFA, E-Mail) werden an die Keycloak Account Console delegiert
- **User-Admin-Liste (`/admin/users`):** Tabelle aller Nutzer mit Suche, Status-Filter, Sortierung, Bulk-Aktionen
- **User-Bearbeitungsseite (`/admin/users/:userId`):** 4-Tab-Ansicht (Persönliche Daten, Verwaltung, Berechtigungen, Historie) – angelehnt an das Newcms-AccountEditView-Konzept
- **Rollen-Verwaltungs-UI (`/admin/roles`):** Übersicht der System- und Custom-Rollen mit Berechtigungs-Matrix

### Backend – IAM-Service-Endpunkte

- **User-CRUD-API:** Server-Funktionen für Nutzer-Listing, -Erstellung, -Bearbeitung, -Deaktivierung – basierend auf der CMS-eigenen IAM-Datenbank **und** Keycloak-Synchronisation
- **Keycloak Admin API Client:** Abstraktions-Layer für Keycloak Admin REST API (User-Provisioning, Rollen-Zuweisung, Account-Aktionen)
- **Rollen/Permissions-API:** CRUD für Rollen und Berechtigungs-Zuweisungen gegen `iam.roles` / `iam.permissions`
- **Profil-Update-API:** Endpunkt für Self-Service-Profilbearbeitung (schreibt in IAM-DB + Keycloak)

### Datenbank-Schema (Postgres, Delta-Migration)

Das bestehende Schema (`0001_iam_core.sql`) liefert bereits Multi-Tenancy (`instance_id` + RLS), PII-Verschlüsselung (`*_ciphertext`, ADR-010) und Activity-Logging. Diese Migration **ergänzt** das Schema:

- **`iam.accounts` (ALTER TABLE):** bestehende `instance_id`-Bindung nutzen (Accounts sind instanzgebunden); zusätzliche Profilfelder (`first_name_ciphertext`, `last_name_ciphertext`, `phone_ciphertext`, `position`, `department`, `status`, etc.); Unique-Constraint auf `(keycloak_subject, instance_id)` statt global-unique `keycloak_subject`
- **`iam.account_roles` (ALTER TABLE):** Temporale Constraints (`valid_from`, `valid_to`, `assigned_by`)
- **`iam.activity_logs` (ALTER TABLE):** `subject_id`- und `result`-Spalte; Immutabilitäts-Trigger
- **`iam.instances` (ALTER TABLE):** getrennte Retention-Konfiguration für DSGVO-Anonymisierung (`retention_days`, Default 90) und Audit-Archivierung (`audit_retention_days`, Default 365)
- **Performance-Indizes:** Für `status`, `keycloak_subject`, Activity-Log-Queries

### Nicht im Scope (explizit ausgeklammert)

- **Hierarchische Org-Vererbung:** Phase 2 von `setup-iam-identity-auth`
- **ABAC-Engine:** Attributbasierte Zugriffskontrolle bleibt in Phase 3 von `setup-iam-identity-auth`
- **Audit-Dashboard:** Nur grundlegendes Activity-Logging im History-Tab
- **Externe IdP-Integration (AD, BundID):** Spätere Phase
- **DSGVO-Datenexport (Art. 20):** Wird als separater Change nachgerüstet
- **SCIM 2.0-Konformität:** Bewusst nicht in Phase 1 (spätere Kompatibilitätsschicht geplant)

> **Hinweis Multi-Tenancy:** Das bestehende IAM-Schema enthält bereits `instance_id` auf allen Tabellen mit RLS-Policies. Diese Infrastruktur wird genutzt, nicht nachgerüstet.

## Qualitäts- und Compliance-Leitplanken

- **Typsicherheit:** Typsicheres Routing (Path- und Search-Params) in `@sva/routing`; keine untypisierten Route-Strings in UI-Code
- **Sicherheit:** Input-Validierung für alle IAM-Endpunkte (Client + Server); CSRF-Schutz (`SameSite=Lax` + Custom-Header `X-Requested-With`, siehe ADR) für alle mutierenden Endpunkte; Privilege-Escalation-Schutz mit expliziter Rollen-Hierarchie (Level-Tabelle); Rate Limiting pro authentifizierter User-ID (60 req/min Read, 10 req/min Write, 3 req/min Bulk); Idempotency-Key-Verarbeitung für duplikatskritische Create/Bulk-Endpunkte
- **API-Versionierung:** Alle IAM-Endpunkte unter `/api/v1/iam/...` (Prefix-Versionierung)
- **Logging:** Operative Server-Logs ausschließlich über SDK Logger (`@sva/sdk`), keine `console.*`-Nutzung
- **PII-Schutz:** Keine Klartext-PII in operativen Logs; PII-Felder ausschließlich als `*_ciphertext` in der DB (ADR-010); Audit-Logs folgen den bestehenden IAM-Redaktionsregeln
- **Internationalisierung:** Keine hardcodierten UI-Texte, ausschließlich `t('...')`
- **UI-Komponenten-Standard:** Interaktive Basisbausteine (Dialog, Dropdown, Tabs, Table, Form Controls, Badge) basieren auf `shadcn/ui`-Patterns; keine parallel eingeführte eigene Komponentenbibliothek im Scope dieses Changes
- **Barrierefreiheit:** UI-Flows für Profil, User- und Rollenverwaltung erfüllen WCAG 2.1 AA / BITV 2.0
- **Responsive Design:** Alle Views responsive ab 320px Viewport-Breite (Desktop-Tabelle → Mobile-Cards)

## Impact

### Neue Specs

- `account-ui` – Neue Capability für die gesamte Account- und User-Management-Oberfläche

### Betroffene Specs (modifiziert)

- `iam-core` – Erweiterung um AuthProvider, Self-Service-Profilbearbeitung und IAM-Service-Endpunkte

### Betroffene Packages

- **`packages/auth/`** – Keycloak Admin API Client, `IdentityProviderPort`-Interface und `KeycloakAdapter`, Profil-Update-Endpunkte, IAM-Service
- **`packages/core/`** – User/Permission-Typen (`IamAccountProfile`, `IamRole`, `IamPermission`), IAM-Datenmodell-Typen
- **`packages/data/`** – Framework-agnostische IAM-Typen und Delta-Migration
- **`packages/routing/`** – Route-Factories für `/account`, `/admin/users`, `/admin/roles`
- **`apps/sva-studio-react/`** – `AuthProvider`, `useAuth()`, `useUsers()`, `useRoles()` Hooks; UI-Komponenten (Profil, User-Liste, User-Edit, Rollen-Verwaltung)

### Betroffene arc42-Abschnitte

- `05-building-block-view` – Neue IAM-Service-Komponente und UI-Module
- `06-runtime-view` – Keycloak-First-Sync, Circuit-Breaker-Flows, JIT-Provisioning
- `07-deployment-view` – IAM-Topologie, Keycloak-Service-Account-Konfiguration
- `08-cross-cutting-concepts` – Auth-Provider-Pattern, Permission-Checking-Muster, CSRF-Strategie
- `09-architecture-decisions` – Keycloak Admin API, Hybrid-Profilbearbeitung, Sync-Strategie (ADR-015), CSRF-Strategie, IdP-Abstraktionsschicht, Rollen-Hierarchie
- `10-quality-requirements` – Verfügbarkeits-SLOs, Barrierefreiheits-Anforderungen
- `11-risks-and-technical-debt` – Keycloak-Sync-Risiko, Audit-Log-Wachstum, Keycloak-UX-Abhängigkeit

### Abhängigkeiten

- **`setup-iam-identity-auth` Phase 1** (65% fertig) – OIDC-Login, Redis-Sessions → **Voraussetzung**
- **`setup-iam-identity-auth` Phase 2** (0%) – Org-Schema → **Nicht blockierend**, Org-Scoping wird später nachgerüstet
- **`refactor-plugin-sdk-boundary`** – SDK-Grenze muss klar sein für Hook-Platzierung → **Zu koordinieren** (Hooks vorerst in `sva-studio-react`, Migration bei SDK-Grenzänderung)

### Breaking Changes

- **`Header.tsx` und `index.tsx`** werden refactored: Bestehende `fetch('/auth/me')`-Aufrufe werden durch `useAuth()` ersetzt
- **API-Pfad-Migration:** Bestehende IAM-Endpunkte (`/iam/authorize`, `/iam/me/permissions`) werden auf `/api/v1/iam/...` migriert (einheitliche Prefix-Versionierung)
- **API-Error-Format-Harmonisierung:** Bestehendes `IamApiErrorResponse` wird auf das neue einheitliche `ApiErrorResponse`-Envelope-Format migriert

## Referenz

- **Newcms User-Verwaltung:** `Newcms/src/components/PersonsViewNew.tsx`, `account/AccountEditView.tsx`, `RolesView.tsx` – dient als UX-Referenz, wird nicht 1:1 portiert
- **IAM-Konzept:** `concepts/konzeption-cms-v2/03_Systemarchitektur/Umsetzung-Rollen-Rechte.md`
- **Bestehender IAM-Change:** `openspec/specs/iam-core/spec.md` (archiviert aus `setup-iam-identity-auth`)

---

**Status:** 📋 Proposal (überarbeitet nach Review v3)
