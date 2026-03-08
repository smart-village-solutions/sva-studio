# Tasks: add-account-user-management-ui

## Phase 1: Auth-Foundation (Frontend-State)

**Voraussetzung:** `setup-iam-identity-auth` Phase 1 (OIDC Login/Logout funktionsfähig)

### 1.1 AuthProvider + useAuth() Hook

- [x] 1.1.1 `IamAccountProfile`-, `IamRole`-, `IamPermission`-Typen in `@sva/core` definieren (konsistent mit DB: `keycloakSubject`, `instanceId`, `roleName`, `permissionKey`, `isSystemRole`)
- [x] 1.1.2 `IdentityProviderPort`-Interface in `@sva/auth` definieren (nicht `@sva/core` – Port gehört zur Server-Schicht)
- [x] 1.1.3 `AuthProvider` React-Context in `sva-studio-react` implementieren (lädt `/auth/me`)
- [x] 1.1.4 `useAuth()` Hook exportieren mit `{ user, isAuthenticated, isLoading, error, refetch, logout, invalidatePermissions }`
- [x] 1.1.5 `AuthProvider` in Root-Layout (`__root.tsx`) einbinden
- [x] 1.1.6 Bestehende `fetch('/auth/me')`-Aufrufe in `Header.tsx` und `index.tsx` durch `useAuth()` ersetzen
- [x] 1.1.7 Cache-Invalidierungslogik: `invalidatePermissions()` bei Rollen-Änderungen und `403`-Responses
- [x] 1.1.8 Unit-Tests für `AuthProvider`, `useAuth()` und Cache-Invalidierung

### 1.2 Protected Route Guard

- [x] 1.2.1 `createProtectedRoute()`-Factory in `@sva/routing` implementieren (Auth-Check im `beforeLoad` via `routerContext`)
- [x] 1.2.2 `createAdminRoute()`-Factory mit Rollen-Prüfung (`system_admin`, `app_manager`)
- [x] 1.2.3 Redirect-Logik: Login-Redirect mit Return-URL, Startseiten-Redirect bei fehlender Rolle
- [x] 1.2.4 Unit-Tests für Route-Guards

### 1.3 i18n-Namespaces und Konventionen

- [x] 1.3.1 i18n-Namespace `account` anlegen (DE + EN) für Profil-Seite
- [x] 1.3.2 i18n-Namespace `admin.users` anlegen (DE + EN) für User-Verwaltung
- [x] 1.3.3 i18n-Namespace `admin.roles` anlegen (DE + EN) für Rollen-Verwaltung
- [x] 1.3.4 i18n-Key-Konventionen dokumentieren: `<bereich>.<seite>.<element>` (z. B. `admin.users.table.headerName`)
- [x] 1.3.5 Build-Check einrichten: Fehlende i18n-Keys erzeugen Fehler

### 1.4 UI-Foundation (Design-System)

- [x] 1.4.1 Komponenten-Mapping für Account-UI dokumentieren (Dialog, Tabs, Dropdown, Table-Interaktionen, Form Controls -> `shadcn/ui`-Patterns)
- [x] 1.4.2 Sicherstellen, dass keine parallele Eigenbibliothek für dieselben interaktiven Basisbausteine im Scope eingeführt wird

---

## Phase 2: Backend – IAM-Service + Datenbank

**Voraussetzung:** Keycloak Service-Account `sva-studio-iam-service` ist im Realm konfiguriert (siehe 2.0)

### 2.0 Keycloak Service-Account Setup

- [x] 2.0.1 Keycloak-Client `sva-studio-iam-service` anlegen (Confidential, Service Account Enabled)
- [x] 2.0.2 Client-Rolle `realm-management` zuweisen: nur `manage-users`, `view-users`, `view-realm`
- [x] 2.0.3 Client-Secret über Secrets-Manager konfigurieren (nicht `.env`)
- [x] 2.0.4 Env-Variablen dokumentieren: `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`, `KEYCLOAK_ADMIN_REALM`, `KEYCLOAK_ADMIN_BASE_URL`
- [x] 2.0.5 Token-Lebensdauer auf 5 Minuten setzen
- [x] 2.0.6 Secret-Rotation alle 90 Tage einrichten (BSI-Grundschutz ORP.4), Dual-Secret-Rotation mit Overlap-Fenster dokumentieren

### 2.1 Datenbank-Schema (Delta-Migration)

> **Wichtig:** Das bestehende Schema (`0001_iam_core.sql`) mit Multi-Tenancy, RLS und PII-Verschlüsselung bleibt unangetastet. Die Migration erweitert es nur.

- [x] 2.1.1 Delta-Migration `0004_iam_account_profile.sql` in `packages/data/migrations/up/` erstellen
- [x] 2.1.2 `ALTER TABLE iam.accounts`: Profilfelder ergänzen (`first_name_ciphertext`, `last_name_ciphertext`, `phone_ciphertext`, `position`, `department`, `avatar_url`, `preferred_language`, `timezone`, `status`, `notes`)
- [x] 2.1.3 `ALTER TABLE iam.account_roles`: Temporale Spalten `assigned_by`, `valid_from`, `valid_to` ergänzen
- [x] 2.1.4 `ALTER TABLE iam.activity_logs`: `subject_id` und `result`-Spalte ergänzen
- [x] 2.1.5 Immutabilitäts-Trigger `trg_immutable_activity_logs` erstellen
- [x] 2.1.6 Performance-Indizes erstellen: `idx_accounts_status`, `idx_accounts_keycloak_subject`, `idx_accounts_kc_subject_instance` (Unique für JIT), `idx_activity_logs_subject_created`, `idx_activity_logs_account_created`
- [x] 2.1.7 `role_level INTEGER` Spalte in `iam.roles` ergänzen (Level-Hierarchie, CHECK 0–100)
- [x] 2.1.8 `retention_days INTEGER DEFAULT 90` Spalte in `iam.instances` ergänzen (mandantenspezifische Retention für DSGVO-Anonymisierung)
- [x] 2.1.9 `audit_retention_days INTEGER DEFAULT 365` Spalte in `iam.instances` ergänzen (mandantenspezifische Retention für Audit-Archivierung)
- [x] 2.1.10 Down-Migration `0004_iam_account_profile.sql` in `packages/data/migrations/down/` erstellen (**Reihenfolge:** Trigger droppen VOR Spalten droppen)
- [x] 2.1.11 Idempotentes Seed-Script für System-Rollen mit role_level (Rollen sind vorläufig, werden sich entwickeln)
- [x] 2.1.12 Migration lokal testen: Up + Down + Re-Up

### 2.2 Keycloak Admin API Client (hinter IdentityProviderPort)

- [x] 2.2.1 `IdentityProviderPort`-Adapter `KeycloakAdminClient` in `@sva/auth` implementieren
- [x] 2.2.2 Methoden: `createUser()`, `updateUser()`, `deactivateUser()`, `syncRoles()`
- [x] 2.2.3 Read-Methoden: `listUsers()`, `listRoles()` (direkt, nicht über Port)
- [x] 2.2.4 Token-Caching für Service-Account (Refresh bei Ablauf)
- [x] 2.2.5 Circuit-Breaker implementieren: 5 aufeinanderfolgende Fehler → Open-State 30s
- [x] 2.2.6 Timeouts: 5s connect, 10s read; Retry: max. 3 Versuche mit Exponential Backoff (1s, 2s, 4s)
- [x] 2.2.7 Degraded-Mode: Reads → DB-Fallback, Writes → `503 Service Unavailable`
- [x] 2.2.8 Keycloak-Mindestversion >= 22.0 dokumentieren
- [x] 2.2.9 Unit-Tests mit gemockter Keycloak Admin API (inkl. Circuit-Breaker-Tests)

### 2.3 IAM-Service-Endpunkte (unter `/api/v1/iam/`)

- [x] 2.3.1 `GET /api/v1/iam/users` – Paginierte User-Liste mit Filter (status, role, search); `instance_id`-Scoping via RLS
- [x] 2.3.2 `GET /api/v1/iam/users/:id` – Einzelner User mit Rollen und Berechtigungen
- [x] 2.3.3 `POST /api/v1/iam/users` – User erstellen (Keycloak-First + DB + Compensation bei Fehler)
- [x] 2.3.4 `PATCH /api/v1/iam/users/:id` – User updaten (Admin-Operation, Keycloak-Sync)
- [x] 2.3.5 `DELETE /api/v1/iam/users/:id` – User deaktivieren (Status → inactive, Keycloak `enabled=false`)
- [x] 2.3.6 `POST /api/v1/iam/users/bulk-deactivate` – Bulk-Deaktivierung (max. 50, Self-Protection)
- [x] 2.3.7 `PATCH /api/v1/iam/users/me/profile` – Self-Service-Profilbearbeitung (nur erlaubte Felder, PII → `*_ciphertext`)
- [x] 2.3.8 `GET /api/v1/iam/roles` – Rollen auflisten
- [x] 2.3.9 `POST /api/v1/iam/roles` – Custom-Rolle erstellen
- [x] 2.3.10 `PATCH /api/v1/iam/roles/:id` – Rolle bearbeiten (nur Custom)
- [x] 2.3.11 `DELETE /api/v1/iam/roles/:id` – Custom-Rolle löschen (mit Abhängigkeitsprüfung)
- [x] 2.3.12 Route-Handler für alle Endpunkte in `@sva/auth` implementieren
- [x] 2.3.13 Route-Factories für IAM-API in `@sva/routing` registrieren
- [x] 2.3.14 Serverseitige Payload-Validierung mit Zod für alle mutierenden Endpunkte
- [x] 2.3.15 Serverseitige Rollenprüfung in allen IAM-Handlern (`system_admin`/`app_manager`)
- [x] 2.3.16 Privilege-Escalation-Schutz: Rollenzuweisung <= eigene höchste Rolle; Last-Admin-Schutz
- [x] 2.3.17 CSRF-Schutz: `SameSite=Lax` + `X-Requested-With: XMLHttpRequest`-Header serverseitig validieren
- [x] 2.3.18 Rate Limiting: 60 req/min Read, 10 req/min Write, 3 req/min Bulk
- [x] 2.3.19 Operatives Logging auf SDK Logger standardisieren (Component-Label `iam-service`); keine `console.*`
- [x] 2.3.20 Einheitliches API-Response-Format (`ApiListResponse`, `ApiItemResponse`, `ApiErrorResponse`) implementieren
- [x] 2.3.21 Correlation-IDs: `request_id` in allen Logs und Audit-Events mitführen; OTEL Trace-Context propagieren
- [x] 2.3.22 PII-Maskierung in operativen Logs sicherstellen (Emails maskiert, Tokens/Secrets nie loggen)
- [x] 2.3.23 Cache-Invalidierung auslösen bei Rollen-Änderungen (`PermissionSnapshotCache`)
- [x] 2.3.24 Idempotency-Key-Validierung für duplikatskritische Endpunkte (`POST /users`, `POST /users/bulk-deactivate`, `POST /roles`)
- [x] 2.3.25 Tabelle `iam.idempotency_keys` (Scope: `actor_account_id`, `endpoint`, `idempotency_key`; TTL 24h) implementieren und migrieren
- [x] 2.3.26 Replay-Logik: identischer Payload -> gecachtes Ergebnis; abweichender Payload -> `409 IDEMPOTENCY_KEY_REUSE`
- [x] 2.3.27 Keycloak-First-Flows mit Idempotency verbinden (`IN_PROGRESS`/`COMPLETED`/`FAILED`) und Compensation deterministisch machen

### 2.4 JIT-Account-Erstellung

- [x] 2.4.1 Hook in `handleCallback()`: Beim Erst-Login Account via `INSERT ... ON CONFLICT (keycloak_subject, instance_id) DO UPDATE SET updated_at = NOW()` erstellen (nur nicht-administrative Felder updaten, keine Rollen/Status überschreiben)
- [x] 2.4.2 Account-Status `pending` bis Admin-Aktivierung
- [x] 2.4.3 `user.jit_provisioned`-Audit-Event loggen
- [x] 2.4.4 Tests für JIT-Provisioning (Erst-Login, Wieder-Login, gleichzeitiger Login)

### 2.5 Health-Checks und Monitoring

- [x] 2.5.1 `GET /health/ready` – Prüft DB, Keycloak, Redis
- [x] 2.5.2 `GET /health/live` – Prozess-Liveness
- [x] 2.5.3 Prometheus-Metriken für IAM-Operationen (User-CRUD-Zähler, Keycloak-Latenz, Circuit-Breaker-State)
- [x] 2.5.4 Feature-Flag-Hierarchie implementieren: `iam-ui-enabled` (Kill-Switch gesamte UI), `iam-admin-enabled` (nur Admin-Bereich), `iam-bulk-enabled` (Bulk-Operationen)

### 2.6 OpenAPI-Spezifikation und Alerting

- [x] 2.6.1 OpenAPI 3.1 Spezifikation für alle IAM-Endpunkte erstellen (`docs/api/iam-v1.yaml`)
- [x] 2.6.2 OpenAPI-Validierung im CI einrichten (z.B. `spectral` oder `redocly`)
- [x] 2.6.3 Alerting-Konzept: Alert-Rules für IAM (`iam_keycloak_request_duration_seconds > 5s`, `iam_circuit_breaker_state == 2`, `iam_user_operations_total{result="failure"} rate > 10/min`)
- [x] 2.6.4 Retention-Automation: Cron-Job für PII-Anonymisierung nach `retention_days`
- [x] 2.6.5 Retention-Automation: Audit-Archivierung nach `audit_retention_days`
- [x] 2.6.6 Reconciliation-Endpunkt `POST /api/v1/iam/admin/reconcile` (Folge-Task, nur Platzhalter)

---

## Phase 3: Frontend – Account-Profilseite

### 3.1 Account-Profilseite (`/account`)

- [x] 3.1.1 Route-Factory `/account` in `@sva/routing` erstellen (erfordert Authentifizierung)
- [x] 3.1.2 `AccountProfilePage`-Komponente in `sva-studio-react` implementieren
- [x] 3.1.3 Profil-Anzeige: Name, E-Mail, Telefon, Position, Abteilung, Avatar, Rolle, Status
- [x] 3.1.4 Formular für editierbare Felder (Name, Telefon, Position, Abteilung, Sprache, Zeitzone)
- [x] 3.1.5 Keycloak-Redirects mit Hinweis-UX: Externe-Link-Icon, `aria-label`, Rückkehr via `redirect_uri`
- [x] 3.1.6 Formular-Validierung (Pflichtfelder, Formate) mit Error-Summary und Fokus-Management
- [x] 3.1.7 Speichern via `PATCH /api/v1/iam/users/me/profile`
- [x] 3.1.8 Loading-, Error- und Leerzustände mit `aria-busy`, `role="status"`, Retry-Button
- [x] 3.1.9 Alle UI-Texte über `t('account.*')` lokalisieren
- [x] 3.1.10 A11y: WCAG 2.1 AA / BITV 2.0 konform (Formular-Labels, Fokus-Management, ARIA)
- [x] 3.1.11 Responsive: Desktop-Formular, Tablet/Mobile-Stack-Layout
- [x] 3.1.12 Unit-Tests für `AccountProfilePage`

---

## Phase 4: Frontend – User-Administration

### 4.1 React-Hooks für User-Verwaltung

- [x] 4.1.1 `useUsers()` Hook in `sva-studio-react` implementieren (Listing + CRUD via IAM-Service)
- [x] 4.1.2 `useUser(userId)` Hook für Einzelabruf mit Rollen und Berechtigungen
- [x] 4.1.3 `useRoles()` Hook für Rollen-Listing und CRUD
- [x] 4.1.4 Unit-Tests für alle Hooks

### 4.2 User-Liste (`/admin/users`)

- [x] 4.2.1 Route-Factory `/admin/users` in `@sva/routing` erstellen (Admin-Guard)
- [x] 4.2.2 `UserListPage`-Komponente mit TanStack Table implementieren
- [x] 4.2.3 Semantische Tabelle: `<table>` mit `<caption>` / `aria-label`, `<th scope="col">`, `aria-sort`
- [x] 4.2.4 Spalten: Name, E-Mail, Rolle, Status, Letzter Login
- [x] 4.2.5 Suche (Name, E-Mail – Debounce 300ms)
- [x] 4.2.6 Status-Filter (Aktiv, Inaktiv, Ausstehend) – kombinierbar mit Suche
- [x] 4.2.7 Status-Badges: Farbe + Text-Label + Icon; Kontrast >= 4.5:1
- [x] 4.2.8 Sortierung (alle Spalten) mit `aria-sort`
- [x] 4.2.9 Pagination (25 Einträge pro Seite)
- [x] 4.2.10 Checkbox-Selektion + Bulk-Aktionen (max. 50, Self-Protection, Last-Admin-Schutz)
- [x] 4.2.11 Bestätigungs-Dialoge: `role="alertdialog"`, Focus-Trap, Escape-Schließen
- [x] 4.2.12 „Nutzer anlegen"-Button → Formular-Dialog (`role="dialog"`, `aria-modal`, Focus-Trap)
- [x] 4.2.13 Navigation zu User-Bearbeitung (`/admin/users/:userId`)
- [x] 4.2.14 Loading-State (`aria-busy`), Error-State (Retry), Empty-State
- [x] 4.2.15 Alle UI-Texte über `t('admin.users.*')` lokalisieren
- [x] 4.2.16 Responsive: Desktop-Tabelle → Tablet-kompakt → Mobile-Cards
- [x] 4.2.17 A11y-Tests: Tastatur-Navigation, Screenreader-Unterstützung
- [x] 4.2.18 Unit-Tests für `UserListPage`

### 4.3 User-Bearbeitungsseite (`/admin/users/:userId`)

- [x] 4.3.1 Route-Factory `/admin/users/$userId` in `@sva/routing` erstellen (Admin-Guard)
- [x] 4.3.2 `UserEditPage`-Hauptkomponente mit Tab-Navigation (WAI-ARIA Tabs Pattern)
- [x] 4.3.3 Tabs implementieren: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, Arrow-Keys, Home/End
- [x] 4.3.4 Tab 1 – Persönliche Daten: Name, E-Mail, Telefon, Position, Abteilung, Adresse
- [x] 4.3.5 Tab 2 – Verwaltung: Status, Rollen-Zuweisung (mit Privilege-Escalation-Schutz), Sprache, Zeitzone, Notizen (max. 2000 Zeichen)
- [x] 4.3.6 Tab 3 – Berechtigungen: Effektive Berechtigungs-Anzeige nach Ressourcentyp
- [x] 4.3.7 Tab 4 – Historie: Activity-Log des Nutzers (chronologisch, paginiert, Empty-State)
- [x] 4.3.8 Unsaved-Changes-Warnung bei Tab-Wechsel oder Seitenverlassen (`role="alertdialog"`)
- [x] 4.3.9 Header-Card: Avatar, Name, Status-Badge (Farbe + Text + Icon), Rollen-Badge
- [x] 4.3.10 Speichern via `PATCH /api/v1/iam/users/:userId`
- [x] 4.3.11 Alle UI-Texte über `t('admin.users.*')` lokalisieren
- [x] 4.3.12 Responsive: Tabs als Scroll-Leiste oder Dropdown auf Mobile
- [x] 4.3.13 A11y: Tab-Navigation, Formulare, ARIA, Error-Summary, Fokus-Management
- [x] 4.3.14 Unit-Tests für `UserEditPage` und alle Tab-Komponenten

---

## Phase 5: Frontend – Rollen-Verwaltung

### 5.1 Rollen-Seite (`/admin/roles`)

- [x] 5.1.1 Route-Factory `/admin/roles` in `@sva/routing` erstellen (Admin-Guard, nur `system_admin`)
- [x] 5.1.2 `RolesPage`-Komponente implementieren
- [x] 5.1.3 Rollen-Tabelle: Name, Typ, Beschreibung, Nutzeranzahl (semantisches `<table>`)
- [x] 5.1.4 Expandierbare Berechtigungs-Matrix pro Rolle (`aria-expanded`, `aria-controls`)
- [x] 5.1.5 System-Rollen: Read-only-Matrix, nicht löschbar; Hinweis „Rollen sind vorläufig"
- [x] 5.1.6 Custom-Rolle erstellen: Formular-Dialog mit Name, Beschreibung, Permissions-Auswahl
- [x] 5.1.7 Custom-Rolle löschen: Abhängigkeitsprüfung + Bestätigungsdialog (`role="alertdialog"`)
- [x] 5.1.8 Suche und Sortierung
- [x] 5.1.9 Loading-, Error-, Empty-States
- [x] 5.1.10 Alle UI-Texte über `t('admin.roles.*')` lokalisieren
- [x] 5.1.11 Responsive: Desktop-Matrix → Mobile-Card-Layout
- [x] 5.1.12 A11y: Matrix-Tabelle, expandierbare Rows, Dialog-Patterns
- [x] 5.1.13 Unit-Tests für `RolesPage`

---

## Phase 6: Integration + Qualitätssicherung

### 6.1 Integration

- [x] 6.1.1 Navigation im Header/Sidebar: Links zu `/account`, `/admin/users`, `/admin/roles` (rollenbasiert)
- [x] 6.1.2 Admin-Bereich nur für berechtigte Rollen sichtbar
- [x] 6.1.3 E2E-Tests: Login → Profil anzeigen → Profil bearbeiten
- [x] 6.1.4 E2E-Tests: Login als Admin → User-Liste → User bearbeiten → Rolle zuweisen
- [x] 6.1.5 E2E-Tests: Login ohne Admin-Rolle → Admin-Bereich nicht erreichbar
- [x] 6.1.6 E2E-Tests: Direkter API-Aufruf ohne Admin-Rechte liefert `403 Forbidden`
- [x] 6.1.7 E2E-Tests: CSRF-Schutz-Prüfung (`X-Requested-With`-Header) bei mutierenden Endpunkten
- [x] 6.1.8 E2E-Tests: Responsive Layouts auf verschiedenen Viewports (320px, 768px, 1024px)
- [x] 6.1.9 UI-Review: Interaktive Komponenten in Account-/Admin-Views entsprechen den `shadcn/ui`-Patterns

### 6.2 Dokumentation und ADRs

- [x] 6.2.1 arc42 `05-building-block-view` aktualisieren (IAM-Service, Account-UI-Module)
- [x] 6.2.2 arc42 `06-runtime-view` ergänzen (Keycloak-Sync-Sequenzdiagramme, JIT-Provisioning-Flow)
- [x] 6.2.3 arc42 `07-deployment-view` ergänzen (Keycloak-Integration, Service-Account, Secrets-Injection)
- [x] 6.2.4 arc42 `08-cross-cutting-concepts` aktualisieren (AuthProvider-Pattern, Permission-Checking)
- [x] 6.2.5 arc42 `09-architecture-decisions` aktualisieren (Keycloak Admin API, Hybrid-Profil)
- [x] 6.2.6 arc42 `10-quality` ergänzen (Testabdeckung IAM, Performance-Ziele Keycloak-Sync)
- [x] 6.2.7 arc42 `11-risks-and-technical-debt` aktualisieren (Sync-Risiken, Vendor-Lock, Partitionierung als Tech-Debt)
- [x] 6.2.8 ADR erstellen: CSRF-Schutz-Strategie (`docs/adr/ADR-015-csrf-schutz-strategie.md`)
- [x] 6.2.9 ADR erstellen: IdP-Abstraktionsschicht (`docs/adr/ADR-016-idp-abstraktionsschicht.md`)
- [x] 6.2.10 Developer-Guide: IAM-Service-API-Dokumentation (Endpunkte, Response-Format, Error-Codes)
- [x] 6.2.11 Keycloak-Setup-Anleitung (Service-Account `sva-studio-iam-service`, Realm-Konfiguration)
- [x] 6.2.12 Deployment-Runbook: Delta-Migration, Feature-Flag, Keycloak-Voraussetzungen, Rollback-Verfahren
- [x] 6.2.13 i18n-Key-Abdeckung für `account.*`, `admin.users.*`, `admin.roles.*` dokumentieren und prüfbar machen
- [x] 6.2.14 OpenSpec-Validierung mit `openspec validate add-account-user-management-ui --strict` ausführen

---

## Acceptance-Kriterien

**Phase 1 (Auth-Foundation):**
- [x] `useAuth()`-Hook liefert korrekten Auth-State in der gesamten Anwendung
- [x] `invalidatePermissions()` triggert Refetch bei Rollen-Änderungen
- [x] Geschützte Routen leiten nicht-authentifizierte Nutzer auf Login weiter
- [x] Admin-Routen sind nur für berechtigte Rollen erreichbar

**Phase 2 (Backend):**
- [x] Delta-Migration erweitert bestehendes Schema ohne Breaking Changes
- [x] `GET /api/v1/iam/users` liefert paginierte, `instance_id`-scoped User-Liste
- [x] User-Erstellung folgt Keycloak-First + Compensation
- [x] CSRF-Schutz ist aktiv für alle mutierenden Endpunkte
- [x] Rate Limiting ist aktiv
- [x] Health-Checks `/health/ready` und `/health/live` funktionieren
- [x] JIT-Provisioning erstellt Account beim Erst-Login (Race-Condition-sicher)
- [x] Keine PII in operativen Logs

**Phase 3 (Profil):**
- [x] Nutzer kann unter `/account` sein Profil einsehen
- [x] Basis-Daten sind editierbar und werden gespeichert
- [x] Passwort/MFA-Links leiten zu Keycloak Account Console weiter (mit Hinweis-UX)
- [x] Responsive auf allen Viewports

**Phase 4 (User-Admin):**
- [x] Admin kann unter `/admin/users` alle Nutzer auflisten, suchen und filtern
- [x] Admin kann Nutzer erstellen, bearbeiten, deaktivieren
- [x] Bulk-Aktionen: max. 50, Self-Protection, Last-Admin-Schutz
- [x] 4-Tab-Ansicht implementiert WAI-ARIA Tabs Pattern
- [x] Status-Badges sind farb-unabhängig zugänglich

**Phase 5 (Rollen):**
- [x] Admin kann System-Rollen einsehen und Custom-Rollen erstellen/löschen
- [x] Berechtigungs-Matrix zeigt effektive Permissions korrekt an
- [x] Privilege-Escalation-Schutz ist aktiv

**Phase 6 (Integration):**
- [x] Navigation zeigt Admin-Bereich nur für berechtigte Rollen
- [x] E2E-Tests decken kritische Flows ab (inkl. CSRF und Responsive)
- [x] arc42-Dokumentation und ADRs sind aktualisiert
- [x] Deployment-Runbook ist vorhanden

---

**Gesamtfortschritt:** 100% COMPLETE (alle Tasks in dieser Checkliste umgesetzt)
**Last Updated:** 4. März 2026
