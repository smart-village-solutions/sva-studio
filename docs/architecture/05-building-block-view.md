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
   - Theme-Bausteine: `ThemeProvider`, semantische CSS-Token und `Sheet`-Primitive für mobile Shell-Navigation
   - Nx-Targets für `build`, `serve`, `lint`, `test:unit`, `test:coverage` und `test:e2e` über Vite-, Vitest- und Playwright-Executor
2. Core (`packages/core`)
   - generische Route-Registry Utilities (`mergeRouteFactories`, `buildRouteTree`)
   - kanonisches Inhaltsmodell für `Content`, Statusmodell und JSON-Payload-Validierung
3. Routing (`packages/routing`)
   - zentrale Route-Factories (client + server)
   - einzige Source of Truth für Auth-Handler-Mapping, Runtime-Guard und JSON-Error-Boundary
   - der Startup-Guard in `auth.routes.server.ts` prüft ausschließlich das Auth-Route-Mapping gegen `authRoutePaths`; er ist keine allgemeine Plugin- oder Router-Vollständigkeitsprüfung
4. Auth (`packages/auth`)
   - OIDC-Flows, Session-Store, auth HTTP-Handler
   - modulare Server-Fassaden und fachliche Unterordner für IAM- und Auth-Pfade
5. SDK (`packages/sdk`)
   - Logger, Context-Propagation, OTEL-Bootstrap
   - Instance-Config-Modul (`instance/config.server.ts`): Validierung der `instanceId`-Allowlist beim Startup, Host-Parsing und Mapping auf `instanceId`
   - deklarative Registries für erweiterbare Inhalts-Typen und typgebundene UI-/Validierungs-Metadaten
6. Monitoring Client (`packages/monitoring-client`)
   - OTEL SDK Setup, Exporter, Log-Redaction-Processor
7. Data (`packages/data`)
   - HTTP DataClient, IAM-Migrationen/Seeds und DB-Validierungstasks
   - IAM-Persistenzmodell (`iam`-Schema) mit Multi-Tenant-Struktur
   - Integrations-Repository für instanzgebundene externe Schnittstellen (`iam.instance_integrations`)
8. SVA Mainserver (`packages/sva-mainserver`)
   - dedizierte Integrationsschicht für OAuth2, GraphQL-Transport, Fehlerabbildung und Fachadapter
   - trennt client-sichere Typen von serverseitigen Delegations- und Diagnostikfunktionen
9. Plugin Example (`packages/plugin-example`)
   - Beispielroute fuer Plugin-Erweiterbarkeit

### IAM-Bausteine und Package-Zuordnung

- Identity und OIDC-Flow:
  - `packages/auth` (`routes.server.ts`, `routes/*`, `auth.server.ts`, `auth-server/*`, `oidc.server.ts`)
- Account- und Rollenmanagement inkl. IdP-Synchronisation:
  - `packages/auth` (`iam-account-management.server.ts`, `iam-account-management/*`, `identity-provider-port.ts`, `keycloak-admin-client.ts`, `keycloak-admin-client/*`)
- Per-User-Credential-Lesen für Downstream-Integrationen:
  - `packages/auth` (`mainserver-credentials.server.ts`, `identity-provider-port.ts`, `keycloak-admin-client/*`)
- Autorisierung (RBAC/ABAC) und Laufzeitentscheidungen:
  - `packages/auth` (`iam-authorization.server.ts`, `iam-authorization/*`)
- Organisations- und Mandantenkontext (`instanceId`) inkl. RLS-nahe Datenmodelle:
  - `packages/data` (IAM-Migrationen, Seeds, SQL-Policies, `iam/repositories/*`)
- Instanzgebundene Mainserver-Endpunkte:
  - `packages/data` (`integrations/instance-integrations.ts`, Migration `0013_iam_instance_integrations.sql`)
- Auditierung und Nachvollziehbarkeit:
  - `packages/auth` (`audit-db-sink.server.ts`) + `packages/sdk` (`createSdkLogger`)
- Governance und DSGVO-Betroffenenrechte:
  - `packages/auth` (`iam-governance.server.ts`, `iam-governance/*`, `iam-data-subject-rights.server.ts`, `iam-data-subject-rights/*`)
- Inhaltsverwaltung als Core-Element:
  - `packages/core` (`content-management.ts`) für Kernvertrag
  - `packages/sdk` (`content-types.ts`) für Erweiterungspunkte
  - `packages/auth` (`iam-contents.server.ts`, `iam-contents/*`) für serverseitige Read-/Write-Pfade, Historie und Audit
  - `apps/sva-studio-react/src/routes/content/*` für Listen- und Editor-UI unter `/content`
- Externe Mainserver-Anbindung:
  - `packages/sva-mainserver` (`server/config-store.ts`, `server/service.ts`, `generated/*`)

### IAM-Server-Schnittmuster

- Fassade:
  - stabile Importpfade für Router, Tests und `@sva/auth/server`
- Fachmodul:
  - gruppiert Handler und fachnahe Hilfsbausteine pro Domäne
- Core:
  - enthält verbleibende, noch nicht vollständig zerlegte Kernlogik mit expliziter Ticket-Restschuld

### Verantwortungsgrenzen im IAM-Pfad

- Keycloak ist führend für Authentifizierung, Token-Claims und IdP-nahe Admin-Operationen.
- Postgres ist führend für Studio-verwaltete IAM-Fachdaten wie Accounts, Rollen, Permissions und Auditdaten.
- Redis hält lediglich Permission-Snapshots zur Beschleunigung des Authorize-Pfads.
- Der SVA-Mainserver bleibt fachliche Source of Truth für seine GraphQL-Daten; Studio hält nur Endpunktkonfiguration und kurzlebige Laufzeit-Caches für Credentials und Access-Tokens.
- Fachmodule konsumieren zentrale IAM-Entscheidungen und duplizieren keine eigene Berechtigungsauflösung gegen IAM-Tabellen.

### Abhängigkeiten (vereinfacht)

- App -> `@sva/core`, `@sva/routing`, `@sva/auth`, `@sva/sva-mainserver`, `@sva/plugin-example`
- `@sva/routing` -> `@sva/auth`, `@sva/core`, `@sva/sdk`
- `@sva/auth` -> `@sva/sdk`
- `@sva/sva-mainserver` -> `@sva/auth`, `@sva/data`, `@sva/sdk`
- `@sva/sdk` -> `@sva/core`, `@sva/monitoring-client`
- `@sva/plugin-*` -> `@sva/sdk` (kein Direktimport aus `@sva/core`)
- `@sva/monitoring-client` -> OTEL Libraries, `@sva/sdk` Context API
- `@sva/auth` -> `@sva/core` (IAM-Claims + Feldverschlüsselung), `pg`
- `apps/sva-studio-react` -> `@sva/core` + `@sva/auth` für Inhaltsliste, Detail, Historie und Statuswechsel

### Schichtregel für Plugins

Erlaubte Richtung für Host-APIs in Plugin-Code:

```mermaid
flowchart LR
  C[@sva/core] --> S[@sva/sdk]
  S --> P[@sva/plugin-*]
```

Nicht erlaubt: `@sva/plugin-*` -> `@sva/core`

### Schichtdefinition `scope:integration`

- Zweck: `scope:integration` kapselt serverseitige Downstream-Integrationen, die weder reine Identity-Logik (`scope:auth`) noch reine Persistenzlogik (`scope:data`) sind.
- Erlaubte Abhängigkeiten: `scope:integration` darf auf `scope:auth`, `scope:data`, `scope:sdk` und `scope:core` zugreifen.
- Nicht erlaubt: Fach- oder UI-Code darf nicht direkt OAuth2-/GraphQL-Clients, Secret-Lookups oder Datenbankzugriffe in Integrationspaketen umgehen.
- Referenzpaket: `packages/sva-mainserver` nutzt `@sva/auth/server` für per-User-Credentials, `@sva/data/server` für instanzgebundene Endpunktkonfiguration und `@sva/sdk/server` für Logging/OTEL.
- Zielgrenze: Integrationspakete exportieren client-sichere Typen getrennt von serverseitigen Runtime-Adaptern.

### Boundary Core vs. Framework Binding

- Framework-agnostisch:
  - `packages/core`, Teile von `packages/data`, SDK Context APIs
- Framework-/Runtime-gebunden:
  - `apps/sva-studio-react`, TanStack-Route-Definitionen, Auth-Handler fuer Start
  - `ThemeProvider` löst im App-Layer das aktive Shell-Theme aus `instanceId` auf und kombiniert es mit einem separaten Light-/Dark-Mode
  - Mainserver-Aufrufe werden in TanStack-Start-Server-Funktionen gekapselt; rohe OAuth- oder GraphQL-Aufrufe bleiben außerhalb des Browser-Bundles

Referenzen:

- `packages/core/src/routing/registry.ts`
- `packages/routing/src/index.ts`
- `packages/auth/src/index.server.ts`
- `packages/auth/src/audit-db-sink.server.ts`
- `packages/auth/src/mainserver-credentials.server.ts`
  - liest und kanonisiert die Keycloak-Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret`; Legacy-Namen bleiben als Fallback lesbar
- `packages/sdk/src/server.ts`
- `packages/data/migrations/up/0001_iam_core.sql`
- `packages/data/migrations/up/0013_iam_instance_integrations.sql`
- `packages/sva-mainserver/src/server/service.ts`
- `docs/architecture/iam-service-architektur.md`
- `apps/sva-studio-react/src/components/Header.tsx`
- `apps/sva-studio-react/src/components/Sidebar.tsx`
- `apps/sva-studio-react/src/components/AppShell.tsx`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/lib/theme.ts`
- `apps/sva-studio-react/src/lib/sva-mainserver.server.ts`

### Erweiterung 2026-03: Account- und User-Management-UI

Neu hinzugekommene Bausteine im Change `add-account-user-management-ui`:

1. `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
   - Self-Service-Profilseite (`/account`) mit Validierung, Error-Summary, editierbarer E-Mail, editierbarem Benutzernamen und synchronisiertem Profilabgleich nach IAM und Keycloak.
2. `apps/sva-studio-react/src/routes/admin/users/*`
   - Admin-User-Liste (`/admin/users`) und User-Detailansicht (`/admin/users/$userId`) inklusive Rollen- und Statusverwaltung; Profiländerungen aus `/account` werden bei erneuter Datenladung bzw. In-App-Invalidierung sichtbar.
3. `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
   - Rollenverwaltung (`/admin/roles`) mit System-/Custom-Rollen und erweiterbarer Berechtigungsmatrix.
4. `apps/sva-studio-react/src/hooks/use-users.ts`, `use-user.ts`, `use-roles.ts`
   - Frontend-Datenzugriff auf IAM-v1-Endpunkte mit Fehler-/403-Behandlung.
5. `packages/routing/src/account-ui.routes.ts`
   - Zentrale Guard-Konfiguration für `/account`, `/admin/users`, `/admin/users/$userId`, `/admin/roles`.

### Erweiterung 2026-03: Keycloak-Rollen-Katalog-Sync

Neu hinzugekommene Bausteine im Change `add-keycloak-role-catalog-sync`:

1. `packages/auth/src/iam-account-management.server.ts` + `packages/auth/src/iam-account-management/*`
   - Fassade für Users, Rollen, Profile und Plattform-Entry-Points; Kernlogik liegt in `core.ts`.
2. `packages/auth/src/identity-provider-port.ts`
   - Erweitert die IdP-Abstraktion um Role-Catalog-Operationen (`list`, `get`, `create`, `update`, `delete`).
3. `packages/auth/src/keycloak-admin-client.ts` + `packages/auth/src/keycloak-admin-client/*`
   - Fassade und Teilmodule für Konfiguration, Fehlertypen, Modelle und Keycloak-Adapter-Core.
4. `packages/data/migrations/up/0007_iam_role_catalog_sync.sql`
   - Erweitert `iam.roles` um Mapping- und Sync-Felder (`role_key`, `external_role_name`, `sync_state`, `last_synced_at`, `last_error_code`).
5. `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
   - Zeigt Sync-Status, Retry-Aktion und manuelles Reconcile für `system_admin`.

### Erweiterung 2026-03: Organisationsverwaltung und Org-Kontext

Neu hinzugekommene Bausteine im Change `add-iam-organization-management-hierarchy`:

1. `packages/data/migrations/up/0009_iam_organization_management.sql`
   - Erweitert `iam.organizations` und `iam.account_organizations` um Hierarchie-, Typ-, Policy- und Kontextfelder.
2. `packages/auth/src/iam-organizations.server.ts` + `packages/auth/src/iam-organizations/*`
   - Fassade und Fachbausteine für Organisationsliste, Detailpflege, Memberships und sessionbasierten Org-Kontext.
3. `packages/core/src/iam/account-management-contract.ts`
   - Typisierte Contracts für Organisations-Read-Models, Membership-Metadaten und `GET/PUT /api/v1/iam/me/context`.
4. `packages/routing/src/account-ui.routes.ts`
   - Guarded Routing für `/admin/organizations` und den clientseitigen Zugriff auf den Org-Kontextpfad.
5. `apps/sva-studio-react/src/routes/admin/organizations/*`
   - Organisationsverwaltung mit Liste, Filtern, Detailbearbeitung und Membership-Verwaltung.
6. `apps/sva-studio-react/src/components/OrganizationContextSwitcher.tsx`
   - Shell-Baustein für den Wechsel des aktiven Organisationskontexts bei Multi-Org-Accounts.

### Ergänzung 2026-03: Strukturierte Permissions und Hierarchie-Vererbung

1. `packages/data/migrations/up/0010_iam_structured_permissions.sql`
   - Erweitert `iam.permissions` um `action`, `resource_type`, `resource_id`, `effect` und `scope` als strukturiertes Read-/Compute-Modell.
2. `packages/data/seeds/0001_iam_personas.sql`
   - Seedet Basis-Permissions rückwärtskompatibel sowohl mit `permission_key` als auch mit strukturierten Feldern.
3. `packages/core/src/iam/authorization-engine.ts`
   - Wertet `allow`/`deny`, Resource-Spezifität, Org-Hierarchie und Scope-Daten deterministisch in einer festen Prioritätsreihenfolge aus.
4. `packages/auth/src/iam-authorization/permission-store.ts`
   - Lädt effektive Rollen-Permissions org-kontextbezogen aus Postgres und normalisiert Parent-Mitgliedschaften auf den angefragten Zielkontext.
5. `packages/auth/src/iam-authorization/shared.ts`
   - Transformiert DB-Permission-Zeilen in deduplizierte effektive Permissions inklusive `effect` und `scope`.

### Ergänzung 2026-03: IAM-Transparenz-UI

1. `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
   - URL-gesteuertes Transparenz-Cockpit für `rights`, `governance` und `dsr`.
2. `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
   - Self-Service-Datenschutzansicht unter `/account/privacy` ohne eigenen Sidebar-Eintrag.
3. `packages/core/src/iam/transparency-contract.ts`
   - Getypte Read-Modelle für Governance-Feed, DSR-Feed, Self-Service-Übersicht und User-Timeline.
4. `packages/auth/src/iam-governance/read-models.ts`, `packages/auth/src/iam-data-subject-rights/read-models.ts`, `packages/auth/src/iam-account-management/user-timeline-query.ts`
   - Serverseitige Normalisierung der Transparenzdaten statt Roh-JSON aus Einzeltabellen.

### Ergänzung 2026-03: Direkte Nutzerrechte in der Benutzerverwaltung

1. `packages/data/migrations/up/0023_iam_account_permissions.sql`
   - Führt `iam.account_permissions` als instanzgebundene Zuordnung `Account -> Permission -> effect` ein.
2. `packages/auth/src/iam-account-management/users-handlers.ts` und `packages/auth/src/iam-account-management/user-detail-query.ts`
   - Erweitern den User-Update- und Read-Pfad um direkte Nutzerrechte einschließlich Validierung, Persistenz und Invalidation.
3. `packages/auth/src/iam-authorization/permission-store.ts` und `packages/auth/src/iam-authorization/shared.ts`
   - Laden direkte Nutzerrechte zusätzlich zu Rollen- und Gruppenrechten und serialisieren deren Herkunft als `direct_user`.
4. `packages/core/src/iam/authorization-contract.ts` und `packages/core/src/iam/account-management-contract.ts`
   - Erweitern die gemeinsamen Verträge um direkte Nutzerrechte, zusätzliche Provenance und die Admin-Read-Modelle für den Nutzer-Editor.
5. `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
   - Ergänzt im Nutzer-Detail eine eigene Rechte-Tab mit Drei-Zustands-Auswahl `nicht gesetzt | erlauben | verweigern` und separater Wirksicht.

### Ergänzung 2026-03: Fachliche Rechtstext-Verwaltung

1. `packages/core/src/iam/account-management-contract.ts`
   - Definiert das gemeinsame Rechtstext-Modell mit UUID, Name, Version, Locale, HTML-Inhalt, Status sowie Erstellungs-, Änderungs- und Veröffentlichungszeitpunkten.
2. `packages/auth/src/iam-legal-texts/*`
   - Kapselt Request-Validierung, Repository, Statusregeln, serverseitiges HTML-Sanitizing und API-Mapping für `GET/POST/PATCH /api/v1/iam/legal-texts`.
3. `packages/data/migrations/up/0019_iam_legal_text_rich_content.sql`
   - Erweitert das IAM-Schema um `name`, `content_html`, `status` und `updated_at` für fachlich editierbare Rechtstexte.
4. `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx`
   - Stellt Liste sowie Create/Edit-Dialoge für fachliche Rechtstexte bereit und bindet einen App-spezifischen Rich-Text-Editor an.
5. `apps/sva-studio-react/src/components/RichTextEditor.tsx`
   - Bleibt bewusst im App-Layer, damit keine Editor-Abhängigkeiten oder UI-Typen in `packages/core` oder `packages/auth` gelangen.

### Ergänzung 2026-03: Manueller Keycloak-User-Import

1. `packages/auth/src/iam-account-management/user-import-sync-handler.ts`
   - Führt einen expliziten Admin-Sync aus, liest Keycloak-Benutzer seitenweise, filtert sie über das `instanceId`-Attribut und spiegelt Basisdaten idempotent nach `iam.accounts`.
2. `packages/auth/src/identity-provider-port.ts`
   - Erweitert die IdP-Abstraktion um typisierte User-Listing-Operationen für administrative Import- und Reconcile-Flows.
3. `packages/routing/src/auth.routes.server.ts` und `packages/auth/src/routes.shared.ts`
   - Registrieren den mutierenden IAM-Endpunkt `POST /api/v1/iam/users/sync-keycloak` typsicher im zentralen Auth-/IAM-Router und prüfen das Mapping beim Modulstart auf Drift.
4. `packages/core/src/iam/account-management-contract.ts`
   - Definiert den gemeinsamen Sync-Report (`importedCount`, `updatedCount`, `skippedCount`, `totalKeycloakUsers`) für Server und Frontend.
5. `apps/sva-studio-react/src/hooks/use-users.ts` und `apps/sva-studio-react/src/routes/admin/users/-user-list-page.tsx`
   - Binden die Aktion „Aus Keycloak synchronisieren“ in `/admin/users` an, zeigen Statusfeedback an und laden die User-Liste nach erfolgreichem Import neu.
