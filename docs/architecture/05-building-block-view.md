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
   - offizieller Server-Entry unter `apps/sva-studio-react/src/server.ts`; der finale Release-Vertrag wird am gebauten `.output/server/**`-Artefakt, nicht an `.nitro/vite/services/ssr/**`, beurteilt
   - der App-Build enthält neben `build` einen expliziten Final-Artifact-Check `verify:runtime-artifact`, der den finalen Node-Output mit Health-Probes und Artefakt-Assertions verifiziert
   - Shell-Bausteine: `Header`, `Sidebar`, `AppShell` (Layout-Komposition)
   - Runtime-Health-Bausteine: `RuntimeHealthIndicator` und `useRuntimeHealth` für die globale Anzeige des Plattformzustands
   - Skeleton-Bausteine für Kopfzeile, Seitenleiste und Contentbereich
   - Theme-Bausteine: `ThemeProvider`, semantische CSS-Token und `Sheet`-Primitive für mobile Shell-Navigation
   - Auth- und Diagnose-Bausteine: `AuthProvider` fuer `/auth/me`, Silent-Recovery und den clientseitigen Grundzustand; `iam-api.ts` fuer Browser-Timeouts, `requestId`-Aufnahme und Safe-Detail-Parsing
   - Nx-Targets für `build`, `serve`, `lint`, `test:unit`, `test:coverage` und `test:e2e` über Vite-, Vitest- und Playwright-Executor
2. Core (`packages/core`)
   - generische Route-Registry Utilities (`mergeRouteFactories`, `buildRouteTree`)
   - kanonisches Inhaltsmodell für `Content`, Statusmodell und JSON-Payload-Validierung
3. Routing (`packages/routing`)
   - zentrale Route-Factories (client + server)
   - einzige Source of Truth für Auth-Handler-Mapping, Runtime-Guard und JSON-Error-Boundary
   - eigener Observability-Vertrag für Guard-Denials, Plugin-Guard-Anomalien und serverseitige Dispatch-Fehler mit optionalem Diagnostics-Hook
   - der Startup-Guard in `auth.routes.server.ts` prüft ausschließlich das Auth-Route-Mapping gegen `authRoutePaths`; er ist keine allgemeine Plugin- oder Router-Vollständigkeitsprüfung
4. Auth Runtime (`packages/auth-runtime`)
   - OIDC-Flows, Session-Store, Cookies, Auth-Middleware, Runtime-Health und Auth-/HTTP-Handler
   - Runtime-Adapter für fachliche IAM-, Governance-, Content- und Registry-Routen
   - Diagnosebausteine für Session-Hydration/-Refresh, Hostvalidierung, Schema-Guard, Runtime-Health und allowlist-basierte API-Fehlerdetails
5. Plugin SDK und Server Runtime (`packages/plugin-sdk`, `packages/server-runtime`)
   - `@sva/plugin-sdk`: öffentlicher Plugin-Vertrag v1, Build-time-Registry, Admin-Ressourcen, Content-Type- und Translation-Verträge
   - `@sva/server-runtime`: Logger, Request-Kontext, JSON-Fehlerantworten, Workspace-Kontext und OTEL-Bootstrap
   - Namespacing- und Ownership-Validierung für plugin-beigestellte registrierte Host-Identifier
6. Studio UI React (`packages/studio-ui-react`)
   - öffentliche React/UI-Basis `@sva/studio-ui-react` für Host-Seiten und Plugin-Custom-Views
   - kapselt shadcn-/Radix-Primitives, Studio-Templates, Formularfelder, Zustandsbausteine, Tabellen- und Aktionsmuster
   - bleibt UI-only: keine Plugin-Registry, keine Route-Materialisierung, keine Persistenz, keine IAM- oder Server-Runtime-Logik
7. Monitoring Client (`packages/monitoring-client`)
   - OTEL SDK Setup, Exporter, Log-Redaction-Processor
8. Data Client und Data Repositories (`packages/data-client`, `packages/data-repositories`)
   - `@sva/data-client`: client-sicherer HTTP-DataClient mit Schema-Validierung
   - `@sva/data-repositories`: serverseitige Repository-Fassaden und DB-nahe Operationen
   - IAM-Persistenzmodell (`iam`-Schema) mit Multi-Tenant-Struktur bleibt SQL-first versioniert
9. SVA Mainserver (`packages/sva-mainserver`)
   - dedizierte Integrationsschicht für OAuth2, GraphQL-Transport, Fehlerabbildung und Fachadapter
   - trennt client-sichere Typen von serverseitigen Delegations- und Diagnostikfunktionen
10. Plugin News (`packages/plugin-news`)
   - produktives Fachplugin für Mainserver-News mit pluginnahem Modell `news.article`
   - eigene Listen- und Editor-Ansichten, Plugin-Navigation und Plugin-Übersetzungen
   - bildet das vollständige Mainserver-`NewsItem`-Modell über dedizierte Felder ab; `contentBlocks` sind der führende Langinhalt
   - nutzt `@sva/plugin-sdk` für Host-Metadaten und `@sva/studio-ui-react` für gemeinsame UI-Primitives statt App-interner Komponenten
   - persistiert nicht direkt in lokale IAM-Contents, sondern spricht die hostgeführte Mainserver-News-Fassade per HTTP an
11. Instanz-Registry (`packages/instance-registry`)
   - Host-Klassifikation, Vertrags- und Run-Modell fuer Registry, Preflight, Plan und Provisioning-Protokoll
   - Registry-Repositories, persistente Provisioning-Runs und Cache-Zugriffe über injizierte Repository-Verträge
   - Plattformvertrag, Keycloak-Control-Plane, Provisioning-Fassade und Root-Host-Guard
   - Keycloak-Reconcile- und Execute-Mutationen führen `Idempotency-Key`, API-Mutation und stabilen Payload-Fingerprint bis in `iam.instance_keycloak_provisioning_runs`, damit Retries denselben fachlichen Run wiederverwenden
   - `apps/sva-studio-react`: gefuehrte Admin-Control-Plane unter `/admin/instances` mit Preflight, Plan, Ausfuehrung und Protokoll
   - der Instanzvertrag trennt `authClientId` fuer interaktive Logins von `tenantAdminClient.clientId` fuer tenant-lokale Admin-Mutationen und Reconcile
   - blockerrelevanter Drift aus Preflight, Provisioning-Plan oder fehlendem Tenant-Admin-Vertrag wird vor Reconcile-/Sync-Starts fail-closed durchgesetzt

### IAM-Bausteine und Package-Zuordnung

- Identity und OIDC-Flow:
  - `packages/auth-runtime` (`routes`, `auth-server`, `oidc`, Session, Cookies, Runtime-Health)
- Account- und Rollenmanagement inkl. IdP-Synchronisation:
  - `packages/iam-admin` (User-, Rollen-, Gruppen-, Organisations-, Actor-, Reconcile- und Keycloak-Admin-Orchestrierung)
  - `user-projection.ts` ist der gemeinsame Projektionskern für Self-Service-Profile und Admin-Reads; spezialisierte UI-Pfade dürfen darauf nur noch darstellerisch aufsetzen
  - `reconcile-core.ts` und `user-import-sync-handler.ts` liefern deterministische Abschlusszustände (`success`, `partial_failure`, `blocked`, `failed`) mit Zählwerten für `checked`, `corrected`, `failed` und `manualReview`
- Per-User-Credential-Lesen für Downstream-Integrationen:
  - `packages/auth-runtime` liest die Mainserver-Credential-Projektion runtime-nah und stellt sie Integrationspaketen bereit.
- Autorisierung (RBAC/ABAC) und Laufzeitentscheidungen:
  - `packages/iam-core` für zentrale Autorisierungsverträge und Entscheidungen; Runtime-Adapter liegen in `packages/auth-runtime`.
- Organisations- und Mandantenkontext (`instanceId`) inkl. RLS-nahe Datenmodelle:
  - `packages/iam-admin`, `packages/instance-registry` und `packages/data-repositories` über klar getrennte Fach- und Repository-Verträge
- Plattformkontext (`platform`) für Root-Host-Control-Plane, Root-Host-Auth und globale Readiness:
  - `packages/auth-runtime`, `packages/iam-admin` und `packages/instance-registry`
- Tenant-Admin-Pfad pro Instanz:
  - `packages/iam-admin` für Tenant-Admin-Orchestrierung
  - `packages/instance-registry` für Registry-, Diagnose- und Health-Verträge des `tenantAdminClient`
  - `packages/data-repositories` für DB-nahe Registry- und IAM-Zugriffe
- Instanzgebundene Mainserver-Endpunkte:
  - `packages/data-repositories` für Endpunktkonfiguration, `packages/sva-mainserver` für Integration und Adapter
- Auditierung und Nachvollziehbarkeit:
  - `packages/auth-runtime` und fachliche Zielpackages für Events, `packages/server-runtime` für Logger und Request-Kontext
  - tenantgebunden: `iam.activity_logs`
  - plattformgebunden: `iam.platform_activity_logs`
- Governance und DSGVO-Betroffenenrechte:
  - `packages/iam-governance`
- Inhaltsverwaltung als Core-Element:
  - `packages/core` (`content-management.ts`) für Kernvertrag
  - `packages/plugin-sdk` für Erweiterungspunkte, Registries und Namespace-Verträge
  - `packages/auth-runtime` für Runtime-Handler und `packages/iam-governance` für legal-/audit-nahe Fachanteile
  - `apps/sva-studio-react/src/routes/content/*` für Listen- und Editor-UI unter `/admin/content`
  - `packages/plugin-news` für plugin-spezifische News-Ansichten auf Basis derselben Core-Content-API
- Externe Mainserver-Anbindung:
  - `packages/sva-mainserver` (`server/config-store.ts`, `server/service.ts`, `generated/*`)

### IAM-Server-Schnittmuster

- Fassade:
  - stabile Importpfade für Router, Tests und Runtime-Consumer liegen in den Zielpackages, insbesondere `@sva/auth-runtime`
- Fachmodul:
  - gruppiert Handler und fachnahe Hilfsbausteine pro Domäne
- Core:
  - enthält verbleibende, noch nicht vollständig zerlegte Kernlogik mit expliziter Ticket-Restschuld

### Verantwortungsgrenzen im IAM-Pfad

- Keycloak ist führend für Authentifizierung, Token-Claims und IdP-nahe Admin-Operationen.
- Postgres ist führend für Studio-verwaltete IAM-Fachdaten wie Accounts, Rollen, Permissions und Auditdaten.
- `iam.instances` modelliert ausschließlich Tenant-Instanzen; der Root-Host ist ein separater Plattform-Scope.
- `iam.instances` fuehrt fuer jede tenantfaehige Instanz getrennte Auth-Vertraege fuer Login (`authClientId`) und Tenant-Administration (`tenantAdminClient`) als kanonische Registry-Basisdaten.
- Redis hält lediglich Permission-Snapshots zur Beschleunigung des Authorize-Pfads.
- Der SVA-Mainserver bleibt fachliche Source of Truth für seine GraphQL-Daten; Studio hält nur Endpunktkonfiguration und kurzlebige Laufzeit-Caches für Credentials und Access-Tokens.
- Fachmodule konsumieren zentrale IAM-Entscheidungen und duplizieren keine eigene Berechtigungsauflösung gegen IAM-Tabellen.

### Fortschreibung 2026-04: Keycloak-Admin-UI-Bausteine

1. `@sva/core`
   - Definiert additive Verträge für `mappingStatus`, `editability`, objektbezogene Diagnosecodes und Sync-/Reconcile-Objektlisten.
2. `packages/iam-admin/src/identity-provider-port.ts`
   - Kapselt Keycloak-nahe Listen-, Count-, Mutations- und explizite Role-Assignment-Operationen.
3. `packages/iam-admin/src/keycloak-admin-client`
   - Implementiert serverseitige Pagination/Count für Realm-Rollen und User sowie differenzierte Fehlerabbildung für Keycloak-Admin-Aufrufe.
4. `packages/iam-admin/src`
   - Trennt Platform-Admin-Client, Tenant-Admin-Client, Keycloak-first Mutationen, Read-Model-Synchronisation und Drift-/Diagnoseprojektion.
5. `apps/sva-studio-react/src/routes/admin/users` und `apps/sva-studio-react/src/routes/admin/roles`
   - Rendern Mappingstatus, Bearbeitbarkeit und Diagnosecodes; blockierte oder read-only Aktionen bleiben sichtbar, aber deaktiviert.

### Fortschreibung 2026-04: Diagnosegrenzen im IAM-Pfad

- `packages/data-repositories` liefert tenant- und registrynahe Drift- und Fallback-Signale, insbesondere in der Host-Auflösung.
- `packages/auth-runtime`, `packages/iam-admin` und `packages/instance-registry` klassifizieren Session-, Actor-, Schema- und Keycloak-nahe Fehlerbilder entlang ihrer Ownership.
- `apps/sva-studio-react` transportiert heute bereits `requestId` und Safe-Details teilweise bis in den Browser, verwendet diese Informationen aber noch nicht durchgängig für classification-basierte UI-Zustände.
- Der aktuelle Zielkonflikt liegt damit nicht zwischen fehlenden Signalen und fehlender Observability, sondern zwischen vorhandenen Einzelsignalen und einem noch unvollständigen öffentlichen Diagnosevertrag.

### Abhängigkeiten (vereinfacht)

- App -> `@sva/core`, `@sva/routing`, `@sva/auth-runtime`, `@sva/plugin-sdk`, `@sva/studio-ui-react`, `@sva/sva-mainserver`, `@sva/plugin-news`
- `@sva/routing` -> `@sva/auth-runtime`, `@sva/core`, `@sva/plugin-sdk`, `@sva/server-runtime`
- `@sva/auth-runtime` -> `@sva/iam-core`, `@sva/iam-admin`, `@sva/iam-governance`, `@sva/instance-registry`, `@sva/data-repositories`, `@sva/server-runtime`
- `@sva/sva-mainserver` -> `@sva/auth-runtime`, `@sva/data-repositories`, `@sva/server-runtime`
- `@sva/plugin-sdk` -> `@sva/core`
- `@sva/server-runtime` -> `@sva/core`, `@sva/monitoring-client`
- `@sva/plugin-*` -> `@sva/plugin-sdk`, optional `@sva/studio-ui-react` für Custom-Views (kein Direktimport aus `@sva/core` oder App-internen Komponenten)
- `@sva/plugin-news` bleibt absichtlich auf SDK, Studio-UI und Peer Dependencies beschränkt; API-Aufrufe laufen über den öffentlichen HTTP-Vertrag statt über App-Module
- `@sva/monitoring-client` -> OTEL Libraries, `@sva/server-runtime` Context API
- `@sva/iam-core` -> `@sva/core`
- `apps/sva-studio-react` -> Zielpackages über Server-Funktionen für Inhaltsliste, Detail, Historie und Statuswechsel

### Schichtregel für Plugins

Erlaubte Richtung für Host-APIs in Plugin-Code:

```mermaid
flowchart LR
  C[@sva/core] --> S[@sva/plugin-sdk]
  S --> P[@sva/plugin-*]
  U[@sva/studio-ui-react] --> P
```

Nicht erlaubt: `@sva/plugin-*` -> `@sva/core`
Nicht erlaubt: `@sva/plugin-*` -> `apps/sva-studio-react/src/**`

### Erweiterung 2026-04: Plugin-SDK-Vertrag v1 und News-Plugin

1. `packages/plugin-sdk/src/plugins.ts`
   - definiert `PluginDefinition` und Merge-Helfer für Plugin-Routen, Navigation, Content-Typen und Übersetzungen
2. `apps/sva-studio-react/src/lib/plugins.ts`
   - registriert `pluginNews` statisch im Host und materialisiert daraus Route-, Navigations-, Admin-Ressourcen-, Audit- und i18n-Metadaten
3. `packages/auth-runtime/src/iam-contents/content-type-registry.ts`
   - erweitert den generischen Content-Write-Pfad um contentType-spezifische Payload-Validierung und Sanitisierung
4. `packages/plugin-news/src/*`
   - kapselt News-Liste, Editor, Delete-Flow und plugin-eigene Übersetzungen unter der SDK-Boundary
   - schreibt News-Fachdaten über die hostgeführte Mainserver-Fassade; Legacy-`payload` ist nur Lesefallback und wird bei Create/Update nicht gesendet

### Erweiterung 2026-04: Namespacete Plugin-Identität über Build-time-Registries

1. `packages/plugin-sdk/src/plugins.ts` + `packages/plugin-sdk/src/plugin-identifiers.ts`
   - definieren die technische Plugin-Identität über `PluginDefinition.id` als führenden Namespace und validieren plugin-beigestellte `contentType`s, Admin-Ressourcen und Audit-Event-Typen gegen `<pluginId>.<name>`
2. `packages/plugin-sdk/src/build-time-registry.ts`
   - verdichtet Plugins, hosteigene Admin-Ressourcen und plugin-spezifische Audit-Event-Definitionen phasenweise in einen gemeinsamen Registry-Snapshot für Host und Routing
   - hält die bestehende `BuildTimeRegistry`-API stabil; interne Phasen ordnen Preflight, Content, Admin, Audit, Routing und Publish ohne neue Beitragstypen
3. `packages/routing/src/app.routes.shared.ts`
   - materialisiert deklarative Admin-Ressourcen unter `/admin/<resource>` und hält Legacy-Aliase wie `/content*` nur noch als Redirect-Vertrag
4. `packages/auth-runtime/src/iam-contents/content-type-registry.ts`
   - führt `news.article` als kanonischen plugin-beigestellten `contentType` im serverseitigen Validierungsvertrag

### Erweiterung 2026-04: Host-seitige Plugin-Guardrails

1. `packages/plugin-sdk/src/guardrails.ts`
   - definiert deterministische Guardrail-Fehlercodes für Routing-, Autorisierungs-, Audit-, Persistenz- und Dynamic-Registration-Bypässe
2. `packages/plugin-sdk/src/plugins.ts`
   - validiert Plugin-Contributions gegen Runtime-Allowlists, bevor der Build-time-Registry-Snapshot veröffentlicht wird
3. `packages/routing/src/app.routes.shared.ts`
   - materialisiert Plugin-Routen nur unter `/plugins/<pluginNamespace>` und bricht unbekannte Plugin-Guards fail-fast ab
4. Plugin-UI-Komponenten bleiben erlaubt, solange Route, Guard, Search-Parameter, Persistenz und Audit-Pfad host-owned bleiben

### Schichtdefinition `scope:integration`

- Zweck: `scope:integration` kapselt serverseitige Downstream-Integrationen, die weder Auth-Runtime noch Persistenzlogik besitzen.
- Erlaubte Abhängigkeiten: `scope:integration` darf auf `scope:auth-runtime`, `scope:data-repositories`, `scope:server-runtime` und `scope:core` zugreifen.
- Nicht erlaubt: Fach- oder UI-Code darf nicht direkt OAuth2-/GraphQL-Clients, Secret-Lookups oder Datenbankzugriffe in Integrationspaketen umgehen.
- Referenzpaket: `packages/sva-mainserver` nutzt `@sva/auth-runtime/server` für per-User-Credentials, `@sva/data-repositories/server` für instanzgebundene Endpunktkonfiguration und `@sva/server-runtime` für Logging/OTEL.
- Zielgrenze: Integrationspakete exportieren client-sichere Typen getrennt von serverseitigen Runtime-Adaptern.

### Boundary Core vs. Framework Binding

- Framework-agnostisch:
  - `packages/core`, `packages/plugin-sdk`, client-sichere Teile von `packages/data-client`
- Framework-/Runtime-gebunden:
  - `apps/sva-studio-react`, TanStack-Route-Definitionen, Auth-Handler fuer Start
  - `apps/sva-studio-react/src/server.ts` kapselt Auth-Dispatch, Request-Kontext und env-gesteuerte Server-Entry-Diagnostik vor der Delegation an TanStack Start
  - `.output/server/index.mjs` plus `.output/server/chunks/build/server.mjs` bilden den verbindlichen Runtime-Output fuer Build-, Verify- und Release-Gates
  - `ThemeProvider` löst im App-Layer das aktive Shell-Theme aus `instanceId` auf und kombiniert es mit einem separaten Light-/Dark-Mode
  - Mainserver-Aufrufe werden in TanStack-Start-Server-Funktionen gekapselt; rohe OAuth- oder GraphQL-Aufrufe bleiben außerhalb des Browser-Bundles

Referenzen:

- `packages/core/src/routing/registry.ts`
- `packages/routing/src/index.ts`
- `packages/auth-runtime/src/index.server.ts`
- `packages/auth-runtime/src/audit-db-sink.server.ts`
- `packages/auth-runtime/src/mainserver-credentials.server.ts`
  - liest und kanonisiert die Keycloak-Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret`; Legacy-Namen bleiben als Fallback lesbar
- `packages/server-runtime/src/index.ts`
- `packages/data/migrations/0001_iam_core.sql` (historischer Migrationsort)
- `packages/data/migrations/0013_iam_instance_integrations.sql` (historischer Migrationsort)
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

1. `packages/iam-admin/src`
   - Fassade für Users, Rollen, Profile und Plattform-Entry-Points; Kernlogik liegt in `core.ts`.
2. `packages/iam-admin/src/identity-provider-port.ts`
   - Erweitert die IdP-Abstraktion um Role-Catalog-Operationen (`list`, `get`, `create`, `update`, `delete`).
3. `packages/iam-admin/src/keycloak-admin-client.ts` + `packages/iam-admin/src/keycloak-admin-client/*`
   - Fassade und Teilmodule für Konfiguration, Fehlertypen, Modelle und Keycloak-Adapter-Core.
4. `packages/data/migrations/0007_iam_role_catalog_sync.sql` (historischer Migrationsort)
   - Erweitert `iam.roles` um Mapping- und Sync-Felder (`role_key`, `external_role_name`, `sync_state`, `last_synced_at`, `last_error_code`).
5. `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
   - Zeigt Sync-Status, Retry-Aktion und manuelles Reconcile für `system_admin`.

### Erweiterung 2026-03: Organisationsverwaltung und Org-Kontext

Neu hinzugekommene Bausteine im Change `add-iam-organization-management-hierarchy`:

1. `packages/data/migrations/0009_iam_organization_management.sql` (historischer Migrationsort)
   - Erweitert `iam.organizations` und `iam.account_organizations` um Hierarchie-, Typ-, Policy- und Kontextfelder.
2. `packages/iam-admin/src/organizations`
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

1. `packages/data/migrations/0010_iam_structured_permissions.sql` (historischer Migrationsort)
   - Erweitert `iam.permissions` um `action`, `resource_type`, `resource_id`, `effect` und `scope` als strukturiertes Read-/Compute-Modell.
2. `packages/data/seeds/0001_iam_personas.sql` (historischer Seed-Ort)
   - Seedet Basis-Permissions rückwärtskompatibel sowohl mit `permission_key` als auch mit strukturierten Feldern.
3. `packages/core/src/iam/authorization-engine.ts`
   - Wertet `allow`/`deny`, Resource-Spezifität, Org-Hierarchie und Scope-Daten deterministisch in einer festen Prioritätsreihenfolge aus.
4. `packages/iam-core/src/permission-store.ts`
   - Lädt effektive Rollen-Permissions org-kontextbezogen aus Postgres und normalisiert Parent-Mitgliedschaften auf den angefragten Zielkontext.
5. `packages/iam-core/src/shared.ts`
   - Transformiert DB-Permission-Zeilen in deduplizierte effektive Permissions inklusive `effect` und `scope`.

### Ergänzung 2026-03: IAM-Transparenz-UI

1. `apps/sva-studio-react/src/routes/admin/-iam-page.tsx`
   - URL-gesteuertes Transparenz-Cockpit für `rights`, `governance` und `dsr`.
2. `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
   - Self-Service-Datenschutzansicht unter `/account/privacy` ohne eigenen Sidebar-Eintrag.
3. `packages/core/src/iam/transparency-contract.ts`
   - Getypte Read-Modelle für Governance-Feed, DSR-Feed, Self-Service-Übersicht und User-Timeline.
4. `packages/iam-governance/src/read-models.ts`, `packages/iam-governance/src/data-subject-rights/read-models.ts`, `packages/iam-admin/src/user-timeline-query.ts`
   - Serverseitige Normalisierung der Transparenzdaten statt Roh-JSON aus Einzeltabellen.

### Ergänzung 2026-03: Direkte Nutzerrechte in der Benutzerverwaltung

1. `packages/data/migrations/0024_iam_account_permissions.sql` (historischer Migrationsort)
   - Führt `iam.account_permissions` als instanzgebundene Zuordnung `Account -> Permission -> effect` ein.
2. `packages/iam-admin/src/users`
   - Erweitern den User-Update- und Read-Pfad um direkte Nutzerrechte einschließlich Validierung, Persistenz und Invalidation.
3. `packages/iam-core/src/permission-store.ts` und `packages/iam-core/src/shared.ts`
   - Laden direkte Nutzerrechte zusätzlich zu Rollen- und Gruppenrechten und serialisieren deren Herkunft als `direct_user`.
4. `packages/core/src/iam/authorization-contract.ts` und `packages/core/src/iam/account-management-contract.ts`
   - Erweitern die gemeinsamen Verträge um direkte Nutzerrechte, zusätzliche Provenance und die Admin-Read-Modelle für den Nutzer-Editor.
5. `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
   - Ergänzt im Nutzer-Detail eine eigene Rechte-Tab mit Drei-Zustands-Auswahl `nicht gesetzt | erlauben | verweigern` und separater Wirksicht.

### Ergänzung 2026-03: Fachliche Rechtstext-Verwaltung

1. `packages/core/src/iam/account-management-contract.ts`
   - Definiert das gemeinsame Rechtstext-Modell mit UUID, Name, Version, Locale, HTML-Inhalt, Status sowie Erstellungs-, Änderungs- und Veröffentlichungszeitpunkten.
2. `packages/iam-governance/src/legal-texts/*`
   - Kapselt Request-Validierung, Repository, Statusregeln, serverseitiges HTML-Sanitizing und API-Mapping für `GET/POST/PATCH /api/v1/iam/legal-texts`.
3. `packages/data/migrations/0020_iam_legal_text_rich_content.sql` (historischer Migrationsort)
   - Erweitert das IAM-Schema um `name`, `content_html`, `status` und `updated_at` für fachlich editierbare Rechtstexte.
4. `apps/sva-studio-react/src/routes/admin/legal-texts/-legal-texts-page.tsx`
   - Stellt Liste sowie Create/Edit-Dialoge für fachliche Rechtstexte bereit und bindet einen App-spezifischen Rich-Text-Editor an.
5. `apps/sva-studio-react/src/components/RichTextEditor.tsx`
   - Bleibt bewusst im App-Layer, damit keine Editor-Abhängigkeiten oder UI-Typen in `packages/core` oder fachliche Zielpackages gelangen.

### Ergänzung 2026-04: Vereinheitlichte Admin-CRUD-Routen

1. `apps/sva-studio-react/src/routes/admin/users/*`
   - Nutzerverwaltung trennt Liste, Anlage und Detailbearbeitung in eigene Seiten unter `/admin/users`, `/admin/users/new` und `/admin/users/$userId`.
2. `apps/sva-studio-react/src/routes/admin/organizations/*`
   - Organisationsverwaltung trennt Liste, Anlage und Detail/Mitgliedschaften in eigenständige Routen ohne modalbasierten CRUD-State.
3. `apps/sva-studio-react/src/routes/admin/groups/*`
   - Gruppenverwaltung trennt Liste, Anlage und Detail/Rollen/Mitgliedschaften in eigenständige Routen.
4. `apps/sva-studio-react/src/routes/admin/legal-texts/*`
   - Rechtstextverwaltung trennt Liste, Anlage und versionsbezogene Detailbearbeitung in eigenständige Routen.
5. `packages/routing/src/account-ui.routes.ts`
   - Enthält die kanonischen Guard-Pfade für Listen-, Create- und Detailrouten dieser CRUD-artigen Admin-Ressourcen.

### Ergänzung 2026-04: Admin-Ressourcen-Registry

1. `packages/plugin-sdk/src/admin-resources.ts`
   - Definiert `AdminResourceDefinition` sowie fail-fast Registry-/Merge-Logik für Ressourcen-ID, Basispfad und deklarative Listen-/Create-/Detail-/History-Bindings.
2. `packages/routing/src/app.routes.shared.ts`
   - Materialisiert kanonische Admin-Routen aus registrierten Admin-Ressourcen und hält Legacy-Aliase wie `/content* -> /admin/content*` zentral im Routing-Layer.
3. `apps/sva-studio-react/src/routing/admin-resources.ts`
   - Registriert die im Host aktivierten Admin-Ressourcen; aktuell dient `content` als Referenzmigration.
4. `apps/sva-studio-react/src/routing/app-route-bindings.tsx`
   - Bindet nur noch Seitenkomponenten und Param-Adapter an den Vertrag; der kanonische Detailparam für Admin-Ressourcen ist `$id`.

### Ergänzung 2026-03: Manueller Keycloak-User-Import

1. `packages/iam-admin/src/user-import-sync-handler.ts`
   - Führt einen expliziten Admin-Sync aus, liest Keycloak-Benutzer seitenweise aus dem aktiven Tenant-Realm, akzeptiert Benutzer ohne `instanceId`-Attribut und spiegelt Basisdaten idempotent nach `iam.accounts`; widersprüchliche Attribute bleiben als Diagnose sichtbar.
   - Auf dem Root-Host führt derselbe Endpunkt einen Platform-Sync über den Plattform-Realm aus und meldet `executionMode=platform_admin`, ohne eine Pseudo-Instanz anzulegen.
2. `packages/iam-admin/src/identity-provider-port.ts`
   - Erweitert die IdP-Abstraktion um typisierte User-Listing-Operationen für administrative Import- und Reconcile-Flows.
3. `packages/routing/src/auth.routes.server.ts` und `packages/auth-runtime/src/routes.ts`
   - Registrieren den mutierenden IAM-Endpunkt `POST /api/v1/iam/users/sync-keycloak` typsicher im zentralen Auth-/IAM-Router und prüfen das Mapping beim Modulstart auf Drift.
4. `packages/core/src/iam/account-management-contract.ts`
   - Definiert den gemeinsamen Sync-Report (`importedCount`, `updatedCount`, `skippedCount`, `totalKeycloakUsers`) für Server und Frontend.
5. `apps/sva-studio-react/src/hooks/use-users.ts` und `apps/sva-studio-react/src/routes/admin/users/-user-list-page.tsx`
   - Binden die Aktion „Aus Keycloak synchronisieren“ in `/admin/users` an, zeigen Statusfeedback an und laden die User-Liste nach erfolgreichem Import neu.
