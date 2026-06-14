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
   - Auth- und Diagnose-Bausteine: `AuthProvider` für `/auth/me`, Silent-Recovery und den clientseitigen Grundzustand; `iam-api.ts` für Browser-Timeouts, `requestId`-Aufnahme und Safe-Detail-Parsing
   - Account-Self-Service-Bausteine: `/account/privacy` als Aktivitätscockpit für Datenschutz- und Transparenzvorgänge, `/account/privacy/$caseId` als Deep-Link-Detailansicht und `/account/rules` als getrennte Oberfläche für tenantweite Löschregeln und persönliche Inhaltsregeln
  - Host-Standard-Bausteine für Admin-Ressourcen: `appAdminResources` als kanonische Capability-Deklaration, route-addressable Listensteuerung in den Admin-/Content-Seiten und dünne Label-/Routing-Bindings für `@sva/studio-ui-react` statt app-eigener Tabellen-Owner-Schicht
   - Nx-Targets für `build`, `serve`, `lint`, das aggregierte `test:unit`, die gezielten App-Slices `test:unit:ui|routes|hooks|server`, `test:coverage` und `test:e2e` über Vite-, Vitest- und Playwright-Executor
2. Core (`packages/core`)
   - generische Route-Registry Utilities (`mergeRouteFactories`, `buildRouteTree`)
   - kanonisches Inhaltsmodell für `Content`, Statusmodell und JSON-Payload-Validierung
   - generische Plattformverträge für Studio-Jobs wie Jobstatus, Jobdetail, Jobstart, Jobquelle (`plugin|host`) und Importphasen
   - baut framework-agnostisch das `wasteTypes`-Static-Content-Artefakt aus aktiven Fraktionen, inklusive stabiler Key-Normalisierung und inhaltsbasiertem Versionshash
3. Routing (`packages/routing`)
   - zentrale Route-Factories (client + server)
   - einzige Source of Truth für Auth-Handler-Mapping, Runtime-Guard und JSON-Error-Boundary
   - eigener Observability-Vertrag für Guard-Denials, Plugin-Guard-Anomalien und serverseitige Dispatch-Fehler mit optionalem Diagnostics-Hook
   - Search-Param-Normalisierung fuer deklarierte Admin-Ressourcen ueber `normalizeAdminResourceListSearch`, damit Host-Listen zustandsstabil, deep-link-faehig und fail-closed bei ungueltigen Parametern bleiben
   - der Startup-Guard in `auth.routes.server.ts` prüft ausschließlich das Auth-Route-Mapping gegen `authRoutePaths`; er ist keine allgemeine Plugin- oder Router-Vollständigkeitsprüfung
4. Auth Runtime (`packages/auth-runtime`)
   - OIDC-Flows, Session-Store, Cookies, Auth-Middleware, Runtime-Health und Auth-/HTTP-Handler
   - Runtime-Adapter für fachliche IAM-, Governance-, Content- und Registry-Routen
   - Diagnosebausteine für Session-Hydration/-Refresh, Hostvalidierung, Schema-Guard, Runtime-Health und allowlist-basierte API-Fehlerdetails
5. Plugin SDK, Studio Module IAM und Server Runtime (`packages/plugin-sdk`, `packages/studio-module-iam`, `packages/server-runtime`)
   - `@sva/plugin-sdk`: öffentlicher Plugin-Vertrag v1, Build-time-Registry, Admin-Ressourcen, Content-Type- und Translation-Verträge
   - erweitert um deklarative Operations-Beiträge für registrierte Jobtypen und Importprofile im bestehenden Build-time-Snapshot
   - erweitert um deklarative `externalInterfaceTypes`, damit Plugins zusätzliche Schnittstellentyp-Metadaten beisteuern können, ohne eigene Persistenz- oder Secret-Pfade einzuführen
   - bündelt außerdem wiederverwendbare Helper für standardisierte Content-Plugins, Mainserver-CRUD-Basis und kleine UI-nahe Plugin-Utilities
   - `@sva/server-runtime`: Logger, Request-Kontext, JSON-Fehlerantworten, Workspace-Kontext, OTEL-Bootstrap und zentraler Resolver für External-Interface-Secrets und Statusprüfungen
   - Namespacing- und Ownership-Validierung für plugin-beigestellte registrierte Host-Identifier
   - Zielbild Plugin-Plattform v2: zusätzlich serialisierbarer Manifest-Vertrag, hostgeführter Katalog, Loader zur Snapshot-Materialisierung und host-owned Runtime-Boundaries für pluginseitige Server-, Job- und Integrationsbeiträge
6. Studio UI React (`packages/studio-ui-react`)
  - öffentliche React/UI-Basis `@sva/studio-ui-react` für Host-Seiten und Plugin-Custom-Views
  - kapselt shadcn-/Radix-Primitives, Studio-Templates, Formularfelder, Zustandsbausteine, Tabellen- und Aktionsmuster
  - ist der kanonische UI-Owner für die Formular-Foundation rund um `react-hook-form`-, Resolver- und Form-Bridge-Muster; Host und Plugins sollen keine parallelen Basis-Formularsysteme etablieren
  - ist kanonischer Owner für wiederverwendbare Host-Listen-UI wie `StudioDataTable` und `StudioListPageTemplate`; die App liefert nur noch explizite Labels, Routen und Seitendaten
  - bleibt UI-only: keine Plugin-Registry, keine Route-Materialisierung, keine Persistenz, keine IAM- oder Server-Runtime-Logik
7. Tooling Testing (`tooling/testing`)
   - gemeinsamer Owner für Frontend-Test-Foundations wie `msw`-Setup, Handler-Konventionen, Reset-Regeln und Test-Utilities
   - trennt HTTP-nahe Testinfrastruktur von produktiver Runtime-Logik und von E2E-/Infra-Läufen
   - bildet zusammen mit `docs/development/studio-foundations-governance.md` den Standardpfad für HTTP-nahe Frontend-Tests
8. Monitoring Client (`packages/monitoring-client`)
   - OTEL SDK Setup, Exporter, Log-Redaction-Processor
9. Data Client und Data Repositories (`packages/data-client`, `packages/data-repositories`)
   - `@sva/data-client`: client-sicherer HTTP-DataClient mit Schema-Validierung
   - `@sva/data-repositories`: serverseitige Repository-Fassaden und DB-nahe Operationen
   - enthält den führenden zentralen Job-Store für generische Studio-Jobs im Studio-Postgres
   - hält zusätzlich den kanonischen Registry-Store für `external_interface_types` und `instance_external_interfaces`
   - IAM-Persistenzmodell (`iam`-Schema) mit Multi-Tenant-Struktur bleibt SQL-first versioniert
10. SVA Mainserver (`packages/sva-mainserver`)
  - dedizierte Integrationsschicht für OAuth2, GraphQL-Transport, Fehlerabbildung und Fachadapter
  - trennt client-sichere Typen von serverseitigen Delegations- und Diagnostikfunktionen
  - exportiert die kanonischen serverseitigen Host-Verträge für Mainserver-News, -Events, -POI und die Schnittstellenverwaltung; `apps/sva-studio-react` hält dafür nur dünne Request- und TanStack-Adapter
  - kapselt zusätzlich den getypten Schreibpfad für Mainserver-Static-Content wie `wasteTypes` über `createOrUpdateStaticContent`, ohne Browser- oder Plugin-Code direkt an GraphQL zu koppeln
  - liest seine instanzbezogene Endpunktkonfiguration nicht mehr aus einer Mainserver-Spezialtabelle, sondern aus der zentralen External-Interface-Registry
  - hält `src/server/service.ts` bewusst als schlanke Fassade; Credentials, Token, GraphQL-Transport, Sichtbarkeits-Pagination, Mapper und ressourcenspezifische Operationen liegen in getrennten internen Modulen unter `src/server/service-internals/`
11. Plugin News (`packages/plugin-news`)
   - produktives Fachplugin für Mainserver-News mit pluginnahem Modell `news.article`
   - eigene Listen- und Editor-Ansichten, plugin-beigestellte Admin-Ressourcen-Spezialisierungen, Navigation und Übersetzungen
   - kapselt ein redaktionell vereinfachtes Editor-Mapping in `news.editor-model.ts`, das UI-Felder gezielt auf `contentBlocks[0]`, Kategorien, Veröffentlichungsmodus und den nachgelagerten Visibility-Schritt abbildet
   - verwendet in der Bearbeitung card-basierte Tabpanels mit globalem Speichern, während Legacy-Felder außerhalb der vereinfachten Oberfläche bei Updates aus dem geladenen Datensatz erhalten bleiben
   - nutzt `@sva/plugin-sdk` für Host-Metadaten und `@sva/studio-ui-react` für gemeinsame UI-Primitives statt App-interner Komponenten
   - persistiert nicht direkt in lokale IAM-Contents, sondern spricht die hostgeführte Mainserver-News-Fassade per HTTP an; die Studio-Liste lädt Entwürfe ausdrücklich mit `includeInvisible=true`
12. Plugin Waste Management (`packages/plugin-waste-management`)
   - freies Fachplugin unter `/plugins/waste-management` für Waste-Stammdaten, Touren, Ausweichtermine, PDF-Stamminhalte, technische Werkzeuge und instanzbezogene Einstellungen
   - konsumiert ausschließlich hostgeführte Endpunkte unter `/api/v1/waste-management/*`
   - hält bewusst nur fachliche UI-, Dialog-, Bulk- und lokale View-Model-Logik; keine direkte Datenbank-, Supabase- oder `Newcms`-Runtime-Kopplung
   - nutzt `@sva/plugin-sdk` für Route, Navigation, Audit-, Import- und Job-Verträge sowie `@sva/studio-ui-react` für generische Confirm-, Status- und Job-UI
   - stößt nach erfolgreichen Fraktionsmutationen asynchron den dedizierten Job `waste-management.sync-waste-types` an und degradiert reine Mainserver-Sync-Fehler bewusst zu einem Retry-Hinweis im Fraktionskontext
   - zeigt für den laufenden CSV-Spezialimport eine fachnahe Live-Fortschrittskarte an, leitet Prozent und Zeilenstand aber weiterhin ausschließlich aus dem generischen Host-Jobvertrag ab
13. Instanz-Registry (`packages/instance-registry`)
   - Host-Klassifikation, Vertrags- und Run-Modell fuer Registry, Preflight, Plan und Provisioning-Protokoll
   - Registry-Repositories, persistente Provisioning-Runs und Cache-Zugriffe über injizierte Repository-Verträge
   - Plattformvertrag, Keycloak-Control-Plane, Provisioning-Fassade und Root-Host-Guard
   - Root-Entry exportiert bewusst nur die stabile Capability-Fläche; interne Service-, HTTP- und Provisioning-Helfer bleiben auf Subpath- oder interne Module begrenzt
   - Keycloak-Reconcile- und Execute-Mutationen führen `Idempotency-Key`, API-Mutation und stabilen Payload-Fingerprint bis in `iam.instance_keycloak_provisioning_runs`, damit Retries denselben fachlichen Run wiederverwenden
   - aggregiert für `GET /api/v1/iam/instances/:instanceId` zusätzlich `tenantIamStatus` aus Registry-/Provisioning-, Access-Probe- und Reconcile-Evidenz
   - persistiert die letzte explizite Tenant-IAM-Access-Probe als Audit-Evidenz in `iam.instance_audit_events` und stellt sie der Detailseite korrelierbar mit `requestId`, `errorCode` und Zeitstempel bereit
   - `apps/sva-studio-react`: gefuehrte Admin-Control-Plane unter `/admin/instances` mit Preflight, Plan, Ausfuehrung und Protokoll
   - der Instanzvertrag trennt `authClientId` fuer interaktive Logins von `tenantAdminClient.clientId` fuer tenant-lokale Admin-Mutationen und Reconcile
   - blockerrelevanter Drift aus Preflight, Provisioning-Plan oder fehlendem Tenant-Admin-Vertrag wird vor Reconcile-/Sync-Starts fail-closed durchgesetzt
   - HTTP-Handler, Service-Komposition und Keycloak-Ausführung sind intern entlang Read, Mutation, Payload/Sync/Finalize und Diagnose getrennt, damit Runtime-Consumer stabile Fassaden nutzen und fachliche Flows nicht wieder in Sammeldateien zusammenlaufen
14. Studio-Job-Hostpfad (`packages/auth-runtime`, `packages/routing`, `packages/data-repositories`, `packages/iam-governance`)
   - `@sva/auth-runtime` veröffentlicht die hostgeführten Start-, Status- und Worker-Integrationspfade für generische Studio-Jobs
   - `@sva/routing` führt die öffentlichen Plugin-Operation-Endpunkte weiterhin typsicher; die interne Worker-Ausführung läuft über den generischen Task `studio_job_execute`
   - `@sva/data-repositories` hält den kanonischen Jobdatensatz mit `source`, Status, Progress, Payload-, Retry- und Fehlerfeldern
   - `@sva/iam-governance` bleibt fachlicher Owner der DSR-Exportdatensätze; Self-Service-Exporte verknüpfen diese Datensätze zusätzlich mit einem Host-Job über `studio_job_id`
   - strukturierte Progress-Details wie `processedRows` und `totalRows` bleiben Teil desselben generischen Jobdatensatzes und werden nicht in plugin- oder DSR-spezifische Nebenspeicher ausgelagert
   - eine interne Worker-Anbindung wie Graphile Worker bleibt hinter diesem Hostpfad austauschbar und ist kein Teil öffentlicher Plugin- oder Self-Service-Verträge
15. Waste-Host-Fassade (`packages/auth-runtime`, `packages/server-runtime`, `packages/data-repositories`)
   - `@sva/auth-runtime` publiziert die hostgeführte Waste-Fassade für Settings, Historie, CRUD, Bulk-Flows und technische Tool-Starts
   - derselbe Hostpfad startet auch den dedizierten Job `waste-management.sync-waste-types`; die eigentliche Mainserver-Schreiboperation bleibt dahinter in der Studio-Runtime und `@sva/sva-mainserver`
   - `@sva/server-runtime` löst die aktive instanzbezogene Waste-Datenquelle serverseitig auf und kapselt Secret-Nutzung sowie Connection-Checks
   - `@sva/data-repositories` hält sowohl die zentrale Governance-Persistenz der Waste-Datenquelle im Studio-Postgres als auch die hostseitigen Repositories gegen die instanzbezogene `waste_*`-Tabellenfamilie
   - `@sva/data` bleibt dabei ausdrücklich ohne neue primäre Waste-SQL- oder Orchestrierungs-Ownership
   - die Host-Fassade erzeugt keine persistenten Waste-PDF-Artefakte mehr; PDF-Exporte werden ad hoc in der öffentlichen Web-App ausgelöst

### IAM-Bausteine und Package-Zuordnung

- Identity und OIDC-Flow:
  - `packages/auth-runtime` (`routes`, `auth-server`, `oidc`, Session, Cookies, Runtime-Health)
- Account- und Rollenmanagement inkl. IdP-Synchronisation:
  - `packages/iam-admin` (User-, Rollen-, Gruppen-, Organisations-, Actor-, Reconcile- und Keycloak-Admin-Orchestrierung)
  - `user-projection.ts` ist der gemeinsame Projektionskern für Self-Service-Profile und Admin-Reads; spezialisierte UI-Pfade dürfen darauf nur noch darstellerisch aufsetzen
  - `reconcile-core.ts` und `user-import-sync-handler.ts` liefern deterministische Abschlusszustände (`success`, `partial_failure`, `blocked`, `failed`) mit Zählwerten für `checked`, `corrected`, `failed` und `manualReview`
- Mainserver-Credential-Auflösung für Downstream-Integrationen:
  - `packages/iam-admin` hält den organisationsgebundenen Credential-Speicher, die Write-only-Secret-Pflege und die read-safe Projektionslogik für Organisationen.
  - `packages/auth-runtime` liefert den aktiven Session- und Organisationskontext und stellt die Laufzeitgrenze für Mainserver-Aufrufe bereit.
  - `packages/sva-mainserver` löst daraus die effektive Credential-Quelle policy-gesteuert auf; persönliche Keycloak-Credentials bleiben nur Fallback bei `org_or_personal`.
- Autorisierung (RBAC/ABAC) und Laufzeitentscheidungen:
  - `packages/iam-core` für zentrale Autorisierungsverträge und Entscheidungen; Runtime-Adapter liegen in `packages/auth-runtime`.
- Organisations- und Mandantenkontext (`instanceId`) inkl. RLS-nahe Datenmodelle:
  - `packages/iam-admin`, `packages/instance-registry` und `packages/data-repositories` über klar getrennte Fach- und Repository-Verträge
- Plattformkontext (`platform`) für Root-Host-Control-Plane, Root-Host-Auth und globale Readiness:
  - `packages/auth-runtime`, `packages/iam-admin` und `packages/instance-registry`
  - `packages/auth-runtime` liefert die serverseitig gebundene Fresh-Reauth-Evidenz für kritische Root-Host-Mutationen; `packages/instance-registry` verwendet nur diesen Kontext und keine klientseitigen Marker als Sicherheitsnachweis
- Tenant-Admin-Pfad pro Instanz:
  - `packages/iam-admin` für Tenant-Admin-Orchestrierung
  - `packages/instance-registry` für Registry-, Diagnose-, Access-Probe-, Preflight- und Provisioning-Verträge des `tenantAdminClient`
  - `packages/data-repositories` für DB-nahe Registry- und IAM-Zugriffe
- Instanzgebundene Mainserver-Endpunkte:
  - `packages/data-repositories` für Endpunktkonfiguration, `packages/sva-mainserver` für Integration und Adapter
- Auditierung und Nachvollziehbarkeit:
  - `packages/auth-runtime` und fachliche Zielpackages für Events, `packages/server-runtime` für Logger und Request-Kontext
  - tenantgebunden: `iam.activity_logs`
  - plattformgebunden: `iam.platform_activity_logs`
- Governance und DSGVO-Betroffenenrechte:
  - `packages/iam-governance`
  - enthält auch die kanonische Legal-Text-Sanitisierung; React-Consumer importieren keinen app-lokalen HTML-Sanitizer mehr
  - liefert für den Account-Self-Service sowohl die Overview-Projektion mit `activityItems` als auch den `caseId`-basierten Detailzugriff für Deep-Links auf einzelne Datenschutzvorgänge
- Inhaltsverwaltung als Core-Element:
  - `packages/core` (`content-management.ts`) für Kernvertrag
  - `packages/plugin-sdk` für Erweiterungspunkte, Registries und Namespace-Verträge
  - `packages/auth-runtime` für Runtime-Handler und `packages/iam-governance` für legal-/audit-nahe Fachanteile
  - `apps/sva-studio-react/src/routes/content/*` für Listen- und Editor-UI unter `/admin/content`
  - `packages/plugin-news` für plugin-spezifische News-Ansichten auf Basis derselben Core-Content-API
- Externe Mainserver-Anbindung:
  - `packages/sva-mainserver` (`server/config-store.ts`, `server/service.ts`, `server/service-internals/*`, `generated/*`)

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
- `packages/auth-runtime` haelt zusaetzlich nur sehr kurzlebige In-Process-Caches fuer Session-Resolution und Account-Lifecycle-Pruefung, um wiederholte Authorize-Requests derselben Session ohne neuen Redis-/DB-Roundtrip abzufangen.
- Der SVA-Mainserver bleibt fachliche Source of Truth für seine GraphQL-Daten; Studio hält nur Endpunktkonfiguration und kurzlebige Laufzeit-Caches für Credentials und Access-Tokens.
- Fachmodule konsumieren zentrale IAM-Entscheidungen und duplizieren keine eigene Berechtigungsauflösung gegen IAM-Tabellen.
- `packages/iam-admin` hält zusätzlich die tenantseitige Governance-Trennung für Rollen und Permissions: Root-only-Rollen/-Permissions werden vor Admin-CRUD gefiltert oder abgewiesen, während `system_admin` als geschützte Tenant-Sonderrolle erhalten bleibt.

### Fortschreibung 2026-05: Scoped Rollen-Permissions fuer Datensatzrechte

1. `packages/core`
   - erweitert den kanonischen IAM-Vertrag um `IamRolePermissionAssignmentScope = all|own|organization` sowie UI-Metadaten fuer scope-faehige Permissions.
   - trennt bewusst zwischen generischem `permission.scope` fuer bestehende ABAC-Faelle und dem neuen Assignment-Scope auf Rollen-Permission-Zuordnungen.
2. `packages/iam-admin`
   - liest und schreibt Rollen-Permission-Zuordnungen als `permissionAssignments[]` mit `accessScope`.
   - validiert serverseitig, dass nur explizit scope-faehige Datensatzrechte einen Assignment-Scope tragen.
3. `packages/auth-runtime`
   - erweitert die effektive Permission-Aufloesung und den Authorize-Pfad um `accessScope`.
   - verwendet fuer scope-faehige Datensatzentscheidungen kanonische Resource-Attribute wie `createdByAccountId` und `organizationId`.
4. `packages/data` und `packages/data-repositories`
   - versionieren `iam.role_permissions.access_scope` SQL-first als Teil des fuehrenden IAM-Schemas.
5. `apps/sva-studio-react`
   - erweitert die Rollen-Detailseite um Scope-Pflege pro Permission-Zuweisung.
   - zeigt in der Nutzeransicht die resultierenden effektiven Scopes read-only als Transparenzsignal.

### Fortschreibung 2026-05: Monitoring-Einstieg fuer IAM-Authorize-Performance

1. `@sva/core`
   - definiert den gemeinsamen Ergebnis- und Report-Vertrag fuer GUI, API und persistierten Nachweis des Authorize-Performance-Laufs.
2. `packages/auth-runtime`
   - exponiert den geschuetzten Endpoint `GET|POST /api/v1/iam/authorize-performance` fuer `system_admin`.
   - misst den echten `POST /iam/authorize`-Pfad serverseitig mit der aktuellen Administrations-Session statt ueber Browser-Timing.
   - invalidiert im Szenario `recompute` nur den Snapshot des aktuellen Session-Actors und schreibt JSON-/Markdown-Nachweise unter `docs/reports/`.
   - nutzt im Hot-Path zusaetzlich kurzlebige In-Process-Caches fuer Session-Resolution und Account-Lifecycle (`TTL 500 ms`), nachdem der lokale Monitoring-Nachweis gezeigt hat, dass der vorherige Engpass nicht in der Policy-Auswertung, sondern in der vorgelagerten Auth-Middleware lag.
3. `packages/routing`
   - registriert den Lauf typsicher im zentralen Auth-/IAM-Router und haelt GET-/POST-Dispatch konsistent.
4. `apps/sva-studio-react`
   - rendert unter `/monitoring` den betrieblichen Einstieg fuer Plugin-Jobs und den GUI-gestuetzten Authorize-Benchmark.
   - trennt bewusst Monitoring-Operations von der IAM-Cockpit-Oberflaeche und zeigt nur sichere Ergebnisfelder, Kennzahlen und Report-Referenzen an.

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

### Fortschreibung 2026-04: Tenant-IAM-Operations im Instanz-Detail

1. `packages/core`
   - erweitert den Instanz-Detailvertrag um `tenantIamStatus` mit den Achsen `configuration`, `access`, `reconcile` und `overall`.
2. `packages/data-repositories`
   - liest letzte Access-Probe-Evidenz aus `iam.instance_audit_events` und Reconcile-Zusammenfassungen aus `iam.roles` plus `iam.activity_logs`.
3. `packages/instance-registry`
   - baut daraus den aggregierten Tenant-IAM-Betriebsstatus und bietet die Mutation `POST /api/v1/iam/instances/:instanceId/tenant-iam/access-probe`.
4. `packages/auth-runtime`
   - erzwingt für die Access-Probe und tenantlokale Reconcile-Pfade den Execution-Mode `tenant_admin` ohne Plattform-Fallback.
   - bewertet `/health/ready` fail-closed auch gegen den tenant-spezifischen Login-Vertrag aktiver Instanzen; fehlende Host-/Realm-/Client-Grunddaten oder unlesbare tenantgebundene Auth-Secrets blockieren Readiness.
5. `apps/sva-studio-react`
   - rendert auf `/admin/instances/$instanceId` einen separaten Tenant-IAM-Bereich mit Statusachsen, Korrelation und kontextbezogenen Aktionen.
   - strukturiert dieselbe Detailseite als `Control Tower + Workbench`: fester Überblick für Gesamtstatus, Evidenzfrische, priorisierte Befunde und genau eine Primäraktion; nachgelagerte Arbeitsbereiche für `Konfiguration`, `Betrieb` und `Historie`.
   - leitet dafür in der React-Schicht ein kanonisches Cockpit-Modell aus bestehenden Datenquellen wie `tenantIamStatus`, Keycloak-Preflight, Provisioning-Vorschau, letztem Run und Mutationsdiagnostik ab, ohne den Backend-Vertrag zu ändern.
16. Öffentlicher Abfallkalender (`apps/public-waste-calendar-web`)
   - eigenständige Vite/React-App für den öffentlichen Waste-Kalender außerhalb der Studio-Admin-Shell
   - hält Resolver, Kalenderprojektion, Demo-Runtime, Cookie-Restore, PDF-/iCal-Links und Modal-Interaktion bewusst app-lokal
   - nutzt eine reduzierte UI aus `PublicWasteApp`, `PublicWasteSelectionForm`, `PublicWasteCalendarPanels` und `PublicWasteEventDialog`
   - kapselt servernahe Verträge in `src/lib/public-waste-*.ts` und nutzt dafür bewusst gemeinsame Workspace-Verträge aus `@sva/core` und `@sva/data-repositories`, ohne an die Studio-Admin-UI oder das Plugin-Routing zu koppeln
   - besitzt zusätzlich eine eigene produktive Node-Runtime unter `src/server/**`, die das gebaute Frontend statisch ausliefert und die öffentlichen Read-Endpunkte `/api/public-waste/*` lokal bedient
   - wird betrieblich über ein dediziertes Image, einen dedizierten Portainer-Stack `web-waste-calendar` und einen separaten Git-Tag-Releasepfad `waste-web-vX.Y.Z` ausgerollt, ohne den normalen Studio-Releasevertrag mitzubenutzen

### Foundation-Governance über Bausteingrenzen

- `docs/development/studio-foundations-governance.md` definiert den verbindlichen Standardpfad für Formular- und Frontend-Test-Foundations über Host, Plugins, `@sva/studio-ui-react` und `tooling/testing`.
- `docs/development/studio-form-migrationsinventur.md` bleibt das Pflichtartefakt für Legacy-Ausnahmen, Migrationsreihenfolge und betroffene Host-/Plugin-Flows.
- Die zugehörigen Architekturentscheidungen liegen in `docs/adr/ADR-043-formular-foundation-mit-react-hook-form-und-zodresolver.md` und `docs/adr/ADR-044-frontend-test-foundation-mit-msw-und-selektivem-fast-check.md`.

### Fortschreibung 2026-04: Instanz-Modulaktivierung

1. `packages/core`
   - erweitert Instanz-Read-Modelle um `assignedModules` und einen Modul-IAM-Befund.
2. `packages/data` und `packages/data-repositories`
   - persistieren die kanonische Instanz-Modul-Zuordnung in `iam.instance_modules`.
3. `packages/plugin-sdk`
   - definiert den deklarativen Modul-IAM-Vertrag pro Plugin.
4. `packages/instance-registry`
   - ist führender Fachbaustein für `assignModule`, `revokeModule` und `seedIamBaseline`.
5. `packages/auth-runtime`
   - reichert `/auth/me` für Instanz-Sessions mit `assignedModules` an.
6. `packages/routing` und `apps/sva-studio-react`
   - sperren Plugin-Routen und Plugin-Navigation fail-closed gegen den aktiven Modulsatz der Instanz.

### Abhängigkeiten (vereinfacht)

- App -> `@sva/core`, `@sva/routing`, `@sva/auth-runtime`, `@sva/plugin-sdk`, `@sva/studio-ui-react`, `@sva/sva-mainserver`, `@sva/plugin-categories`, `@sva/plugin-news`, `@sva/plugin-events`, `@sva/plugin-poi`
- `@sva/routing` -> `@sva/auth-runtime`, `@sva/core`, `@sva/plugin-sdk`, `@sva/server-runtime`
- `@sva/auth-runtime` -> `@sva/iam-core`, `@sva/iam-admin`, `@sva/iam-governance`, `@sva/instance-registry`, `@sva/data-repositories`, `@sva/server-runtime`
- `@sva/auth-runtime` -> `@sva/studio-module-iam` für den kanonischen Modul-IAM-Katalog
- `@sva/sva-mainserver` -> `@sva/auth-runtime`, `@sva/data-repositories`, `@sva/server-runtime`
- `@sva/plugin-sdk` -> `@sva/core`
- `@sva/studio-module-iam` -> keine React-, Host- oder Plugin-UI-Abhängigkeiten; nur Vertragsdaten und kleine Helper
- `@sva/server-runtime` -> `@sva/core`, `@sva/monitoring-client`
- `@sva/plugin-*` -> `@sva/plugin-sdk`, optional `@sva/studio-ui-react` für Custom-Views (kein Direktimport aus `@sva/core` oder App-internen Komponenten)
- `@sva/plugin-waste-management` -> `@sva/plugin-sdk`, `@sva/studio-ui-react`; Host-Datenzugriffe ausschließlich über `/api/v1/waste-management/*`
- `@sva/plugin-categories`, `@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi` bleiben absichtlich auf SDK, Studio-UI und Peer Dependencies beschränkt; API-Aufrufe laufen über öffentliche Host-Fassaden statt über App-Module
- `@sva/monitoring-client` -> OTEL Libraries, `@sva/server-runtime` Context API
- `@sva/iam-core` -> `@sva/core`
- `apps/sva-studio-react` -> Zielpackages über Server-Funktionen für Inhaltsliste, Detail, Historie und Statuswechsel
- `apps/public-waste-calendar-web` -> `@sva/core`, `@sva/data-repositories`; die App hält ihren öffentlichen UI- und Node-Laufzeitpfad trotzdem lokal und getrennt von der Studio-Admin-Shell

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

### Erweiterung 2026-04 bis 2026-06: Plugin-SDK-Vertrag v1 und Workspace-Plugins

1. `packages/plugin-sdk/src/plugins.ts`
   - definiert `PluginDefinition` und Merge-Helfer für Plugin-Routen, Navigation, Content-Typen, Admin-Ressourcen und Übersetzungen
2. `apps/sva-studio-react/plugin-catalog.json` und `apps/sva-studio-react/src/lib/plugins.ts`
   - registrieren `pluginCategories`, `pluginNews`, `pluginEvents`, `pluginPoi` und `pluginWasteManagement` statisch im Host und materialisieren daraus Route-, Navigations-, Admin-Ressourcen-, Audit- und i18n-Metadaten
3. `packages/auth-runtime/src/iam-contents/content-type-registry.ts`
   - erweitert den generischen Content-Write-Pfad um contentType-spezifische Payload-Validierung und Sanitisierung
4. `packages/plugin-categories/src/*`, `packages/plugin-news/src/*`, `packages/plugin-events/src/*`, `packages/plugin-poi/src/*`
   - kapseln fachliche Listen- und Editorflächen unter der SDK-Boundary
   - `plugin-categories` stellt eine freie Fachroute unter `/categories` als redaktionelles Begleitmodul für Mainserver-Kategorien bereit
   - `plugin-news`, `plugin-events` und `plugin-poi` registrieren `adminResources` mit `resourceId` `news.content`, `events.content` und `poi.content`, jeweils auf Basis der Host-Views `content`, `contentCreate` und `contentDetail`
   - liefern über `contentUi` optionale Bindings für `list`, `detail` und `editor`; Events und POI nutzen dabei dieselbe feste Tab-Struktur `Basis` / `Inhalt` / `Einstellungen` / `Historie` wie News, während Route, Guard, Shell und Persistenz host-owned bleiben
   - beziehen gemeinsame Standard-Metadaten, Mainserver-CRUD-Basis und kleine Hilfsfunktionen aus `@sva/plugin-sdk`, ohne einander zu importieren
   - schreiben ihre Fachdaten über hostgeführte Fassaden; Legacy-`payload` bleibt nur dort Lesefallback, wo die jeweilige Fassade ihn noch toleriert

### Erweiterung 2026-04: Namespacete Plugin-Identität über Build-time-Registries

1. `packages/plugin-sdk/src/plugins.ts` + `packages/plugin-sdk/src/plugin-identifiers.ts`
   - definieren die technische Plugin-Identität über `PluginDefinition.id` als führenden Namespace und validieren plugin-beigestellte `contentType`s, Admin-Ressourcen, Audit-Event-Typen und Permissions gegen `<pluginId>.<name>`
2. `packages/plugin-sdk/src/build-time-registry.ts`
   - verdichtet Plugins, hosteigene Admin-Ressourcen, plugin-spezifische Permissions und Audit-Event-Definitionen phasenweise in einen gemeinsamen Registry-Snapshot für Host und Routing
   - hält die bestehende `BuildTimeRegistry`-API stabil; interne Phasen ordnen Preflight, Content, Admin, Audit, Permissions, Routing und Publish
   - validiert spezialisierte `contentUi.contentType`-Referenzen gegen den zusammengeführten Content-Type-Snapshot fail-fast vor der Veröffentlichung
3. `packages/routing/src/app.routes.shared.ts`

### Fortschreibung 2026-05: Zielbausteine der Plugin-Plattform v2

1. `@sva/plugin-sdk`
   - bleibt die öffentliche Authoring-Boundary für generische Contribution-Typen, Host-Client-Fassaden und pluginseitige React-Hilfen
   - ist nicht der Zielort für Manifest-Speicherung, Aktivierungskatalog oder app-spezifische Loader-Entscheidungen
2. `plugin-manifest` (Zielbaustein)
   - beschreibt veröffentlichte Plugins serialisierbar mit Identität, Version, Kompatibilität, Capabilities und Entry-Points
3. `plugin-catalog` (Zielbaustein)
   - verwaltet lokale und installierte Plugins als aktivierbare Host-Bestandteile mit Status `aktiv`, `deaktiviert` oder `inkompatibel`
4. `plugin-loader` (Zielbaustein)
   - normalisiert lokale Source-Plugins und installierte Distributions-Plugins auf denselben validierten Host-Snapshot
5. `plugin-runtime` (Zielbaustein)
   - stellt host-owned Execution-Contexts für pluginseitige Request-, Job- und Integrationsbeiträge bereit
   - kapselt Authentifizierung, Instanzauflösung, Guarding, Audit, Secret-Auflösung, Fehlervertrag und Orchestrierung außerhalb des Plugin-Codes
   - materialisiert deklarative Admin-Ressourcen unter `/admin/<resource>`; für News, Events und POI entstehen host-owned CRUD-Pfade unter `/admin/news`, `/admin/events` und `/admin/poi`
   - verwendet spezialisierte `contentUi`-Bindings nur innerhalb der vorgesehenen Host-Region und hält Legacy-Aliase wie `/content*` nur noch für die generische Inhaltsverwaltung
4. `packages/auth-runtime/src/iam-contents/content-type-registry.ts`
   - führt `news.article` als kanonischen plugin-beigestellten `contentType` im serverseitigen Validierungsvertrag

### Erweiterung 2026-04: Plugin-spezifische IAM-Rechte

1. `packages/plugin-sdk/src/plugins.ts`
   - ergänzt `PluginDefinition.permissions` und `definePluginPermissions()` als generischen SDK-Vertrag für plugin-deklarierte Rechtefamilien
   - weist `content.*`-Guards, fremde Plugin-Namespaces, reservierte Namespaces, Duplikate und nicht registrierte Permission-Referenzen fail-fast ab
2. `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-poi`
   - deklarieren eigene Rechtefamilien `news.*`, `events.*` und `poi.*`
   - nutzen diese Rechte für Actions, Routen und Navigation ohne produktiven `content.*`-Fallback
3. `packages/data/src/iam/seed-plan.ts`
   - seeded plugin-spezifische Permissions als normale IAM-Permissions mit `resourceType` `news`, `events` oder `poi`
   - weist Personas Rechte namespace-isoliert zu, sodass ein News-Recht keine Events- oder POI-Freigabe impliziert
4. `apps/sva-studio-react/src/routes/admin/roles`
   - zeigt Plugin-Permissions in der Rollenverwaltung als fachliche Ressourcengruppen und speichert sie über den bestehenden Rollen-Permission-Vertrag

### Erweiterung 2026-05: Gemeinsame Runtime-Vertragsquelle für Modul-IAM

1. `packages/studio-module-iam/src`
   - veröffentlicht den kanonischen Modul-IAM-Katalog für `news`, `events`, `poi` und hosteigene Module wie `media`
   - kapselt Namespace-, Ownership-, Permission- und Systemrollen-Metadaten in einer runtime-sicheren Vertragsform
2. `packages/plugin-news/src/plugin.tsx`, `packages/plugin-events/src/plugin.tsx`, `packages/plugin-poi/src/plugin.tsx`
   - leiten ihre `moduleIam`-Deklarationen aus derselben Vertragsfamilie ab, behalten aber den schmalen Plugin-Vertrag ohne zusätzliche Runtime-Metadaten
3. `apps/sva-studio-react/src/lib/plugins.ts`
   - verwendet denselben Katalog für Build-time-Registry-Parität und die hostseitige Modulübersicht
4. `packages/auth-runtime/src/iam-instance-registry/repository.ts`
   - nutzt denselben Katalog für Runtime- und Provisioning-Wiring statt lokaler manueller Modul-Maps

### Erweiterung 2026-04: Host-seitige Plugin-Guardrails

1. `packages/plugin-sdk/src/guardrails.ts`
   - definiert deterministische Guardrail-Fehlercodes für Routing-, Autorisierungs-, Audit-, Persistenz- und Dynamic-Registration-Bypässe
2. `packages/plugin-sdk/src/plugins.ts`
   - validiert Plugin-Contributions gegen Runtime-Allowlists, bevor der Build-time-Registry-Snapshot veröffentlicht wird
3. `packages/routing/src/app.routes.shared.ts`
   - materialisiert Plugin-Routen nur unter `/plugins/<pluginNamespace>` und bricht unbekannte Plugin-Guards fail-fast ab
4. Standardisierte Content-Plugins dürfen ihre CRUD-Hauptrouten nicht mehr parallel unter `/plugins/<pluginNamespace>` veröffentlichen; Versuche auf `/plugins/<namespace>`, `/plugins/<namespace>/new` oder `/plugins/<namespace>/$id` werden fail-fast als Bypass des Host-Pfads abgewiesen
5. Plugin-UI-Komponenten bleiben erlaubt, solange Route, Guard, Search-Parameter, Persistenz und Audit-Pfad host-owned bleiben

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
  - der Host pflegt organisationsgebundene Mainserver-Credentials nur read-safe über den IAM-Organisationsvertrag; das Secret bleibt write-only und verlässt den Server nie

Referenzen:

- `packages/core/src/routing/registry.ts`
- `packages/routing/src/index.ts`
- `packages/auth-runtime/src/index.server.ts`
- `packages/auth-runtime/src/audit-db-sink.server.ts`
- `packages/iam-admin/src/organization-mainserver-credentials.ts`
  - hält den dedizierten organisationsgebundenen Credential-Speicher inklusive AAD-Bildung, write-only Secret-Update und read-safe Zustandsprojektion
- `packages/auth-runtime/src/mainserver-credentials.server.ts`
  - liest und kanonisiert persönliche Keycloak-Attribute `mainserverUserApplicationId` und `mainserverUserApplicationSecret`; dieser Pfad bleibt persönlicher Fallback statt globalem Primärmodell
- `packages/data/migrations/0048_iam_organization_mainserver_credentials.sql`
  - versioniert den organisationsgebundenen Mainserver-Credential-Speicher im IAM-Schema
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
   - Self-Service-Profilseite (`/account`) mit Validierung, Error-Summary, tenantlokaler Profilpflege und einer kleinen Studio-owned Rückkehrmeldung nach delegierten Keycloak-Credential-Flows.
2. `apps/sva-studio-react/src/components/Header.tsx` und `apps/sva-studio-react/src/lib/auth-navigation.ts`
   - Das Kontomenü startet derzeit nur die Passwort-Änderung über den kanonischen Pfad `/auth/account-action?action=update-password&returnTo=/account`; die E-Mail-Änderung bleibt bis zur serverseitigen Keycloak-Freischaltung ausgeblendet, statt eigene Formularlogik im Browser aufzubauen.
3. `apps/sva-studio-react/src/routes/admin/users/*`
   - Admin-User-Liste (`/admin/users`) und User-Detailansicht (`/admin/users/$userId`) inklusive Rollen- und Statusverwaltung; Profiländerungen aus `/account` werden bei erneuter Datenladung bzw. In-App-Invalidierung sichtbar.
4. `apps/sva-studio-react/src/routes/admin/roles/-roles-page.tsx`
   - Rollenverwaltung (`/admin/roles`) mit System-/Custom-Rollen und erweiterbarer Berechtigungsmatrix.
5. `apps/sva-studio-react/src/hooks/use-users.ts`, `use-user.ts`, `use-roles.ts`
   - Frontend-Datenzugriff auf IAM-v1-Endpunkte mit Fehler-/403-Behandlung.
6. `packages/routing/src/account-ui.routes.ts`, `packages/auth-runtime/src/auth-route-handlers.ts`
   - Zentrale Guard- und Runtime-Konfiguration für `/account`, `/admin/users`, `/admin/users/$userId`, `/admin/roles` sowie den serverseitigen Keycloak-AIA-Einstieg `/auth/account-action`.

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

### Ergänzung 2026-05: Tenant-Löschregeln und Account-Lifecycle

1. `packages/data/migrations/0043_iam_tenant_account_deletion_rules.sql`
   - Führt tenantbezogene Löschregeln, Self-Service-Inhaltspräferenzen sowie Lifecycle-Felder für Accounts und Contents ein.
2. `packages/iam-governance/src/deletion-rules-read-models.*`
   - Leiten wirksame Tenant-Regeln und Self-Service-Overviews aus Baseline-Defaults, Tenant-Konfiguration und dem letzten `login`-Event aus `iam.activity_logs` ab.
3. `packages/iam-governance/src/deletion-rules-maintenance.ts`
   - Bewertet tenantweit den Login-basierten Inaktivitäts-Lifecycle und spiegelt Owner-Stufen optional referenzwahrend auf `iam.contents`.
4. `packages/auth-runtime/src/iam-deletion-rules/core.ts`
   - Stellt tenantgebundene Runtime-Endpunkte für Admin-Read/Write, Self-Service-Read und Self-Service-Inhaltspräferenzen bereit.
5. `apps/sva-studio-react/src/routes/admin/-iam-page.tsx` und `apps/sva-studio-react/src/routes/account/-account-privacy-page.tsx`
   - Erweitern das IAM-Transparenz-Cockpit um den Tab `deletion-rules` und das Datenschutz-Cockpit um eine tenantgebundene Konten-Löschregeln-Box.

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
4. Medienvertrag (`packages/media`)
   - kanonische Typen für `MediaAsset`, `MediaVariant`, `MediaReference`, Rollen, Sichtbarkeit, Upload- und Processing-Status
   - fail-closed Regeln für Löschbarkeit und Referenzierbarkeit
5. Datenzugriff (`packages/data-repositories`)
   - Medien-Repositories für Assets, Varianten, Referenzen, Upload-Sessions, Quota und Usage-Impact
6. Auth-Runtime (`packages/auth-runtime`)
   - hostseitige Media-HTTP-Endpunkte
   - interner Storage-Port und S3-/MinIO-Adapter
   - Audit, Autorisierung und Upload-Processing für Medien
