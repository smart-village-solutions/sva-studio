# 08 Querschnittliche Konzepte

## Zweck

Dieser Abschnitt sammelt übergreifende Konzepte, die mehrere Bausteine
gleichzeitig beeinflussen.

## Mindestinhalte

- Security- und Privacy-Konzepte
- Logging/Observability-Konzept
- Fehlerbehandlung, Resilienz, i18n und Accessibility-Leitlinien

## Aktueller Stand

### Security und Privacy

- OIDC Authorization Code Flow mit PKCE
- Signiertes Login-State-Cookie (HMAC)
- Session-Cookies: `httpOnly`, `sameSite=lax`, `secure` in Production
- Optionale Verschlüsselung von Tokens im Redis-Store via `ENCRYPTION_KEY`
- Application-Level Column Encryption für IAM-PII-Felder (`email_ciphertext`, `display_name_ciphertext`)
- Schlüsselverwaltung über `IAM_PII_ACTIVE_KEY_ID` + `IAM_PII_KEYRING_JSON` (außerhalb der DB)
- Fehlertexte der Feldverschlüsselung enthalten keine internen Key-IDs; technische Key-Kontexte werden nur als strukturierter Fehlerkontext geführt
- Redaction sensibler Logfelder im SDK und im OTEL Processor
- Governance-Gates: Ticketpflicht, Vier-Augen-Prinzip, keine Self-Approvals
- Harte Laufzeitgrenzen: Impersonation max. 120 Minuten, Delegation max. 30 Tage
- `support_admin`-Impersonation benötigt zusätzlichen Security-Approver
- DSGVO-Betroffenenrechte im IAM: Auskunft, Berichtigung, Löschung, Einschränkung, Widerspruch
- Löschprozess zweistufig: Soft-Delete (SLA <= 48h) und finale Anonymisierung nach Retention
- Legal Hold blockiert irreversible Löschschritte bis zur Freigabe
- Art.-19-Nachweisdaten für Empfängerbenachrichtigung werden revisionssicher persistiert
- Trust-Boundary-Validierung mit Zod in IAM-Endpoints (`authorize`, `governance`, `data-subject-rights`)
- DataClient unterstützt optionale Runtime-Schema-Validierung (`get(path, schema)`) für API-Responses
- IAM-Server-Fassaden bleiben bewusst dünn; fachliche Erweiterungen gehören in Unterordner und nicht zurück in Monolith-Dateien

### IAM Multi-Tenancy, Caching und Audit-Logging

- Mandantenisolation basiert auf kanonischem Scope `instanceId` als fachlichem String-Schlüssel (inkl. Mapping zu `workspace_id` in Logs)
- Keycloak ist führend für Authentifizierung; Postgres ist führend für Studio-verwaltete IAM-Fachdaten
- Autorisierungspfade erzwingen `instanceId`-Filterung vor Rollen-/Policy-Evaluation
- Effektive Berechtigungen aggregieren direkte Rollen und gruppenvermittelte Rollen gleichwertig; die Provenance hält `direct_role` und `group_role` als strukturierte Quelle fest
- Gruppen sind instanzgebundene Rollenbündel (`group_type = role_bundle`); direkte Gruppen-Permissions sind bewusst nicht Teil des ersten Schnitts
- Gruppenmitgliedschaften werden mit Herkunft (`manual|seed|sync`) und optionalen Gültigkeitsfenstern in `iam.account_groups` geführt
- Geo-Scopes werden kanonisch über `allowedGeoUnitIds` und `restrictedGeoUnitIds` gegen das Read-Modell `iam.geo_units` ausgewertet; `allowedGeoScopes` bleibt nur als Kompatibilitäts-Fallback bestehen
- Geo-Vererbung ist strikt restriktiv: Parent-Allow darf auf Children vererben, ein spezifischer Child-Deny schlägt diesen Allow deterministisch
- Die zentrale Permission Engine arbeitet fail-closed bei fehlendem Kontext, unvollständigen Pflichtattributen oder inkonsistenten Laufzeitdaten
- RLS-Policies und service-seitige Guards verhindern organisationsfremde Datenzugriffe
- Permission-Snapshot-Cache ist instanz- und kontextgebunden; der Leseweg läuft deterministisch über lokalen L1-Cache, Redis-Shared-Read-Path und erst dann Recompute aus Postgres
- Invalidation erfolgt event-first über Postgres `NOTIFY` mit `eventId`; TTL begrenzt Eventverlust, ersetzt aber keinen technischen Failover-Pfad
- Permission-Snapshots sind reine Laufzeitoptimierung und keine fachliche Source of Truth
- Audit-Logging für IAM-Ereignisse folgt Dual-Write (`iam.activity_logs` + OTEL via SDK Logger)
- Audit-Daten enthalten korrelierbare IDs (`request_id`, `trace_id`) und pseudonymisierte Actor-Referenzen
- Studio-verwaltete Rollen werden über `managed_by = 'studio'` und `instance_id` gegen fremdverwaltete Keycloak-Rollen abgegrenzt
- `role_key` ist die stabile technische Identität, `display_name` der editierbare UI-Name
- Rollen-Alias-Mapping für erhöhte Berechtigungen (z. B. `Admin -> system_admin`) wird ausschließlich aus `realm_access` übernommen; `resource_access`-Rollen bleiben client-spezifisch und erhalten keine globalen Privileg-Aliasse
- Idempotency-Schlüssel für mutierende IAM-Endpoints sind mandantenspezifisch gescoped: (`instance_id`, `actor_account_id`, `endpoint`, `idempotency_key`)

### Logging und Observability

- Einheitlicher Server-Logger über `@sva/sdk/server`
- AsyncLocalStorage für `workspace_id`/request context
- OTEL Pipeline für Logs + Metrics
- Label-Whitelist und PII-Blockliste in OTEL/Promtail
- IAM-Authorize/Cache-Logs nutzen strukturierte Operations (`cache_lookup`, `cache_invalidate`, `cache_stale_detected`, `cache_invalidate_failed`)
- Cold-Start-, Recompute- und Store-Fehler im Snapshot-Pfad werden als strukturierte Cache-Events (`cache_cold_start`, `cache_store_failed`) geloggt
- Korrelationsfelder `request_id` und `trace_id` sind im IAM-Pfad verpflichtend
- Außerhalb des `AsyncLocalStorage`-Kontexts werden `request_id` und `trace_id` best effort aus validierten Headern (`X-Request-Id`, `traceparent`) extrahiert
- Serverseitige JSON-Fehlerantworten für Auth-/IAM-Hotspots nutzen den flachen Vertrag `{ error: string, message?: string }` und setzen best effort `X-Request-Id`
- Keycloak-User-Sync loggt übersprungene Benutzer nur begrenzt, auf Debug-Level und ohne Klartext-PII; Summary-Logs enthalten `skipped_count` und `sample_instance_ids`
- Role-Sync- und Reconcile-Pfade verwenden ausschließlich den SDK-Logger; `console.*` ist serverseitig ausgeschlossen
- Role-Sync-Audit nutzt ein einheitliches Schema mit `workspace_id`, `operation`, `result`, `error_code?`, `request_id`, `trace_id?`, `span_id?`
- Zusätzliche Metriken für den Rollenpfad: `iam_role_sync_operations_total` und `iam_role_drift_backlog`
- Zusätzliche Cache-Metriken für IAM: `sva_iam_cache_lookup_total`, `sva_iam_cache_invalidation_duration_ms`, `sva_iam_cache_stale_entry_rate`
- Redis-Infrastrukturmetriken werden über `redis-exporter` in denselben Monitoring-Stack eingespeist und mit den IAM-Cache-Metriken korreliert
- Governance-Logs nutzen `component: iam-governance` und strukturierte Events:
  `impersonate_start`, `impersonate_end`, `impersonate_timeout`, `impersonate_abort`
- Governance-Audit folgt Dual-Write: DB (`iam.activity_logs`) + OTEL-Pipeline
- PII-Schutz in Governance-Events: nur pseudonymisierte Actor-/Target-Referenzen
- DSR-Wartungslauf emittiert strukturierte Audit-Events (`dsr_maintenance_executed`, `dsr_deletion_sla_escalated`)
- Finale Löschung pseudonymisiert Audit-Referenzen (`subject_pseudonym`) statt Klartext-PII
- SDK-Logger nutzt typisierte OTEL-Bridge (keine `any`-Casts in Transport/Bootstrap)
- Sensitive-Keys-Redaction umfasst zusätzlich Cookie-, Session-, CSRF- und API-Key-Header/Felder
- Workspace-Context-Warnungen erfolgen über lazy `process.emitWarning` statt `console.warn`
- Mainserver-Logs enthalten nur `instanceId`/`workspace_id`, `operation_name`, `request_id`, `trace_id`, Status und abstrahierte Fehlercodes; API-Key, Secret, Token und unredactete Variablen werden nie geloggt

### Fehlerbehandlung und Resilienz

- OTEL-Init ist fehlertolerant (App läuft weiter ohne Telemetrie)
- Die Routing-Error-Boundary liefert auch bei unerwarteten Fehlern immer JSON statt HTML-Fallbackseiten
- Redis-Reconnect mit Backoff und Max-Retry Logik
- Auth-Flow mit klaren Redirect-Fehlerpfaden (`auth=error`, `auth=state-expired`)
- Root-Route nutzt ein zentrales `errorComponent` für unbehandelte Laufzeitfehler mit Retry-Option
- IAM-Cache-Invalidierung folgt Event-first (Postgres NOTIFY) mit TTL/Recompute-Fallback
- Redis-Lookup-, Snapshot-Write- und Recompute-Fehler im Autorisierungspfad enden fail-closed mit HTTP `503` und Fehlercode `database_unavailable`
- Der Authorization-Cache gilt als `degraded`, wenn Redis-Latenz > `50 ms` oder die Recompute-Rate > `20/min` steigt; nach drei Redis-Fehlern wechselt der Zustand auf `failed`
- DSR-Resilienz über asynchrones Export-Statusmodell (`queued|processing|completed|failed`)
- Restore-Sanitization nach Backup-Restore stellt DSGVO-konforme Nachbereinigung sicher
- Mainserver-Delegation arbeitet fail-closed: ohne lokalen Rollencheck, Instanzkontext, Konfiguration oder gültige Credentials wird kein Upstream-Call ausgeführt
- Der IAM-Acceptance-Runner arbeitet ebenfalls fail-closed: fehlende Env, fehlende Testbenutzer, nicht bereite Dependencies oder unvollständige Laufzeitnachweise beenden den Lauf mit dokumentierten Fehlercodes
- Der Gruppen-CRUD arbeitet fail-closed: unbekannte `roleIds`, instanzfremde Gruppen oder fehlerhafte CSRF-/Idempotency-Header erzeugen stabile `invalid_request`-, `forbidden`- oder `csrf_validation_failed`-Antworten
- Geo-Hierarchie-Konflikte werden deterministisch diagnostiziert: `hierarchy_restriction` für wirksame Restriktionen, `instance_scope_mismatch` für Instanzverletzungen und `permission_missing` für fehlende Kandidaten

### Build-, Test- und Cache-Konzept der Frontend-App

- `apps/sva-studio-react` nutzt dedizierte Nx-Executor für Vite (`build`, `serve`, `preview`), Vitest (`test:unit`, `test:coverage`) und Playwright (`test:e2e`)
- Cache-relevante Frontend-Konfigurationen werden über `frontendTooling` in `nx.json` explizit modelliert
- Environment-Einflüsse mit Build-/Serve-/E2E-Relevanz (`CODECOV_TOKEN`, `TSS_DEV_SERVER`, `CI`) werden explizit in die Nx-Hash-Bildung aufgenommen
- Pre-Build-Checks für i18n und Account-UI-Foundation bleiben als separate Nx-Targets vor dem App-Build erzwungen
- Die App-Unit-Tests erzwingen wegen Node-25-/`jsdom`-Instabilitäten einen einzelnen Vitest-Worker im Thread-Pool
- Das IAM-Acceptance-Gate ist bewusst ein separates Nx-Target ohne PR-CI-Zwang, weil es reale Laufzeitabhängigkeiten gegen eine dedizierte Testumgebung prüft

### i18n und Accessibility

- UI-Texte sind derzeit überwiegend direkt im Code und noch nicht durchgängig i18n-basiert
- A11y wird pro Review/Template eingefordert, aber noch nicht zentral automatisiert
- Rollen-Statusindikatoren in `/admin/roles` verwenden i18n-Labels für `synced`, `pending` und `failed`
- Retry- und Reconcile-Aktionen bleiben über semantische Buttons und Testabdeckung tastatur- und screenreader-freundlich prüfbar

### UI-Theming, Design-Tokens und Shell-Verhalten

- Die Shell verwendet semantische CSS-Tokens (`background`, `foreground`, `card`, `sidebar`, `primary`, `border`, `ring`, `destructive`) statt direkter Tailwind-Farbwerte
- Light- und Dark-Mode werden über denselben Token-Satz aufgelöst; der aktive Modus wird im Frontend per `ThemeProvider` auf das Dokument angewendet
- Theme-Varianten sind instanzfähig vorbereitet: `instanceId` kann eine Theme-Auswahl beeinflussen, ohne die Shell-Komponenten selbst zu verzweigen
- Mobile Navigation nutzt ein zugängliches Drawer-/`Sheet`-Muster statt projektspezifischer Spezialinteraktionen
- Komplexe Alt-Muster wie kollabierte Flyout-Submenüs oder pixelgenaue Active-Indikatoren bleiben bewusst außerhalb des Initial-Scope

### Review-Governance

- Proposal-Reviews werden über einen dedizierten Proposal-Orchestrator konsolidiert
- PR- und Code-Reviews werden über einen separaten PR-Orchestrator konsolidiert
- Spezialisierte Review-Agents decken ergänzend Testqualität, i18n/Content, User Journey & Usability und Performance ab
- Zentrale und kritische Module werden zusätzlich über ein eigenes Komplexitäts-Gate mit Ticketpflicht überwacht
- Das Modulregister und die Schwellwerte liegen versioniert unter `tooling/quality/complexity-policy.json`
- Bekannte Überschreitungen bleiben nur dann zulässig, wenn sie in `trackedFindings` mit Refactoring-Ticket hinterlegt sind
- Bei modularem IAM-Refactoring wird Restschuld am tatsächlichen Kernmodul (`core.ts` oder feingranulare Teilbausteine) und nicht am historischen Fassadenpfad dokumentiert
- Kritische Coverage-Hotspots werden in `tooling/testing/coverage-policy.json` als `hotspotFloors` geführt
- Normative Accessibility und heuristische Nutzersicht sind bewusst getrennt:
  - `ux-accessibility.agent.md` für WCAG/BITV, Fokus, Tastatur und Screenreader
  - `user-journey-usability.agent.md` für Friktion, Verständlichkeit und Aufgabenbewältigung
- i18n/harte Strings werden als eigener Governance-Strang behandelt und nicht nur implizit im Code-Review geprüft
- Konflikte zwischen Review-Perspektiven werden auf Orchestrator-Ebene explizit gemacht, die Entscheidung bleibt beim Menschen

### UI-Shell, Responsivität und Skeleton UX

- Die Root-Shell trennt die Bereiche Kopfzeile, Seitenleiste und Hauptinhalt explizit
- Ein Skip-Link ermöglicht direkten Sprung in den Contentbereich (`#main-content`)
- Skeleton-Zustände werden konsistent über alle drei Kernbereiche bereitgestellt
- Mobile-first Layout: Sidebar bleibt auf kleinen Viewports nutzbar, auf großen Viewports als feste Seitenleiste

Referenzen:

- `packages/auth/src/routes.server.ts`
- `packages/auth/src/iam-authorization.server.ts`
- `packages/auth/src/iam-account-management/groups-handlers.ts`
- `packages/auth/src/iam-governance.server.ts`
- `packages/auth/src/iam-data-subject-rights.server.ts`
- `packages/auth/src/redis-session.server.ts`
- `packages/auth/src/audit-db-sink.server.ts`
- `packages/auth/src/iam-authorization/permission-store.ts`
- `packages/auth/src/iam-authorization/shared.ts`
- `packages/core/src/iam/authorization-engine.ts`
- `packages/sdk/src/logger/index.server.ts`
- `packages/monitoring-client/src/otel.server.ts`
- `docs/adr/ADR-014-postgres-notify-cache-invalidierung.md`
- `docs/architecture/iam-service-architektur.md`
- `docs/architecture/iam-datenklassifizierung.md`
- `docs/development/complexity-quality-governance.md`
- `docs/development/iam-server-modularization.md`
- `docs/development/review-agent-governance.md`
- `docs/development/iam-schluesselmanagement-strategie.md`
- `docs/guides/iam-governance-runbook.md`
- `docs/guides/iam-governance-freigabematrix.md`
- `docs/guides/iam-data-subject-rights-runbook.md`
- `docs/guides/iam-authorization-api-contract.md`
- `docs/guides/iam-service-api-dokumentation.md`
- `apps/sva-studio-react/src/routes/__root.tsx`
- `apps/sva-studio-react/src/components/AppShell.tsx`
- `apps/sva-studio-react/src/providers/theme-provider.tsx`
- `apps/sva-studio-react/src/lib/theme.ts`
- `docs/development/ui-shell-theming.md`

### Ergänzung 2026-03: AuthProvider-Pattern und Permission-Checking

- `AuthProvider` kapselt Session-Status zentral in der Root-Shell.
- UI-Bausteine konsumieren Auth-Daten ausschließlich über `useAuth()`.
- Route-Guards (`createProtectedRoute`, `createAdminRoute`) erzwingen Auth/Rollenprüfung vor Seitenrendering.
- Bei `403` in IAM-Hooks wird `invalidatePermissions()` ausgelöst, um Session-/Rollenkontext konsistent zu halten.

### Ergänzung 2026-03: CSRF-Strategie in IAM-v1

- Alle mutierenden IAM-Endpunkte prüfen serverseitig den Header `X-Requested-With: XMLHttpRequest`.
- Client-Hooks setzen den Header standardisiert über gemeinsame API-Utilities.
- Fehlercode bei Verstoß: `csrf_validation_failed`.

### Ergänzung 2026-03: Organisationsverwaltung und Org-Kontext

- Organisationspfade bleiben strikt instanzzentriert; `instanceId` ist führend, `activeOrganizationId` ist daraus abgeleiteter Session-Fachkontext.
- `GET/PUT /api/v1/iam/me/context` bilden den kanonischen Session-Contract; requestbasierte Org-Overrides sind im ersten Schnitt ausgeschlossen.
- Organisationsmutationen und Kontextwechsel folgen denselben CSRF-, Audit- und Logger-Leitplanken wie übrige IAM-v1-Schreibpfade.
- Der Org-Switcher nutzt i18n-Keys für Label, Status und Fehlerzustände und kündigt Wechsel über `aria-live="polite"` an.
- Fehlercodes wie `invalid_organization_id`, `organization_inactive` und `csrf_validation_failed` bleiben stabil, damit UI, Audit und Betriebsanalyse konsistent korrelieren können.
- Organisations-Read-Models liefern Parent-, Typ-, Policy- und Zählerdaten serverseitig aus einem lesefähigen Modell, um N+1-Abfragen in der UI zu vermeiden.

### Ergänzung 2026-03: Strukturierte Permissions und restriktive Vererbung

- `iam.permissions` bleibt rückwärtskompatibel über `permission_key`, nutzt im Read-/Compute-Pfad aber strukturierte Felder (`action`, `resource_type`, `resource_id`, `effect`, `scope`) als kanonisches Modell.
- Org-bezogene Vererbung wird nur innerhalb derselben `instanceId` ausgewertet; Parent-Scopes werden über die `hierarchy_path` des aktiven Zielkontexts gelesen.
- Restriktive Regeln (`effect = 'deny'`) werden vor Freigaben ausgewertet; lokale Restriktionen dürfen vererbte Parent-Freigaben einschränken.
- Scope-Daten für Geo, Acting-As und Restriktionen werden in effektive Permissions übernommen und im Snapshot mitgeführt.
- Der Kompatibilitätspfad liest fehlende strukturierte Felder deterministisch aus `permission_key`, bis alle relevanten Alt-Daten migriert sind.

### Ergänzung 2026-03: Gruppen und Geo-Provenance im IAM

- `EffectivePermission` erweitert die bisherige Rollentransparenz um `sourceGroupIds`; Clients erhalten damit direkte und gruppenvermittelte Herkunft ohne Zusatz-Queries.
- `MePermissionsResponse.provenance` fasst verdichtet zusammen, ob gruppenvermittelte Rechte oder Geo-Vererbung im aktuellen Snapshot enthalten sind.
- `AuthorizeResponse.provenance` benennt bei Hierarchieentscheidungen die wirksame Quelle (`inheritedFromOrganizationId`, `inheritedFromGeoUnitId`) sowie restriktive Gegenquellen (`restrictedByGeoUnitId`).
- `AuthorizeResponse.diagnostics.stage` bleibt eine allowlist-basierte Diagnosehilfe und exponiert keine internen SQL-, Cache- oder Policy-Dumps.
- UI- und API-Filter dürfen gruppenbasierte Herkunft nur auf Basis der strukturierten Felder (`sourceGroupIds`, `sourceKinds`) auswerten; implizite String-Heuristiken sind nicht zulässig.

### Ergänzung 2026-03: Multi-Host-Betrieb und Secrets-Handling

- **Instanz-Routing:** Eingehende Hosts werden über ein Subdomain-Modell (`<instanceId>.<SVA_PARENT_DOMAIN>`) auf `instanceId`s abgebildet. Die Env-Allowlist (`SVA_ALLOWED_INSTANCE_IDS`) ist die autoritative Freigabequelle. Ablehnungen liefern identische `403`-Antworten (kein Host-Enumeration-Vektor).
- **Kanonischer Auth-Host:** OIDC-Flows laufen ausschließlich über die Root-Domain. Zielbild: Auth-Cookies werden auf die Parent-Domain gesetzt (`Domain=.<SVA_PARENT_DOMAIN>`) für SSO über Instanz-Subdomains. Aktuell ist das Cookie-Scoping host-only (siehe [ADR-020](../adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md)).
- **Kanonische Runtime-Profile:** Die Betriebsmodi `local-keycloak`, `local-builder` und `acceptance-hb` werden über `SVA_RUNTIME_PROFILE` sowie versionierte Profildefinitionen unter `config/runtime/` gesteuert. Die einheitliche Bedienoberfläche ist `pnpm env:*:<profil>`.
- **Secrets-Klassifizierung:** Vertrauliche Werte (Auth-Secrets, DB-Passwörter, Encryption-Keys) werden im Swarm-Betrieb als externe Docker Secrets bereitgestellt. Das Entrypoint-Skript (`entrypoint.sh`) liest Secret-Dateien aus `/run/secrets/` und exportiert sie als Env-Variablen. Nicht-vertrauliche Konfiguration bleibt als Stack-Umgebungsvariable.
- **Startup-Validierung:** Die `instanceId`-Allowlist wird beim Startup gegen ein Regex validiert (fail-fast). Ungültige Einträge oder IDN/Punycode-Labels führen zum sofortigen Abbruch.

### Ergänzung 2026-03: Per-User-SVA-Mainserver-Integration

- Die Mainserver-Integration ist eine reine Server-Side-Integration; es gibt keinen generischen Browser-Proxy auf den externen GraphQL-Endpunkt.
- Per-User-Credentials liegen ausschließlich in Keycloak-User-Attributen (`mainserverUserApplicationId`, `mainserverUserApplicationSecret`) und werden serverseitig on demand gelesen; die bisherigen Namen `sva_mainserver_api_key` und `sva_mainserver_api_secret` bleiben nur als Legacy-Fallback lesbar.
- Die Studio-Datenbank hält nur instanzbezogene Endpunktkonfiguration (`graphql_base_url`, `oauth_token_url`, Prüfstatus) in `iam.instance_integrations`.
- Credential-Caching bleibt kurzlebig im Prozessspeicher; Access-Tokens werden ebenfalls nur in-memory und vor Ablauf mit Skew erneuert.
- OAuth-Token werden pro `(instanceId, keycloakSubject, apiKey)` gecacht; eine Persistenz in Session, Redis oder Postgres ist ausgeschlossen.
- Downstream-Headers propagieren `X-Request-Id` und Tracing-Kontext, damit Studio- und Mainserver-Logs korrelierbar bleiben.

### Ergänzung 2026-03: IAM-Transparenz-UI und Privacy-Self-Service

- Transparenz-Views verwenden ausschließlich getypte Read-Modelle aus `@sva/core`; Roh-JSON aus Einzelquellen bleibt außerhalb des Standard-UI-Pfads.
- Diagnoseinformationen aus `POST /iam/authorize` folgen einer festen Allowlist; nicht spezifizierte interne Gründe, Stacktraces oder verschachtelte Rohdaten werden nicht exponiert.
- Der Zugriff auf `/admin/iam` und seine Tabs folgt einer abgestuften Rollenmatrix:
  - Route und Tabs `rights`/`dsr`: `iam_admin`, `support_admin`, `system_admin`
  - Tab `governance` lesend zusätzlich: `security_admin`, `compliance_officer`
- `/account/privacy` verarbeitet ausschließlich das eigene Subjekt; der Client akzeptiert dort keine fremden User- oder Account-IDs.
- Das DSR-UI verwendet ein kanonisches Statusmodell (`queued`, `in_progress`, `completed`, `blocked`, `failed`) und zeigt Rohstatus nur sekundär zur Betriebsdiagnose.
- Transparenzlisten laden tab-spezifisch, serverseitig paginiert und filterbar; Detaildaten und User-Timeline-Ereignisse werden on demand geladen.
- Neue IAM-/Privacy-Texte laufen vollständig über Translation-Keys in `de` und `en`; harte Strings in den neuen Views sind nicht zulässig.
