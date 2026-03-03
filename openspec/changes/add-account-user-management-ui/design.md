# Design: Account- und User-Management-UI

## Kontext

Das SVA Studio benötigt eine UI für Self-Service-Profilverwaltung und administrative User-/Rollen-Verwaltung. Die Auth-Infrastruktur (`@sva/auth`) existiert bereits mit OIDC + Redis-Sessions, aber es fehlen Frontend-State-Management, IAM-Service-Endpunkte und die Verwaltungsoberflächen.

Das Newcms liefert eine erprobte UX-Referenz (PersonsView, AccountEditView, RolesView), die nach Studio-Konventionen neu implementiert wird.

**Stakeholder:**
- Endnutzer (Profil-Self-Service)
- CMS-Administratoren (User- und Rollenverwaltung)
- Entwickler (Auth-Hooks, Permission-API)

**Constraints:**
- Monorepo mit strikter Package-Trennung (core → auth → data → routing → app)
- Keycloak als Identity Provider (bestehend)
- TanStack Router mit Factory-Pattern für Routing
- i18n-Pflicht: Keine hardcodierten Strings (`t('key')`)
- WCAG 2.1 AA Barrierefreiheit
- Design-System (Tailwind + shadcn/ui-Patterns) – keine Inline-Styles

---

## Ziele / Non-Ziele

### Ziele

1. **Zentraler Auth-State:** Einmaliger `AuthProvider` + `useAuth()` Hook statt verteilter API-Calls
2. **Hybrid-Profilverwaltung:** Basis-Daten (Name, Telefon, Organisation) im Studio editierbar, Sicherheits-Einstellungen (Passwort, MFA, E-Mail) über Keycloak Account Console
3. **Admin-User-Verwaltung:** Volles CRUD für Nutzer-Accounts mit Suche, Filter, Bulk-Aktionen
4. **Rollen-Verwaltung:** Übersicht und Bearbeitung von System-Rollen (7 Personas) und Custom-Rollen
5. **Keycloak-Synchronisation:** Änderungen in der IAM-DB werden bidirektional mit Keycloak synchronisiert

### Non-Ziele

- Multi-Tenancy / Org-Scoping (Phase 2 von `setup-iam-identity-auth`)
- ABAC-Engine (Phase 3)
- Hierarchische Org-Vererbung
- Externes IdP-Management
- User-Import aus Legacy-Systemen

---

## Entscheidungen

### 1. Package-Zuordnung

**Entscheidung:** Strikte Schichtentrennung nach bestehendem Monorepo-Muster.

| Schicht | Package | Verantwortung |
|---------|---------|---------------|
| Typen/Modelle | `@sva/core` | `IamUser`, `IamRole`, `Permission`, `AccountProfile` |
| Server-Logik | `@sva/auth` | Keycloak Admin API Client, IAM-Service-Endpunkte, DB-Zugriff |
| React-Bindings | `@sva/data` | `AuthProvider`, `useAuth()`, `useUsers()`, `useRoles()` |
| Route-Factories | `@sva/routing` | `/account`, `/admin/users`, `/admin/users/:id`, `/admin/roles` |
| UI-Komponenten | `sva-studio-react` | Seiten und Komponenten |

**Rationale:**
- Folgt dem bestehenden Dependency-Graph (`core → sdk → auth → routing → app`)
- Framework-agnostische Typen in `@sva/core` ermöglichen Wiederverwendung
- React-Hooks in `@sva/data` sind konsistent mit dem bestehenden `createDataClient()`-Pattern

### 2. Auth-State-Management: React Context + `/auth/me`

**Entscheidung:** `AuthProvider` als React-Context, der `/auth/me` einmal lädt und cached.

```typescript
// @sva/data
type AuthState = {
  user: SessionUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | null;
};

const useAuth = (): AuthState & {
  refetch: () => Promise<void>;
  logout: () => void;
};
```

**Rationale:**
- ✅ Nutzt den bestehenden `/auth/me`-Endpunkt (kein neuer API-Contract)
- ✅ Einfach und Server-State-basiert (kein Client-Token-Parsing nötig)
- ✅ Automatischer Refetch bei Token-Refresh
- ✅ Konsistent mit TanStack Router Loader-Pattern

**Alternativen betrachtet:**
- Zustand/Redux Store → Overhead, Auth-State ist Server-State
- Token-Parsing im Client → Sicherheitsbedenken, kein Bedarf (Token ist HttpOnly)

### 3. Profil-Bearbeitung: Hybrid-Ansatz

**Entscheidung:** Basis-Daten im Studio, Sicherheits-Daten über Keycloak.

| Datenfeld | Wo bearbeiten | Backend |
|-----------|---------------|---------|
| Name, Telefon, Position, Abteilung | Studio-Formular | IAM-DB + Keycloak User Attributes |
| E-Mail, Passwort | Keycloak Account Console (Redirect) | Keycloak |
| MFA/2FA | Keycloak Account Console (Redirect) | Keycloak |
| Avatar/Profilbild | Studio-Formular | IAM-DB (Asset-Storage TBD) |
| Sprache, Zeitzone | Studio-Formular | IAM-DB |

**Rationale:**
- ✅ Sicherheits-sensible Operationen bleiben in Keycloak (bewährt, E-Mail-Verifizierung, MFA-Flows)
- ✅ Basis-Daten direkt editierbar (bessere UX, kein Context-Switch)
- ✅ Keycloak Account Console ist out-of-the-box verfügbar

**Keycloak Account Console URL:**
```
{issuer}/realms/{realm}/account/
```

### 4. IAM-Service: CMS-Backend + Keycloak Admin API

**Entscheidung:** Ein IAM-Service im CMS-Backend, der CMS-IAM-DB und Keycloak synchron hält.

```
Browser → CMS-Backend (IAM-Service) → IAM-DB (Postgres)
                                     → Keycloak Admin API
```

**Keycloak Admin API Operationen:**
- `GET /admin/realms/{realm}/users` – User auflisten
- `POST /admin/realms/{realm}/users` – User erstellen
- `PUT /admin/realms/{realm}/users/{id}` – User updaten
- `DELETE /admin/realms/{realm}/users/{id}` – User löschen
- `GET /admin/realms/{realm}/roles` – Realm-Rollen
- `POST /admin/realms/{realm}/users/{id}/role-mappings/realm` – Rollen zuweisen

**Authentifizierung:** Service-Account mit `realm-management`-Client-Rolle in Keycloak.

**Rationale:**
- ✅ CMS-IAM-DB hält erweiterte Daten (Telefon, Abteilung, Custom-Permissions, Audit-Logs)
- ✅ Keycloak hält Identity-Daten (Login, Token, MFA)
- ✅ Bidirektionale Sync stellt Konsistenz sicher
- ✅ Entspricht dem Architekturkonzept aus `concepts/konzeption-cms-v2/03_Systemarchitektur/Umsetzung-Rollen-Rechte.md`

### 5. Routing: Factory-Pattern mit Admin-Guard

**Entscheidung:** Neue Route-Factories nach bestehendem Pattern in `@sva/routing`.

```typescript
// Route-Hierarchie
/account                → AccountProfilePage (authentifiziert)
/admin/users            → UserListPage (Rolle: admin/app_manager)
/admin/users/:userId    → UserEditPage (Rolle: admin/app_manager)
/admin/roles            → RolesPage (Rolle: admin)
```

**Admin-Guard:**
```typescript
// beforeLoad Guard in Route-Factory
const adminGuard = async ({ context }) => {
  const user = await context.auth.getUser();
  if (!user?.roles.includes('admin') && !user?.roles.includes('app_manager')) {
    throw redirect({ to: '/' });
  }
};
```

### 6. UI-Implementierung: Newcms als Referenz, nicht als Quelle

**Entscheidung:** Neu implementieren nach Studio-Konventionen, Newcms als UX-Referenz.

| Newcms-Komponente | Studio-Äquivalent | Anpassung |
|---|---|---|
| `PersonsViewNew.tsx` (Custom-Table) | `UserListPage` mit TanStack Table | Studio-Table-Pattern, i18n |
| `AccountEditView.tsx` (4 Tabs) | `UserEditPage` mit Tab-Routing | TanStack Router Tabs, i18n |
| `RolesView.tsx` (Mock-Daten) | `RolesPage` mit API-Anbindung | Gegen IAM-Service, nicht Mocks |
| `UserContext.tsx` (hardcoded Users) | `AuthProvider` via `/auth/me` | Server-State, kein Mock |
| State-basiertes Routing | TanStack Router | Typsicheres URL-Routing |
| Hardcoded Strings | `t('key')` | i18n mit Namespace `account.*`, `admin.*` |

---

## Datenmodell

### IAM-DB Schema (Postgres, Subset für Phase 1)

```sql
-- Accounts: User-Stammdaten mit Keycloak-Mapping
CREATE TABLE iam.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  keycloak_id TEXT UNIQUE NOT NULL,
  email TEXT,
  display_name TEXT,
  first_name TEXT,
  last_name TEXT,
  phone TEXT,
  position TEXT,
  department TEXT,
  avatar_url TEXT,
  preferred_language TEXT DEFAULT 'de',
  timezone TEXT DEFAULT 'Europe/Berlin',
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'pending')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rollen: System-Rollen (7 Personas) + Custom-Rollen
CREATE TABLE iam.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('system', 'custom')),
  description TEXT,
  is_deletable BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Permissions
CREATE TABLE iam.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  description TEXT,
  UNIQUE (action, resource_type)
);

-- Role ↔ Permission
CREATE TABLE iam.role_permissions (
  role_id UUID REFERENCES iam.roles(id) ON DELETE CASCADE,
  permission_id UUID REFERENCES iam.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- Account ↔ Role
CREATE TABLE iam.account_roles (
  account_id UUID REFERENCES iam.accounts(id) ON DELETE CASCADE,
  role_id UUID REFERENCES iam.roles(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES iam.accounts(id),
  assigned_at TIMESTAMPTZ DEFAULT NOW(),
  valid_from TIMESTAMPTZ DEFAULT NOW(),
  valid_to TIMESTAMPTZ,
  PRIMARY KEY (account_id, role_id)
);

-- Activity-Log (Basis für History-Tab)
CREATE TABLE iam.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type TEXT NOT NULL,
  actor_id UUID REFERENCES iam.accounts(id),
  subject_id UUID REFERENCES iam.accounts(id),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Seed: 7 System-Personas
INSERT INTO iam.roles (name, display_name, type, is_deletable, description) VALUES
  ('system_admin', 'System-Administrator:in', 'system', FALSE, 'Vollzugriff auf alle Systembereiche'),
  ('app_manager', 'App-Manager:in', 'system', FALSE, 'Verwaltung von Modulen und Nutzern einer Organisation'),
  ('designer', 'Designer:in', 'system', FALSE, 'Branding, Layout und Template-Verwaltung'),
  ('editor', 'Redakteur:in', 'system', FALSE, 'Inhaltserstellung und -bearbeitung'),
  ('interface_manager', 'Schnittstellen-Manager:in', 'system', FALSE, 'API-Clients und Integrationen verwalten'),
  ('moderator', 'Moderator:in', 'system', FALSE, 'Community-Management und Support'),
  ('strategic_decision_maker', 'Strategische:r Entscheider:in', 'system', FALSE, 'Read-Only-Dashboards und Reports');
```

### TypeScript-Typen (`@sva/core`)

```typescript
export type IamUser = {
  id: string;
  keycloakId: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  position?: string;
  department?: string;
  avatarUrl?: string;
  preferredLanguage: string;
  timezone: string;
  status: 'active' | 'inactive' | 'pending';
  roles: IamRole[];
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
};

export type IamRole = {
  id: string;
  name: string;
  displayName: string;
  type: 'system' | 'custom';
  description?: string;
  isDeletable: boolean;
  permissions: Permission[];
};

export type Permission = {
  id: string;
  action: string;
  resourceType: string;
  description?: string;
};

export type AccountProfile = Pick<IamUser,
  'displayName' | 'firstName' | 'lastName' | 'phone' |
  'position' | 'department' | 'avatarUrl' | 'preferredLanguage' | 'timezone'
>;
```

---

## Risiken / Trade-offs

| Risiko | Schwere | Mitigation |
|--------|---------|------------|
| Keycloak Admin API erfordert Service-Account | Mittel | Dokumentierte Keycloak-Konfiguration, Env-Variablen |
| Sync-Konflikte CMS-DB ↔ Keycloak | Mittel | Keycloak als Source of Truth für Identity, CMS-DB für erweiterte Daten |
| DB-Schema-Migration im laufenden Betrieb | Niedrig | Feature-Flag für IAM-Routen, Backward-Compatible-Migrations |
| Newcms-Features divergieren während Migration | Niedrig | Newcms als Referenz-Snapshot, nicht als Moving Target |
| Rollen-Seed-Daten ändern sich | Niedrig | Migrations-basiertes Seeding, idempotente Scripts |

---

## Offene Fragen

- Keycloak Service-Account: Welcher Realm, welche Client-Rolle für Admin API?
- Asset-Storage für Profilbilder: Eigener Dienst oder Keycloak User Attributes?
- DB-Migrations-Tooling: Flyway, Prisma Migrate, oder raw SQL-Migrationen?
- Keycloak Account Console: Custom Theme oder Standard-Theme?

---

**Document Version:** 1.0
**Last Updated:** 3. März 2026
