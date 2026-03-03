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

Im Newcms existiert ein funktionierender Mock dieser Features (PersonsView, AccountEditView mit 4 Tabs, RolesView). Dieser dient als bewährte UX-Referenz, wird aber nicht 1:1 portiert, sondern nach Studio-Patterns (TanStack Router, i18n, Design-System) neu implementiert.

## What Changes

### Frontend – Neue Capability `account-ui`

- **AuthProvider + `useAuth()` Hook:** Zentraler React-Context für Auth-State, ersetzt verteilte `fetch('/auth/me')`-Aufrufe
- **Protected-Route-Guard:** Generische rollenbasierte Route-Protection als Wrapper
- **Account-Profilseite (`/account`):** Eigenes Profil anzeigen und Basis-Daten (Name, Telefon, Organisation) bearbeiten; Sicherheits-Daten (Passwort, MFA, E-Mail) werden an die Keycloak Account Console delegiert
- **User-Admin-Liste (`/admin/users`):** Tabelle aller Nutzer mit Suche, Status-Filter, Sortierung, Bulk-Aktionen
- **User-Bearbeitungsseite (`/admin/users/:id`):** 4-Tab-Ansicht (Persönliche Daten, Verwaltung, Berechtigungen, Historie) – angelehnt an das Newcms-AccountEditView-Konzept
- **Rollen-Verwaltungs-UI (`/admin/roles`):** Übersicht der System- und Custom-Rollen mit Berechtigungs-Matrix

### Backend – IAM-Service-Endpunkte

- **User-CRUD-API:** Server-Funktionen für Nutzer-Listing, -Erstellung, -Bearbeitung, -Deaktivierung – basierend auf der CMS-eigenen IAM-Datenbank **und** Keycloak-Synchronisation
- **Keycloak Admin API Client:** Abstraktions-Layer für Keycloak Admin REST API (User-Provisioning, Rollen-Zuweisung, Account-Aktionen)
- **Rollen/Permissions-API:** CRUD für Rollen und Berechtigungs-Zuweisungen gegen `iam.roles` / `iam.permissions`
- **Profil-Update-API:** Endpunkt für Self-Service-Profilbearbeitung (schreibt in IAM-DB + Keycloak)

### Datenbank-Schema (Postgres)

- **`iam.accounts`:** User-Stammdaten mit Keycloak-ID-Mapping (JIT-Provisioning beim Erst-Login)
- **`iam.roles` + `iam.role_permissions`:** Rollen-Definitionen inkl. 7-Personas-Seed-Daten
- **`iam.account_roles`:** User-Rollen-Zuordnung mit temporalen Constraints
- **RLS-Policies:** Row-Level-Security für Multi-Tenancy-Vorbereitung

### Nicht im Scope (explizit ausgeklammert)

- **Multi-Tenancy / Org-Scoping:** Wird später mit `setup-iam-identity-auth` Phase 2 nachgerüstet
- **ABAC-Engine:** Attributbasierte Zugriffskontrolle bleibt in Phase 3 von `setup-iam-identity-auth`
- **Hierarchische Org-Vererbung:** Nicht in der ersten Version
- **Audit-Dashboard:** Nur grundlegendes Activity-Logging im History-Tab
- **Externe IdP-Integration (AD, BundID):** Spätere Phase

## Impact

### Neue Specs

- `account-ui` – Neue Capability für die gesamte Account- und User-Management-Oberfläche

### Betroffene Specs (modifiziert)

- `iam-core` – Erweiterung um AuthProvider, Self-Service-Profilbearbeitung und IAM-Service-Endpunkte

### Betroffene Packages

- **`packages/auth/`** – Keycloak Admin API Client, Profil-Update-Endpunkte, IAM-Service
- **`packages/core/`** – User/Permission-Typen, IAM-Datenmodell-Typen
- **`packages/data/`** – AuthProvider, `useAuth()`, `useUsers()`, `useRoles()` Hooks
- **`packages/routing/`** – Route-Factories für `/account`, `/admin/users`, `/admin/roles`
- **`apps/sva-studio-react/`** – UI-Komponenten (Profil, User-Liste, User-Edit, Rollen-Verwaltung)

### Betroffene arc42-Abschnitte

- `05-building-block-view` – Neue IAM-Service-Komponente und UI-Module
- `08-cross-cutting-concepts` – Auth-Provider-Pattern, Permission-Checking-Muster
- `09-architecture-decisions` – Keycloak Admin API vs. reine DB-Verwaltung, Hybrid-Profilbearbeitung

### Abhängigkeiten

- **`setup-iam-identity-auth` Phase 1** (65% fertig) – OIDC-Login, Redis-Sessions → **Voraussetzung**
- **`setup-iam-identity-auth` Phase 2** (0%) – Org-Schema → **Nicht blockierend**, Org-Scoping wird später nachgerüstet
- **`refactor-plugin-sdk-boundary`** – SDK-Grenze muss klar sein für Hook-Platzierung → **Zu koordinieren**

### Breaking Changes

- **`Header.tsx` und `index.tsx`** werden refactored: Bestehende `fetch('/auth/me')`-Aufrufe werden durch `useAuth()` ersetzt
- Keine externen API-Breaking-Changes

## Referenz

- **Newcms User-Verwaltung:** `Newcms/src/components/PersonsViewNew.tsx`, `account/AccountEditView.tsx`, `RolesView.tsx` – dient als UX-Referenz, wird nicht 1:1 portiert
- **IAM-Konzept:** `concepts/konzeption-cms-v2/03_Systemarchitektur/Umsetzung-Rollen-Rechte.md`
- **Bestehender IAM-Change:** `openspec/changes/setup-iam-identity-auth/`

---

**Status:** 🟡 Proposal (bereit für Review)
