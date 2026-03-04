```markdown
# Tasks: add-account-user-management-ui

## Phase 1: Auth-Foundation (Frontend-State)

**Voraussetzung:** `setup-iam-identity-auth` Phase 1 (OIDC Login/Logout funktionsfähig)

### 1.1 AuthProvider + useAuth() Hook

- [ ] 1.1.1 `IamAccountProfile`-, `IamRole`-, `IamPermission`-Typen in `@sva/core` definieren (konsistent mit DB: `keycloakSubject`, `instanceId`, `roleName`, `permissionKey`, `isSystemRole`)
- [ ] 1.1.2 `IdentityProviderPort`-Interface in `@sva/core` definieren
- [ ] 1.1.3 `AuthProvider` React-Context in `sva-studio-react` implementieren (lädt `/auth/me`)
- [ ] 1.1.4 `useAuth()` Hook exportieren mit `{ user, isAuthenticated, isLoading, error, refetch, logout, invalidatePermissions }`
- [ ] 1.1.5 `AuthProvider` in Root-Layout (`__root.tsx`) einbinden
- [ ] 1.1.6 Bestehende `fetch('/auth/me')`-Aufrufe in `Header.tsx` und `index.tsx` durch `useAuth()` ersetzen
- [ ] 1.1.7 Cache-Invalidierungslogik: `invalidatePermissions()` bei Rollen-Änderungen und `403`-Responses
- [ ] 1.1.8 Unit-Tests für `AuthProvider`, `useAuth()` und Cache-Invalidierung

### 1.2 Protected Route Guard

- [ ] 1.2.1 `createProtectedRoute()`-Factory in `@sva/routing` implementieren (Auth-Check im `beforeLoad` via `routerContext`)
- [ ] 1.2.2 `createAdminRoute()`-Factory mit Rollen-Prüfung (`system_admin`, `app_manager`)
- [ ] 1.2.3 Redirect-Logik: Login-Redirect mit Return-URL, Startseiten-Redirect bei fehlender Rolle
- [ ] 1.2.4 Unit-Tests für Route-Guards

### 1.3 i18n-Namespaces und Konventionen

- [ ] 1.3.1 i18n-Namespace `account` anlegen (DE + EN) für Profil-Seite
- [ ] 1.3.2 i18n-Namespace `admin.users` anlegen (DE + EN) für User-Verwaltung
- [ ] 1.3.3 i18n-Namespace `admin.roles` anlegen (DE + EN) für Rollen-Verwaltung
- [ ] 1.3.4 i18n-Key-Konventionen dokumentieren: `<bereich>.<seite>.<element>` (z. B. `admin.users.table.headerName`)
- [ ] 1.3.5 Build-Check einrichten: Fehlende i18n-Keys erzeugen Fehler

---

## Phase 2: Backend – IAM-Service + Datenbank

**Voraussetzung:** Keycloak Service-Account `sva-studio-iam-service` ist im Realm konfiguriert (siehe 2.0)

### 2.0 Keycloak Service-Account Setup

- [ ] 2.0.1 Keycloak-Client `sva-studio-iam-service` anlegen (Confidential, Service Account Enabled)
- [ ] 2.0.2 Client-Rolle `realm-management` zuweisen: nur `manage-users`, `view-users`, `manage-realm`
- [ ] 2.0.3 Client-Secret über Secrets-Manager konfigurieren (nicht `.env`)
- [ ] 2.0.4 Env-Variablen dokumentieren: `KEYCLOAK_ADMIN_CLIENT_ID`, `KEYCLOAK_ADMIN_CLIENT_SECRET`, `KEYCLOAK_ADMIN_REALM`, `KEYCLOAK_ADMIN_BASE_URL`
- [ ] 2.0.5 Token-Lebensdauer auf 5 Minuten setzen
- [ ] 2.0.6 Secret-Rotation alle 90 Tage einrichten (BSI-Grundschutz ORP.4)

### 2.1 Datenbank-Schema (Delta-Migration)

> **Wichtig:** Das bestehende Schema (`0001_iam_core.sql`) mit Multi-Tenancy, RLS und PII-Verschlüsselung bleibt unangetastet. Die Migration erweitert es nur.

- [ ] 2.1.1 Delta-Migration `0004_iam_account_profile.sql` in `packages/data/migrations/up/` erstellen
- [ ] 2.1.2 `ALTER TABLE iam.accounts`: Profilfelder ergänzen (`first_name_ciphertext`, `last_name_ciphertext`, `phone_ciphertext`, `position`, `department`, `avatar_url`, `preferred_language`, `timezone`, `status`, `notes`)
- [ ] 2.1.3 `ALTER TABLE iam.account_roles`: Temporale Spalten `assigned_by`, `valid_from`, `valid_to` ergänzen
- [ ] 2.1.4 `ALTER TABLE iam.activity_logs`: `subject_id` und `result`-Spalte ergänzen
- [ ] 2.1.5 Immutabilitäts-Trigger `trg_immutable_activity_logs` erstellen
- [ ] 2.1.6 Performance-Indizes erstellen: `idx_accounts_status`, `idx_accounts_keycloak_subject`, `idx_activity_logs_subject_created`, `idx_activity_logs_account_created`
- [ ] 2.1.7 Down-Migration `0004_iam_account_profile.sql` in `packages/data/migrations/down/` erstellen
- [ ] 2.1.8 Idempotentes Seed-Script für System-Rollen (Rollen sind vorläufig, werden sich entwickeln)
- [ ] 2.1.9 Migration lokal testen: Up + Down + Re-Up

### 2.2 Keycloak Admin API Client (hinter IdentityProviderPort)

- [ ] 2.2.1 `IdentityProviderPort`-Adapter `KeycloakAdminClient` in `@sva/auth` implementieren
- [ ] 2.2.2 Methoden: `createUser()`, `updateUser()`, `deactivateUser()`, `syncRoles()`
- [ ] 2.2.3 Read-Methoden: `listUsers()`, `listRoles()` (direkt, nicht über Port)
- [ ] 2.2.4 Token-Caching für Service-Account (Refresh bei Ablauf)
- [ ] 2.2.5 Circuit-Breaker implementieren: 5 aufeinanderfolgende Fehler → Open-State 30s
- [ ] 2.2.6 Timeouts: 5s connect, 10s read; Retry: max. 3 Versuche mit Exponential Backoff (1s, 2s, 4s)
- [ ] 2.2.7 Degraded-Mode: Reads → DB-Fallback, Writes → `503 Service Unavailable`
- [ ] 2.2.8 Keycloak-Mindestversion >= 22.0 dokumentieren
- [ ] 2.2.9 Unit-Tests mit gemockter Keycloak Admin API (inkl. Circuit-Breaker-Tests)

### 2.3 IAM-Service-Endpunkte (unter `/api/v1/iam/`)

- [ ] 2.3.1 `GET /api/v1/iam/users` – Paginierte User-Liste mit Filter (status, role, search); `instance_id`-Scoping via RLS
- [ ] 2.3.2 `GET /api/v1/iam/users/:id` – Einzelner User mit Rollen und Berechtigungen
- [ ] 2.3.3 `POST /api/v1/iam/users` – User erstellen (Keycloak-First + DB + Compensation bei Fehler)
- [ ] 2.3.4 `PATCH /api/v1/iam/users/:id` – User updaten (Admin-Operation, Keycloak-Sync)
- [ ] 2.3.5 `DELETE /api/v1/iam/users/:id` – User deaktivieren (Status → inactive, Keycloak `enabled=false`)
- [ ] 2.3.6 `POST /api/v1/iam/users/bulk-deactivate` – Bulk-Deaktivierung (max. 50, Self-Protection)
- [ ] 2.3.7 `PATCH /api/v1/iam/users/me/profile` – Self-Service-Profilbearbeitung (nur erlaubte Felder, PII → `*_ciphertext`)
- [ ] 2.3.8 `GET /api/v1/iam/roles` – Rollen auflisten
- [ ] 2.3.9 `POST /api/v1/iam/roles` – Custom-Rolle erstellen
- [ ] 2.3.10 `PATCH /api/v1/iam/roles/:id` – Rolle bearbeiten (nur Custom)
- [ ] 2.3.11 `DELETE /api/v1/iam/roles/:id` – Custom-Rolle löschen (mit Abhängigkeitsprüfung)
- [ ] 2.3.12 Route-Handler für alle Endpunkte in `@sva/auth` implementieren
- [ ] 2.3.13 Route-Factories für IAM-API in `@sva/routing` registrieren
- [ ] 2.3.14 Serverseitige Payload-Validierung mit Zod für alle mutierenden Endpunkte
- [ ] 2.3.15 Serverseitige Rollenprüfung in allen IAM-Handlern (`system_admin`/`app_manager`)
- [ ] 2.3.16 Privilege-Escalation-Schutz: Rollenzuweisung <= eigene höchste Rolle; Last-Admin-Schutz
- [ ] 2.3.17 CSRF-Schutz: Double-Submit-Cookie oder SameSite=Strict + `X-Requested-With`-Header
- [ ] 2.3.18 Rate Limiting: 60 req/min Read, 10 req/min Write, 3 req/min Bulk
- [ ] 2.3.19 Operatives Logging auf SDK Logger standardisieren (Component-Label `iam-service`); keine `console.*`
- [ ] 2.3.20 Einheitliches API-Response-Format (`ApiListResponse`, `ApiItemResponse`, `ApiErrorResponse`) implementieren
- [ ] 2.3.21 Correlation-IDs: `request_id` in allen Logs und Audit-Events mitführen; OTEL Trace-Context propagieren
- [ ] 2.3.22 PII-Maskierung in operativen Logs sicherstellen (Emails maskiert, Tokens/Secrets nie loggen)
- [ ] 2.3.23 Cache-Invalidierung auslösen bei Rollen-Änderungen (`PermissionSnapshotCache`)

### 2.4 JIT-Account-Erstellung

- [ ] 2.4.1 Hook in `handleCallback()`: Beim Erst-Login Account via `INSERT ... ON CONFLICT (keycloak_subject, instance_id) DO UPDATE` erstellen (Race-Condition-sicher)
- [ ] 2.4.2 Account-Status `pending` bis Admin-Aktivierung
- [ ] 2.4.3 `user.jit_provisioned`-Audit-Event loggen
- [ ] 2.4.4 Tests für JIT-Provisioning (Erst-Login, Wieder-Login, gleichzeitiger Login)

### 2.5 Health-Checks und Monitoring

- [ ] 2.5.1 `GET /health/ready` – Prüft DB, Keycloak, Redis
- [ ] 2.5.2 `GET /health/live` – Prozess-Liveness
- [ ] 2.5.3 Prometheus-Metriken für IAM-Operationen (User-CRUD-Zähler, Keycloak-Latenz, Circuit-Breaker-State)
- [ ] 2.5.4 Feature-Flag `iam-ui-enabled` als Kill-Switch implementieren

---

## Phase 3: Frontend – Account-Profilseite

### 3.1 Account-Profilseite (`/account`)

- [ ] 3.1.1 Route-Factory `/account` in `@sva/routing` erstellen (erfordert Authentifizierung)
- [ ] 3.1.2 `AccountProfilePage`-Komponente in `sva-studio-react` implementieren
- [ ] 3.1.3 Profil-Anzeige: Name, E-Mail, Telefon, Position, Abteilung, Avatar, Rolle, Status
- [ ] 3.1.4 Formular für editierbare Felder (Name, Telefon, Position, Abteilung, Sprache, Zeitzone)
- [ ] 3.1.5 Keycloak-Redirects mit Hinweis-UX: Externe-Link-Icon, `aria-label`, Rückkehr via `redirect_uri`
- [ ] 3.1.6 Formular-Validierung (Pflichtfelder, Formate) mit Error-Summary und Fokus-Management
- [ ] 3.1.7 Speichern via `PATCH /api/v1/iam/users/me/profile`
- [ ] 3.1.8 Loading-, Error- und Leerzustände mit `aria-busy`, `role="status"`, Retry-Button
- [ ] 3.1.9 Alle UI-Texte über `t('account.*')` lokalisieren
- [ ] 3.1.10 A11y: WCAG 2.1 AA / BITV 2.0 konform (Formular-Labels, Fokus-Management, ARIA)
- [ ] 3.1.11 Responsive: Desktop-Formular, Tablet/Mobile-Stack-Layout
- [ ] 3.1.12 Unit-Tests für `AccountProfilePage`

---

## Phase 4: Frontend – User-Administration

### 4.1 React-Hooks für User-Verwaltung

- [ ] 4.1.1 `useUsers()` Hook in `sva-studio-react` implementieren (Listing + CRUD via IAM-Service)
- [ ] 4.1.2 `useUser(userId)` Hook für Einzelabruf mit Rollen und Berechtigungen
- [ ] 4.1.3 `useRoles()` Hook für Rollen-Listing und CRUD
- [ ] 4.1.4 Unit-Tests für alle Hooks

### 4.2 User-Liste (`/admin/users`)

- [ ] 4.2.1 Route-Factory `/admin/users` in `@sva/routing` erstellen (Admin-Guard)
- [ ] 4.2.2 `UserListPage`-Komponente mit TanStack Table implementieren
- [ ] 4.2.3 Semantische Tabelle: `<table>` mit `<caption>` / `aria-label`, `<th scope="col">`, `aria-sort`
- [ ] 4.2.4 Spalten: Name, E-Mail, Rolle, Status, Letzter Login
- [ ] 4.2.5 Suche (Name, E-Mail – Debounce 300ms)
- [ ] 4.2.6 Status-Filter (Aktiv, Inaktiv, Ausstehend) – kombinierbar mit Suche
- [ ] 4.2.7 Status-Badges: Farbe + Text-Label + Icon; Kontrast >= 4.5:1
- [ ] 4.2.8 Sortierung (alle Spalten) mit `aria-sort`
- [ ] 4.2.9 Pagination (25 Einträge pro Seite)
- [ ] 4.2.10 Checkbox-Selektion + Bulk-Aktionen (max. 50, Self-Protection, Last-Admin-Schutz)
- [ ] 4.2.11 Bestätigungs-Dialoge: `role="alertdialog"`, Focus-Trap, Escape-Schließen
- [ ] 4.2.12 „Nutzer anlegen"-Button → Formular-Dialog (`role="dialog"`, `aria-modal`, Focus-Trap)
- [ ] 4.2.13 Navigation zu User-Bearbeitung (`/admin/users/:userId`)
- [ ] 4.2.14 Loading-State (`aria-busy`), Error-State (Retry), Empty-State
- [ ] 4.2.15 Alle UI-Texte über `t('admin.users.*')` lokalisieren
- [ ] 4.2.16 Responsive: Desktop-Tabelle → Tablet-kompakt → Mobile-Cards
- [ ] 4.2.17 A11y-Tests: Tastatur-Navigation, Screenreader-Unterstützung
- [ ] 4.2.18 Unit-Tests für `UserListPage`

### 4.3 User-Bearbeitungsseite (`/admin/users/:userId`)

- [ ] 4.3.1 Route-Factory `/admin/users/$userId` in `@sva/routing` erstellen (Admin-Guard)
- [ ] 4.3.2 `UserEditPage`-Hauptkomponente mit Tab-Navigation (WAI-ARIA Tabs Pattern)
- [ ] 4.3.3 Tabs implementieren: `role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, Arrow-Keys, Home/End
- [ ] 4.3.4 Tab 1 – Persönliche Daten: Name, E-Mail, Telefon, Position, Abteilung, Adresse
- [ ] 4.3.5 Tab 2 – Verwaltung: Status, Rollen-Zuweisung (mit Privilege-Escalation-Schutz), Sprache, Zeitzone, Notizen (max. 2000 Zeichen)
- [ ] 4.3.6 Tab 3 – Berechtigungen: Effektive Berechtigungs-Anzeige nach Ressourcentyp
- [ ] 4.3.7 Tab 4 – Historie: Activity-Log des Nutzers (chronologisch, paginiert, Empty-State)
- [ ] 4.3.8 Unsaved-Changes-Warnung bei Tab-Wechsel oder Seitenverlassen (`role="alertdialog"`)
- [ ] 4.3.9 Header-Card: Avatar, Name, Status-Badge (Farbe + Text + Icon), Rollen-Badge
- [ ] 4.3.10 Speichern via `PATCH /api/v1/iam/users/:userId`
- [ ] 4.3.11 Alle UI-Texte über `t('admin.users.*')` lokalisieren
- [ ] 4.3.12 Responsive: Tabs als Scroll-Leiste oder Dropdown auf Mobile
- [ ] 4.3.13 A11y: Tab-Navigation, Formulare, ARIA, Error-Summary, Fokus-Management
- [ ] 4.3.14 Unit-Tests für `UserEditPage` und alle Tab-Komponenten

---

## Phase 5: Frontend – Rollen-Verwaltung

### 5.1 Rollen-Seite (`/admin/roles`)

- [ ] 5.1.1 Route-Factory `/admin/roles` in `@sva/routing` erstellen (Admin-Guard, nur `system_admin`)
- [ ] 5.1.2 `RolesPage`-Komponente implementieren
- [ ] 5.1.3 Rollen-Tabelle: Name, Typ, Beschreibung, Nutzeranzahl (semantisches `<table>`)
- [ ] 5.1.4 Expandierbare Berechtigungs-Matrix pro Rolle (`aria-expanded`, `aria-controls`)
- [ ] 5.1.5 System-Rollen: Read-only-Matrix, nicht löschbar; Hinweis „Rollen sind vorläufig"
- [ ] 5.1.6 Custom-Rolle erstellen: Formular-Dialog mit Name, Beschreibung, Permissions-Auswahl
- [ ] 5.1.7 Custom-Rolle löschen: Abhängigkeitsprüfung + Bestätigungsdialog (`role="alertdialog"`)
- [ ] 5.1.8 Suche und Sortierung
- [ ] 5.1.9 Loading-, Error-, Empty-States
- [ ] 5.1.10 Alle UI-Texte über `t('admin.roles.*')` lokalisieren
- [ ] 5.1.11 Responsive: Desktop-Matrix → Mobile-Card-Layout
- [ ] 5.1.12 A11y: Matrix-Tabelle, expandierbare Rows, Dialog-Patterns
- [ ] 5.1.13 Unit-Tests für `RolesPage`

---

## Phase 6: Integration + Qualitätssicherung

### 6.1 Integration

- [ ] 6.1.1 Navigation im Header/Sidebar: Links zu `/account`, `/admin/users`, `/admin/roles` (rollenbasiert)
- [ ] 6.1.2 Admin-Bereich nur für berechtigte Rollen sichtbar
- [ ] 6.1.3 E2E-Tests: Login → Profil anzeigen → Profil bearbeiten
- [ ] 6.1.4 E2E-Tests: Login als Admin → User-Liste → User bearbeiten → Rolle zuweisen
- [ ] 6.1.5 E2E-Tests: Login ohne Admin-Rolle → Admin-Bereich nicht erreichbar
- [ ] 6.1.6 E2E-Tests: Direkter API-Aufruf ohne Admin-Rechte liefert `403 Forbidden`
- [ ] 6.1.7 E2E-Tests: CSRF-Token-Prüfung bei mutierenden Endpunkten
- [ ] 6.1.8 E2E-Tests: Responsive Layouts auf verschiedenen Viewports (320px, 768px, 1024px)

### 6.2 Dokumentation und ADRs

- [ ] 6.2.1 arc42 `05-building-block-view` aktualisieren (IAM-Service, Account-UI-Module)
- [ ] 6.2.2 arc42 `08-cross-cutting-concepts` aktualisieren (AuthProvider-Pattern, Permission-Checking)
- [ ] 6.2.3 arc42 `09-architecture-decisions` aktualisieren (Keycloak Admin API, Hybrid-Profil)
- [ ] 6.2.4 ADR erstellen: CSRF-Schutz-Strategie für Cookie-basierte Auth
- [ ] 6.2.5 ADR erstellen: IdP-Abstraktionsschicht (`IdentityProviderPort`)
- [ ] 6.2.6 Developer-Guide: IAM-Service-API-Dokumentation (Endpunkte, Response-Format, Error-Codes)
- [ ] 6.2.7 Keycloak-Setup-Anleitung (Service-Account `sva-studio-iam-service`, Realm-Konfiguration)
- [ ] 6.2.8 Deployment-Runbook: Delta-Migration, Feature-Flag, Keycloak-Voraussetzungen, Rollback-Verfahren
- [ ] 6.2.9 i18n-Key-Abdeckung für `account.*`, `admin.users.*`, `admin.roles.*` dokumentieren und prüfbar machen
- [ ] 6.2.10 OpenSpec-Validierung mit `openspec validate add-account-user-management-ui --strict` ausführen

---

## Acceptance-Kriterien

**Phase 1 (Auth-Foundation):**
- [ ] `useAuth()`-Hook liefert korrekten Auth-State in der gesamten Anwendung
- [ ] `invalidatePermissions()` triggert Refetch bei Rollen-Änderungen
- [ ] Geschützte Routen leiten nicht-authentifizierte Nutzer auf Login weiter
- [ ] Admin-Routen sind nur für berechtigte Rollen erreichbar

**Phase 2 (Backend):**
- [ ] Delta-Migration erweitert bestehendes Schema ohne Breaking Changes
- [ ] `GET /api/v1/iam/users` liefert paginierte, `instance_id`-scoped User-Liste
- [ ] User-Erstellung folgt Keycloak-First + Compensation
- [ ] CSRF-Schutz ist aktiv für alle mutierenden Endpunkte
- [ ] Rate Limiting ist aktiv
- [ ] Health-Checks `/health/ready` und `/health/live` funktionieren
- [ ] JIT-Provisioning erstellt Account beim Erst-Login (Race-Condition-sicher)
- [ ] Keine PII in operativen Logs

**Phase 3 (Profil):**
- [ ] Nutzer kann unter `/account` sein Profil einsehen
- [ ] Basis-Daten sind editierbar und werden gespeichert
- [ ] Passwort/MFA-Links leiten zu Keycloak Account Console weiter (mit Hinweis-UX)
- [ ] Responsive auf allen Viewports

**Phase 4 (User-Admin):**
- [ ] Admin kann unter `/admin/users` alle Nutzer auflisten, suchen und filtern
- [ ] Admin kann Nutzer erstellen, bearbeiten, deaktivieren
- [ ] Bulk-Aktionen: max. 50, Self-Protection, Last-Admin-Schutz
- [ ] 4-Tab-Ansicht implementiert WAI-ARIA Tabs Pattern
- [ ] Status-Badges sind farb-unabhängig zugänglich

**Phase 5 (Rollen):**
- [ ] Admin kann System-Rollen einsehen und Custom-Rollen erstellen/löschen
- [ ] Berechtigungs-Matrix zeigt effektive Permissions korrekt an
- [ ] Privilege-Escalation-Schutz ist aktiv

**Phase 6 (Integration):**
- [ ] Navigation zeigt Admin-Bereich nur für berechtigte Rollen
- [ ] E2E-Tests decken kritische Flows ab (inkl. CSRF und Responsive)
- [ ] arc42-Dokumentation und ADRs sind aktualisiert
- [ ] Deployment-Runbook ist vorhanden

---

**Gesamtfortschritt:** 0% COMPLETE (0/~105 Tasks)
**Last Updated:** 4. März 2026

```
