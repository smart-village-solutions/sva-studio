# 10 Qualitätsanforderungen

## Zweck

Dieser Abschnitt beschreibt messbare Qualitätsziele auf aktuellem Stand.

## Mindestinhalte

- Qualitätsziele (z. B. Sicherheit, Wartbarkeit, Verfügbarkeit)
- Priorisierung und messbare Akzeptanzkriterien
- Bezug zu Tests, Monitoring und Quality Gates

## Aktueller Stand

### Priorisierte Qualitätsziele

1. Sicherheit/Datenschutz
2. Wartbarkeit und Nachvollziehbarkeit
3. Beobachtbarkeit und Betrieb
4. Typsicherheit und Integrationsstabilität
5. Testqualität und Verifikationsabdeckung
6. Nutzbarkeit und internationale Konsistenz
7. Performance-Effizienz

### Messbare Kriterien (IST)

- Type Safety:
  - `pnpm test:types` muss grün sein
- Lint/Build Qualitaet:
  - `pnpm test:eslint` muss grün sein
  - `pnpm nx show project sva-studio-react` zeigt explizite Targets mit definierten `inputs` und `outputs`
- Package-Boundary-Qualität:
  - alte Sammelimporte in neuen Consumer-Pfaden werden durch ESLint und Nx-Boundaries blockiert
  - serverseitige Zielpackages bestehen `check:runtime` und verwenden Node-ESM-konforme Runtime-Imports mit expliziter `.js`-Endung
  - `pnpm openspec validate refactor-package-target-architecture-hard-cut --strict` muss für Package-Grenzänderungen grün sein
  - `@sva/studio-module-iam` bleibt React-frei und besteht `test:types`, `test:unit` sowie `check:runtime` als serverseitig konsumierbarer Vertrags-Edge
- Unit-Test-Basis:
  - `pnpm test:unit` muss grün sein
  - isolierte App-Änderungen dürfen im PR-Pfad über `sva-studio-react:test:unit:ui|routes|hooks|server` statt über die komplette App-Suite validiert werden
  - nicht-serverseitige Änderungen unter `apps/sva-studio-react/src/lib/` gelten dabei als Bestandteil des bestehenden Hooks/Lib-Slices
  - gemischte oder nicht eindeutig klassifizierbare App-Änderungen fallen bewusst auf das aggregierte `sva-studio-react:test:unit` zurück
  - neue oder grundlegend überarbeitete HTTP-nahe Frontend-Tests nutzen `msw`; reine Modul-Mocks sind dort kein ausreichender Qualitätsnachweis
  - für geänderte kritische framework-agnostische Hotspots muss eine `fast-check`-Property oder eine dokumentierte Gegenbegründung reviewbar vorliegen
  - neue oder grundlegend überarbeitete Formular-Flows müssen dem RHF-/`zodResolver`-Standardpfad folgen oder als Ausnahme dokumentiert sein
- Accessibility-Gate:
  - `Quality Gates / A11y` läuft auf allen Pull Requests und auf `main`
  - Pull Requests ohne UI-relevante Änderungen enden bewusst als erfolgreicher No-op
  - UI-relevante Änderungen an `apps/sva-studio-react`, `packages/routing`, `packages/studio-ui-react` und Plugin-UI blockieren den Merge erst nach einem grünen `pnpm test:a11y`
  - der A11y-Pfad bleibt ein eigener Signaltyp und darf Build-, E2E- oder i18n-Gates nicht doppelt ausführen
- IAM-Acceptance-Gate:
  - `pnpm nx run sva-studio-react:test:acceptance` läuft als separates Delivery-Gate gegen die Testumgebung
  - Bericht mit JSON- und Markdown-Artefakt wird unter `docs/reports/` geschrieben
  - `/health/ready` sowie Login-, JIT-, Organisations- und Membership-Nachweise müssen im Bericht als `passed` erscheinen
- Produktionsnahe Release-Validierung:
  - `Main Build / App Build` fuehrt `pnpm verify:runtime-artifact` nur fuer runtime-kritische Pull Requests aus; regulaere UI- oder Content-PRs bleiben bewusst auf dem leichteren Build-Pfad
  - `Studio Image Build` muss genau einen Manifest-Digest für `linux/amd64` liefern
  - `Studio Image Verify` muss denselben Digest gegen `/health/live`, `/health/ready` und `/` erfolgreich pruefen
  - `pnpm test:release:studio` muss `pnpm test:pr` und `pnpm verify:runtime-artifact` in dieser Reihenfolge ausführen
  - `pnpm env:release:studio:local` ist nur mit `--image-digest=sha256:...` gueltig
  - `env:precheck:studio` muss Image-Digest und passende Image-Verify-Evidenz als eigenen Check dokumentieren; fehlende Evidenz ist mindestens `warn`
  - `environment-precheck`, `image-smoke`, `internal-verify`, `external-smoke` und `release-decision` müssen im Deploy-Report als `ok` erscheinen
  - öffentliche Smoke-Probes gegen `/`, `/health/live`, `/health/ready`, `/auth/login` und `/api/v1/iam/me/context` dürfen keinen Timeout und keinen generischen HTML-Fehlerpfad liefern
  - Release-Evidenz unter `artifacts/runtime/deployments/` muss Report, Release-Manifest und Probe-Artefakte enthalten
  - Migrations-Evidenz muss zusätzlich `goose`-Status und die verwendete `goose`-Version enthalten
  - `pnpm env:feedback:studio` muss nach jedem Lauf eine Trend-Zusammenfassung und einen Review-Entwurf erzeugen
  - fuer `studio` muessen `doctor` und `precheck` zusaetzlich `app-db-principal` als `ok` ausweisen; `db`, `redis` und `keycloak` muessen dabei aus Sicht des laufenden `APP_DB_USER` bereit sein
  - wenn ein Rollout ein bereits live laufendes Ziel-Digest wiederverwendet, muss der Deploy-Report diese Live-Paritaet fuer dasselbe Digest explizit ausweisen
- Lokale Runtime-Drift-Reparatur:
  - `pnpm env:up:local-keycloak` bleibt read-only und darf bestehende lokale Instanz-Identitaet oder tenant-spezifische Secrets nicht still ueberschreiben
  - `pnpm env:doctor:local-keycloak --json` liefert fuer lokale Driftklassen stabile `reasonCode`-, `repairable`- und `recommendedAction`-Felder
  - `pnpm env:repair:local-keycloak` muss Migration, Registry-Reconcile und tenant-spezifischen Secret-Sync idempotent ausfuehren koennen
  - repo-gesteuerte gefaehrliche Ops-Pfade bleiben ohne passendes `--approve-dangerous=<token>` blockiert
  - `pnpm env:verify:db-schema-snapshot` muss Snapshot-Drift gegen den lokalen migrationsbasierten Datenbankstand sichtbar machen und Runtime-/Infra-Schemata wie `graphile_worker` ausklammern
  - `docs/development/studio-db-schema-final.sql` wird als abgeleitetes Artefakt behandelt; `packages/data/migrations/*.sql` bleiben die fuehrende Schema-Quelle
- IAM Authorize Performance:
  - P95 für `POST /iam/authorize` < 50 ms (mindestens 100 RPS / 500 gleichzeitige Nutzer als Zielprofil)
- IAM Gruppenverwaltung:
  - `GET|POST|PATCH|DELETE /api/v1/iam/groups` müssen direkte Rollenbündel, Mitgliederzählung und Deaktivierungssemantik deterministisch liefern
  - `PATCH /api/v1/iam/users/{userId}` mit `groupIds` muss Permission-Invalidierung auslösen, ohne direkte Rollen regressiv zu verlieren
- IAM Mandantenisolation (RLS):
  - Kein Datenzugriff über Organisations-/Instanzgrenzen (`instanceId`) hinweg
  - Negativtests für RLS-Bypass und Direktzugriff müssen grün sein
- IAM Geo-Vererbung:
  - Parent-Allow auf `allowedGeoUnitIds` muss Child-Geo-Units deterministisch einschließen
  - spezifischere `restrictedGeoUnitIds` müssen Parent-Allows deterministisch übersteuern
  - `GET /iam/me/permissions` und `POST /iam/authorize` müssen Gruppenherkunft und Geo-Provenance stabil serialisieren
- IAM Cache-Invaliderung:
  - End-to-End-Latenz P95 <= 2 s, P99 <= 5 s
  - Snapshot-TTL = 300 s, maximal tolerierte Stale-Dauer = 300 s
  - Cache-Hit P95 < 5 ms, Cache-Miss P95 < 80 ms, Recompute P95 < 300 ms bei `N = 100` gleichzeitigen Requests, endpoint-nah gemessen
  - Zusätzliches Beobachtungsprofil `Slow-4G` wird dokumentiert, auch wenn dort keine harte Abnahmegrenze gilt
- Monitoring-gestuetzter IAM-Authorize-Performance-Nachweis:
  - `/monitoring` muss den serverseitigen Benchmark fuer `cache-hit`, `cache-miss` und `recompute` ueber den echten Authorize-Pfad starten koennen
  - Ergebnisvertrag, API-Antwort und JSON-/Markdown-Report unter `docs/reports/` muessen dieselben Kennzahlen und Report-Referenzen stabil serialisieren
  - Die UI darf nur sichere, nicht-sensitive Ergebnisfelder und Fehlercodes anzeigen; tiefe Provider-, SQL- oder Cache-Details bleiben im Server-/OTEL-Pfad
- Instanz-Registry:
  - unbekannte, ungültige, suspendierte und archivierte Hosts liefern identisches fail-closed-Verhalten
  - neue Instanzen müssen ohne App-Redeploy über Registry und Cache-Invalidation erreichbar werden
  - Root-Host-Instanzverwaltung ist in Deutsch und Englisch vollständig über `t('...')` lokalisiert
- IAM Authorization-Cache-Readiness:
  - `/health/ready` liefert `checks.authorizationCache`
  - `degraded` ab Redis-Latenz > `50 ms` oder Recompute-Rate > `20/min`
  - `failed` nach drei aufeinanderfolgenden Redis-Fehlern
- IAM-Diagnosefähigkeit:
  - jede relevante IAM-Fehlerklasse muss mindestens einem Codepfad, einem UI- oder API-Signal und einer operativen Handlungsempfehlung zugeordnet sein
  - `requestId` und allowlist-basierte Safe-Details müssen für diagnosefähige IAM-Fehler browser- und UI-seitig erhalten bleiben
  - degradierte und Recovery-nahe Zustände dürfen nicht implizit als vollständig gesund dargestellt werden
  - Reconcile- und Sync-Responses müssen deterministische Abschlusszustände und die Zählwerte `checked`, `corrected`, `failed`, `manualReview` stabil serialisieren
  - blockerrelevanter Drift muss User-Sync und Rollen-Reconcile fail-closed blockieren und darf nicht als scheinbarer Erfolg in UI oder Audit erscheinen
- IAM Keycloak-Admin-UI:
  - `/admin/users` und `/admin/roles` müssen Mappingstatus, Bearbeitbarkeit und Diagnosecodes aus dem IAM-v1-Vertrag anzeigen
  - Tenant-Scope darf nie auf Platform- oder globale Keycloak-Admin-Credentials zurückfallen
  - Keycloak-Count/Pagination für User und Rollen muss serverseitig testbar bleiben
  - read-only oder blockierte Aktionen müssen in UI und Serverprüfung konsistent deaktiviert beziehungsweise abgewiesen werden
- IAM Redis-Betrieb:
  - Session-Store folgt dem Plattform-RTO `<= 2h`
  - Permission-Snapshots sind rekonstruierbar und müssen operativ innerhalb von `15 min` wieder in `ready|degraded` überführt werden
  - Für Permission-Snapshots besteht kein eigener fachlicher RPO, da Postgres die führende Quelle bleibt
- DSGVO-Betroffenenrechte (IAM):
  - Soft-Delete nach gültigem Löschantrag innerhalb von 48 Stunden
  - Datenexport in JSON/CSV/XML verfügbar (sync/async je nach Datenumfang)
  - Legal Holds blockieren finale Löschung deterministisch
  - Art.-19-Nachweise für Berichtigung/Löschung/Einschränkung vollständig dokumentiert
  - Wartungslauf verarbeitet Exportjobs, Eskalationen und Finalisierungen nachvollziehbar
- Tenant-Löschregeln:
  - `pnpm nx run iam-governance:test:unit --testFiles=src/deletion-rules-read-models.test.ts --testFiles=src/deletion-rules-maintenance.test.ts` muss grün sein
  - `pnpm nx run auth-runtime:test:unit --testFiles=src/iam-deletion-rules/core.test.ts` muss grün sein
  - `pnpm nx run sva-studio-react:test:unit --testFiles=src/routes/admin/-iam-page.test.tsx --testFiles=src/routes/account/-account-privacy-page.test.tsx` muss grün sein
  - `pnpm nx run data:db:test:seeds` muss tenantbezogene Löschregel-Defaults idempotent anwenden
  - Root-/Plattform-Accounts ohne Tenant-Scope dürfen weder den Admin-Tab `deletion-rules` noch die Konten-Löschregeln-Box im Datenschutz-Cockpit sehen
  - Die automatische Löschverarbeitung bleibt referenzwahrend; `deleted` markiert Accounts und Inhalte nur als Tombstone-Soft-Delete und löscht keine Zeilen physisch
- UI-Shell-Qualität:
  - Landmarks (`header`, `aside`, `main`) und Skip-Link vorhanden
  - Skeleton-Zustand für Sidebar, Kopfzeile und Contentbereich vorhanden
  - Responsives Verhalten für mobile und desktop geprüft
  - Shell-Farben werden über semantische Tokens statt direkter Farbcodes bezogen
  - Light- und Dark-Mode bleiben in Header, Sidebar und Content kontraststabil und fokussierbar
  - Unbekannte `instanceId` fällt deterministisch auf ein Basis-Theme zurück
- Öffentlicher Abfallkalender:
  - `pnpm nx run public-waste-calendar-web:test:unit` muss für Auswahlfluss, Cookie-Restore, Export-Links und Termin-Modal grün sein
  - `pnpm nx run public-waste-calendar-web:test:e2e` deckt den vollständigen Bürgerfluss Auswahl -> Kalender -> Modal -> Reload-Restore ab
  - `pnpm nx run public-waste-calendar-web:test:types` bleibt Pflichtgate für alle app-lokalen Verträge
  - Auswahlbuttons, Fraktionsfilter, Exportlinks und Dialog müssen per Rolle oder zugänglichem Namen testbar bleiben
  - Die Oberfläche muss eingebettet und auf kleinen Viewports ohne horizontale Zwangsinteraktion benutzbar bleiben
- Mainserver-Plugin-Listen:
  - News-, Events- und POI-Listen müssen `page` und `pageSize` typsicher über URL/Search-Params führen
  - die erste Listenanfrage lädt höchstens eine Seite plus notwendiges Overfetching für sichtbarkeitsbasierte `hasNextPage`-Entscheidungen
  - `StudioDataTable` bleibt die gemeinsame Tabellenbasis dieser drei Listen
  - Playwright-Mocks und Unit-Tests müssen paginierte Responses mit `hasNextPage` stabil abdecken
- Modul-IAM-Parität:
  - Build-time-Host-Registry, Plugin-Deklaration und Runtime-Wiring müssen denselben Modulkatalog verwenden
  - Parität wird mindestens über Tests in Host- und Runtime-Pfaden nachgewiesen, bevor Änderungen an `moduleIam` freigegeben werden
- File-Placement Governance:
  - `pnpm check:file-placement` muss grün sein
- Plugin-Guardrail-Governance:
  - `pnpm nx run plugin-sdk:test:unit` muss Bypass-Versuche gegen Route, Autorisierung, Audit, Persistenz und Dynamic Registration abdecken
  - `pnpm nx run routing:test:unit` muss sicherstellen, dass unbekannte Plugin-Guards und nicht-kanonische Plugin-Pfade fail-fast abgewiesen werden
  - Plugin-UI-Komponenten und host-invoked Content-Validatoren müssen weiterhin als erlaubte Erweiterungspunkte testbar bleiben
- Admin-Resource-Host-Standards:
  - deklarierte Listen-Capabilities muessen ueber Routing, Host-UI und Tests denselben kanonischen Search-State reproduzierbar rehydrieren
  - Bulk-Actions muessen Selection-Modes (`explicitIds`, `currentPage`, `allMatchingQuery`) deterministisch abbilden und ohne Suchtext-/PII-Leak nur sichere Scope-Metadaten protokollieren
  - Ressourcen ohne deklarierte Capabilities duerfen keine erzwungenen Search-/Bulk-Vertraege erhalten
- Plugin-Operations-Plattform:
  - `openspec validate update-plugin-platform-for-generic-jobs-imports --strict` muss grün sein
  - `@sva/plugin-sdk`, `@sva/core`, `@sva/auth-runtime`, `@sva/routing` und `@sva/data-repositories` müssen die neuen Job-/Import-Verträge über Unit- oder Type-Tests absichern
  - produktive Plugin-Operations-Endpunkte dürfen nur über den typisierten Runtime-Route-Katalog erreichbar sein
  - der Status eines generischen Plugin-Jobs muss aus genau einem zentralen Jobdatensatz gelesen werden
  - die öffentliche Plattform darf keine konkrete Worker-Technologie im API- oder Plugin-Vertrag voraussetzen
- Plugin-Plattform v2:
  - `openspec validate refactor-plugin-platform-for-external-publishable-plugins --strict` muss grün sein
  - Architektur- und ADR-Dokumentation für Manifest, Katalog, Loader und Runtime muss konsistent aufeinander verweisen
  - lokale Source-Plugins und installierte Distributions-Plugins müssen denselben Snapshot-Vertrag erfüllen
  - inkompatible oder deaktivierte Plugins dürfen nicht teilweise in Routing, IAM, Audit oder Jobs sichtbar werden
- Plugin-UI-Boundary:
  - `pnpm check:plugin-ui-boundary` muss für Plugin-Packages grün sein
  - Plugin-Custom-Views importieren gemeinsame UI aus `@sva/studio-ui-react` und keine App-internen Komponentenpfade
  - lokale Basis-Control-Duplikate für Button, Input, Select, Tabs, Dialog, Alert, Badge, Table oder DataTable in `packages/plugin-*` sind unzulässig
  - fachliche Wrapper bleiben zulässig, wenn sie Studio-Primitives komponieren und Accessibility-/Design-Token-Semantik erhalten
- Plugin-Architecture-Boundary:
  - `pnpm check:plugin-architecture-boundary` muss fuer Plugin-Packages gruen sein
  - der Check blockiert neue Workspace-Dependencies, Source-Imports und Host-Signale ausserhalb des dokumentierten Plugin-Vertrags
  - Brownfield-Abweichungen sind nur mit maschinenlesbarer Baseline unter `docs/reports/plugin-architecture-boundary-baseline.md` tolerierbar
  - Baseline-Aenderungen und neue Advanced-Path-Faehigkeiten gelten als review-pflichtige Architekturereignisse
- Medienmanagement:
  - `openspec validate add-media-management --strict` muss grün sein
  - `@sva/media` bleibt typstabil über `test:types`
  - Löschblockierung, Mandantentrennung, Upload-Status und Media-Picker-Verträge werden explizit per Unit- und Integrationstests abgesichert
  - `sva-studio-react:check:i18n` deckt Rollen- und Fehlerübersetzungen der Medienoberflächen ab
- Coverage Governance:
  - Gate-Logik und Baselines in `scripts/ci/coverage-gate.ts` und `tooling/testing/*`
  - Workflow- und CI-Dateien werden über `tooling-testing` targeted abgesichert und eskalieren Quality-/Coverage-Läufe nicht automatisch auf volle Produkt-Suiten
- Complexity Governance:
  - `pnpm complexity-gate` muss für definierte zentrale/kritische Module grün sein
  - neue Schwellwertüberschreitungen ohne Ticket-Referenz blockieren den Qualitätslauf
  - kritische Module können strengere Coverage-Mindestwerte und Datei-Hotspots erhalten
  - bei modularen Refactorings muss Restschuld auf den tatsächlich verbleibenden Kernmodulen getrackt werden
- Review-Governance:
  - Proposal- und PR-Reviews nutzen spezialisierte Agents mit standardisierten Templates
  - Trigger-Matrix und Abgrenzungen sind in `docs/development/review-agent-governance.md` dokumentiert
  - relevante Bot-Kommentare von `Copilot` und `chatgpt-codex-connector[bot]` blockieren den Merge, bis ein maschinenlesbarer Bearbeitungsnachweis vorliegt
  - Formular-, Frontend-HTTP- und Hotspot-Änderungen sind erst reviewbar abgeschlossen, wenn `docs/development/studio-foundations-governance.md`, die konkrete Formularinventur `docs/development/studio-form-migrationsinventur.md` und der PR- oder Arbeitskontext den Standardpfad oder die Ausnahme nachvollziehbar und konsistent abbilden

### Qualitätsattribute und Review-Zuordnung

- Reliability:
  - `test-quality.agent.md`
  - `operations-reliability.agent.md`
  - `logging.agent.md`
- Usability:
  - `user-journey-usability.agent.md`
- Accessibility:
  - `ux-accessibility.agent.md`
- Maintainability:
  - `code-quality-guardian.agent.md`
  - `documentation.agent.md`
- Security:
  - `security-privacy.agent.md`
- Performance Efficiency:
  - `performance.agent.md`
- Internationalization:
  - `i18n-content.agent.md`

### Observability-Qualität

- Strukturierte Logs mit Pflichtfeldern (`component`, `environment`, `workspace_id`)
- IAM-Authorize- und Cache-Logs enthalten zusätzlich `request_id` und `trace_id`
- IAM-Cache-Metriken `sva_iam_cache_lookup_total`, `sva_iam_cache_invalidation_duration_ms` und `sva_iam_cache_stale_entry_rate` sind in Dashboards und Alerting sichtbar
- Auth-/IAM-Error-Boundaries setzen best effort `X-Request-Id` und liefern einen stabilen JSON-Fehlervertrag
- Label-Whitelist und PII-Redaction entlang der OTEL-Pipeline
- Healthchecks für lokale Monitoring-Dienste in Compose
- Redis-Infrastrukturmetriken werden über `redis-exporter` mit Prometheus eingesammelt
- DSR-Audit-Events enthalten mindestens `instance_id`, `request_id`, `trace_id`, `event_type`, `result`
- Produktnahe Deploy-Artefakte enthalten pro Phase eine maschinenlesbare Fehlerkategorie und trennen Rollout-Erfolg von technischer Freigabeentscheidung

### Aktuelle Lücken

- Nicht alle Projekte haben vollwertige Unit/Coverage-Suites (teils exempt)
- App-Tests laufen derzeit mit `--passWithNoTests`, daher eingeschränkte Aussagekraft
- Große App-Unit-Suiten benötigen aktive Pflege ihrer Slice-Zuordnung; unklare Dateien müssen auf den Aggregat-Fallback statt auf partielle Unterabdeckung zurückfallen
- Fehlende oder implizite Cache-Inputs für Frontend-Tooling können zu falschen Cache-Hits führen, wenn neue App-Targets nicht konsistent gepflegt werden
- Mehrere IAM-Hotspots können fachlich weiterhin komplex sein, liegen aber nicht mehr als neue Ownership in den alten Sammelpackages.
- Die Package-Zielarchitektur reduziert öffentliche Importflächen; verbleibende Restkomplexität wird im jeweiligen Zielpackage statt am historischen Fassadenpfad nachverfolgt.
- Performance-Nachweis für Routing-Startup-Guard und begrenztes Sync-Debug-Logging bleibt als Folgearbeit beobachtbar
- Alertmanager-Receiver, automatisierte Backup-Automation und produktive Digest-Promotion bleiben trotz gehärtetem Releasevertrag externe Folgearbeit
- Ein lokaler Kandidatencontainer kann fuer `studio` Private-DNS-, Ingress- und Swarm-Vertraege nicht vollstaendig abbilden; prod-nahe Freigaben bleiben deshalb bewusst an Remote-Evidenz gebunden
- Auch bei starker Repo-Abdeckung bleibt IAM-Diagnostik ohne reale Dev-/Staging-Evidenz für Host-, Cookie-, Keycloak- und Datenzustandsprobleme unvollständig; ein vorbereiteter Live-Triage-Block ist daher Teil des Qualitätsziels
- Exakte End-to-End-Performancebelege für Mainserver-Listen über echte Upstream-Bestände bleiben trotz der Pagination-Migration Folgearbeit; lokal und in Tests ist zunächst die Vertrags- und Interaktionsstabilität abgesichert
- Für die öffentliche Waste-App basiert der aktuelle E2E-Nachweis noch auf einer app-lokalen Demo-Runtime; der produktive Endpunktpfad benötigt später einen separaten Integrationsnachweis.

Referenzen:

- `../development/testing-coverage.md`
- `../development/studio-foundations-governance.md`
- `../development/complexity-quality-governance.md`
- `../development/review-agent-governance.md`
- `scripts/ci/coverage-gate.ts`
- `scripts/ci/complexity-gate.ts`
- `tooling/quality/complexity-policy.json`
- `packages/monitoring-client/src/otel.server.ts`

### Ergänzung 2026-03: Qualitätsziele IAM-UI

- Account-/Admin-UI muss auf 320px, 768px und 1024px funktionsfähig bleiben.
- IAM-Admin-Calls gegen Keycloak sollen bei Circuit-Breaker-Open deterministisch in den Degraded-Mode wechseln.
- Mutierende IAM-Endpunkte müssen CSRF-Header validieren.
- UI-Regressionen werden über Unit-Tests für Hooks und Seiten sowie E2E-Szenarien für Account/Admin abgesichert.

### Ergänzung 2026-04: Qualitätsziele IAM-Laufzeitkonsistenz

- `/auth/me`, `/account`, `/admin/users` und `/admin/roles` müssen bei identischer Identität und Membership denselben fachlichen Rollen-, Status- und Profilzustand ausweisen.
- Ein gestarteter User-Sync oder Rollen-Reconcile darf nie ohne Abschlusszustand enden.
- `IDP_FORBIDDEN`, `IDP_UNAVAILABLE` und fachliches `manual_review` müssen in API, Logs und UI getrennt nachweisbar bleiben.

### Ergänzung 2026-03: Qualitätsziele Organisationsverwaltung

- Organisations-Read-Models müssen Parent-, Typ- und Zählerdaten ohne UI-seitige Rekursion bereitstellen.
- Org-Kontextwechsel darf den bestehenden `POST /iam/authorize`-Pfad nicht regressiv verschlechtern.
- Negativtests für CSRF, instanzfremde Kontexte, Zyklusverletzungen und Deaktivierungskonflikte müssen grün sein.
- Verifikationsnachweise für diesen Change werden in `docs/reports/iam-organization-management-verification-2026-03-09.md` festgehalten.
- Verifikationsnachweise für die gehärtete IAM-Abnahme werden unter `docs/reports/iam-foundation-acceptance-*.md` und `docs/reports/iam-foundation-acceptance-*.json` versioniert.

### Ergänzung 2026-03: Qualitätsziele strukturierte Permission-Vererbung

- Strukturierte Permission-Seeds und Migrationen müssen idempotent sein; `pnpm nx run data:db:migrate:validate` und `pnpm nx run data:db:test:seeds` müssen grün sein.
- `pnpm nx run data:db:migrate:status` muss den erwarteten `goose`-Stand reproduzierbar anzeigen.
- `authorize`- und `me/permissions`-Pfad müssen Resource-Spezifität, `allow`/`deny` und Org-Vererbung deterministisch auflösen.
- Negativtests für restriktive Parent-/Child-Konflikte, Geo-Scope-Mismatches und fehlende Resource-IDs müssen grün sein.
- Der Kompatibilitätspfad von `permission_key` auf strukturierte Felder darf bestehende Permission-Reads nicht regressiv brechen.

### Ergänzung 2026-03: Qualitätsziele Gruppen und Geo-Hierarchie

- Migrationen für `iam.groups`, `iam.group_roles`, `iam.account_groups` und `iam.geo_units` müssen Unique-, FK- und Self-Parent-Constraints reproduzierbar durchsetzen.
- Unit- und Integrationstests müssen gruppenvermittelte Rechte, aggregierte Provenance und Konfliktfälle `Parent-Allow + Child-Deny` explizit abdecken.
- Die Admin-UI `/admin/groups`, die Benutzerdetailseite und das Rechte-Cockpit müssen gruppenbasierte Herkunft ohne harte Strings und ohne zusätzliche N+1-Requests rendern.
- `pnpm nx run auth-runtime:test:unit`, `pnpm nx run core:test:unit`, `pnpm nx run routing:test:unit` und `pnpm nx run sva-studio-react:test:unit` bleiben für diesen Change grün.

### Ergänzung 2026-03: Qualitätsziele Inhaltsverwaltung

- Das Core-Modell für Inhalte bleibt framework-agnostisch; `packages/core` und `packages/plugin-sdk` definieren nur den stabilen Kern und deklarative Erweiterungspunkte.
- Die UI unter `/content` muss bestehende `shadcn/ui`-Patterns und Admin-Tabellen wiederverwenden und darf keine parallele Tabellen-Basis einführen.
- Inhalts-Create und -Update müssen JSON-Payloads, Statuswechsel und Historie über Unit-Tests für Hooks und Seiten explizit abdecken.
- Rollen-Gates für `system_admin`, `app_manager` und `editor` müssen auf Route-, UI- und Server-Ebene konsistent wirken.
- Neue Inhaltsmigrationen gelten nur als verifiziert, wenn `pnpm nx run data:db:migrate:validate` lokal erfolgreich `up -> down -> up` bestätigt.

### Ergänzung 2026-03: Qualitätsziele direkte Nutzerrechte

- `PATCH /api/v1/iam/users/{userId}` mit `directPermissions` muss bekannte Permission-IDs streng validieren und doppelte Zuordnungen fail-closed abweisen.
- `GET /iam/me/permissions` und `POST /iam/authorize` müssen direkte Nutzerrechte mit Provenance `direct_user` stabil serialisieren.
- Direkte Nutzer-Denies müssen konfliktäre Allows aus Rollen oder Gruppen deterministisch schlagen; entsprechende Negativtests bleiben grün.
- Reine Änderungen an direkten Nutzerrechten dürfen keinen Keycloak-Sync auslösen.
- Die Nutzerdetailseite `/admin/users/{userId}` muss direkte Rechte und aktuell wirksame Rechte getrennt und ohne harte Strings darstellen.

### Ergänzung 2026-03: Qualitätsziele Swarm-Deployment und Multi-Host-Betrieb

- `docker compose -f deploy/portainer/docker-compose.yml config` muss ohne Fehler durchlaufen (statische Stack-Validierung).
- Startup-Validierung lokaler oder migrationsbezogener `instanceId`-Fallback-Scopes bleibt ein harter Gate: ungültige Einträge in `SVA_ALLOWED_INSTANCE_IDS` führen in diesen Pfaden zum sofortigen Abbruch.
- Host-Validierung liefert identische `403`-Antworten unabhängig vom Ablehnungsgrund (keine Informationspreisgabe).
- Zielbild: Auth-Session-Cookies werden auf die Parent-Domain gesetzt, um SSO über Instanz-Subdomains zu ermöglichen; aktuell sind gemäß ADR-020 host-only-Cookies umgesetzt (Folgearbeit: Parent-Domain-Cookie-Scoping implementieren und verifizieren).
- Entrypoint-basierte Secret-Injektion muss abwärtskompatibel sein (No-Op ohne `/run/secrets/`).
- Rolling Updates (`start-first`) dürfen keine Downtime verursachen; Healthchecks müssen vor dem Routing-Start grün sein.
