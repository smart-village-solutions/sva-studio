# Tasks: add-account-user-management-ui

## Phase 1: Auth-Foundation (Frontend-State)

**Voraussetzung:** `setup-iam-identity-auth` Phase 1 (OIDC Login/Logout funktionsfähig)

### 1.1 AuthProvider + useAuth() Hook

- [ ] 1.1.1 `IamUser`-, `IamRole`-, `Permission`-Typen in `@sva/core` definieren
- [ ] 1.1.2 `AuthProvider` React-Context in `@sva/data` implementieren (lädt `/auth/me`)
- [ ] 1.1.3 `useAuth()` Hook exportieren mit `{ user, isAuthenticated, isLoading, error, refetch, logout }`
- [ ] 1.1.4 `AuthProvider` in Root-Layout (`__root.tsx`) einbinden
- [ ] 1.1.5 Bestehende `fetch('/auth/me')`-Aufrufe in `Header.tsx` und `index.tsx` durch `useAuth()` ersetzen
- [ ] 1.1.6 Unit-Tests für `AuthProvider` und `useAuth()` schreiben

### 1.2 Protected Route Guard

- [ ] 1.2.1 `createProtectedRoute()`-Factory in `@sva/routing` implementieren (Auth-Check im `beforeLoad`)
- [ ] 1.2.2 `createAdminRoute()`-Factory mit Rollen-Prüfung (`system_admin`, `app_manager`)
- [ ] 1.2.3 Redirect-Logik: Login-Redirect mit Return-URL, Startseiten-Redirect bei fehlender Rolle
- [ ] 1.2.4 Unit-Tests für Route-Guards

### 1.3 i18n-Namespaces

- [ ] 1.3.1 i18n-Namespace `account` anlegen (DE + EN) für Profil-Seite
- [ ] 1.3.2 i18n-Namespace `admin.users` anlegen (DE + EN) für User-Verwaltung
- [ ] 1.3.3 i18n-Namespace `admin.roles` anlegen (DE + EN) für Rollen-Verwaltung

---

## Phase 2: Backend – IAM-Service + Datenbank

### 2.1 Datenbank-Schema

- [ ] 2.1.1 Postgres-Schema `iam` erstellen (Schema-Namespace)
- [ ] 2.1.2 `iam.accounts`-Tabelle mit Keycloak-Mapping erstellen
- [ ] 2.1.3 `iam.roles`- und `iam.permissions`-Tabellen erstellen
- [ ] 2.1.4 `iam.role_permissions`- und `iam.account_roles`-Junction-Tabellen erstellen
- [ ] 2.1.5 `iam.activity_logs`-Tabelle erstellen
- [ ] 2.1.6 7-Personas-Seed-Daten einfügen (idempotentes Script)
- [ ] 2.1.7 Indexes für Performance (keycloak_id, email, status, role_id)
- [ ] 2.1.8 Migrations-Skripte dokumentieren und versionieren

### 2.2 Keycloak Admin API Client

- [ ] 2.2.1 `KeycloakAdminClient`-Klasse in `@sva/auth` implementieren (Service-Account-Auth)
- [ ] 2.2.2 User-CRUD-Methoden: `listUsers()`, `createUser()`, `updateUser()`, `deleteUser()`
- [ ] 2.2.3 Rollen-Methoden: `listRoles()`, `assignRole()`, `removeRole()`
- [ ] 2.2.4 Token-Caching für Service-Account (Refresh bei Ablauf)
- [ ] 2.2.5 Error-Handling und Retry-Logik
- [ ] 2.2.6 Unit-Tests mit gemockter Keycloak Admin API

### 2.3 IAM-Service-Endpunkte

- [ ] 2.3.1 `GET /api/iam/users` – Paginierte User-Liste mit Filter (status, role, search)
- [ ] 2.3.2 `GET /api/iam/users/:id` – Einzelner User mit Rollen und Berechtigungen
- [ ] 2.3.3 `POST /api/iam/users` – User erstellen (Keycloak + IAM-DB, Rollback bei Fehler)
- [ ] 2.3.4 `PATCH /api/iam/users/:id` – User updaten (Admin-Operation)
- [ ] 2.3.5 `DELETE /api/iam/users/:id` – User deaktivieren/löschen
- [ ] 2.3.6 `POST /api/iam/users/bulk-delete` – Bulk-Deaktivierung
- [ ] 2.3.7 `PATCH /api/iam/users/me/profile` – Self-Service-Profilbearbeitung (nur erlaubte Felder)
- [ ] 2.3.8 `GET /api/iam/roles` – Rollen auflisten
- [ ] 2.3.9 `POST /api/iam/roles` – Custom-Rolle erstellen
- [ ] 2.3.10 `PATCH /api/iam/roles/:id` – Rolle bearbeiten (nur Custom)
- [ ] 2.3.11 `DELETE /api/iam/roles/:id` – Custom-Rolle löschen (mit Abhängigkeitsprüfung)
- [ ] 2.3.12 Route-Handler für alle Endpunkte in `@sva/auth` implementieren (Server-Funktionen)
- [ ] 2.3.13 Route-Factories für IAM-API in `@sva/routing` registrieren

### 2.4 JIT-Account-Erstellung

- [ ] 2.4.1 Hook in `handleCallback()` einbauen: Beim Erst-Login Account in IAM-DB erstellen
- [ ] 2.4.2 Account-Status `pending` bis Admin-Aktivierung
- [ ] 2.4.3 Activity-Log-Eintrag bei JIT-Erstellung
- [ ] 2.4.4 Tests für JIT-Provisioning (Erst-Login, Wieder-Login)

---

## Phase 3: Frontend – Account-Profilseite

### 3.1 Account-Profilseite (`/account`)

- [ ] 3.1.1 Route-Factory `/account` in `@sva/routing` erstellen (erfordert Authentifizierung)
- [ ] 3.1.2 `AccountProfilePage`-Komponente in `sva-studio-react` implementieren
- [ ] 3.1.3 Profil-Anzeige: Name, E-Mail, Telefon, Position, Abteilung, Avatar, Rolle, Status
- [ ] 3.1.4 Formular für editierbare Felder (Name, Telefon, Position, Abteilung, Sprache, Zeitzone)
- [ ] 3.1.5 Keycloak-Redirects für Passwort-Änderung, MFA, E-Mail-Änderung
- [ ] 3.1.6 Formular-Validierung (Pflichtfelder, Formate)
- [ ] 3.1.7 Speichern via `PATCH /api/iam/users/me/profile`
- [ ] 3.1.8 Alle UI-Texte über `t('account.*')` lokalisieren
- [ ] 3.1.9 A11y: WCAG 2.1 AA konform (Formular-Labels, Fokus-Management, ARIA)
- [ ] 3.1.10 Unit-Tests für `AccountProfilePage`

---

## Phase 4: Frontend – User-Administration

### 4.1 React-Hooks für User-Verwaltung

- [ ] 4.1.1 `useUsers()` Hook in `@sva/data` implementieren (Listing + CRUD via IAM-Service)
- [ ] 4.1.2 `useUser(userId)` Hook für Einzelabruf mit Rollen und Berechtigungen
- [ ] 4.1.3 `useRoles()` Hook für Rollen-Listing und CRUD
- [ ] 4.1.4 Unit-Tests für alle Hooks

### 4.2 User-Liste (`/admin/users`)

- [ ] 4.2.1 Route-Factory `/admin/users` in `@sva/routing` erstellen (Admin-Guard)
- [ ] 4.2.2 `UserListPage`-Komponente mit TanStack Table implementieren
- [ ] 4.2.3 Spalten: Name, E-Mail, Rolle, Status, Letzter Login
- [ ] 4.2.4 Suche (Name, E-Mail – Debounce 300ms)
- [ ] 4.2.5 Status-Filter (Aktiv, Inaktiv, Ausstehend)
- [ ] 4.2.6 Sortierung (alle Spalten)
- [ ] 4.2.7 Pagination (25 Einträge pro Seite)
- [ ] 4.2.8 Checkbox-Selektion + Bulk-Aktionen (Deaktivieren, Löschen)
- [ ] 4.2.9 „Nutzer anlegen"-Button mit Formular-Dialog
- [ ] 4.2.10 Navigation zu User-Bearbeitung (`/admin/users/:id`)
- [ ] 4.2.11 Loading-, Error- und Empty-States
- [ ] 4.2.12 Alle UI-Texte über `t('admin.users.*')` lokalisieren
- [ ] 4.2.13 A11y: Tabelle mit ARIA, Fokus-Management, Screenreader-Unterstützung
- [ ] 4.2.14 Unit-Tests für `UserListPage`

### 4.3 User-Bearbeitungsseite (`/admin/users/:userId`)

- [ ] 4.3.1 Route-Factory `/admin/users/$userId` in `@sva/routing` erstellen (Admin-Guard)
- [ ] 4.3.2 `UserEditPage`-Hauptkomponente mit Tab-Navigation (4 Tabs)
- [ ] 4.3.3 Tab 1 – Persönliche Daten: Name, E-Mail, Telefon, Position, Abteilung, Adresse
- [ ] 4.3.4 Tab 2 – Verwaltung: Status, Rollen-Zuweisung, Sprache, Zeitzone, Notizen
- [ ] 4.3.5 Tab 3 – Berechtigungen: Effektive Berechtigungs-Anzeige nach Ressourcentyp
- [ ] 4.3.6 Tab 4 – Historie: Activity-Log des Nutzers (chronologisch, paginiert)
- [ ] 4.3.7 Unsaved-Changes-Warnung bei Tab-Wechsel oder Seitenverlassen
- [ ] 4.3.8 Header-Card: Avatar, Name, Status-Badge, Rollen-Badge
- [ ] 4.3.9 Speichern via `PATCH /api/iam/users/:id`
- [ ] 4.3.10 Alle UI-Texte über `t('admin.users.*')` lokalisieren
- [ ] 4.3.11 A11y: Tab-Navigation, Formulare, ARIA
- [ ] 4.3.12 Unit-Tests für `UserEditPage` und alle Tab-Komponenten

---

## Phase 5: Frontend – Rollen-Verwaltung

### 5.1 Rollen-Seite (`/admin/roles`)

- [ ] 5.1.1 Route-Factory `/admin/roles` in `@sva/routing` erstellen (Admin-Guard, nur `system_admin`)
- [ ] 5.1.2 `RolesPage`-Komponente implementieren
- [ ] 5.1.3 Rollen-Tabelle: Name, Typ, Beschreibung, Nutzeranzahl
- [ ] 5.1.4 Expandierbare Berechtigungs-Matrix pro Rolle (Ressourcentyp × Aktion)
- [ ] 5.1.5 System-Rollen: Read-only-Matrix, nicht löschbar
- [ ] 5.1.6 Custom-Rolle erstellen: Formular mit Name, Beschreibung, Permissions-Auswahl
- [ ] 5.1.7 Custom-Rolle löschen: Abhängigkeitsprüfung + Bestätigungsdialog
- [ ] 5.1.8 Suche und Sortierung
- [ ] 5.1.9 Alle UI-Texte über `t('admin.roles.*')` lokalisieren
- [ ] 5.1.10 A11y: Matrix-Tabelle, expandierbare Rows, ARIA
- [ ] 5.1.11 Unit-Tests für `RolesPage`

---

## Phase 6: Integration + Qualitätssicherung

### 6.1 Integration

- [ ] 6.1.1 Navigation im Header/Sidebar: Links zu `/account`, `/admin/users`, `/admin/roles` (rollenbasiert)
- [ ] 6.1.2 Admin-Bereich nur für berechtigte Rollen sichtbar
- [ ] 6.1.3 E2E-Tests: Login → Profil anzeigen → Profil bearbeiten
- [ ] 6.1.4 E2E-Tests: Login als Admin → User-Liste → User bearbeiten → Rolle zuweisen
- [ ] 6.1.5 E2E-Tests: Login ohne Admin-Rolle → Admin-Bereich nicht erreichbar

### 6.2 Dokumentation

- [ ] 6.2.1 arc42 `05-building-block-view` aktualisieren (IAM-Service, Account-UI-Module)
- [ ] 6.2.2 arc42 `08-cross-cutting-concepts` aktualisieren (AuthProvider-Pattern, Permission-Checking)
- [ ] 6.2.3 arc42 `09-architecture-decisions` aktualisieren (Keycloak Admin API, Hybrid-Profil)
- [ ] 6.2.4 Developer-Guide: IAM-Service-API-Dokumentation
- [ ] 6.2.5 Keycloak-Setup-Anleitung (Service-Account, Realm-Konfiguration)

---

## Acceptance Criteria

**Phase 1 (Auth-Foundation):**
- [ ] `useAuth()`-Hook liefert korrekten Auth-State in der gesamten Anwendung
- [ ] Geschützte Routen leiten nicht-authentifizierte Nutzer auf Login weiter
- [ ] Admin-Routen sind nur für berechtigte Rollen erreichbar

**Phase 2 (Backend):**
- [ ] IAM-DB-Schema ist deployt und enthält 7-Personas-Seed-Daten
- [ ] `GET /api/iam/users` liefert paginierte User-Liste
- [ ] User-Erstellung synchronisiert Keycloak und IAM-DB atomar
- [ ] JIT-Provisioning erstellt Account beim Erst-Login

**Phase 3 (Profil):**
- [ ] Nutzer kann unter `/account` sein Profil einsehen
- [ ] Basis-Daten sind editierbar und werden gespeichert
- [ ] Passwort/MFA-Links leiten zu Keycloak Account Console weiter

**Phase 4 (User-Admin):**
- [ ] Admin kann unter `/admin/users` alle Nutzer auflisten, suchen und filtern
- [ ] Admin kann Nutzer erstellen, bearbeiten, deaktivieren
- [ ] 4-Tab-Ansicht für User-Bearbeitung funktioniert vollständig

**Phase 5 (Rollen):**
- [ ] Admin kann System-Rollen einsehen und Custom-Rollen erstellen/löschen
- [ ] Berechtigungs-Matrix zeigt effektive Permissions korrekt an

**Phase 6 (Integration):**
- [ ] Navigation zeigt Admin-Bereich nur für berechtigte Rollen
- [ ] E2E-Tests decken kritische Flows ab
- [ ] arc42-Dokumentation ist aktualisiert

---

**Gesamtfortschritt:** ❌ **0% COMPLETE** (0/78 Tasks)
**Last Updated:** 3. März 2026
