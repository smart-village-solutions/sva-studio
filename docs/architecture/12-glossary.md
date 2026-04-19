# 12 Glossar

## Zweck

Dieser Abschnitt führt einheitliche Begriffe und Abkürzungen für
Architektur und Betrieb.

## Mindestinhalte

- Begriff
- Definition
- Bezug zu Baustein/Prozess/ADR

## Aktueller Stand

| Begriff | Definition | Bezug |
| --- | --- | --- |
| arc42 | Strukturrahmen für Architekturdokumentation mit 12 Abschnitten | `docs/architecture/README.md` |
| ADR | Architecture Decision Record für nachvollziehbare Entscheidungen | `docs/adr/README.md` |
| Kommune | Organisations-/Mandanteneinheit im Smart-Village-Kontext (fachlicher Begriff) | `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md` |
| Mandant | Isolierter Betriebs-/Datenkontext (Tenant); wird im Code u. a. ueber `workspace_id` abgebildet | `packages/sdk/src/observability/context.server.ts` |
| workspace_id | Identifier zur Kontext-Korrelation (z. B. Tenant/Workspace) in Logs/Telemetry | `docs/architecture/logging-architecture.md` |
| Core Route Factory | Funktion, die aus `rootRoute` eine Route erzeugt | `packages/core/src/routing/registry.ts` |
| Plugin-Vertrag | Öffentlicher SDK-Vertrag, über den ein Plugin Routen, Navigation, Content-Typen und Übersetzungen beschreibt | `packages/sdk/src/plugins.ts` |
| Plugin-Registrierung | Statische Zusammenführung aller `PluginDefinition`-Objekte im Host | `apps/sva-studio-react/src/lib/plugins.ts` |
| PluginDefinition | Zentrales SDK-Typmodell eines Plugins mit `id`, `routes`, `navigation`, `contentTypes` und `translations` | `packages/sdk/src/plugins.ts` |
| contentType | Fachlicher Typ eines Core-Inhalts, z. B. `news`; steuert Plugin-UI und serverseitige Payload-Validierung | `packages/auth/src/iam-contents/content-type-registry.ts` |
| Plugin Route Factory | Historischer Begriff für lose Plugin-Route-Listen; in v1 durch `PluginDefinition.routes` ersetzt | `docs/architecture/routing-architecture.md` |
| OIDC | OpenID Connect für Authentifizierung gegen externen IdP | `packages/auth/src/oidc.server.ts` |
| IdP | Identity Provider (OIDC-Provider) für Authentifizierung, extern betrieben | `packages/auth/src/oidc.server.ts` |
| PKCE | Security-Mechanismus im Authorization Code Flow | `packages/auth/src/auth.server.ts` |
| Session Cookie | HttpOnly-Cookie mit Session-ID für Auth-Kontext | `packages/auth/src/routes.server.ts` |
| AsyncLocalStorage Context | Request-/Workspace-Kontext für Logging und Korrelation | `packages/sdk/src/observability/context.server.ts` |
| OTEL | OpenTelemetry Standard für Logs/Metriken/Tracing | `packages/monitoring-client/src/otel.server.ts` |
| OTLP | OpenTelemetry Protocol für Export an Collector | `packages/monitoring-client/src/otel.server.ts` |
| Label Whitelist | erlaubte Log-Labels (`workspace_id`, `component`, `environment`, `level`) | `packages/monitoring-client/src/otel.server.ts` |
| Coverage Exempt | Projekt, das temporär nicht in Coverage-Gates eingeht | `tooling/testing/coverage-policy.json` |
| Referenz-Betriebsprofil | Docker-Swarm-basiertes Deployment-Profil mit Traefik-Ingress und Registry-Images als repoverbindliche Deployment-Topologie | `docs/adr/ADR-019-swarm-traefik-referenz-betriebsprofil.md` |
| Kanonischer Auth-Host | Die Root-Domain (`SVA_PARENT_DOMAIN`), über die alle OIDC-Flows (Login, Logout, Callback) laufen; einzige registrierte Redirect-URI beim IdP | `docs/adr/ADR-020-kanonischer-auth-host-multi-host-grenze.md` |
| Env-Allowlist | Kommagetrennte Liste erlaubter `instanceId`s in `SVA_ALLOWED_INSTANCE_IDS`; wird in lokalen oder migrationsbezogenen Fallback-Pfaden beim Startup validiert und ist nicht mehr die autoritative Freigabequelle für produktiven Tenant-Traffic | `docs/adr/ADR-011-instanceid-kanonischer-mandanten-scope.md` |
| fail-closed-Policy | Standardverhalten, bei dem fehlende oder ungültige Kontextinformationen (z. B. Host, `instanceId`) zum Abweisen der Anfrage führen (kein Zugriff ohne positive Freigabe) | `packages/sdk/src/instance/config.server.ts` |
| Parent-Domain | Die konfigurierbare Basis-Domain (`SVA_PARENT_DOMAIN`), unter der Instanz-Subdomains und der kanonische Auth-Host laufen | `deploy/portainer/.env.example` |
| Swarm Secret | Vertraulicher Wert, der über Docker Swarm Secrets bereitgestellt und über `/run/secrets/` in Container gemountet wird; Namenskonvention `sva_studio_<service>_<secret_name>` | `deploy/portainer/entrypoint.sh` |
| Per-User-Delegation | Downstream-Aufrufe, bei denen Studio pro angemeldetem Benutzer dessen in Keycloak hinterlegte Mainserver-Credentials serverseitig nutzt, statt zentrale Instanz-Secrets zu halten | `docs/adr/ADR-021-per-user-sva-mainserver-delegation.md` |
