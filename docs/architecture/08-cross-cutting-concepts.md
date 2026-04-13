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
- `Session.expiresAt` ist die fachlich führende Session-Gültigkeit; Cookie und Redis-TTL werden daraus abgeleitet
- Sessions bleiben datensparsam und tragen nur Auth-Kern plus Lifecycle-Felder (`issuedAt`, `expiresAt`, `sessionVersion`)
- Optionale Verschlüsselung von Tokens im Redis-Store via `ENCRYPTION_KEY`
- Sessionen fuehren nur den minimalen Auth-Kern (`sub/id`, `instanceId`, Rollen); Profilattribute wie Name und E-Mail gehoeren nicht zum Pflichtumfang der Session
- Forced Reauth pro Benutzer erfolgt über `minimumSessionVersion` und `forcedReauthAt`; Keycloak-Logout ist optional zuschaltbar
- Silent SSO ist nur ein einmaliger Recovery-Versuch nach `401` und wird nach explizitem Logout temporär unterdrückt
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
- Rechtstext-HTML wird serverseitig vor Persistenz sanitisiert; erlaubte Statuswerte bleiben auf `draft`, `valid`, `archived` begrenzt
- Inhaltsverwaltung bleibt im ersten Schnitt auf einen stabilen Core-Kern begrenzt: `title`, `contentType`, `publishedAt`, `createdAt`, `updatedAt`, `author`, `payload`, `status`, `history`
- Inhaltstypen dürfen über das SDK zusätzliche Validierung, UI-Sektionen und Listenmetadaten registrieren, aber keine Core-Semantik oder das Statusmodell überschreiben
- Plugin-Vertrag v1 bleibt statisch und bundlegebunden: Plugins deklarieren Metadaten über `PluginDefinition`, aber weder Runtime-Loading noch Plugin-eigene Sicherheits- oder Routing-Bypässe sind erlaubt
- Plugin-Guards werden grundsätzlich hostseitig angewendet; ein Plugin deklariert nur die fachliche Guard-Anforderung und darf keine eigene Autorisierungsschicht am Host vorbei etablieren
- News-Payloads werden serverseitig contentType-spezifisch validiert; HTML-Inhalte durchlaufen eine Allowlist-Sanitisierung, bevor sie persistiert werden
- DataClient unterstützt optionale Runtime-Schema-Validierung (`get(path, schema)`) für API-Responses
- IAM-Server-Fassaden bleiben bewusst dünn; fachliche Erweiterungen gehören in Unterordner und nicht zurück in Monolith-Dateien
- Profil-Synchronisation mit Keycloak bleibt zulaessig, erfolgt aber ausschliesslich ueber dedizierte Profil-/Sync-Flows und nicht implizit ueber Session- oder Logging-Pfade

### IAM Multi-Tenancy, Caching und Audit-Logging

- Mandantenisolation basiert auf kanonischem Scope `instanceId` als fachlichem String-Schlüssel (inkl. Mapping zu `workspace_id` in Logs)
- Keycloak ist führend für Authentifizierung; Postgres ist führend für Studio-verwaltete IAM-Fachdaten
- Autorisierungspfade erzwingen `instanceId`-Filterung vor Rollen-/Policy-Evaluation
- Effektive Berechtigungen aggregieren direkte Nutzerrechte, direkte Rollen und gruppenvermittelte Rollen; die Provenance hält `direct_user`, `direct_role` und `group_role` als strukturierte Quelle fest
- Gruppen sind instanzgebundene Rollenbündel (`group_type = role_bundle`); direkte Gruppen-Permissions sind bewusst nicht Teil des ersten Schnitts
- Direkte Nutzerrechte werden in `iam.account_permissions` mit eigenem `effect` (`allow|deny`) persistiert und bewusst von Rollen-/Gruppenmitgliedschaften getrennt gepflegt
- Konfliktregel für direkte Nutzerrechte bleibt konservativ: direkte Nutzer-Denies schlagen alle Allows; direkte Nutzer-Allows ergänzen nur, wenn kein restriktiver Konflikt greift
- Gruppenmitgliedschaften werden mit Herkunft (`manual|seed|sync`) und optionalen Gültigkeitsfenstern in `iam.account_groups` geführt
- Geo-Scopes werden kanonisch über `allowedGeoUnitIds` und `restrictedGeoUnitIds` gegen das Read-Modell `iam.geo_units` ausgewertet; `allowedGeoScopes` bleibt nur als Kompatibilitäts-Fallback bestehen
- Geo-Vererbung ist strikt restriktiv: Parent-Allow darf auf Children vererben, ein spezifischer Child-Deny schlägt diesen Allow deterministisch
- Die zentrale Permission Engine arbeitet fail-closed bei fehlendem Kontext, unvollständigen Pflichtattributen oder inkonsistenten Laufzeitdaten
- RLS-Policies und service-seitige Guards verhindern organisationsfremde Datenzugriffe
- Permission-Snapshot-Cache ist instanz- und kontextgebunden; der Leseweg läuft deterministisch über lokalen L1-Cache, Redis-Shared-Read-Path und erst dann Recompute aus Postgres
- Invalidation erfolgt event-first über Postgres `NOTIFY` mit `eventId`; TTL begrenzt Eventverlust, ersetzt aber keinen technischen Failover-Pfad
- Permission-Snapshots sind reine Laufzeitoptimierung und keine fachliche Source of Truth
- Änderungen an direkten Nutzerrechten invalidieren dieselben Snapshot-Pfade wie Rollen- und Gruppenänderungen; Cache-Konsistenz ist damit für `me/permissions` und `authorize` identisch abgesichert
- Audit-Logging für IAM-Ereignisse folgt Dual-Write:
  - Tenant-Scope: `iam.activity_logs` + OTEL via SDK Logger
  - Plattform-Scope: `iam.platform_activity_logs` + OTEL via SDK Logger
- Audit-Daten enthalten korrelierbare IDs (`request_id`, `trace_id`) und pseudonymisierte Actor-Referenzen
- Der Root-Host ist ein expliziter Plattform-Scope und keine Pseudo-Instanz in `iam.instances`
- Studio-verwaltete Rollen werden über `managed_by = 'studio'` und `instance_id` gegen fremdverwaltete Keycloak-Rollen abgegrenzt
- Keycloak bleibt von direkten Nutzerrechten fachlich entkoppelt; diese Konfiguration ist ausschließlich Studio-intern und wird nicht in den IdP gespiegelt
- `role_key` ist die stabile technische Identität, `display_name` der editierbare UI-Name
- Rollen-Alias-Mapping für erhöhte Berechtigungen (z. B. `Admin -> system_admin`) wird ausschließlich aus `realm_access` übernommen; `resource_access`-Rollen bleiben client-spezifisch und erhalten keine globalen Privileg-Aliasse
- Idempotency-Schlüssel für mutierende IAM-Endpoints sind mandantenspezifisch gescoped: (`instance_id`, `actor_account_id`, `endpoint`, `idempotency_key`)
- Inhalts-Schreibpfade folgen denselben Guardrails: CSRF-Header, Idempotency-Key bei Create, permission-basierte Freigabe (`content.read|create|update`) und revisionssichere History-Events
- Globale Instanzmutationen verwenden die dedizierte Plattformrolle `instance_registry_admin`
- Instanzverwaltung ist nur auf dem Root-Host zulässig; Tenant-Hosts rendern keine globale Control Plane
- Normale Tenant-Administration nutzt ausschließlich einen tenantlokalen Keycloak-Adminpfad; Plattform-/Root-Credentials sind dafür kein zulässiger Fallback
- Root-/Plattform-Zugriff bleibt auf Instanz-Lifecycle, Provisioning, Reconcile und explizites Break-Glass begrenzt
- Keycloak-Provisioning fuer Instanzen ist ein expliziter mehrstufiger Root-Host-Workflow aus Preflight, Plan, Ausfuehrung und persistiertem Schrittprotokoll
- Registry-Daten und Keycloak-Mutation sind getrennte Aktionen; ein Speichern von Instanzdaten fuehrt keine implizite Keycloak-Aenderung aus
- Registry-Lookups verwenden einen kurzen In-Process-L1-Cache mit expliziter Invalidation, aber ohne Stale-Serve-Strategie

### Logging und Observability

- Einheitlicher Server-Logger über `@sva/sdk/server`
- AsyncLocalStorage für `workspace_id`/request context
- OTEL Pipeline für Logs + Metrics
- Development nutzt zusätzlich eine lokale Debug-Konsole im Frontend; sie zeigt Browser-Logs und redaktierte Server-Logs, ist aber kein produktiver Telemetriepfad
- Operative Logs enthalten keine Tokens, keine tokenhaltigen Redirect- oder Logout-URLs und keine decodierbaren JWT-Strings; zulaessig sind nur sichere Summary-Felder
- Runtime-Diagnostik folgt einem zweistufigen Modell: öffentliche Health-/API-Responses liefern knappe, nicht-sensitive `reason_code`s; OTEL liefert die tiefe technische Korrelation über Span-Attribute und Events
- Der Server-Entry-Diagnosevertrag ist env-gesteuert: `SVA_SERVER_ENTRY_DEBUG=true` aktiviert strukturierte Logs fuer Request-Eingang, Auth-Dispatch, Delegation an TanStack Start und Antwortstatus, ohne Secrets oder Tokeninhalte zu protokollieren
- Fuer produktionsnahe Remote-Profile ist `app-db-principal` ein eigener Diagnosevertrag: `/health/ready` muss `db`, `redis` und `keycloak` aus Sicht des laufenden `APP_DB_USER` als bereit ausweisen
- Die Studio-Root-Shell rendert in allen Environments einen sichtbaren Runtime-Health-Indikator auf Basis des bestehenden IAM-Readiness-Endpunkts; die UI zeigt nur sichere Statuszustände und `reason_code`s, keine rohen Provider- oder Stack-Details
- Label-Whitelist und PII-Blockliste in OTEL/Promtail
- IAM-Authorize/Cache-Logs nutzen strukturierte Operations (`cache_lookup`, `cache_invalidate`, `cache_stale_detected`, `cache_invalidate_failed`)
- Cold-Start-, Recompute- und Store-Fehler im Snapshot-Pfad werden als strukturierte Cache-Events (`cache_cold_start`, `cache_store_failed`) geloggt
- Korrelationsfelder `request_id` und `trace_id` sind im IAM-Pfad verpflichtend
- Scope-aware Logs enthalten zusätzlich `scope_kind`, `workspace_id` und im Tenant-Scope `instance_id`
- Außerhalb des `AsyncLocalStorage`-Kontexts werden `request_id` und `trace_id` best effort aus validierten Headern (`X-Request-Id`, `traceparent`) extrahiert
- Serverseitige JSON-Fehlerantworten für Auth-/IAM-Hotspots nutzen den flachen Vertrag `{ error: string, message?: string }` und setzen best effort `X-Request-Id`
- IAM-v1-Fehlerantworten dürfen additive `details` tragen, enthalten dort aber nur nicht-sensitive Diagnosefelder wie `reason_code`, `dependency`, `schema_object`, `expected_migration`, `actor_resolution` und `instance_id`
- Tenant-Admin-Fehler dürfen zusätzlich `execution_mode`, `auth_realm` und `provider_source` tragen, damit Realm- oder Control-Plane-Drift ohne Rohfehler analysierbar bleibt
- Auth-, Resolver- und Audit-Fehler protokollieren redigiert nur `error_type`, `reason_code`, `dependency`, `scope_kind` und Korrelationsfelder; rohe Provider-/DB-Fehltexte bleiben außerhalb des Standard-Logs
- IAM-Readiness und Diagnosepfade exponieren Schema-Drift bewusst knapp (`schema_drift`, `missing_table`, `missing_column`) statt rohe SQL-, Redis- oder Provider-Fehler an UI oder Browser weiterzugeben
- Runtime-Doctor und Deploy-Report ergänzen den fachlichen Schema-Guard um die verwendete `goose`-Version sowie Metadaten des dedizierten Swarm-Migrations- und Bootstrap-Jobs, ohne Secrets oder Roh-SQL nach außen zu exponieren
- Keycloak-User-Sync loggt übersprungene Benutzer nur begrenzt, auf Debug-Level und ohne Klartext-PII; Summary-Logs enthalten `auth_realm`, `provider_source`, `execution_mode`, `skipped_count` und `sample_instance_ids`
- Der Sync-Report darf additive, nicht-sensitive Diagnosefelder wie `authRealm`, `providerSource`, `executionMode`, `matchedWithoutInstanceAttributeCount` und `skippedInstanceIds` zurückgeben, damit UI und Doctor Realm-/Instanz-Drift ohne `kcadm.sh` eingrenzen können
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
- Pseudonyme technische IDs bleiben personenbezogen und werden nur geloggt, wenn sie fuer Betrieb, Audit oder Korrelation wirklich erforderlich sind
- Auth-Audit und Betriebslogs unterscheiden `login`, `silent_reauth_success`, `silent_reauth_failed`, `forced_reauth` und `logout`
- Workspace-Context-Warnungen erfolgen über lazy `process.emitWarning` statt `console.warn`
- Mainserver-Logs enthalten nur `instanceId`/`workspace_id`, `operation_name`, `request_id`, `trace_id`, Status und abstrahierte Fehlercodes; API-Key, Secret, Token und unredactete Variablen werden nie geloggt
- IAM-Request-Spans tragen konsistente Diagnoseattribute wie `iam.endpoint`, `iam.instance_id`, `iam.actor_resolution`, `iam.reason_code`, `iam.feature_flags`, `db.schema_guard_result`, `dependency.redis.status` und `dependency.keycloak.status`
- Der Runtime-Doctor- und Migrationspfad emittiert eigene OTEL-Ereignisse für Schema-Guard, Actor-Diagnose und verifizierte Migrationsläufe, damit Betriebsfehler mit `request_id` und `trace_id` korrelierbar bleiben
- Inhalts-Historie nutzt ein eigenes Read-Modell statt Roh-Logs; jede Erstellung, Aktualisierung und jeder Statuswechsel erzeugt zusätzlich Audit-Ereignisse im bestehenden IAM-Auditpfad
- Studio-Deploys erzeugen zusätzlich strukturierte Release-Evidenz unter `artifacts/runtime/deployments/`; enthalten sind Release-Modus, Actor, Workflow, Image-Referenz, Schrittstatus und Stack-Zusammenfassung, jedoch keine Secrets oder PII
- Produktionsnahe Releases erzeugen zusätzlich eigenständige Artefakte für Release-Manifest, Phasenstatus, Migration, Bootstrap, Migrationsjob, Bootstrap-Job, interne Probes und externe Probes; diese Artefakte bleiben bewusst ohne Secrets oder PII
- Remote-Prechecks für `studio` vergleichen zusätzlich die Live-Service-Spec der App mit dem gerenderten Sollzustand aus dem Deploy-Compose; dabei sind Netzwerke und ingressrelevante Labels eigene Drift-Signale

### Fehlerbehandlung und Resilienz

- OTEL-Init ist in Development fehlertolerant; in Production wird fehlende OTEL-Readiness fail-closed behandelt
- Die Routing-Error-Boundary liefert auch bei unerwarteten Fehlern immer JSON statt HTML-Fallbackseiten
- Redis-Reconnect mit Backoff und Max-Retry Logik
- Auth-Flow mit klaren Redirect-Fehlerpfaden (`auth=error`, `auth=state-expired`)
- Silent Session-Recovery arbeitet ohne Retry-Schleifen und fällt bei Browser-/IdP-Limits deterministisch auf aktiven Login zurück
- Root-Route nutzt ein zentrales `errorComponent` für unbehandelte Laufzeitfehler mit Retry-Option
- Runtime-Profile verwenden einen verbindlichen Diagnosepfad `pnpm env:doctor:<profil>`; manuelle `psql`-/Browser-Netzwerkdiagnose ist nur Fallback
- Read-only Remote-Diagnostik trennt strikt zwischen Portainer-API als Primaerkanal und `quantum-cli` als Mutations-/Fallback-Kanal
- Mutierende `studio`-Kommandos laufen regulaer ueber den expliziten lokalen Operator-Kontext `local-operator`; der bisherige CI-/Runner-Deploypfad ist hoechstens noch Legacy-Fallback
- `studio` verwendet einen verbindlichen, fehlertoleranten Deploypfad ueber `Studio Image Build`, `Studio Artifact Verify` und den lokalen Einstieg `env:release:studio:local`; direkte `up`-/`update`-Deploys sind fuer Serverrollouts gesperrt
- Der produktionsnahe Releasevertrag klassifiziert Fehler verbindlich in `config`, `image`, `migration`, `bootstrap`, `startup`, `health`, `ingress` und `dependency`; spätere Phasen dürfen frühere Resultate nicht überschreiben
- Release-Modus `schema-and-app` arbeitet fail-closed: ohne dokumentiertes Wartungsfenster startet kein orchestrierter Studio-Deploy
- Release-Modus `schema-and-app` arbeitet zusätzlich fail-closed auf Basis dedizierter Swarm-Jobs: ohne erfolgreichen Exit-Code von `migrate` und `bootstrap`, Post-Migration-Assertions und Schema-Guard startet kein App-Rollout
- Studio-Releases arbeiten fail-closed ohne `SVA_IMAGE_DIGEST`; ein nicht bestehender `image-smoke` blockiert jeden Rollout vor dem Stack-Update
- Prod-nahe Paritaet fuer `studio` muss Root-Host, Tenant-Host und OIDC-Verhalten bewerten. Wenn dasselbe Digest bereits live laeuft, darf nur die Live-Evidenz dieses Digests wiederverwendet werden.
- Der Live-Rollout-Render validiert vor `quantum-cli stacks update`, dass `app` die Netzwerke `internal` und `public` sowie die benoetigten Traefik-Labels weiterhin enthält; fehlende Einträge blockieren den Rollout fail-fast
- Temp-Job-Stacks für `migrate` und `bootstrap` sind von Live-Rollouts strikt getrennt. Sie nutzen nur `<stack>_internal`, enthalten keinen `app`-Service und dürfen die Live-Spec von `studio_app` nicht mutieren
- Deploy-Reports unterscheiden explizit zwischen `migration`, `bootstrap`, `health`, `verify` und `ingress_consistency`; ein Zustand `app 1/1`, aber externer `502` wird als eigener Drift-/Ingress-Fehler ausgewiesen
- Vor dem Docker-Build prueft `verify:runtime-artifact` den finalen Node-Output `apps/sva-studio-react/.output/server/index.mjs` mit Artefakt-Assertions, temporaeren Migrationen und Health-Probes. Das Image-Verify prueft danach denselben Vertrag erneut am gepushten Digest.
- Laufzeit-Patching im Container ist kein Normalpfad mehr. Wenn `SVA_ENABLE_RUNTIME_RECOVERY_PATCH` nicht explizit gesetzt ist, muss der Container mit dem unveraenderten Build-Output start- und health-faehig sein.
- IAM-Cache-Invalidierung folgt Event-first (Postgres NOTIFY) mit TTL/Recompute-Fallback
- Redis-Lookup-, Snapshot-Write- und Recompute-Fehler im Autorisierungspfad enden fail-closed mit HTTP `503` und Fehlercode `database_unavailable`
- Der Authorization-Cache gilt als `degraded`, wenn Redis-Latenz > `50 ms` oder die Recompute-Rate > `20/min` steigt; nach drei Redis-Fehlern wechselt der Zustand auf `failed`
- DSR-Resilienz über asynchrones Export-Statusmodell (`queued|processing|completed|failed`)
- Restore-Sanitization nach Backup-Restore stellt DSGVO-konforme Nachbereinigung sicher
- Mainserver-Delegation arbeitet fail-closed: ohne lokalen Rollencheck, Instanzkontext, Konfiguration oder gültige Credentials wird kein Upstream-Call ausgeführt
- Der IAM-Acceptance-Runner arbeitet ebenfalls fail-closed: fehlende Env, fehlende Testbenutzer, nicht bereite Dependencies oder unvollständige Laufzeitnachweise beenden den Lauf mit dokumentierten Fehlercodes
- Der Gruppen-CRUD arbeitet fail-closed: unbekannte `roleIds`, instanzfremde Gruppen oder fehlerhafte CSRF-/Idempotency-Header erzeugen stabile `invalid_request`-, `forbidden`- oder `csrf_validation_failed`-Antworten
- Die Rechtstext-Verwaltung arbeitet fail-closed: ungültige Statuswechsel, fehlendes `publishedAt` bei `valid` oder nicht reloadbare Neuanlagen liefern stabile `invalid_request`- bzw. `database_unavailable`-Antworten
- Die Inhaltsverwaltung arbeitet fail-closed: ungültiges JSON, fehlendes `publishedAt` bei `published`, nicht erlaubte Rollen oder nicht auflösbare Inhalte liefern stabile `invalid_request`-, `forbidden`- bzw. `not_found`-Antworten
- Geo-Hierarchie-Konflikte werden deterministisch diagnostiziert: `hierarchy_restriction` für wirksame Restriktionen, `instance_scope_mismatch` für Instanzverletzungen und `permission_missing` für fehlende Kandidaten

### Build-, Test- und Cache-Konzept der Frontend-App

- `apps/sva-studio-react` nutzt dedizierte Nx-Executor für Vite (`build`, `serve`, `preview`), Vitest (`test:unit`, `test:coverage`) und Playwright (`test:e2e`)
- `apps/sva-studio-react:verify:runtime-artifact` ist der verbindliche Final-Artifact-Check nach dem Build; er validiert den finalen `.output/server/**`-Vertrag gegen echte Health-Probes und klassifiziert Fehler als `artifact-contract-failed`, `dependency-failed`, `runtime-start-failed` oder `http-dispatch-failed`
- Cache-relevante Frontend-Konfigurationen werden über `frontendTooling` in `nx.json` explizit modelliert
- Environment-Einflüsse mit Build-/Serve-/E2E-Relevanz (`CODECOV_TOKEN`, `TSS_DEV_SERVER`, `CI`) werden explizit in die Nx-Hash-Bildung aufgenommen
- Pre-Build-Checks für i18n und Account-UI-Foundation bleiben als separate Nx-Targets vor dem App-Build erzwungen
- Die App-Unit-Tests erzwingen wegen Node-25-/`jsdom`-Instabilitäten einen einzelnen Vitest-Worker im Thread-Pool
- Das IAM-Acceptance-Gate ist bewusst ein separates Nx-Target ohne PR-CI-Zwang, weil es reale Laufzeitabhängigkeiten gegen eine dedizierte Testumgebung prüft

### TypeScript-, Bundler- und Node-ESM-Vertrag

- Das Monorepo nutzt `moduleResolution: "Bundler"` für produktive Dev-Tooling-Pfade mit Vite, `tsx` und Vitest
- Diese Bundler-Auflösung ist bewusst nicht identisch mit der Laufzeitauflösung von Node-ESM für gebaute `dist/*.js`-Packages
- Serverseitig direkt von Node geladene Workspace-Packages müssen deshalb ESM-strikte relative Runtime-Imports mit expliziter Laufzeitendung (`.js`) verwenden
- Runtime-Imports auf andere Workspace-Packages bleiben nur dann gültig, wenn die jeweilige Dependency im lokalen `package.json` des importierenden Packages deklariert ist
- Der technische Schutz gegen Drift liegt im zentralen Guard `pnpm check:server-runtime`, der statische Source-Prüfung und `dist`-Smoke-Imports kombiniert
- `pnpm test:types` gilt dadurch zugleich als Typ- und Node-ESM-Kompatibilitäts-Gate für die serverseitigen Workspace-Packages

### i18n und Accessibility

- Core- und Plugin-UI-Texte werden über gemeinsame i18n-Ressourcen aufgelöst; Plugin-Namespaces folgen der Konvention `<pluginId>.*`
- A11y wird pro Review/Template eingefordert, aber noch nicht zentral automatisiert
- Rollen-Statusindikatoren in `/admin/roles` verwenden i18n-Labels für `synced`, `pending` und `failed`
- Retry- und Reconcile-Aktionen bleiben über semantische Buttons und Testabdeckung tastatur- und screenreader-freundlich prüfbar
- Die neue `/content`-Verwaltung verwendet ausschließlich bestehende `shadcn/ui`-Kompositionen und orientiert sich visuell an vorhandenen Admin-Tabellen statt eine parallele Tabellenbasis einzuführen
- Plugin-Ansichten folgen denselben Shell-Konventionen für Fokus, Breadcrumbs, `document.title`, Heading-Hierarchie und `aria-live`-Feedback wie Core-Ansichten
- CRUD-artige Admin-Ressourcen folgen einer einheitlichen Navigationskonvention:
  - Liste unter `/admin/<resource>`
  - Erstellungsansicht unter `/admin/<resource>/new`
  - Detail- und Bearbeitungsansicht unter `/admin/<resource>/$id`
- Create- und Edit-Flows dieser Ressourcen werden nicht über lokalen Dialog-State der Listenansicht gesteuert; Listenaktionen navigieren immer auf die kanonische Zielroute

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
- Am unteren Ende jeder Studio-Seite wird ein kompakter Runtime-Health-Indikator mit Polling für Postgres, Redis, Keycloak und den Autorisierungs-Cache angezeigt; ein Fehler beim Polling degradiert nur die Anzeige, nicht die restliche Shell

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
- `docs/development/runtime-profile-betrieb.md`
- `docs/development/review-agent-governance.md`
- `docs/development/server-package-runtime-guards.md`
- `docs/development/iam-schluesselmanagement-strategie.md`
- `docs/guides/iam-governance-runbook.md`
- `docs/guides/iam-governance-freigabematrix.md`
- `docs/guides/iam-data-subject-rights-runbook.md`
- `docs/guides/iam-authorization-api-contract.md`
- `docs/guides/iam-service-api-dokumentation.md`
- `docs/guides/swarm-deployment-runbook.md`
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
- **Kanonische Runtime-Profile:** Die Betriebsmodi `local-keycloak`, `local-builder` und `studio` werden über `SVA_RUNTIME_PROFILE` sowie versionierte Profildefinitionen unter `config/runtime/` gesteuert. Die einheitliche Bedienoberfläche ist `pnpm env:*:<profil>`.
- **Secrets-Klassifizierung:** Vertrauliche Werte (Auth-Secrets, DB-Passwörter, Encryption-Keys) werden im Acceptance-Swarm als geschützte Stack-Umgebungsvariablen betrieben. Das Entrypoint-Skript (`entrypoint.sh`) validiert und normalisiert diese Werte, protokolliert sie aber nie. Nicht-vertrauliche Konfiguration bleibt ebenfalls als Stack-Umgebungsvariable versioniert beschrieben.
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
