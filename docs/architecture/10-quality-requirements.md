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
- Unit-Test-Basis:
  - `pnpm test:unit` muss grün sein
- IAM-Acceptance-Gate:
  - `pnpm nx run sva-studio-react:test:acceptance` läuft als separates Delivery-Gate gegen die Testumgebung
  - Bericht mit JSON- und Markdown-Artefakt wird unter `docs/reports/` geschrieben
  - `/health/ready` sowie Login-, JIT-, Organisations- und Membership-Nachweise müssen im Bericht als `passed` erscheinen
- Produktionsnahe Release-Validierung:
  - `Studio Image Build and Publish` muss genau einen Manifest-Digest für `linux/amd64` liefern
  - `Studio Image Verify` muss denselben Digest gegen `/health/live`, `/health/ready` und `/` erfolgreich pruefen
  - `pnpm env:release:studio:local` ist nur mit `--image-digest=sha256:...` gueltig
  - `environment-precheck`, `image-smoke`, `internal-verify`, `external-smoke` und `release-decision` müssen im Deploy-Report als `ok` erscheinen
  - öffentliche Smoke-Probes gegen `/`, `/health/live`, `/health/ready`, `/auth/login` und `/api/v1/iam/me/context` dürfen keinen Timeout und keinen generischen HTML-Fehlerpfad liefern
  - Release-Evidenz unter `artifacts/runtime/deployments/` muss Report, Release-Manifest und Probe-Artefakte enthalten
  - Migrations-Evidenz muss zusätzlich `goose`-Status und die verwendete `goose`-Version enthalten
  - `pnpm env:feedback:studio` muss nach jedem Lauf eine Trend-Zusammenfassung und einen Review-Entwurf erzeugen
  - fuer `studio` muessen `doctor` und `precheck` zusaetzlich `app-db-principal` als `ok` ausweisen; `db`, `redis` und `keycloak` muessen dabei aus Sicht des laufenden `APP_DB_USER` bereit sein
  - wenn ein Rollout ein bereits live laufendes Ziel-Digest wiederverwendet, muss der Deploy-Report diese Live-Paritaet fuer dasselbe Digest explizit ausweisen
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
- UI-Shell-Qualität:
  - Landmarks (`header`, `aside`, `main`) und Skip-Link vorhanden
  - Skeleton-Zustand für Sidebar, Kopfzeile und Contentbereich vorhanden
  - Responsives Verhalten für mobile und desktop geprüft
  - Shell-Farben werden über semantische Tokens statt direkter Farbcodes bezogen
  - Light- und Dark-Mode bleiben in Header, Sidebar und Content kontraststabil und fokussierbar
  - Unbekannte `instanceId` fällt deterministisch auf ein Basis-Theme zurück
- File-Placement Governance:
  - `pnpm check:file-placement` muss grün sein
- Coverage Governance:
  - Gate-Logik und Baselines in `scripts/ci/coverage-gate.ts` und `tooling/testing/*`
- Complexity Governance:
  - `pnpm complexity-gate` muss für definierte zentrale/kritische Module grün sein
  - neue Schwellwertüberschreitungen ohne Ticket-Referenz blockieren den Qualitätslauf
  - kritische Module können strengere Coverage-Mindestwerte und Datei-Hotspots erhalten
  - bei modularen Refactorings muss Restschuld auf den tatsächlich verbleibenden Kernmodulen getrackt werden
- Review-Governance:
  - Proposal- und PR-Reviews nutzen spezialisierte Agents mit standardisierten Templates
  - Trigger-Matrix und Abgrenzungen sind in `docs/development/review-agent-governance.md` dokumentiert

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
- Fehlende oder implizite Cache-Inputs für Frontend-Tooling können zu falschen Cache-Hits führen, wenn neue App-Targets nicht konsistent gepflegt werden
- Mehrere IAM-Hotspots liegen bewusst über den Komplexitäts-Schwellwerten und werden über Refactoring-Tickets nachverfolgt
- Die neue modulare IAM-Fassade reduziert öffentliche Importflächen; vollständige Kernzerlegung bleibt für einzelne `core.ts`-Bausteine Folgearbeit
- Performance-Nachweis für Routing-Startup-Guard und begrenztes Sync-Debug-Logging bleibt als Folgearbeit beobachtbar
- Alertmanager-Receiver, automatisierte Backup-Automation und produktive Digest-Promotion bleiben trotz gehärtetem Releasevertrag externe Folgearbeit
- Ein lokaler Kandidatencontainer kann fuer `studio` Private-DNS-, Ingress- und Swarm-Vertraege nicht vollstaendig abbilden; prod-nahe Freigaben bleiben deshalb bewusst an Remote-Evidenz gebunden
- Auch bei starker Repo-Abdeckung bleibt IAM-Diagnostik ohne reale Dev-/Staging-Evidenz für Host-, Cookie-, Keycloak- und Datenzustandsprobleme unvollständig; ein vorbereiteter Live-Triage-Block ist daher Teil des Qualitätsziels

Referenzen:

- `../development/testing-coverage.md`
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
- `pnpm nx run auth:test:unit`, `pnpm nx run core:test:unit`, `pnpm nx run routing:test:unit` und `pnpm nx run sva-studio-react:test:unit` bleiben für diesen Change grün.

### Ergänzung 2026-03: Qualitätsziele Inhaltsverwaltung

- Das Core-Modell für Inhalte bleibt framework-agnostisch; `packages/core` und `packages/sdk` definieren nur den stabilen Kern und deklarative Erweiterungspunkte.
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
