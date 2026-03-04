````markdown
# Design: Account- und User-Management-UI

## Kontext

Das SVA Studio benötigt eine UI für Self-Service-Profilverwaltung und administrative User-/Rollen-Verwaltung. Die Auth-Infrastruktur (`@sva/auth`) existiert bereits mit OIDC + Redis-Sessions, aber es fehlen Frontend-State-Management, IAM-Service-Endpunkte und die Verwaltungsoberflächen.

Das bestehende IAM-Schema (`0001_iam_core.sql`) liefert bereits Multi-Tenancy (`instance_id` + RLS), PII-Verschlüsselung (`*_ciphertext`) und Activity-Logging. Dieses Design baut darauf auf – kein Ersatz, sondern **Delta-Migration**.

Das Newcms liefert eine erprobte UX-Referenz (PersonsView, AccountEditView, RolesView), die nach Studio-Konventionen neu implementiert wird.

**Stakeholder:**
- Endnutzer (Profil-Self-Service)
- CMS-Administratoren (User- und Rollenverwaltung)
- Entwickler (Auth-Hooks, Permission-API)

**Constraints:**
- Monorepo mit strikter Package-Trennung (core → auth → data → routing → app)
- Keycloak als Identity Provider (bestehend, ADR-009)
- Bestehendes IAM-Schema mit `instance_id`-Scoping und RLS-Policies
- PII-Verschlüsselung via Application-Level Column Encryption (ADR-010)
- TanStack Router mit Factory-Pattern für Routing
- i18n-Pflicht: Keine hardcodierten Strings (`t('key')`)
- WCAG 2.1 AA / BITV 2.0 Barrierefreiheit
- Design-System (Tailwind + shadcn/ui-Patterns) – keine Inline-Styles

---

## Ziele / Non-Ziele

### Ziele

1. **Zentraler Auth-State:** Einmaliger `AuthProvider` + `useAuth()` Hook statt verteilter API-Calls
2. **Hybrid-Profilverwaltung:** Basis-Daten (Name, Telefon, Organisation) im Studio editierbar, Sicherheits-Einstellungen (Passwort, MFA, E-Mail) über Keycloak Account Console
3. **Admin-User-Verwaltung:** Volles CRUD für Nutzer-Accounts mit Suche, Filter, Bulk-Aktionen
4. **Rollen-Verwaltung:** Übersicht und Bearbeitung von System-Rollen und Custom-Rollen
5. **Keycloak-Synchronisation:** Änderungen im IAM-Service werden nach dem Keycloak-First-Prinzip synchronisiert
6. **Cache-Invalidierung:** Rollen- und Berechtigungsänderungen invalidieren den `PermissionSnapshotCache`

### Non-Ziele

- Hierarchische Org-Vererbung (Phase 2 von `setup-iam-identity-auth`)
- ABAC-Engine (Phase 3)
- Externes IdP-Management
- User-Import aus Legacy-Systemen
- DSGVO-Datenexport (Art. 20) – wird als separater Change nachgerüstet
- SCIM 2.0-Konformität – bewusst nicht in Phase 1 (API ist erweiterbar gestaltet)

---

## Entscheidungen

### 1. Package-Zuordnung

**Entscheidung:** Strikte Schichtentrennung nach bestehendem Monorepo-Muster. React-spezifische Bindings (AuthProvider, Hooks) leben in `sva-studio-react`, nicht in `@sva/data`.

| Schicht | Package | Verantwortung |
|---------|---------|---------------|
| Typen/Modelle | `@sva/core` | `IamAccountProfile`, `IamRole`, `IamPermission` |
| Server-Logik | `@sva/auth` | Keycloak Admin API Client (als Adapter hinter `IdentityProviderPort`), IAM-Service-Endpunkte, DB-Zugriff |
| Route-Factories | `@sva/routing` | `/account`, `/admin/users`, `/admin/users/:userId`, `/admin/roles` |
| React-Bindings | `sva-studio-react` | `AuthProvider`, `useAuth()`, `useUsers()`, `useRoles()`, UI-Komponenten |

**Rationale:**
- `@sva/data` ist framework-agnostisch (HTTP DataClient, IAM-Migrationen) und hat keine React-Dependency
- React-Hooks gehören in die App, wo React bereits Dependency ist
- Folgt dem bestehenden Dependency-Graph (`core → sdk → auth → routing → app`)
- Framework-agnostische Typen in `@sva/core` ermöglichen Wiederverwendung
- Klare Abstimmung mit `refactor-plugin-sdk-boundary`: Wenn die SDK-Grenze später React-Bindings als eigenes Package abtrennt, können die Hooks dorthin migriert werden. Bis dahin ist die Platzierung in der App die sicherste Option.

### 2. Auth-State-Management: React Context + `/auth/me`

**Entscheidung:** `AuthProvider` als React-Context in `sva-studio-react`, der `/auth/me` einmal lädt und cached.

```typescript
// sva-studio-react/src/providers/AuthProvider.tsx
type AuthState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
};

const useAuth = (): AuthState & {
  refetch: () => Promise<void>;
  logout: () => void;
  invalidatePermissions: () => void;
};
```

**Cache-Invalidierung bei Rollen-Änderungen:**
- Wenn über die Admin-UI Rollen geändert werden, wird `invalidatePermissions()` aufgerufen
- Dies löst eine Neuberechnung des `PermissionSnapshotCache` aus und refetcht `/auth/me`
- Der Cache wird auch invalidiert, wenn der Server bei einem API-Call `403` zurückgibt (Stale-Permissions-Erkennung)

**Rationale:**
- Nutzt den bestehenden `/auth/me`-Endpunkt (kein neuer API-Contract)
- Einfach und Server-State-basiert (kein Client-Token-Parsing nötig)
- Automatischer Refetch bei Token-Refresh
- Konsistent mit TanStack Router Loader-Pattern
- Cache-Invalidierung stellt Konsistenz nach Rollen-Änderungen sicher

**Alternativen betrachtet:**
- Zustand/Redux Store → Overhead, Auth-State ist Server-State
- Token-Parsing im Client → Sicherheitsbedenken, kein Bedarf (Token ist HttpOnly)
- Platzierung in `@sva/data` → Bricht Framework-Agnostik (kein React in `@sva/data`)

### 3. Profil-Bearbeitung: Hybrid-Ansatz

**Entscheidung:** Basis-Daten im Studio, Sicherheits-Daten über Keycloak.

| Datenfeld | Wo bearbeiten | Backend |
|-----------|---------------|---------|
| Name, Telefon, Position, Abteilung | Studio-Formular | IAM-DB + Keycloak User Attributes |
| E-Mail, Passwort | Keycloak Account Console (Redirect) | Keycloak |
| MFA/2FA | Keycloak Account Console (Redirect) | Keycloak |
| Avatar/Profilbild | Studio-Formular | IAM-DB (Asset-Storage TBD) |
| Sprache, Zeitzone | Studio-Formular | IAM-DB |

**Keycloak-Redirect-UX:**
- Vor dem Redirect wird ein Hinweis angezeigt: „Sie werden zur Keycloak-Kontoverwaltung weitergeleitet"
- Link zeigt externes Ziel an (externes-Link-Icon, `aria-label` mit Hinweis)
- Redirect-URL enthält `kc_action` und Rückkehr-URL (`redirect_uri` → `/account?returnedFromKeycloak=true`)
- Bei Abbruch durch den Nutzer (Browser-Zurück) landet er wieder auf `/account`
- Öffnet im selben Tab (kein neuer Tab – konsistente Navigation)

**Keycloak Account Console URL:**
```
{issuer}/realms/{realm}/account/
```

**Rationale:**
- Sicherheits-sensible Operationen bleiben in Keycloak (bewährt, E-Mail-Verifizierung, MFA-Flows)
- Basis-Daten direkt editierbar (bessere UX, kein Context-Switch)
- Keycloak Account Console ist out-of-the-box verfügbar

### 4. IAM-Service: CMS-Backend + Keycloak Admin API

**Entscheidung:** Ein IAM-Service im CMS-Backend mit einer `IdentityProviderPort`-Abstraktionsschicht, der CMS-IAM-DB und Keycloak synchron hält.

```
Browser → CMS-Backend (IAM-Service) → IAM-DB (Postgres)
                                     → IdentityProviderPort → KeycloakAdapter → Keycloak Admin API
```

**IdP-Abstraktionsschicht (`@sva/core`):**
```typescript
interface IdentityProviderPort {
  createUser(data: CreateUserInput): Promise<{ externalId: string }>;
  updateUser(externalId: string, data: UpdateUserInput): Promise<void>;
  deactivateUser(externalId: string): Promise<void>;
  syncRoles(externalId: string, roles: string[]): Promise<void>;
}
```
Der `KeycloakAdminClient` implementiert dieses Interface als Adapter. Ein späterer IdP-Wechsel (z. B. Authentik, Zitadel, BundID) erfordert dann nur einen neuen Adapter.

**Keycloak Admin API Operationen:**
- `GET /admin/realms/{realm}/users` – User auflisten
- `POST /admin/realms/{realm}/users` – User erstellen
- `PUT /admin/realms/{realm}/users/{id}` – User updaten
- `DELETE /admin/realms/{realm}/users/{id}` – User löschen (Deaktivierung)
- `GET /admin/realms/{realm}/roles` – Realm-Rollen
- `POST /admin/realms/{realm}/users/{id}/role-mappings/realm` – Rollen zuweisen

**Keycloak-Mindestversion:** >= 22.0 (dokumentiert in Deployment-Voraussetzungen)

**Keycloak Service-Account-Konfiguration (Vorschlag):**

| Parameter | Wert |
|-----------|------|
| **Realm** | `sva-studio` (oder der bestehende App-Realm) |
| **Client-ID** | `sva-studio-iam-service` |
| **Client-Typ** | Confidential, Service Account Enabled |
| **Client-Rolle** | `realm-management` → nur `manage-users`, `view-users`, `manage-realm` |
| **Secret-Injection** | Über Secrets-Manager (Vault/K8s-Secrets), **nicht** als `.env`-Datei |
| **Token-Lebensdauer** | 5 Minuten (Service-Account-Token) |
| **Secret-Rotation** | Alle 90 Tage (BSI-Grundschutz ORP.4) |

**Env-Variablen:**
```
KEYCLOAK_ADMIN_CLIENT_ID=sva-studio-iam-service
KEYCLOAK_ADMIN_CLIENT_SECRET=<injected-via-secrets-manager>
KEYCLOAK_ADMIN_REALM=sva-studio
KEYCLOAK_ADMIN_BASE_URL=https://keycloak.example.com
```

**Sync-Strategie: Keycloak-First mit Compensation**

Für alle mutierenden Operationen gilt: Keycloak wird **zuerst** geschrieben, dann die IAM-DB.

| Operation | Reihenfolge | Bei Fehler |
|-----------|------------|------------|
| User erstellen | 1. Keycloak `POST` → 2. IAM-DB `INSERT` | DB-Fehler → Keycloak `DELETE` (Compensation) |
| User updaten | 1. Keycloak `PUT` → 2. IAM-DB `UPDATE` | DB-Fehler → Keycloak `PUT` mit alten Daten |
| Profil-Self-Service | 1. Keycloak `PUT` → 2. IAM-DB `UPDATE` | DB-Fehler → Keycloak `PUT` Rollback |
| User deaktivieren | 1. IAM-DB `UPDATE status` → 2. Keycloak `PUT enabled=false` | Keycloak-Fehler → IAM-DB Rollback |

**Circuit-Breaker für Keycloak-Ausfälle:**
- Timeouts: 5s connect, 10s read für alle Keycloak Admin API Calls
- Retry: Max. 3 Versuche mit Exponential Backoff (1s, 2s, 4s)
- Circuit-Breaker: Nach 5 aufeinanderfolgenden Fehlern → Open-State für 30s
- Degraded-Mode: Read-Operationen (`GET /api/v1/iam/users`) nutzen IAM-DB als Fallback; Write-Operationen geben `503 Service Unavailable` zurück
- Health-Check: `/health/ready` prüft Keycloak-Konnektivität

**Rationale:**
- CMS-IAM-DB hält erweiterte Daten (PII-verschlüsselt, Audit-Logs)
- Keycloak hält Identity-Daten (Login, Token, MFA)
- Compensation stellt Konsistenz sicher (statt verteilter Transaktionen)
- `IdentityProviderPort` entkoppelt von konkretem IdP (Vendor-unabhängig)
- Entspricht dem Architekturkonzept aus `concepts/konzeption-cms-v2/03_Systemarchitektur/Umsetzung-Rollen-Rechte.md`

### 5. Routing: Factory-Pattern mit Admin-Guard

**Entscheidung:** Neue Route-Factories nach bestehendem Pattern in `@sva/routing`. Alle IAM-API-Pfade sind versioniert mit `/api/v1/iam/...`.

```typescript
// Route-Hierarchie (Frontend)
/account                → AccountProfilePage (authentifiziert)
/admin/users            → UserListPage (Rolle: system_admin/app_manager)
/admin/users/:userId    → UserEditPage (Rolle: system_admin/app_manager)
/admin/roles            → RolesPage (Rolle: system_admin)

// API-Endpunkte (Backend, versioniert)
/api/v1/iam/users       → User-CRUD
/api/v1/iam/roles       → Rollen-CRUD
/api/v1/iam/users/me/profile → Self-Service
```

**Admin-Guard:**
```typescript
// beforeLoad Guard in Route-Factory
const adminGuard = async ({ context }) => {
  const user = await context.auth.getUser();
  if (!user?.roles.includes('system_admin') && !user?.roles.includes('app_manager')) {
    throw redirect({ to: '/' });
  }
};
```

**Route-Guards arbeiten über eine generische `context`-Schnittstelle** – nicht direkt über `useAuth()`. TanStack Router's `beforeLoad` erhält Context über `routerContext`, der beim Root-Layout mit dem Auth-State befüllt wird.

### 6. Sicherheit und Compliance in IAM-Endpunkten

**Entscheidung:** Alle IAM-Endpunkte validieren Eingaben serverseitig, erzwingen Autorisierung und sind gegen CSRF geschützt.

**Verbindliche Leitlinien:**
- Serverseitige Schema-Validierung mit **Zod** für `POST`/`PATCH`/`DELETE`-Payloads (Zod ist bereits im Stack)
- Rollenprüfung im Handler (`system_admin`/`app_manager`) auch dann, wenn ein Client den Frontend-Guard umgeht
- **Privilege-Escalation-Schutz:** Ein Nutzer kann nur Rollen zuweisen, die <= seiner eigenen höchsten Rolle sind. `system_admin`-Zuweisung erfordert `system_admin`. Der letzte aktive `system_admin` kann nicht entfernt werden (Last-Admin-Schutz).
- **CSRF-Schutz:** Double-Submit-Cookie-Pattern für alle mutierenden IAM-Endpunkte (`POST`, `PATCH`, `DELETE`). Alternativ `SameSite=Strict` für Session-Cookie + Custom-Header-Prüfung (`X-Requested-With`).
- **Rate Limiting:** 60 req/min für Read-Endpunkte, 10 req/min für Write-Endpunkte pro Session/IP. Separate Limits für Bulk-Operationen (max. 3 req/min).
- **Bulk-Aktionen:** Max. Batch-Größe 50 Nutzer. Aktueller Nutzer und letzter aktiver `system_admin` werden automatisch aus Bulk-Operationen ausgeschlossen (Self-Protection).
- Operative Logs ausschließlich über SDK Logger (`@sva/sdk`), keine `console.*`
- Keine Klartext-PII in operativen Logs; Audit-Events verwenden pseudonymisierte/strukturierte Felder
- DB-Textfelder mit Längenbegrenzungen: `email VARCHAR(320)`, `display_name VARCHAR(200)`, `phone VARCHAR(50)`, `notes TEXT CHECK (length(notes) <= 2000)`

**DSGVO-Löschkonzept (zweistufig):**
1. **Deaktivierung:** Account-Status wird auf `inactive` gesetzt, Keycloak-Account wird deaktiviert (`enabled=false`)
2. **Anonymisierung:** Nach Ablauf der Aufbewahrungsfrist (konfigurierbar, Standard: 90 Tage nach Deaktivierung) werden PII-Felder anonymisiert (`SET NULL` bzw. anonymisierter Hash). Activity-Logs behalten `account_id` als Pseudonym, `actor_id`/`subject_id` werden durch Pseudonym ersetzt.

**Rationale:**
- Frontend-Guards sind UX, aber keine Sicherheitsgrenze
- CSRF-Schutz ist bei Cookie-basierter Auth Pflicht
- Privilege-Escalation-Schutz verhindert horizontale Rechteausweitung
- Konsistente Validation reduziert inkonsistente IAM-Daten und Fehlerfolgekosten
- Logging-Standards erfüllen bestehende Compliance-Anforderungen in `iam-core`

### 7. UI-Implementierung: Newcms als Referenz, nicht als Quelle

**Entscheidung:** Neu implementieren nach Studio-Konventionen, Newcms als UX-Referenz.

| Newcms-Komponente | Studio-Äquivalent | Anpassung |
|---|---|---|
| `PersonsViewNew.tsx` (Custom-Table) | `UserListPage` mit TanStack Table | Studio-Table-Pattern, i18n |
| `AccountEditView.tsx` (4 Tabs) | `UserEditPage` mit Tab-Routing | TanStack Router Tabs, i18n |
| `RolesView.tsx` (Mock-Daten) | `RolesPage` mit API-Anbindung | Gegen IAM-Service, nicht Mocks |
| `UserContext.tsx` (hardcoded Users) | `AuthProvider` via `/auth/me` | Server-State, kein Mock |
| State-basiertes Routing | TanStack Router | Typsicheres URL-Routing |
| Hardcoded Strings | `t('key')` | i18n mit Namespace `account.*`, `admin.*` |

### 8. DB-Migrations-Tooling

**Entscheidung:** Raw SQL-Migrationen in `packages/data/migrations/up/`, konsistent mit dem bestehenden Pattern (`0001_iam_core.sql`).

- Neue Migration: `0004_iam_account_profile.sql` (oder nächste freie Nummer)
- Jede Migration hat ein korrespondierendes Down-Script in `packages/data/migrations/down/`
- Schema-Änderungen sind backward-compatible (Expand/Contract-Pattern)
- Idempotente Seed-Scripts für System-Rollen

**Rationale:**
- Konsistent mit bestehendem Tooling (kein neues Framework nötig)
- Down-Migrations ermöglichen Rollback bei fehlgeschlagenem Deployment

### 9. Audit-Logging und Observability

**Entscheidung:** Umfassendes Compliance-Logging mit definierter Retention, technischer Immutabilität und vollständiger Event-Taxonomie. Compliance vor Minimalismus.

**Log-Retention:**
- Audit-Logs (`iam.activity_logs`): 365 Tage aktiv, dann Archivierung
- Operative Logs (Loki/OTEL): 90 Tage
- Partitionierung von `iam.activity_logs` nach `created_at` (monatlich)

**Immutabilitäts-Durchsetzung:**
```sql
CREATE OR REPLACE FUNCTION iam.prevent_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs are immutable – UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_immutable_activity_logs
  BEFORE UPDATE OR DELETE ON iam.activity_logs
  FOR EACH ROW EXECUTE FUNCTION iam.prevent_activity_log_mutation();
```

**Event-Type-Enumeration (verbindlich):**

| Event-Type | Auslöser |
|---|---|
| `user.created` | User-Erstellung (Admin) |
| `user.updated` | Profil-Änderung (Admin) |
| `user.deactivated` | Account-Deaktivierung |
| `user.deleted` | Account-Löschung/Anonymisierung |
| `user.bulk_deactivated` | Bulk-Deaktivierung |
| `user.jit_provisioned` | JIT-Account beim Erst-Login |
| `role.assigned` | Rollen-Zuweisung |
| `role.removed` | Rollen-Entfernung |
| `role.created` | Custom-Rolle erstellt |
| `role.deleted` | Custom-Rolle gelöscht |
| `profile.self_updated` | Self-Service-Profilbearbeitung |
| `auth.unauthorized_access` | 403 bei IAM-Endpunkt |
| `keycloak.sync_failed` | Sync-Fehler mit Keycloak |

**Correlation-IDs:**
- Jeder IAM-Handler führt `request_id` als Context-Feld mit
- OTEL Trace-Context (`W3C traceparent` Header) wird an Keycloak Admin API Calls propagiert
- `request_id` wird auch in `iam.activity_logs.payload` gespeichert (Zuordnung operatives Log <-> Audit-Log)

**PII-Feldklassifikation:**

| Feld | PII-Stufe | In operativen Logs? | In Audit-Logs? |
|---|---|---|---|
| `email` | PII (verschlüsselt) | Maskiert (`u***@example.com`) | Nur als `account_id` |
| `phone` | PII (verschlüsselt) | Nicht loggen | Nicht loggen |
| `first_name`, `last_name` | PII (verschlüsselt) | Nicht loggen | Nur als `account_id` |
| `keycloak_subject` | Intern | OK | OK |
| `account_id` (UUID) | Pseudonym | OK | OK |
| Service-Account-Token | Secret | Niemals | Niemals |

**Logger-Component-Labels:**

| Modul | Component-Label |
|---|---|
| IAM-Service-Handler | `iam-service` |
| Keycloak Admin API Client | `iam-keycloak` |
| JIT-Provisioning | `iam-jit` |

**Rationale:**
- IAM-Daten sind compliance-kritisch – umfassendes Logging überwiegt Minimalismus
- Immutabilitäts-Trigger verhindert nachträgliche Manipulation
- Event-Enum macht Audit-Logs querybar und migrierbar
- PII-Klassifikation schützt vor versehentlichem Klartext-Logging

### 10. Responsive Design und Barrierefreiheit

**Entscheidung:** Alle Account- und Admin-Views sind responsive und WCAG 2.1 AA / BITV 2.0 konform.

**Breakpoints:**
- Desktop: >= 1024px (Tabellen-Layout, volle Sidebar)
- Tablet: 768px–1023px (kompaktere Tabelle, eingeklappte Sidebar)
- Mobile: < 768px (Card-Layout statt Tabelle, Tabs als horizontale Scroll-Leiste oder Dropdown)

**Touch-Targets:** Mindestens 44x44px (WCAG 2.5.5)

**ARIA-Pattern-Referenzen (verbindlich):**
- **Tabs:** WAI-ARIA Tabs Pattern (`role="tablist"`, `role="tab"`, `role="tabpanel"`, `aria-selected`, `aria-controls`, Arrow-Keys für Tab-Wechsel, `Home`/`End`)
- **Tabellen:** Semantisches `<table>`-Markup, `<th scope="col|row">`, `aria-sort` für sortierbare Spalten, `<caption>` oder `aria-label` pro Tabelle
- **Expandierbare Rows:** `aria-expanded`, `aria-controls`
- **Dialoge:** `role="alertdialog"` für Warnungen, `role="dialog"` für Formulare, Focus-Trap, `aria-modal="true"`, Escape zum Schließen
- **Status-Badges:** Neben Farbe immer ein Text-Label und/oder differenzierendes Icon. Kontrastverhältnis >= 4.5:1 (WCAG 1.4.1 + 1.4.3)
- **Formular-Validierung:** `aria-invalid="true"` auf fehlerhaften Feldern, `aria-describedby` für Fehlertexte, Error-Summary am Formularanfang, `aria-required="true"` für Pflichtfelder
- **Loading-States:** `aria-busy="true"` auf dem Container, `role="status"` für Spinner/Skeleton

---

## Datenmodell

### Bestehendes IAM-Schema (Referenz)

Das bestehende Schema in `0001_iam_core.sql` definiert:
- `iam.instances` – Mandanten
- `iam.accounts` – mit `keycloak_subject`, `email_ciphertext`, `display_name_ciphertext`
- `iam.organizations` – Organisationseinheiten
- `iam.roles` – mit `instance_id`, `role_name`, `is_system_role`
- `iam.permissions` – mit `instance_id`, `permission_key`
- `iam.instance_memberships`, `iam.account_organizations`, `iam.account_roles`, `iam.role_permissions`
- `iam.activity_logs` – mit `instance_id`, `account_id`, `event_type`, `payload` (JSONB), `request_id`, `trace_id`
- RLS-Policies auf allen Tabellen via `iam.current_instance_id()`

### Delta-Migration (`0004_iam_account_profile.sql`)

```sql
-- ============================================================
-- Delta-Migration: Account-Profilfelder und Audit-Erweiterungen
-- Setzt auf 0001_iam_core.sql auf – kein Ersatz!
-- ============================================================

-- 1. Profilfelder in iam.accounts ergänzen (PII-verschlüsselt, ADR-010)
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS first_name_ciphertext TEXT;
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS last_name_ciphertext TEXT;
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS phone_ciphertext TEXT;
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS position VARCHAR(200);
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS department VARCHAR(200);
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS preferred_language VARCHAR(10) DEFAULT 'de';
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'Europe/Berlin';
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'
  CHECK (status IN ('active', 'inactive', 'pending'));
ALTER TABLE iam.accounts ADD COLUMN IF NOT EXISTS notes TEXT CHECK (length(notes) <= 2000);

-- 2. Temporale Constraints für Rollen-Zuweisungen
ALTER TABLE iam.account_roles ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES iam.accounts(id);
ALTER TABLE iam.account_roles ADD COLUMN IF NOT EXISTS valid_from TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE iam.account_roles ADD COLUMN IF NOT EXISTS valid_to TIMESTAMPTZ;

-- 3. System-Rollen als is_system_role markieren (idempotent)
-- Die konkreten Rollen-Namen werden durch Seed-Script eingefügt;
-- die Liste ist vorläufig und wird sich im Laufe der Entwicklung noch anpassen.

-- 4. Activity-Log-Erweiterungen (Compliance)
ALTER TABLE iam.activity_logs ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES iam.accounts(id) ON DELETE SET NULL;
ALTER TABLE iam.activity_logs ADD COLUMN IF NOT EXISTS result VARCHAR(20) DEFAULT 'success'
  CHECK (result IN ('success', 'failure'));

-- 5. Immutabilitäts-Trigger für Audit-Logs
CREATE OR REPLACE FUNCTION iam.prevent_activity_log_mutation()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'activity_logs are immutable – UPDATE and DELETE are forbidden';
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_immutable_activity_logs ON iam.activity_logs;
CREATE TRIGGER trg_immutable_activity_logs
  BEFORE UPDATE OR DELETE ON iam.activity_logs
  FOR EACH ROW EXECUTE FUNCTION iam.prevent_activity_log_mutation();

-- 6. Performance-Indizes
CREATE INDEX IF NOT EXISTS idx_accounts_status ON iam.accounts(status);
CREATE INDEX IF NOT EXISTS idx_accounts_keycloak_subject ON iam.accounts(keycloak_subject);
CREATE INDEX IF NOT EXISTS idx_activity_logs_subject_created
  ON iam.activity_logs(subject_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_account_created
  ON iam.activity_logs(account_id, created_at DESC);
```

### TypeScript-Typen (`@sva/core`)

```typescript
/**
 * Applikationsseitiger User-Typ (entschlüsselte PII).
 * Spaltenname-Mapping: keycloak_subject → keycloakSubject,
 * *_ciphertext-Felder werden im Service-Layer entschlüsselt.
 */
export type IamAccountProfile = {
  id: string;
  keycloakSubject: string;   // konsistent mit DB-Spalte
  instanceId: string;         // Pflicht wegen Multi-Tenancy
  // Entschlüsselte Felder (nur in Service-Response, nicht DB-nah):
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  // Nicht-PII-Felder:
  position?: string;
  department?: string;
  avatarUrl?: string;
  preferredLanguage: string;
  timezone: string;
  status: 'active' | 'inactive' | 'pending';
  notes?: string;
  roles: IamRole[];
  lastLogin?: string;        // Abgeleitet aus Session-Store oder Keycloak
  createdAt: string;
  updatedAt: string;
};

export type IamRole = {
  id: string;
  instanceId: string;
  roleName: string;         // konsistent mit DB-Spalte role_name
  displayName?: string;     // abgeleitet aus i18n oder description
  isSystemRole: boolean;    // konsistent mit DB-Spalte is_system_role
  description?: string;
  permissions: IamPermission[];
};

export type IamPermission = {
  id: string;
  instanceId: string;
  permissionKey: string;    // konsistent mit DB-Spalte permission_key
  description?: string;
};

export type AccountProfileUpdate = Pick<IamAccountProfile,
  'displayName' | 'firstName' | 'lastName' | 'phone' |
  'position' | 'department' | 'avatarUrl' | 'preferredLanguage' | 'timezone'
>;

/** Port-Interface für IdP-Abstraktionsschicht */
export interface IdentityProviderPort {
  createUser(data: CreateUserInput): Promise<{ externalId: string }>;
  updateUser(externalId: string, data: UpdateUserInput): Promise<void>;
  deactivateUser(externalId: string): Promise<void>;
  syncRoles(externalId: string, roles: string[]): Promise<void>;
}

export type CreateUserInput = {
  email: string;
  firstName: string;
  lastName: string;
  enabled: boolean;
};

export type UpdateUserInput = Partial<CreateUserInput> & {
  attributes?: Record<string, string[]>;
};
```

### API-Response-Format (einheitlich)

Alle `/api/v1/iam/*`-Endpunkte verwenden ein konsistentes Envelope-Format:

```typescript
// Erfolg (Liste)
type ApiListResponse<T> = {
  data: T[];
  meta: { total: number; page: number; pageSize: number };
};

// Erfolg (Einzelobjekt)
type ApiItemResponse<T> = {
  data: T;
};

// Fehler
type ApiErrorResponse = {
  error: {
    code: string;        // z.B. 'VALIDATION_ERROR', 'FORBIDDEN', 'NOT_FOUND'
    message: string;     // Menschenlesbarer Fehlertext
    details?: object;    // Feldspezifische Fehler bei Validierung
  };
};
```

**HTTP-Statuscodes pro Endpunkt:**

| Situation | Status | Code |
|-----------|--------|------|
| Erfolg (Liste) | `200 OK` | – |
| Erfolg (Erstellen) | `201 Created` | – |
| Validierungsfehler | `400 Bad Request` | `VALIDATION_ERROR` |
| Nicht authentifiziert | `401 Unauthorized` | `UNAUTHORIZED` |
| Nicht autorisiert | `403 Forbidden` | `FORBIDDEN` |
| Nicht gefunden | `404 Not Found` | `NOT_FOUND` |
| Konflikt (z. B. Duplikat) | `409 Conflict` | `CONFLICT` |
| Rate Limit | `429 Too Many Requests` | `RATE_LIMITED` |
| Keycloak nicht erreichbar | `503 Service Unavailable` | `KC_UNAVAILABLE` |

---

## Risiken / Trade-offs

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| Keycloak Admin API erfordert hochprivilegierten Service-Account | Mittel | Principle of Least Privilege (nur `manage-users`, `view-users`), Secret-Rotation alle 90 Tage, Secrets-Manager |
| Sync-Konflikte CMS-DB <-> Keycloak | Mittel | Keycloak-First-Sync mit Compensation; Reconciliation-Job als Folge-Change |
| DB-Schema-Migration im laufenden Betrieb | Niedrig | Feature-Flag `iam-ui-enabled` als Kill-Switch, Backward-Compatible-Migrations (Expand/Contract) |
| Newcms-Features divergieren während Migration | Niedrig | Newcms als Referenz-Snapshot, nicht als Moving Target |
| Rollen-Seed-Daten ändern sich | Niedrig | Migrations-basiertes Seeding, idempotente Scripts; Rollen sind vorläufig und werden sich entwickeln |
| Keycloak-Ausfall blockiert IAM-Operationen | Mittel | Circuit-Breaker, Degraded-Mode für Read-Ops, Health-Checks |
| PII-Leak in Logs | Hoch | PII-Feldklassifikation, SDK Logger, Code-Review-Prüfpunkt |

---

## Beantwortete Fragen

| Frage | Antwort |
|-------|---------|
| Keycloak Service-Account | Eigener Client `sva-studio-iam-service` im App-Realm mit eingeschränkter `realm-management`-Rolle. Secret über Secrets-Manager. Siehe Entscheidung 4. |
| Asset-Storage für Profilbilder | Eigener Dienst oder Keycloak User Attributes → TBD (nicht blockierend für Phase 1, `avatar_url` als Platzhalter) |
| DB-Migrations-Tooling | Raw SQL-Migrationen (Entscheidung 8), konsistent mit bestehendem Pattern |
| Keycloak Account Console | Standard-Theme zunächst; Custom Theme als Folge-Change |
| Koordination mit `refactor-plugin-sdk-boundary` | React-Hooks leben vorerst in `sva-studio-react`. Wenn die SDK-Grenze später ein `@sva/react`-Package abtrennt, werden die Hooks dorthin migriert. Kein Blocker. |

---

**Document Version:** 2.0
**Last Updated:** 4. März 2026

````
