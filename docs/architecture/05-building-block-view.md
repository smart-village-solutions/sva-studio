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
   - Auth- und Diagnose-Bausteine: `AuthProvider` für Identität, `/auth/me`, Silent-Recovery und Session-Lifecycle; ein anwendungsweiter Organisationskontext und `EffectiveAccessProvider` für Plattform-/Tenant-Scope, `/iam/me/permissions`, Modulzuweisung und fail-closed UI-Entscheidungen; `iam-api.ts` für Browser-Timeouts, `requestId`-Aufnahme und Safe-Detail-Parsing
   - Account-Self-Service-Bausteine: `/account/privacy` als Aktivitätscockpit für Datenschutz- und Transparenzvorgänge, `/account/privacy/$caseId` als Deep-Link-Detailansicht und `/account/rules` als getrennte Oberfläche für tenantweite Löschregeln und persönliche Inhaltsregeln

- Host-Standard-Bausteine für Admin-Ressourcen: `appAdminResources` als kanonische Capability-Deklaration, route-addressable Listensteuerung in den Admin-/Content-Seiten und dünne Label-/Routing-Bindings für `@sva/studio-ui-react` statt app-eigener Tabellen-Owner-Schicht
- Nx-Targets für `build`, `serve`, `lint`, das aggregierte `test:unit`, die gezielten App-Slices `test:unit:ui|routes|hooks|server`, `test:coverage` und `test:e2e` über Vite-, Vitest- und Playwright-Executor

1a. Öffentliche Projektberichterstattung (`apps/project-report`)

- eigenständige statische Vite-/React-App mit Meilenstein- und Arbeitspaketansicht
- verwendet das app-lokale öffentliche Reporting-JSON als einzige fachlich gepflegte Datenquelle und leitet Fortschritt ausschließlich aus dem Statusmodell ab
- modelliert Ansicht und Filter als teilbare URL-Search-Params
- besitzt keine Abhängigkeit auf `apps/sva-studio-react` oder `@sva/studio-ui-react`; UI, Styles, Datenadapter und Tests bleiben app-lokal
- bleibt im gebauten Pages-Artefakt read-only; die lokale Vite-Middleware für direkte JSON-Bearbeitung wird nur auf lokalen Hosts aktiviert

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
   - hostgeführter Plugin-Tenant-Lifecycle mit generationsgebundenem Ledger, Readiness-Read-Modell und zentraler Access-Entscheidung; `/auth/me` entfernt nicht freigegebene lifecycle-verwaltete Module aus `assignedModules`, normale Plugin-Jobs prüfen dieselbe Entscheidung vor Idempotenzreservierung und Queueing
5. Plugin SDK, Studio Module IAM und Server Runtime (`packages/plugin-sdk`, `packages/studio-module-iam`, `packages/server-runtime`)
   - `@sva/plugin-sdk`: öffentlicher Plugin-Vertrag v1, Build-time-Registry, Admin-Ressourcen, Content-Type- und Translation-Verträge sowie hostpublizierter, read-only Session-Access-Snapshot für Plugin-UI
   - erweitert um deklarative Operations-Beiträge für registrierte Jobtypen und Importprofile im bestehenden Build-time-Snapshot
   - definiert den frameworkfreien Readiness- und Access-Entscheid für tenantbezogene Plugin-Lifecycles; Datenbanktopologie und Fachprüfungen bleiben plugin-owned
   - erweitert um deklarative `externalInterfaceTypes`, damit Plugins zusätzliche Schnittstellentyp-Metadaten beisteuern können, ohne eigene Persistenz- oder Secret-Pfade einzuführen
   - bündelt außerdem wiederverwendbare Helper für standardisierte Content-Plugins, Mainserver-CRUD-Basis und kleine UI-nahe Plugin-Utilities
   - `@sva/server-runtime`: Logger, Request-Kontext, JSON-Fehlerantworten, Workspace-Kontext, OTEL-Bootstrap und zentraler Resolver für External-Interface-Secrets und Statusprüfungen
   - Namespacing- und Ownership-Validierung für plugin-beigestellte registrierte Host-Identifier
   - Zielbild Plugin-Plattform v2: zusätzlich serialisierbarer Manifest-Vertrag, hostgeführter Katalog, Loader zur Snapshot-Materialisierung und host-owned Runtime-Boundaries für pluginseitige Server-, Job- und Integrationsbeiträge
   - der Manifest-Vertrag führt den verpflichtenden Extension-Tier `feature`, `admin` oder `platform`; der Loader trägt ihn in die Registry-Preflight-Phase, bevor Route, Navigation oder Action veröffentlicht werden
   - die Registry erlaubt Plattformbeiträge nur für freigegebene Tiers und die Rolle `instance_registry_admin`; tenantbezogene Plugin-Rechte bleiben vollständig namespaced und modulgebunden
   - freie Plugin-Routen können einen namespaceten, rein deklarativen Server-Handler referenzieren; Pfad, Action und Access-Anforderung werden vor Veröffentlichung gemeinsam validiert, während die ausführbare Handler-Bindung host-owned bleibt
   - der Build-time-Snapshot veröffentlicht getrennte Plattform-/Tenant-Sichten für Route und Navigation; `@sva/routing` materialisiert pro Host nur die passende Sicht
   - `@sva/core` definiert die framework-unabhängige Aktivierungsauflösung; `@sva/data-repositories` materialisiert Policy, Override und Revision im vorhandenen Instanz-Modulsatz
   - die Studio-App injiziert Aktivierungsrichtlinien und Plugin-IAM-Verträge atomar aus demselben validierten Snapshot in `@sva/auth-runtime`; nur hosteigene Module wie `media` werden zusätzlich ergänzt, ein zweiter statischer Plugin-IAM-Katalog ist keine Runtime-Quelle
   - `@sva/auth-runtime` konfiguriert eine neue Snapshot-Revision im kurzen Bootstrap-Pfad und startet den kontrollierten Fleet-Reconcile erst nach Registrierung der Plugin-Operations-Handler im Hintergrund; Teilfehler werden revisionsgebunden berichtet und bei einem späteren Bootstrap erneut versucht
   - der scoped Instance-Registry-Runtime meldet erfolgreich committete Aktivierungs-Reconciles über einen Post-Commit-Hook; `@sva/auth-runtime` startet darüber fehlende oder retryable `provision`-Läufe automatisch für `automatic`- und `required`-Plugins mit Tenant-Lifecycle, ohne fertige Readiness-Evidenz erneut zu provisionieren
6. Studio UI React (`packages/studio-ui-react`)

- öffentliche React/UI-Basis `@sva/studio-ui-react` für Host-Seiten und Plugin-Custom-Views
- verwendet die framework-agnostische Rich-Text-Allowlist aus `@sva/core/rich-text-html-policy` und wendet sie im Browser mit DOMPurify an, ohne den Node-basierten Server-Sanitizer in das Client-Bundle zu übernehmen
- kapselt shadcn-/Radix-Primitives, Studio-Templates, Formularfelder, Zustandsbausteine, Tabellen- und Aktionsmuster
- ist alleiniger Owner des Studio-Buttons mit der fachlichen Varianten-API `primary`, `secondary`, `tertiary` und `destructive`; App und Plugins besitzen keine parallele Button-Basis
- stellt für Buttons zentrale Theme-Zustände, 44 × 44 Pixel Mindestzielgröße, sichtbaren Fokus, Disabled-/Loading-Semantik und fokusfähige Icon-Tooltips bereit
- ist der kanonische UI-Owner für die Formular-Foundation rund um `react-hook-form`-, Resolver- und Form-Bridge-Muster; Host und Plugins sollen keine parallelen Basis-Formularsysteme etablieren
- besitzt mit `StudioSaveButton`, `useStudioSaveFeedback` und `StudioPersistentFormError` die gemeinsame Darstellung normaler Save-Lifecycles; die kleinen `*StudioCreatedSaveFeedback`-Hilfen transportieren einen Create-Erfolg transient und datensatzgebunden zur Detailroute; fachliche Mutationen und Fehlerübersetzungen bleiben außerhalb des UI-Pakets
- besitzt mit `StudioDestructiveActionDialog` und `StudioPersistentActionResult` die gemeinsame Darstellung endgültiger Entscheidungen und stabiler Ergebnisse; die Navigationshilfen transportieren ausschließlich den einmaligen ressourcengebundenen Abschluss, niemals Undo- oder Restore-Semantik
- erweitert `StudioJobSummaryCard` um eine höfliche Status-/Phasenansage; Jobstatus, Berechtigungen und `availableActions` bleiben Hostdaten
- ist kanonischer Owner für wiederverwendbare Host-Listen-UI wie `StudioDataTable` und `StudioListPageTemplate`; die App liefert nur noch explizite Labels, Routen und Seitendaten
- besitzt mit `ContentMediaUsageBlock` den kontrollierten, pluginneutralen Bildeditor. Er trennt stabile UI-Identität, optionale Asset-Identität, persistierbare Inhalts-URL, transiente Vorschau und redaktionelle Metadaten; pluginnahe Adapter erhalten alle nicht bearbeiteten Fachfelder.
- bleibt UI-only: keine Plugin-Registry, keine Route-Materialisierung, keine Persistenz, keine IAM- oder Server-Runtime-Logik

7. Tooling Testing (`tooling/testing`)
   - gemeinsamer Owner für Frontend-Test-Foundations wie `msw`-Setup, Handler-Konventionen, Reset-Regeln und Test-Utilities
   - trennt HTTP-nahe Testinfrastruktur von produktiver Runtime-Logik und von E2E-/Infra-Läufen
   - bildet zusammen mit `docs/development/studio-foundations-governance.md` den Standardpfad für HTTP-nahe Frontend-Tests
   - prüft den IAM-Acceptance-CLI-Vertrag auf Prozessebene; der dünne Einstieg `run-iam-acceptance.ts` orchestriert explizit getrennte Preflight-, Login/JIT-, Organisations-/Membership-, UI- und Berichtsbausteine unter `scripts/ci/`
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
- kapselt Featured Projects als Mainserver-`GenericItem` mit `genericType: "FeaturedProject"`; Mainserver-ID, Lifecycle, Veröffentlichung und Autorenschaft bleiben fachlich führend, während ein lokaler `iam.contents`-Core und `iam.external_content_references` ausschließlich optionale Studio-History- und Reconciliation-Begleitzustände bilden
- trennt die interne Featured-Project-Erstellung in Create-Orchestrierung, Idempotenz-/Replay-Handling, reine Payload-/Response-Abbildung sowie gemeinsame Autorisierungs- und Transportbausteine; `projects-route.ts` bleibt die HTTP-Fassade und exportiert keine neuen Create-Interna
- kapselt zusätzlich den getypten Schreibpfad für Mainserver-Static-Content wie `wasteTypes` über `createOrUpdateStaticContent`, ohne Browser- oder Plugin-Code direkt an GraphQL zu koppeln
- liest seine instanzbezogene Endpunktkonfiguration nicht mehr aus einer Mainserver-Spezialtabelle, sondern aus der zentralen External-Interface-Registry
- hält `src/server/service.ts` bewusst als schlanke Fassade; Credentials, Token, GraphQL-Transport, Sichtbarkeits-Pagination, Mapper und ressourcenspezifische Operationen liegen in getrennten internen Modulen unter `src/server/service-internals/`
- hält für Surveys einen expliziten Adapter zwischen Studio-Domäne und Mainserver-`SurveyPoll`: Query-Argumente folgen dem Snapshot, Studio-only-Felder werden im Write-Pfad kontrolliert in `payload` serialisiert und im Read-Pfad daraus rekonstruiert

11. Plugin News (`packages/plugin-news`)

- produktives Fachplugin für Mainserver-News mit pluginnahem Modell `news.article`
- eigene Listen- und Editor-Ansichten, plugin-beigestellte Admin-Ressourcen-Spezialisierungen, Navigation und Übersetzungen
- kapselt ein redaktionell vereinfachtes Editor-Mapping in `news.editor-model.ts`, das UI-Felder gezielt auf `contentBlocks[0]`, Kategorien, Veröffentlichungsmodus und den nachgelagerten Visibility-Schritt abbildet
- verwendet in der Bearbeitung card-basierte Tabpanels mit globalem Speichern, während Legacy-Felder außerhalb der vereinfachten Oberfläche bei Updates aus dem geladenen Datensatz erhalten bleiben
- nutzt `@sva/plugin-sdk` für Host-Metadaten und `@sva/studio-ui-react` für gemeinsame UI-Primitives statt App-interner Komponenten
- führt erfolgreiche Creates auf die kanonische News-Detailroute und konsumiert dort den transienten, datensatzgebundenen Save-Erfolg einmalig; partielle Medienreferenzfehler wiederholen nur den fehlgeschlagenen Referenzschritt
- persistiert nicht direkt in lokale IAM-Contents, sondern spricht die hostgeführte Mainserver-News-Fassade per HTTP an; die Studio-Liste lädt Entwürfe ausdrücklich mit `includeInvisible=true`
- ergänzt bei verfügbarer Waste-Leseberechtigung den Push-Bereich unter „Einstellungen“ um eine Zielgruppenauswahl: aktive Abholorte werden erst beim Öffnen über ein schlankes hostseitiges Waste-Read-Modell geladen, im Browser ausgewählt und als stabile `{ street, zip, city }`-Schlüssel im News-Payload gespeichert; unbekannte Payload-Felder und nicht mehr auflösbare Zielschlüssel bleiben erhalten, nach bestätigter Zustellung ist die Empfängerauswahl schreibgeschützt
  11a. Plugin FAQ (`packages/plugin-faq`)

- Standard-Content-Plugin mit dem Content-Type `faq.faq`; die fachlichen Datensätze bleiben Mainserver-`GenericItem`s mit dem festen Discriminator `genericType: "FAQ"`
- kapselt Frage, reine Textantwort, BCP-47-Sprachcode und Sortiergewicht; unbekannte `payload`-Schlüssel bleiben bei Updates erhalten
- nutzt ausschließlich die hostgeführte Fassade `/api/v1/mainserver/faqs`; diese trennt FAQ- und sonstige GenericItem-IDs, erzwingt `faq.*`-Rechte und lädt für korrekte Filter-Pagination sämtliche Upstream-Seiten
- verwendet dieselbe Detail-Shell wie GenericItems: gemeinsame Tabs, beschriebene Panel-Flächen, Formularzusammenfassung, Bestätigungsdialog und URL-gesteuerte Pagination
- übergibt den optionalen Sprachcode an die Host-Fassade; Filterung, Sortierung, Gesamtzahl und Pagination werden dort in dieser Reihenfolge auf der vollständigen FAQ-Teilmenge berechnet

11b. Plugin Cockpit Cards (`packages/plugin-cockpit-cards`)

- eigenständiges Standard-Content-Plugin mit `cockpit-cards.cockpit-card` und festem GenericItem-Discriminator `COCKPIT_CARD`
- begrenzt die Bearbeitung auf die erforderliche Überschrift und genau eine bestehende Kategorie sowie optional Klartext, Sprache, Bilder, einen HTTPS-Link mit Linktext und Öffnungsverhalten und Publikationsmetadaten
- nutzt die hostgeführte Fassade `/api/v1/mainserver/cockpit-cards`, die eigenen `cockpit-cards.*`-Rechte sowie vorhandene Kategorien- und Medienbausteine
- heißt in der deutschen Redaktion „Kacheln“ und nutzt gemeinsame Detail-Tabs, semantische Kartenflächen, History-Darstellung, Löschbestätigung und URL-gesteuerte Pagination; die Kachel-Variante der Medienauswahl zeigt ausschließlich den Alternativtext, erhält aber den gemeinsamen Berechtigungs-, Referenz- und Delivery-Vertrag
  11c. Plugin Surveys (`packages/plugin-surveys`)

- produktives Fachplugin für Mainserver-gestützte Umfragen mit pluginnahem Modell `surveys.survey`
- registriert sich als normales Standard-Content-Plugin über `createStandardContentPluginContribution(...)` und erweitert dieses Muster nur um die Rechte `surveys.moderate` und `surveys.export`
- nutzt einen stabilen Editor-Rahmen mit den Tabs `Basis`, `Inhalt`, `Moderation`, `Ergebnisse` und `Historie`
- hält Survey-spezifische UI-Bausteine wie Frageneditor, Freitext-Moderation, Ergebnisansicht und Historie bewusst plugin-lokal, ohne neue shared UI-Abstraktionen oder Host-Bypässe einzuführen
- spricht den Mainserver nicht direkt, sondern ausschließlich über hostgeführte HTTP-Fassaden und typed Adapter für Liste, Detail, Upsert, Moderation und Ergebnisse
- behält bewusst das Studio-Fachmodell im Plugin bei; Snapshot-Spezifika wie `SurveyPoll`, `date` oder `payload` enden an der Host-/Mainserver-Adaptergrenze
- erzeugt Exportvarianten wie `CSV`, `JSON`, `Excel` und `XML` im Studio aus hostgeführten JSON-Ergebnissen statt über pluginseitige GraphQL- oder Direkt-Exportpfade

  11d. Plugin Generic Items (`packages/plugin-generic-items`)

- bildet als technische Vollansicht alle Mainserver-`GenericItem`s unabhängig vom `genericType` ab, einschließlich fachlich spezialisierter und unbekannter Diskriminatoren
- modelliert redaktionelle Einleitungen ausschließlich je Content-Block über `contentBlocks[].intro`; ein globales GenericItem-Teaser-Feld gehört weder zum Studio-Typ noch zum Editor
- auch das News-Plugin liest und schreibt Einleitung und Haupttext ausschließlich über `contentBlocks[].intro/body`; der News-Payload enthält keine Textkopie und erzeugt keinen Fallback-Block
- autorisiert generische Lese- und Schreibpfade ausschließlich mit `generic-items.*`; zusätzliche Fachrechte sind nicht erforderlich
- lässt die eigenständigen Fachplugins, ihre festen Diskriminatoren, Validierungen und Action-Namespaces unverändert
- bleibt als eigenständiges Modul technischer Vollzugriff auf alle GenericItems; in der gemeinsamen Inhaltsübersicht übernimmt dagegen genau ein registriertes Fachplugin den Datensatz oder der generische Content-Type greift als Fallback

12. Plugin Waste Management (`packages/plugin-waste-management`)

- freies Fachplugin unter `/plugins/waste-management` für Waste-Stammdaten, Touren, Ausweichtermine, PDF-Stamminhalte, technische Werkzeuge und instanzbezogene Einstellungen
- kontextuelle Ausweichtermin-Aktionen in Tourenliste, Jahreskalender und Terminlogik verwenden dieselbe route-basierte Erfassungsansicht in einem neuen Browser-Tab; die reine Auswahl zwischen jährlicher Grundregel und jahresbezogener Ausnahme gehört framework-agnostisch zu `@sva/core`
- konsumiert ausschließlich hostgeführte Endpunkte unter `/api/v1/waste-management/*`
- hält bewusst nur fachliche UI-, Dialog-, Bulk- und lokale View-Model-Logik; keine direkte Datenbank-, Supabase- oder `Newcms`-Runtime-Kopplung
- nutzt `@sva/plugin-sdk` für Route, Navigation, Audit-, Import- und Job-Verträge sowie `@sva/studio-ui-react` für generische Confirm-, Status- und Job-UI
- deklariert `provision`, `reconcile` und `readiness` über den generischen Tenant-Lifecycle; `@sva/waste-management-runtime` adaptiert Provision und Reconcile auf den bestehenden Datenbank-Provisioner und prüft Readiness getrennt über den bestehenden Provisionierungsdatensatz und das pluginverwaltete PostgreSQL-Interface
- stößt nach erfolgreichen Fraktionsmutationen asynchron den dedizierten Job `waste-management.sync-waste-types` an und degradiert reine Mainserver-Sync-Fehler bewusst zu einem Retry-Hinweis im Fraktionskontext
- zeigt den Stand des separaten Terminabgleichs zum SVA Mainserver revisionsbasiert direkt unter dem ruhigen Seitenheader; der Lesepfad kombiniert die tenantlokale Waste-Quellrevision mit dem bestehenden zentralen Jobstore und führt weder Dry-Run noch Mainserver-Abfrage aus
- zeigt für den laufenden CSV-Spezialimport eine fachnahe Live-Fortschrittskarte an, leitet Prozent und Zeilenstand aber weiterhin ausschließlich aus dem generischen Host-Jobvertrag ab
- bietet unter den eingeklappten erweiterten Systemfunktionen die autorisierte Aktion zur Ergänzung fehlender Orts-Postleitzahlen an; Providerzugriff, Bewertung und Mutation bleiben vollständig hostgeführt

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
- `@sva/data-repositories` setzt Create- und Update-Werte der Registry aus fachlich benannten, puren Segmenten in einer festen SQL-Parameterreihenfolge zusammen; Secret-Erhalt, explizites Löschen und Ersetzen bleiben dabei eigenständige Positionsverträge
- blockerrelevanter Drift aus Preflight, Provisioning-Plan oder fehlendem Tenant-Admin-Vertrag wird vor Reconcile-/Sync-Starts fail-closed durchgesetzt
- HTTP-Handler, Service-Komposition und Keycloak-Ausführung sind intern entlang Read, Mutation, Payload/Sync/Finalize und Diagnose getrennt, damit Runtime-Consumer stabile Fassaden nutzen und fachliche Flows nicht wieder in Sammeldateien zusammenlaufen
  13a. Lokaler Studio-MCP (`packages/studio-mcp`)
- lokaler stdio-Server und dünner, typisierter Client der bestehenden Studio-HTTP-API
- hält Tool-Schemata, Korrelation, Idempotenz, Redaction und begrenzte Read-only-Diagnose, aber keine Registry-Fachlogik
- bezieht kurzlebige Keycloak-Tokens aus ausschließlich lokaler Secret-Konfiguration und besitzt weder Datenbank- noch Keycloak-Admin-Zugriff
- trennt Read-, kontrollierte und kritische Tools; Autorisierung und Confirmation-Challenges bleiben serverseitige Studio-Verantwortung
- bietet mit `studio_instance_process` einen modularen Ablauf für Anlage, Reparatur und Anpassung, der ausschließlich vorhandene HTTP-Verträge kombiniert und einen Abschluss nur nach aktuellem Doctor-Read meldet

14. Studio-Job-Hostpfad (`packages/auth-runtime`, `packages/routing`, `packages/data-repositories`, `packages/iam-governance`)

- `@sva/auth-runtime` veröffentlicht die hostgeführten Start-, Status- und Worker-Integrationspfade für generische Studio-Jobs
- `@sva/routing` führt die öffentlichen Plugin-Operation-Endpunkte weiterhin typsicher; die interne Worker-Ausführung läuft über den generischen Task `studio_job_execute`
- `@sva/data-repositories` hält den kanonischen Jobdatensatz mit `source`, Status, Progress, Payload-, Retry- und Fehlerfeldern
- `@sva/iam-governance` bleibt fachlicher Owner der DSR-Exportdatensätze; Self-Service-Exporte verknüpfen diese Datensätze zusätzlich mit einem Host-Job über `studio_job_id`
- strukturierte Progress-Details wie `processedRows` und `totalRows` bleiben Teil desselben generischen Jobdatensatzes und werden nicht in plugin- oder DSR-spezifische Nebenspeicher ausgelagert
- eine interne Worker-Anbindung wie Graphile Worker bleibt hinter diesem Hostpfad austauschbar und ist kein Teil öffentlicher Plugin- oder Self-Service-Verträge
- die Runtime trennt den enqueue-only Zugriff der App von der Ausführung über den dedizierten Datenbank-Principal `sva_job_worker`; Schema-Migrationen gehören ausschließlich zum privilegierten Deploy-One-shot

15. Waste-Host-Fassade (`packages/auth-runtime`, `packages/server-runtime`, `packages/data-repositories`)

- `@sva/auth-runtime` publiziert die hostgeführte Waste-Fassade für Settings, Historie, CRUD, Bulk-Flows und technische Tool-Starts
- derselbe Hostpfad startet auch den dedizierten Job `waste-management.sync-waste-types`; die eigentliche Mainserver-Schreiboperation bleibt dahinter in der Studio-Runtime und `@sva/sva-mainserver`
- der Job `waste-management.enrich-postal-codes` verwendet die konfigurierte Karten-Geocodierung serverseitig, taktet Provideraufrufe und schreibt ausschließlich weiterhin leere `waste_cities.postal_code`-Felder über ein konditionales Repository-Update
- `@sva/server-runtime` löst die aktive instanzbezogene Waste-Datenquelle serverseitig auf und kapselt Secret-Nutzung sowie Connection-Checks
- `@sva/data-repositories` hält sowohl die zentrale Governance-Persistenz der Waste-Datenquelle im Studio-Postgres als auch die hostseitigen Repositories gegen die instanzbezogene `waste_*`-Tabellenfamilie
- der Mainserver-Terminabgleich liest seine tenantlokale Quellrevision zusammen mit allen Materialisierungstabellen in einem PostgreSQL-Snapshot; `iam.studio_jobs` bleibt alleinige Wahrheit für aktiven Lauf, letzten Erfolg, Progress und Fehler
- Tourverschiebungen überschreiten die Repository-Grenze als ISO-Kalenderdaten; PostgreSQL persistiert sie als `DATE` und erzwingt ihre Eindeutigkeit über partielle Indizes
- jede Studio-Instanz erhält eine eigene, deterministisch benannte Waste-Datenbank; das pluginverwaltete `postgresql`-Interface enthält tenantgebundene, verschlüsselte Runtime-URLs und bleibt aus der allgemeinen Interface-UI ausgeblendet, während der weiterhin verfügbare Typ `supabase` nicht mehr vom Waste-Modul benötigt wird
- Modulzuweisung und erneute Aktivierung enqueueen den namespaced Provisionierungsjob im vorhandenen Plugin-Operations-Pfad; nur die privilegierte Lane im vorhandenen Provisioner-Service darf Datenbanken und Rollen anlegen
- der Lifecycle-Adapter führt Host- und bestehende Waste-Sollgeneration getrennt: Der Host claimt den generischen Lifecycle, während der Adapter den vorhandenen Waste-Provisionierungsdatensatz idempotent vorbereitet und dessen Generation an den unveränderten Provisioner übergibt
- `@sva/data` bleibt dabei ausdrücklich ohne neue primäre Waste-SQL- oder Orchestrierungs-Ownership
- die Host-Fassade erzeugt keine persistenten Waste-PDF-Artefakte mehr; PDF-Exporte werden ad hoc in der öffentlichen Web-App ausgelöst

### IAM-Bausteine und Package-Zuordnung

- Identity und OIDC-Flow:
  - `packages/auth-runtime` (`routes`, `auth-server`, `oidc`, Session, Cookies, Runtime-Health)
- Account- und Rollenmanagement inkl. IdP-Synchronisation:
  - `packages/iam-admin` (User-, Rollen-, Gruppen-, Organisations-, Actor-, Reconcile- und Keycloak-Admin-Orchestrierung)
  - `user-projection.ts` ist der gemeinsame Projektionskern für Self-Service-Profile und Admin-Reads; spezialisierte UI-Pfade dürfen darauf nur noch darstellerisch aufsetzen
  - `reconcile-core.ts` und `user-import-sync-handler.ts` liefern deterministische Abschlusszustände (`success`, `partial_failure`, `blocked`, `failed`) mit Zählwerten für `checked`, `corrected`, `failed` und `manualReview`
  - der privilegierte Tenant-Account-Hard-Delete läuft ebenfalls über `packages/iam-admin`: Permission-Gate `iam.accounts.delete`, Schutz für `system_admin`-Zielaccounts, inhaltsbezogene Vorbereinigung, Session-Widerruf, Keycloak-Delete und finaler Studio-Hard-Delete bleiben in diesem Baustein gebündelt
  - `isTechnicalAccount` klassifiziert technische Accounts unabhängig von Status, Rollen und Login. Listen schließen sie standardmäßig vor Pagination aus; der Inaktivitäts-Lifecycle überspringt sie, explizite Deaktivierung und privilegierter Hard Delete bleiben grundsätzlich möglich.
- Mainserver-Credential-Auflösung für Downstream-Integrationen:
  - `packages/iam-admin` hält den organisationsgebundenen Credential-Speicher, die Write-only-Secret-Pflege und die read-safe Projektionslogik für Organisationen.
  - `packages/auth-runtime` liefert den aktiven Session- und Organisationskontext und stellt die Laufzeitgrenze für Mainserver-Aufrufe bereit.
  - `packages/auth-runtime` orchestriert nach lokal erfolgreicher Organisationserstellung und über den expliziten Retry-Endpunkt die Lease-geschützte Provisionierung. Nur `iam.org.write` autorisiert diesen eng begrenzten Systempfad; Rollen, Gruppen und freie Accountattribute sind kein Requestbestandteil.
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
  - trennt bei der Delegationserstellung die frameworkfreie Payload-/Policy-Entscheidung vom explizit sequenziellen Wiring für instanzgebundene Account-Auflösung, Persistenz und Audit; Reason Codes, Zeitgrenzen und SQL-/Auditverträge bleiben Eigentum des bestehenden Governance-Workflows
  - besitzt in `dsr-persistence.ts` die kanonischen, mandantengebundenen Persistenzprimitiven für aktive Legal Holds, DSR-Request-Events und DSR-Audit-Events; Auth-Runtime, Export-Flows und Wartung konsumieren diese Verträge ohne eigene SQL-Kopien
  - enthält auch die kanonische Legal-Text-Sanitisierung; React-Consumer importieren keinen app-lokalen HTML-Sanitizer mehr
  - liefert für den Account-Self-Service sowohl die Overview-Projektion mit `activityItems` als auch den `caseId`-basierten Detailzugriff für Deep-Links auf einzelne Datenschutzvorgänge
- Inhaltsverwaltung als Core-Element:
  - `packages/core` (`content-management.ts`) für Kernvertrag
  - `packages/plugin-sdk` für Erweiterungspunkte, Registries und Namespace-Verträge
  - `packages/auth-runtime` für Runtime-Handler und `packages/iam-governance` für legal-/audit-nahe Fachanteile
  - `apps/sva-studio-react/src/routes/content/*` für Listen- und Editor-UI unter `/admin/content`
  - `apps/sva-studio-react/src/lib/iam-content-list-api.server.ts` als host-geführte Read-Model-Fassade für `GET /api/v1/iam/contents`, die ausschließlich aus der persistierten Projektion `iam.content_list_projection` liest und Mainserver-Typen bei Bedarf serverseitig in diese Projektion refresht
  - die interne Listenprojektion ist entlang ihrer Ownership in Modell, Repository, Source, Read, Authorization, List, Sync und Mutation getrennt; Repository-Details gliedern sich zusätzlich in Schema, Sync-State und statische SQL-Verträge, Source-Details in Loader, Binding und Mutationsquelle sowie Sync in Zustandsableitung und Worker. `iam-content-list-projection.server.ts` bleibt die schmale kompatible Exportfassade
  - Read besitzt Visibility-SQL, Deduplizierung, Sortierung und Paging; Authorization besitzt Request-Aufbau, Typprüfung, Actor-Auflösung und Item-Access; List orchestriert Snapshot-Vorbereitung, Blocking-Entscheidung und Response-Aufbau
  - Modellentscheidungen bleiben I/O-frei, das Repository besitzt SQL- und Schema-Kompatibilität, die Source besitzt Mainserver-Page-/Detailzugriffe und Binding-Enrichment, Sync besitzt Generationen und Laufregistrierung, Mutation nutzt dieselbe Sync-Queue für gezielte Nachsynchronisation
  - die Mainserver-Projektionspersistenz ist account- und scope-isoliert: Snapshot, Deduplizierung und Sync-State werden über `instanceId`, `actorAccountId`, aktiven Organisationskontext und `contentType` getrennt geführt, damit keine Listenstände oder Fehlerzustände account-übergreifend wiederverwendet werden
  - `packages/plugin-news` für plugin-spezifische News-Ansichten auf Basis derselben Core-Content-API
  - `packages/plugin-surveys` für plugin-spezifische Survey-Ansichten mit zusätzlichem Moderations-, Ergebnis- und Historienzuschnitt auf Basis desselben hostgeführten Content-/Mainserver-Backbones
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
- Postgres ist führend für Studio-verwaltete IAM-Fachdaten wie Accounts, tenantlokale Fachrollen, Gruppen, Permissions und Auditdaten.
- Der Keycloak-Rollenabgleich ist auf technische Sonderrollen begrenzt: `system_admin` im Tenant-Kontext und `instance_registry_admin` im Plattform-Kontext.
- `iam.instances` modelliert ausschließlich Tenant-Instanzen; der Root-Host ist ein separater Plattform-Scope.
- `iam.instances` fuehrt fuer jede tenantfaehige Instanz getrennte Auth-Vertraege fuer Login (`authClientId`) und Tenant-Administration (`tenantAdminClient`) als kanonische Registry-Basisdaten.
- Redis hält lediglich Permission-Snapshots zur Beschleunigung des Authorize-Pfads.
- `packages/auth-runtime` haelt zusaetzlich nur sehr kurzlebige In-Process-Caches fuer Session-Resolution und Account-Lifecycle-Pruefung, um wiederholte Authorize-Requests derselben Session ohne neuen Redis-/DB-Roundtrip abzufangen.
- Der SVA-Mainserver bleibt fachliche Source of Truth für alle Mainserver-basierten Content Items; Studio-IAM autorisiert ausschließlich typspezifische Actions und ersetzt keine fachlichen Mainserver-Felder durch lokale Ownership-, Lifecycle- oder Autorenwerte.
- Für `/admin/content` ist `GET /api/v1/iam/contents` die einzige führende Studio-Listenquelle; Mainserver-News, -Events, -POI, -GenericItems, -FAQ, -Cockpit-Cards, -FeaturedProjects und -Surveys werden serverseitig in das rekonstruierbare Read-Model `iam.content_list_projection` projiziert und nicht mehr browserseitig vollgescannt. GenericItem-Fachplugins deklarieren ihre exakte Discriminator-Zuständigkeit im Build-time-Registry-Snapshot; die Projektion persistiert je Mainserver-GenericItem genau den fachlichen Content-Type oder den generischen Fallback. Ein lokaler Content-Core oder eine External-Content-Reference ist keine Projektionsvoraussetzung.
- Surveys folgen denselben Boundary-Regeln wie News, Events und POI: pluginseitige Browser-UI, hostgeführte HTTP-Fassade, typed Adapter in `@sva/sva-mainserver` und kein direkter GraphQL- oder Secret-Zugriff aus dem Plugin.
- Survey-spezifische Snapshot-Drift wird innerhalb von `@sva/sva-mainserver` abgefangen: `SurveyPoll`-Reads bleiben snapshot-nah, während das Plugin weiterhin das stabile Studio-Modell inklusive `startAt`, `resultVisibility`, `showResultsInApp`, `privacyNotice` und `transparencyNotice` konsumiert.
- Fachmodule konsumieren zentrale IAM-Entscheidungen und duplizieren keine eigene Berechtigungsauflösung gegen IAM-Tabellen.
- `packages/iam-admin` hält zusätzlich die tenantseitige Governance-Trennung für Rollen und Permissions: Root-only-Rollen/-Permissions werden vor Admin-CRUD gefiltert oder abgewiesen, normale Tenant-Rollen werden DB-only gepflegt, während `system_admin` als geschützte technische Tenant-Sonderrolle in IAM und Keycloak erhalten bleibt.

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
   - normalisiert effektive Grants pro fachlichem Permission-Key auf den weitesten Scope, ohne Rollen-/Gruppen-Provenance zu verlieren.
4. `packages/data` und `packages/data-repositories`
   - versionieren `iam.role_permissions.access_scope` SQL-first als Teil des fuehrenden IAM-Schemas.
5. `apps/sva-studio-react`
   - erweitert die Rollen-Detailseite um Scope-Pflege pro Permission-Zuweisung.
   - zeigt in der Nutzeransicht die resultierenden effektiven Scopes read-only als Transparenzsignal.
   - materialisiert Mainserver-Read-Models mit getrennter externer DataProvider-/Credential-Identität und kanonischer IAM-Ownership.

### Fortschreibung 2026-05: Monitoring-Einstieg fuer IAM-Authorize-Performance

1. `@sva/iam-core`
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

### Fortschreibung 2026-06: IAM-Admin-Bausteine mit begrenztem Keycloak-Rollenabgleich

1. `@sva/core`
   - Definiert additive Verträge für `mappingStatus`, `editability`, objektbezogene Diagnosecodes, kanonische IAM-Rollen und getrennte technische `keycloakRoles`.
2. `packages/iam-admin/src/identity-provider-port.ts`
   - Kapselt Keycloak-nahe Listen-, Count-, Mutations- und explizite Role-Assignment-Operationen; Call-Sites dürfen tenantseitig nur technische Sonderrollen synchronisieren.
3. `packages/iam-admin/src/keycloak-admin-client`
   - Implementiert serverseitige Pagination/Count für Realm-Rollen und User sowie differenzierte Fehlerabbildung für Keycloak-Admin-Aufrufe.
4. `packages/iam-admin/src`
   - Trennt Platform-Admin-Client, Tenant-Admin-Client, DB-only-Rollen-CRUD, technische Keycloak-Sonderrollen-Synchronisation und Drift-/Diagnoseprojektion.
   - `role-governance.ts` definiert den technischen Keycloak-Schnitt (`system_admin`, `instance_registry_admin`); `reconcile-core.ts` repariert nur diesen Schnitt und berichtet nicht-technische Keycloak-Rollen als Legacy-/Drift-Diagnose.
   - `user-projection.ts` hält `roles` IAM-kanonisch und reicht rohe Keycloak-Rollen separat als `keycloakRoles` durch.
5. `apps/sva-studio-react/src/routes/admin/users` und `apps/sva-studio-react/src/routes/admin/roles`
   - Rendern IAM-Rollen als fachliche Sicht sowie Keycloak-Rollen nur als technische Diagnose; blockierte oder read-only Aktionen bleiben sichtbar, aber deaktiviert.

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
6. Öffentlicher Abfallkalender (`apps/public-waste-calendar-web`)

- eigenständige Vite/React-App für den öffentlichen Waste-Kalender außerhalb der Studio-Admin-Shell
- hält Resolver, Kalenderprojektion, Demo-Runtime, Cookie-Restore, PDF-/iCal-Links und Modal-Interaktion bewusst app-lokal
- nutzt eine reduzierte UI aus `PublicWasteApp`, `PublicWasteSelectionForm`, `PublicWasteCalendarPanels` und `PublicWasteEventDialog`
- trennt in der vollständigen Standortansicht Kalender-/Dialog-Ownership vom konkreten Action-Hub; Reminder-Slot-Auswahl und lokaler Panel-/Formularzustand bleiben app-lokal, während Fraktionsfilter und PDF-Download weiterhin aus dem gemeinsamen Standortmodell gespeist werden
- kapselt servernahe Verträge in `src/lib/public-waste-*.ts` und nutzt dafür bewusst gemeinsame Workspace-Verträge aus `@sva/core`, `@sva/data-repositories` und `@sva/waste-management-contracts/unsubscribe-token`, ohne an die Studio-Admin-UI oder das Plugin-Routing zu koppeln
- besitzt zusätzlich eine eigene produktive Node-Runtime unter `src/server/**`, die das gebaute Frontend statisch ausliefert und die öffentlichen Read-Endpunkte `/api/public-waste/*` lokal bedient
- projiziert über `/api/public-waste/locations` aktive öffentlich auswählbare Abholorte mit vorhandenen IDs, Originalnamen und direkt nutzbarer `calendarQuery`; fehlende Regionen bleiben als `municipality: null` sichtbar, ohne Fallback oder Schreibzugriff
- hält die Kalender-Repository-Fassade stabil, trennt darunter aber parametrisierte SQL-/I/O-Ownership in `public-waste-calendar-loader.server.ts` von der I/O-freien Normalisierung in `public-waste-calendar-loader.projection.ts` und der Einsatz-Zusammenführung in `public-waste-calendar-loader.assignments.ts`; die zeilenförmigen internen Datenverträge bleiben app-lokal
- erweitert diese Runtime um den öffentlichen Reminder-Flow mit CTA im finalen Standortkontext, Formularabsendung, Double-Opt-In-Bestätigung und Abmeldeseiten unter derselben App-URL
- persistiert Pending- und aktive Reminder-Abos sowie DOI-Aufträge über gemeinsame Waste-Repositories, ohne selbst technische Mail-Credentials zu kennen
- wird betrieblich über ein dediziertes Image, einen dedizierten Portainer-Stack `web-waste-calendar` und einen separaten Git-Tag-Releasepfad `waste-web-vX.Y.Z` ausgerollt, ohne den normalen Studio-Releasevertrag mitzubenutzen
- liest explizite Tour-Einsätze mit mehreren Abholorten direkt aus der Waste-Fachdatenbank, löst übergeordnete Abholorte hierarchisch auf und übernimmt Fraktionen ausschließlich aus der normalen Tourzuordnung
- verwendet tenantgenau die abgeleitete Public-Rolle mit Leserechten und eng begrenzten Schreibrechten auf Reminder-, Double-Opt-In-, Abmelde- und Outbox-Tabellen

17. Waste-Reminder-Operationspfad (`apps/sva-studio-react` + `packages/waste-management-runtime`)

- erweitert die bestehende Waste-Operations-Runtime um zwei technische Jobs: Materialisierung fraktions- und slotbezogener Reminder-Outbox-Einträge sowie inkrementelle Batch-Verarbeitung fälliger Outbox-Elemente
- nutzt dafür die führende Waste-Fachkonfiguration aus dem `output`-Tab, die fraktionsbezogenen Reminder-Slots aus den Abfallarten und die zentrale Schnittstelle `mail_transport`
- normalisiert die öffentliche Reminder-Konfiguration in `@sva/core` über kleine feldgruppenspezifische Reader für Pflichtwerte, URLs, Pfade, Adressen und optionale Texte; der öffentliche Objektvertrag und seine Feldreihenfolge bleiben dabei unverändert
- hält den Mailversand selbst adapterbasiert; Studio erzeugt und leased nur transportagnostische `MailDispatchPayload`s und kann damit an eine separate Mail-App oder einen äquivalenten Runtime-Adapter angeschlossen werden
- stellt den signierten `v1`-Abmeldetokenvertrag zentral über `@sva/waste-management-contracts/unsubscribe-token` bereit; Studio erzeugt und Public-Waste liest sowie verifiziert denselben Vertrag ohne direkte App-zu-App-Abhängigkeit oder Installation der Job-Runtime

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
- `@sva/plugin-sdk` definiert zusätzlich den fail-closed `contentHistory`-Contribution-Vertrag und den gemeinsamen History-Read-Client; `@sva/studio-ui-react` stellt dafür die schreibgeschützte, barrierefreie Darstellung bereit
- `@sva/studio-module-iam` -> keine React-, Host- oder Plugin-UI-Abhängigkeiten; nur Vertragsdaten und kleine Helper
- `@sva/server-runtime` -> `@sva/core`, `@sva/monitoring-client`
- `@sva/plugin-*` -> `@sva/plugin-sdk`, optional `@sva/studio-ui-react` für Custom-Views (kein Direktimport aus `@sva/core` oder App-internen Komponenten)
- `@sva/plugin-waste-management` -> `@sva/plugin-sdk`, `@sva/studio-ui-react`, `@sva/waste-management-contracts/job-definitions`; Host-Datenzugriffe ausschließlich über `/api/v1/waste-management/*`
- `@sva/plugin-categories`, `@sva/plugin-news`, `@sva/plugin-events` und `@sva/plugin-poi` bleiben absichtlich auf SDK, Studio-UI und Peer Dependencies beschränkt; API-Aufrufe laufen über öffentliche Host-Fassaden statt über App-Module
- `@sva/monitoring-client` -> OTEL Libraries, `@sva/server-runtime` Context API
- `@sva/core` -> `@sva/iam-core` fuer verbliebene gemeinsame IAM-Vertragstypen waehrend der Hard-Cut-Migration
- `apps/sva-studio-react` -> Zielpackages über Server-Funktionen für Inhaltsliste, Detail, Historie und Statuswechsel
- `apps/sva-studio-react` -> `@sva/waste-management-runtime/server` für Waste-Jobs sowie `@sva/waste-management-contracts/unsubscribe-token` für signierte Abmeldetoken
- `apps/public-waste-calendar-web` -> `@sva/core`, `@sva/data-repositories`, `@sva/waste-management-contracts/unsubscribe-token`; die App hält ihren öffentlichen UI- und Node-Laufzeitpfad lokal und lädt für Tokenoperationen weder die hostseitige Waste-Job-Runtime noch den browserseitigen Waste-Plugin-/UI-Abhängigkeitsbaum
- `apps/*` -> keine direkten Quellimporte aus anderen Anwendungen; gemeinsame Verträge werden über owning Workspace-Packages konsumiert

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
   - klassifiziert Content-History als hostgeführt, fachgeführt oder explizit nicht erforderlich und blockiert bearbeitbare Contributions ohne hostgeführtes Binding vor der Registry-Veröffentlichung
2. `apps/sva-studio-react/plugin-catalog.json` und `apps/sva-studio-react/src/lib/plugins.ts`
   - registrieren `pluginCategories`, `pluginNews`, `pluginEvents`, `pluginPoi` und `pluginWasteManagement` statisch im Host und materialisieren daraus Route-, Navigations-, Admin-Ressourcen-, Audit- und i18n-Metadaten
3. `packages/auth-runtime/src/iam-contents/content-type-registry.ts`
   - erweitert den generischen Content-Write-Pfad um contentType-spezifische Payload-Validierung und Sanitisierung
4. `packages/plugin-categories/src/*`, `packages/plugin-news/src/*`, `packages/plugin-events/src/*`, `packages/plugin-poi/src/*`
   - kapseln fachliche Listen- und Editorflächen unter der SDK-Boundary
   - `plugin-categories` stellt eine freie Fachroute unter `/categories` als redaktionelles Begleitmodul für Mainserver-Kategorien bereit
   - `plugin-news`, `plugin-events` und `plugin-poi` registrieren `adminResources` mit `resourceId` `news.content`, `events.content` und `poi.content`, jeweils auf Basis der Host-Views `content`, `contentCreate` und `contentDetail`
   - liefern über `contentUi` optionale Bindings für `list`, `detail` und `editor`; Events und POI nutzen dabei dieselbe feste Tab-Struktur `Basis` / `Inhalt` / `Einstellungen` / `Historie` wie News, während Route, Guard, Shell und Persistenz host-owned bleiben
   - halten die Event-Formularserialisierung als frameworkfreie, paketinterne Fachlogik getrennt von den React-Tabs; redaktionelle, Datums-, Adress- und Medienwerte werden ohne neue Shared-API in den bestehenden Mainserver-Input assembliert
   - beziehen gemeinsame Standard-Metadaten, Mainserver-CRUD-Basis und kleine Hilfsfunktionen aus `@sva/plugin-sdk`, ohne einander zu importieren
   - schreiben ihre Fachdaten über hostgeführte Fassaden; Legacy-`payload` bleibt nur dort Lesefallback, wo die jeweilige Fassade ihn noch toleriert

### Erweiterung 2026-04: Namespacete Plugin-Identität über Build-time-Registries

1. `packages/plugin-sdk/src/plugins.ts` + `packages/plugin-sdk/src/plugin-identifiers.ts`
   - definieren die technische Plugin-Identität über `PluginDefinition.id` als führenden Namespace und validieren plugin-beigestellte `contentType`s, Admin-Ressourcen, Audit-Event-Typen und Permissions gegen `<pluginId>.<name>`
   - halten `createPluginRegistry` und `createPluginActionRegistry` als stabile öffentliche Fassaden; der mengenbasierte Vergleich verknüpfter Access-Anforderungen und die deterministisch geordneten Action-Validierungsphasen liegen frameworkfrei und intern unter `src/plugin-platform/`
   - bewahren dabei Fehlercodes, Fail-fast-Priorität, reservierte Namespaces, Alias-Auflösung und alle Resource-Capability-Felder als unveränderten Sicherheitsvertrag
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
6. `packages/auth-runtime/src/iam-contents/content-type-registry.ts`
   - führt `news.article` als kanonischen plugin-beigestellten `contentType` im serverseitigen Validierungsvertrag

### Erweiterung 2026-04: Plugin-spezifische IAM-Rechte

1. `packages/plugin-sdk/src/plugins.ts`
   - ergänzt `PluginDefinition.permissions` und `definePluginPermissions()` als generischen SDK-Vertrag für plugin-deklarierte Rechtefamilien
   - weist `content.*`-Guards, fremde Plugin-Namespaces, reservierte Namespaces, Duplikate und nicht registrierte Permission-Referenzen fail-fast ab
2. `packages/plugin-news`, `packages/plugin-events`, `packages/plugin-poi`
   - deklarieren eigene Rechtefamilien `news.*`, `events.*` und `poi.*`
   - nutzen diese Rechte für Actions, Routen und Navigation ohne produktiven `content.*`-Fallback
3. `packages/data-repositories/src/iam/seed-plan.ts`
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
  - materialisiert `Inhalte` als hostgeführte Navigationsgruppe aus den registrierten, im aktiven Modul- und Berechtigungskontext lesbaren Studio-Inhaltstypen
  - führt `Alle` und die typspezifischen Unterpunkte auf dieselbe kanonische Route `/admin/content`; der ausgewählte Typ bleibt ein normalisierter Search-Parameter statt einer parallelen Fachlistenroute
- `apps/sva-studio-react/src/components/AppShell.tsx`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/lib/theme.ts`
- `apps/sva-studio-react/src/lib/sva-mainserver.server.ts`

### Erweiterung 2026-03: Account- und User-Management-UI

Neu hinzugekommene Bausteine im Change `add-account-user-management-ui`:

1. `apps/sva-studio-react/src/routes/account/-account-profile-page.tsx`
   - Self-Service-Profilseite (`/account`) mit Validierung, Error-Summary, tenantlokaler Profilpflege und einer kleinen Studio-owned Rückkehrmeldung nach delegierten Keycloak-Credential-Flows.
   - Die co-located Bausteine `-account-profile-model.ts`, `-use-account-profile.ts`, `-account-profile-summary.tsx` und `-account-profile-form.tsx` trennen framework-unabhängige Formularregeln, asynchronen Seitenzustand und zugängliche Darstellung, ohne den IAM- oder Credential-Self-Service-Vertrag zu verändern.
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
   - Erweiterte historisch `iam.permissions` um strukturierte Felder; das aktuelle Zielmodell nutzt `action`, `resource_type`, `resource_id` und `scope` ohne fachliches `effect`.
2. `packages/data/seeds/0001_iam_personas.sql` (historischer Seed-Ort)
   - Seedet Basis-Permissions rückwärtskompatibel sowohl mit `permission_key` als auch mit strukturierten Feldern.
3. `packages/iam-core/src/authorization-engine.ts`
   - Wertet Allow-Grants, Resource-Spezifität, Org-Hierarchie und Scope-Daten deterministisch in einer festen Prioritätsreihenfolge aus.
4. `packages/iam-core/src/authorization-contract.ts`
   - Hält Authorize-Verträge, Reason Codes und Permission-Typen.
5. `packages/auth-runtime/src/iam-authorization/permission-store.ts`
   - Hält Runtime-nahe Snapshot-, Redis- und DB-Recompute-Infrastruktur.

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

### Historische Ergänzung 2026-03: Direkte Nutzerrechte in der Benutzerverwaltung

1. `packages/data/migrations/0024_iam_account_permissions.sql` (historischer Migrationsort)
   - Führte historisch `iam.account_permissions` als instanzgebundene Zuordnung `Account -> Permission -> effect` ein; das aktuelle Zielmodell entfernt diese Tabelle wieder.
2. `packages/iam-admin/src/users`
   - Entfernt direkte Nutzerrechte aus User-Update- und Read-Pfaden; Berechtigungen kommen über Rollen und Gruppen.
3. `packages/auth-runtime/src/iam-authorization/permission-store.ts` und `packages/auth-runtime/src/iam-authorization/shared-effective-permissions.ts`
   - Laden Rollen- und Gruppenrechte und serialisieren deren Herkunft ohne `direct_user`.
4. `packages/iam-core/src/authorization-contract.ts` und `packages/core/src/iam/account-management-contract.ts`
   - Halten Authorize-Verträge und allgemeine IAM-Projektionen allow-only und ohne direkte Nutzerrechte.
5. `apps/sva-studio-react/src/routes/admin/users/-user-edit-page.tsx`
   - Zeigt wirksame Rechte aus Rollen- und Gruppenzuordnungen ohne Drei-Zustands-Direktzuweisung.

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
6. `packages/auth-runtime/src/iam-account-management/user-import-sync-handler.ts`
   - Trennt die reine Profilreparatur-Entscheidung vom tenantgebundenen Seed-Lookup, der optionalen Keycloak-Mutation, der IAM-Persistenz und der Reportbildung. Quellwerte bleiben vor lokalen Seed-Werten vorrangig; nur für eine weiterhin fehlende E-Mail darf ein syntaktisch gültiger Username dienen.
   - Seed-Lookup, Provider-Update und Persistenz bleiben fail-closed an dieselbe `instanceId` und dasselbe Keycloak-Subject gebunden. Unvollständige Profile gehen ohne IAM-Persistenz in die manuelle Prüfung; Logs enthalten nur einen gehashten Subject-Verweis und Reparaturflags.
7. Medienvertrag (`packages/media`)
   - kanonische Typen für `MediaAsset`, `MediaVariant`, `MediaReference`, Rollen, Sichtbarkeit, Upload- und Processing-Status
   - fail-closed Regeln für Löschbarkeit und Referenzierbarkeit
8. Datenzugriff (`packages/data-repositories`)
   - Medien-Repositories für Assets, Varianten, Referenzen, Upload-Sessions, Quota und Usage-Impact
9. Auth-Runtime (`packages/auth-runtime`)
   - hostseitige Media-HTTP-Endpunkte
   - interner Storage-Port und S3-/MinIO-Adapter
   - Audit, Autorisierung und Upload-Processing für Medien
   - hält `iam-media/core.ts` als schmale öffentliche Fassade; Bibliotheks-/Asset-, Upload-, Content-Save- und Referenz-Handler sowie Request-, Schema- und HTTP-Helfer liegen in fachlich getrennten Modulen
   - verbindet registrierte Assets und Bucket-Objekte über einen versionierten Storage-Key-Cursor, ohne Gesamtzählung oder vollständigen Bucket-Scan
10. Studio-Frontend (`apps/sva-studio-react/src/routes/admin/media/*`, `src/hooks/use-media.ts`)
    - startet in `/admin/media` den Browser-Flow `initialize -> signed PUT -> complete`
    - trennt Bibliotheks-UI, Upload-Orchestrierung und Detailnavigation bewusst in eigene Bausteine und navigiert cursorbasiert vor und zurück

### Ergänzung 2026-06: POI-Geocoding- und Media-Bridges

1. `packages/plugin-sdk/src/map-geocoding-client.ts`, `packages/plugin-sdk/src/media-upload-client.ts`
   - definieren die browser-sicheren Host-Verträge für Geocoding-Konfiguration, Suggest/Geocode/Reverse-Geocode sowie IAM-basierte Upload-Sessions.
2. `apps/sva-studio-react/src/lib/map-geocoding-api.ts`, `apps/sva-studio-react/src/lib/map-geocoding-api.server.ts`
   - binden tenantkonfiguriertes `mapGeocoding` an normierte Host-Endpunkte unter `/api/v1/iam/map-geocoding/*`.
3. `packages/plugin-poi/src/poi.detail-page.tsx`, `poi.detail-location-tab.tsx`, `poi.detail-operator-*.ts(x)`, `poi.detail-media-tab.tsx`
   - orchestrieren den vollständigen POI-Editor mit Bereichs-Tabs, Geocoding-Feldern, Reverse-Geocode-Unterstützung und Host-Media-Referenzierung.
   - der Betreiberbereich trennt reine Feld-/Adressableitungen, kontrollierte Form- und Geocoding-Zustände sowie präsentationale Kontakt-, Adress-, Karten- und Koordinatenabschnitte; Feld-IDs, Validierung und Mainserver-Vertrag bleiben am bestehenden POI-Formular gebunden.

### Ergänzung 2026-08: Gemeinsamer Content-Media-Overlay-Flow

1. `packages/studio-ui-react/src/content-media-usage*.ts(x)`
   - definiert den kontrollierten Bildblock, barrierefreie Reihenfolgeaktionen, sichtbare Referenzzustände und den feldweisen Metadatenabgleich.
2. `packages/plugin-sdk/src/media-picker-client.ts`, `content-ui-utils.ts`, `content-media-persistence.ts`
   - liefert browser-sichere Asset-/Delivery-/Referenzverträge, gemeinsam verwendete Upload-Phasen-, MIME- und Asset-Darstellungslogik sowie den Save-Orchestrator für lokale Entwürfe, provisorische Uploads, fachlichen Write und atomare Aktivierung.
3. POI, News, Events, Generic Items, Projects und Cockpit Cards
   - behalten ihre Mainserver- beziehungsweise Fachmodelle als führenden Snapshot und übersetzen ausschließlich am Pluginrand in `ContentMediaUsage`; `gallery_item` und der normalisierte Listenindex bilden die geordnete Hostreferenz. Fachliche Content-Type-Fallbacks bleiben pluginlokal, während abgelöste Upload-, Picker-, Listen- und Preview-Implementierungen entfernt werden.
4. `@sva/auth-runtime` und `@sva/data-repositories`
   - führen benutzer- und instanzgebundene Content-Save-Operationen. `provisional`-Assets bleiben aus Listen ausgeschlossen; erst der Commit ersetzt Referenzen und aktiviert die verwendeten Assets in einem Datenbankstatement.

## Zentraler Backup-Agent

### Ergänzung 2026-08: Resiliente Mainserver-Detailgrenze

- `@sva/sva-mainserver` validiert Detailantworten nach Identität, optionalen Skalaren und isolierten Listenfeldgruppen. Eine ungültige optionale Feldgruppe verwirft nicht mehr den gesamten Datensatz oder gültige Geschwistereinträge.
- `@sva/plugin-sdk` stellt additiv `getDetail(id)` mit getrennten Daten und PII-armen Abweichungsmetadaten bereit; das bestehende `get(id)` bleibt kompatibel.
- `@sva/studio-ui-react` rendert die gemeinsame zugängliche Abweichungszusammenfassung. Fachplugins bleiben für lokalisierte Abschnittshinweise und die kontrollierten Formularfelder verantwortlich.

Der `studio-backup-agent` ist ein eigenständiger operativer Baustein außerhalb der App-Stacks. Sein HTTP-Port wird nicht veröffentlicht; Traefik leitet ausschließlich die beiden exakten Backup-Request-Pfade an ihn weiter. Der Baustein besitzt getrennte Staging-/Production-Secrets und leitet Datenbankhost, Bucket und Objektpräfix ausschließlich aus der validierten Zielumgebung ab.

Die HTTP-Fassade delegiert die reine Contractprüfung an lokale ESM-Validatoren. Diese trennen Objektform und Feld-allowlist, Version und Aktion, Umgebung, Datenbank-/Tenant-Kopplung, Request-Identität, Digest beziehungsweise SHA-256, Objektpfad, Sondervertrag und Ablaufzeit. Die Fassade bleibt boolesch; OIDC, HMAC, Replay-Schutz und jede Datenbankoperation verbleiben im Agenten. Das Container-Image übernimmt die Validatoren explizit und löst sie über einen relativen `.mjs`-Import auf.

Für Waste liest der Agent das kanonische Inventar aus `iam.instance_waste_provisioning`, sichert alle `ready`- und `disabled`-Datenbanken unter `<umgebung>/waste/<instance_id>/` und bindet Restores zusätzlich an die signierte Instanz-ID. Freie Datenbank- oder Rollennamen sind kein Bestandteil des Request-Vertrags.

### Ergänzung 2026-08: Mainserver-Inhaltsprojektion

- `@sva/sva-mainserver/server` stellt neben den unveränderten Fachadaptern schlanke Projection-List-Operationen bereit. Sie lesen ausschließlich Identität, Titel, Zeitpunkte, Sichtbarkeit, Status und Datenprovider; fachliche Payloads bleiben außerhalb des Projektionspfads.
- Die Studio-Server-Runtime orchestriert pro Instanz, Account, Organisation und Inhaltstyp eine Hot-Phase und eine deduplizierte Reconciliation. Persistierte Pages sind sofort lesbar.
- `iam.content_list_projection_sync_state` hält Generation, Phase, Page-Fortschritt, verfügbare Zeilen, Finalität und Fehlerzustand. Damit liegt die Konkurrenzkontrolle dauerhaft in PostgreSQL und nicht nur im Prozessspeicher.

### Ergänzung 2026-08: Permission-Katalog und Reconcile

- `@sva/core` besitzt Katalogtypen, Core-Definitionen, Availability, Lifecycle und Default-Grant-Regeln.
- `@sva/studio-module-iam` komponiert die bestehenden Modulverträge zur validierten Gesamtsicht `studioPermissionCatalog`.
- `@sva/data-repositories` materialisiert Definitionen und verwaltete Grants additiv und liefert sichere Änderungszähler.
- `@sva/instance-registry` bindet denselben Vertrag an Tenant-Bootstrap, Modul-Lifecycle und explizites `seedIamBaseline`.

### Ergänzung 2026-08: Operativer Keycloak-Instanz-Audit

- `scripts/ops/studio-instance-audit/keycloak.ts` besitzt die read-only
  `kcadm`-Erhebung, die kurzlebige Auth-Konfiguration und deren Cleanup.
- `scripts/ops/studio-instance-audit/keycloak-evaluation.ts` besitzt den
  typisierten Snapshot und die reine Ableitung der vierzehn bestehenden
  Keycloak-Befunde.
- Die Grenze ist bewusst zweckgebunden: Sie führt weder eine generische Rule
  Engine noch einen zweiten Provisioning-, Reconcile- oder Mutationspfad ein.

### Ergänzung 2026-08: DataProvider-gebundene Mainserver-Autorenschaft

- `@sva/auth-runtime` besitzt die instanz- und credential-versionierten Principal-Bindungen, den Shadow-/Automatic-/Compatibility-Resolver, das persistente Mutation-Journal und die read-only Admin-Diagnose.
- `@sva/sva-mainserver` bindet jede Schreiboperation an einen unveränderlichen `MutationPrincipalContext`; derselbe Kontext trägt Pre-Read, Provider-Write, Statusschritt, Audit und kausalen Projection-Refresh.
- `@sva/plugin-sdk` versioniert Mutationsrequests mit Vertrag V2 und übermittelt ausschließlich den Principal-Typ, die Operations-ID und die nicht autorisierende Editor-Kontextbindung. Credentials, Principal-IDs und DataProvider-IDs kommen nie aus dem Browser.
- Principal-gebundene Detailreads verwenden denselben versionierten Principal-Typ ohne Operations-ID. `@sva/sva-mainserver` löst die credential-versionierte DataProvider-Identität auf und liefert ausschließlich die für den konkreten Datensatz ausgewertete Action-Map `meta.access`; fehlende Identitäts- oder Bindungsnachweise bleiben fail-closed und blockieren den normalen Read nicht.
- `@sva/studio-ui-react` stellt das gemeinsame übersetzte Principal-Control und die schreibgeschützte DataProvider-Anzeige für alle Mainserver-Content-Plugins bereit.
- Der Self-Service-Vertrag `GET /api/v1/iam/me/context` liefert die Autorenregel der membership-gefilterten Organisationen. Die App bindet den Create-Principal exakt an `activeOrganizationId` und benötigt dafür keinen administrativen Organisationsdetail-Read.
- Eigenständige Status- und Delete-Aktionen verwenden die an der Projektionszeile ausgewiesene Credential-Quelle des bestehenden Inhalts. Fehlt sie und existiert kein eindeutig fester Kompatibilitätskontext, bleibt die Mutation gesperrt.

### Ergänzung 2026-08: Ownership global sortierter Tabellen

- `StudioDataTable` besitzt ausschließlich Darstellung und Interaktion. Jeder Aufrufer muss den Sortiermodus explizit als deaktiviert, clientseitig auf einem vollständigen Bestand oder extern kontrolliert deklarieren.
- Paginierte Inhalts-, Organisations-, Governance-, DSR- und Waste-Abholortlisten lassen Filterung, Sortierung, stabile Gleichstandsauflösung und Pagination in ihrem serverseitigen Repository beziehungsweise Read-Model ausführen. Waste-Fraktionen verwenden denselben Ablauf auf dem vollständig geladenen, statusgefilterten Bestand.
- Die Waste-Abholortprojektion gehört `@sva/data-repositories`. `@sva/core` definiert den framework-agnostischen Query-, Page- und List-Item-Vertrag; `@sva/auth-runtime` besitzt Autorisierung und strikte HTTP-Parameterprüfung; das Browser-Plugin kontrolliert ausschließlich URL-Zustand, Darstellung und ID-basierte Auswahl.
- Die Projektion verbindet Filter, Gesamtzahl und Seite in einer SQL-Anweisung, aggregiert Touren erst für die Seite und sortiert mit der migrierten ICU-Collation `public.sva_de_numeric`. Beide fachlichen Sortiermodi enden unabhängig von der Richtung mit `ID asc` und behandeln fehlende Werte zuletzt.
- Ein separater, nur lesender Resolver liefert alle IDs desselben Filtervertrags ohne Pagination oder Sortierparameter. Dadurch bleibt „Alle gefilterten auswählen“ global korrekt, ohne den vollständigen Listendatensatz in den Browser zu laden.
- Tenant- und Plattform-Benutzerlisten bleiben führend Keycloak-paginiert und bieten deshalb ohne vollständige Benutzerprojektion keine Sortieraktion an.

### Ergänzung 2026-08: Permission-Denial-Vertrag

- `@sva/core` besitzt den framework-agnostischen, begrenzten Vertrag für erforderliche Actions, `allOf`-/`anyOf`-Semantik und öffentliche Denial-Gründe.
- `@sva/routing` transportiert diesen Kontext bei Guard-Redirects; `@sva/auth-runtime` erzeugt ihn ausschließlich aus eindeutigen serverseitigen Autorisierungsentscheidungen.
- Die Studio-App löst Titel aus Core-Katalog und Build-time-Plugin-Registry auf. Unbekannte Actions verwenden die validierte Action-ID als Fallback.

### Ergänzung 2026-08: Interne Bausteine der IAM-ABAC-Auswertung

- `packages/iam-core/src/authorization-engine.ts` bleibt der einzige öffentliche Entscheidungsbaustein und orchestriert Instanz-Scope, RBAC-Matching, Permission-Scope und finale Antwort.
- `packages/iam-core/src/authorization-abac.ts` normalisiert den bereits zusammengeführten Regelkontext und enthält kleine reine Evaluatoren für Pflichtkontext, Hierarchierestriktionen, Geo-Freigaben, Zeitfenster, Acting-as und Force-Deny.
- `packages/iam-core/src/authorization-provenance.ts` leitet die von Engine und ABAC gemeinsam benötigte Rollen-/Gruppen- und Geo-Provenance ab. Beide internen Module werden nicht über den Package-Entry-Point exportiert.

### Ergänzung 2026-08: Waste-Datenaustausch

- `@sva/core` besitzt den versionierten, framework-agnostischen Vertrag für neun Waste-Datenprofile einschließlich Feldklassifikation, Defaults, Referenzen und Ausschlussgründen.
- `@sva/plugin-sdk` registriert Exportprofile neben Job- und Importprofilen. `@sva/waste-management-contracts` besitzt die konkreten Import-, Export- und Jobdefinitionen.
- Die hostseitige Waste-Runtime liest und schreibt ausschließlich die im Profil enthaltenen Fachfelder. E-Mail-Abonnements, Consent, Token und Outbox bleiben außerhalb dieses Bausteins.
- Exportartefakte werden instanzgebunden im geschützten Media-Speicher abgelegt. Die Auth-Runtime prüft beim Download Job, Actor, Instanz, aktuelle Exportberechtigung, Ablauf, Größe und SHA-256 erneut.

### Ergänzung 2026-08: Waste-Tourensatz im Folgejahr

- `@sva/plugin-waste-management` besitzt ausschließlich den zugänglichen Drei-Schritt-Assistenten, die Auswahl und die ausdrückliche Konfliktbestätigung. Das Zieljahr ist dort nur Anzeige und kein frei wählbarer Parameter.
- `@sva/core` besitzt die frameworkunabhängige Klassifikation, Datums- und Taktabbildung, stabile Zielidentitäten, Konflikterkennung, Fingerprint-Bildung sowie die zentralen Grenzen von 1.000 Touren und 100.000 Beziehungen.
- `@sva/auth-runtime` besitzt Mandanten-, Berechtigungs-, CSRF- und Idempotenzgrenze. Die Waste-Repository-Operation lädt Quelle und Ziel erneut und schreibt den vollständigen inaktiven Tourensatz unter Advisory Lock in genau einer Transaktion.

### Ergänzung 2026-08: Kontextbezogene Anwenderdokumentation

- `@sva/plugin-sdk` besitzt den framework-agnostischen Metadatenvertrag für freie Plugin-Routen.
- `@sva/routing` materialisiert Dokumentationsmetadaten und erzeugt den eindeutigen Seitenkatalog
  aus statischen Routen, Admin-Ressourcen und Plugins.
- Die Studio-App besitzt Fassade, Hinweisfeld und Markdown-Overlay. Das separate Hilfe-Repository
  besitzt Texte, Website, Manifest und Roh-Markdown.

Details stehen unter [Kontextbezogene Anwenderdokumentation](./contextual-user-documentation.md).

### Ergänzung 2026-08: Bausteine des Inhabertransfers

- `@sva/core` besitzt Action, Capability und typisierte Principal-/Zielverträge.
- `@sva/auth-runtime` besitzt lokalen atomaren Transfer, Zielkatalog, Mainserver-Zielauflösung, Lock und Journalanreicherung.
- `@sva/sva-mainserver` besitzt typspezifische Pre-Reads, Provider-Write, Ergebnisvalidierung und Reconciliation.
- `@sva/studio-ui-react` besitzt das gemeinsame Inhaberpanel sowie Editor- und Save-Slots; Plugins enthalten keine eigene Zielauflösung.

### Ergänzung 2026-08: gemeinsame Editor-Primitiven

- `@sva/plugin-sdk` besitzt List-Search-Normalisierung, Map-/Geocoding-Client und den schmalen öffentlichen Subpath `content-media`.
- `@sva/studio-ui-react` besitzt den Map-Lifecycle, Media-Picker-Konfiguration sowie den Media-Reference-Sync-Controller und seine Retry-Aktion.
- Plugins besitzen weiterhin Payload, Mutation, Navigation, Übersetzung und bundlelokales Laden der MapLibre-Runtime.
