# 05 Bausteinsicht

## Zweck

Dieser Abschnitt beschreibt statische Bausteine, Verantwortlichkeiten und
Abhängigkeiten des aktuellen Systems.

## Mindestinhalte

- Hauptbausteine mit Verantwortung
- Schnittstellen und Abhängigkeiten zwischen Bausteinen
- Grenzen zwischen framework-agnostischer Kernlogik und Bindings

## Aktueller Stand

### Hauptbausteine

1. App (`apps/sva-studio-react`)
   - TanStack Start App, UI, Root-Shell, Router-Erzeugung
   - Shell-Bausteine: `Header`, `Sidebar`, `AppShell` (Layout-Komposition)
   - Skeleton-Bausteine für Kopfzeile, Seitenleiste und Contentbereich
   - Nx-Targets für `build`, `serve`, `lint`, `test:unit`, `test:coverage` und `test:e2e` über Vite-, Vitest- und Playwright-Executor
2. Core (`packages/core`)
   - generische Route-Registry Utilities (`mergeRouteFactories`, `buildRouteTree`)
3. Routing (`packages/routing`)
   - zentrale Route-Factories (client + server)
   - exhaustives Auth-Handler-Mapping mit explizitem Fehler bei unbekanntem Auth-Pfad
4. Auth (`packages/auth`)
   - OIDC-Flows, Session-Store, auth HTTP-Handler
5. SDK (`packages/sdk`)
   - Logger, Context-Propagation, OTEL-Bootstrap
6. Monitoring Client (`packages/monitoring-client`)
   - OTEL SDK Setup, Exporter, Log-Redaction-Processor
7. Data (`packages/data`)
   - HTTP DataClient, IAM-Migrationen/Seeds und DB-Validierungstasks
   - IAM-Persistenzmodell (`iam`-Schema) mit Multi-Tenant-Struktur
8. Plugin Example (`packages/plugin-example`)
   - Beispielroute fuer Plugin-Erweiterbarkeit

### IAM-Bausteine und Package-Zuordnung

- Identity und OIDC-Flow:
  - `packages/auth` (`routes.server.ts`, `oidc.server.ts`, `session.server.ts`)
- Autorisierung (RBAC/ABAC) und Laufzeitentscheidungen:
  - `packages/auth` (`iam-authorization.server.ts`, `iam-policy-evaluator.server.ts`)
- Organisations- und Mandantenkontext (`instanceId`) inkl. RLS-nahe Datenmodelle:
  - `packages/data` (IAM-Migrationen, Seeds, SQL-Policies)
- Auditierung und Nachvollziehbarkeit:
  - `packages/auth` (`audit-db-sink.server.ts`) + `packages/sdk` (`createSdkLogger`)
- Governance und DSGVO-Betroffenenrechte:
  - `packages/auth` (`iam-governance.server.ts`, `iam-data-subject-rights.server.ts`)

### Abhängigkeiten (vereinfacht)

- App -> `@sva/core`, `@sva/routing`, `@sva/auth`, `@sva/plugin-example`
- `@sva/routing` -> `@sva/auth`, `@sva/core`
- `@sva/auth` -> `@sva/sdk`
- `@sva/sdk` -> `@sva/core`, `@sva/monitoring-client`
- `@sva/plugin-*` -> `@sva/sdk` (kein Direktimport aus `@sva/core`)
- `@sva/monitoring-client` -> OTEL Libraries, `@sva/sdk` Context API
- `@sva/auth` -> `@sva/core` (IAM-Claims + Feldverschlüsselung), `pg`

### Schichtregel für Plugins

Erlaubte Richtung für Host-APIs in Plugin-Code:

```mermaid
flowchart LR
  C[@sva/core] --> S[@sva/sdk]
  S --> P[@sva/plugin-*]
```

Nicht erlaubt: `@sva/plugin-*` -> `@sva/core`

### Boundary Core vs. Framework Binding

- Framework-agnostisch:
  - `packages/core`, Teile von `packages/data`, SDK Context APIs
- Framework-/Runtime-gebunden:
  - `apps/sva-studio-react`, TanStack-Route-Definitionen, Auth-Handler fuer Start

Referenzen:

- `packages/core/src/routing/registry.ts`
- `packages/routing/src/index.ts`
- `packages/auth/src/index.server.ts`
- `packages/auth/src/audit-db-sink.server.ts`
- `packages/sdk/src/server.ts`
- `packages/data/migrations/up/0001_iam_core.sql`
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/components/Sidebar.tsx`
- `apps/sva-studio-react/src/components/AppShell.tsx`

### Erweiterung 2026-03: Account- und User-Management-UI

Neu hinzugekommene Bausteine im Change `add-account-user-management-ui`:

1. `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
   - Self-Service-Profilseite (`/account`) mit Validierung, Error-Summary und Keycloak-Weiterleitung für Sicherheitsdaten.
2. `apps/sva-studio-react/src/routes/admin/users/*`
   - Admin-User-Liste (`/admin/users`) und User-Detailansicht (`/admin/users/$userId`) inklusive Rollen- und Statusverwaltung.
3. `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
   - Rollenverwaltung (`/admin/roles`) mit System-/Custom-Rollen und erweiterbarer Berechtigungsmatrix.
4. `apps/sva-studio-react/src/hooks/use-users.ts`, `use-user.ts`, `use-roles.ts`
   - Frontend-Datenzugriff auf IAM-v1-Endpunkte mit Fehler-/403-Behandlung.
5. `packages/routing/src/account-ui.routes.ts`
   - Zentrale Guard-Konfiguration für `/account`, `/admin/users`, `/admin/users/$userId`, `/admin/roles`.

### Erweiterung 2026-03: Keycloak-Rollen-Katalog-Sync

Neu hinzugekommene Bausteine im Change `add-keycloak-role-catalog-sync`:

1. `packages/auth/src/iam-account-management.server.ts`
   - Orchestriert Keycloak-First-CRUD, Compensation, Reconcile-Endpunkt und geplanten Reconcile-Lauf.
2. `packages/auth/src/identity-provider-port.ts`
   - Erweitert die IdP-Abstraktion um Role-Catalog-Operationen (`list`, `get`, `create`, `update`, `delete`).
3. `packages/auth/src/keycloak-admin-client.ts`
   - Konkreter Keycloak-Adapter für Realm-Rollen inklusive Managed-Attributes (`managed_by`, `instance_id`, `role_key`, `display_name`).
4. `packages/data/migrations/up/0007_iam_role_catalog_sync.sql`
   - Erweitert `iam.roles` um Mapping- und Sync-Felder (`role_key`, `external_role_name`, `sync_state`, `last_synced_at`, `last_error_code`).
5. `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
   - Zeigt Sync-Status, Retry-Aktion und manuelles Reconcile für `system_admin`.
