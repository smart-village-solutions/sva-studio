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
| Plugin Route Factory | Route-Factory aus Plugins, die mit Core-Factories gemerged wird | `packages/plugin-example/src/routes.tsx` |
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
| Env-Allowlist | Kommagetrennte Liste erlaubter `instanceId`s in `SVA_ALLOWED_INSTANCE_IDS`; wird beim Startup validiert und dient als autoritative Freigabequelle | `docs/adr/ADR-011-instanceid-kanonischer-mandanten-scope.md` |
| fail-closed-Policy | Standardverhalten, bei dem fehlende oder ungültige Kontextinformationen (z. B. Host, `instanceId`) zum Abweisen der Anfrage führen (kein Zugriff ohne positive Freigabe) | `packages/sdk/src/instance/config.server.ts` |
| Parent-Domain | Die konfigurierbare Basis-Domain (`SVA_PARENT_DOMAIN`), unter der Instanz-Subdomains und der kanonische Auth-Host laufen | `deploy/portainer/.env.example` |
| Swarm Secret | Vertraulicher Wert, der über Docker Swarm Secrets bereitgestellt und über `/run/secrets/` in Container gemountet wird; Namenskonvention `sva_studio_<service>_<secret_name>` | `deploy/portainer/entrypoint.sh` |
