# 12 Glossar

## Zweck

Dieser Abschnitt fuehrt einheitliche Begriffe und Abkuerzungen fuer
Architektur und Betrieb.

## Mindestinhalte

- Begriff
- Definition
- Bezug zu Baustein/Prozess/ADR

## Aktueller Stand

| Begriff | Definition | Bezug |
| --- | --- | --- |
| arc42 | Strukturrahmen fuer Architekturdokumentation mit 12 Abschnitten | `docs/architecture/README.md` |
| ADR | Architecture Decision Record fuer nachvollziehbare Entscheidungen | `docs/architecture/decisions/` |
| Kommune | Organisations-/Mandanteneinheit im Smart-Village-Kontext (fachlicher Begriff) | `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md` |
| Mandant | Isolierter Betriebs-/Datenkontext (Tenant); wird im Code u. a. ueber `workspace_id` abgebildet | `packages/sdk/src/observability/context.server.ts` |
| workspace_id | Identifier zur Kontext-Korrelation (z. B. Tenant/Workspace) in Logs/Telemetry | `docs/architecture/logging-architecture.md` |
| Core Route Factory | Funktion, die aus `rootRoute` eine Route erzeugt | `packages/core/src/routing/registry.ts` |
| Plugin Route Factory | Route-Factory aus Plugins, die mit Core-Factories gemerged wird | `packages/plugin-example/src/routes.tsx` |
| OIDC | OpenID Connect fuer Authentifizierung gegen externen IdP | `packages/auth/src/oidc.server.ts` |
| IdP | Identity Provider (OIDC-Provider) fuer Authentifizierung, extern betrieben | `packages/auth/src/oidc.server.ts` |
| PKCE | Security-Mechanismus im Authorization Code Flow | `packages/auth/src/auth.server.ts` |
| Session Cookie | HttpOnly-Cookie mit Session-ID fuer Auth-Kontext | `packages/auth/src/routes.server.ts` |
| AsyncLocalStorage Context | Request-/Workspace-Kontext fuer Logging und Korrelation | `packages/sdk/src/observability/context.server.ts` |
| OTEL | OpenTelemetry Standard fuer Logs/Metriken/Tracing | `packages/monitoring-client/src/otel.server.ts` |
| OTLP | OpenTelemetry Protocol fuer Export an Collector | `packages/monitoring-client/src/otel.server.ts` |
| Label Whitelist | erlaubte Log-Labels (`workspace_id`, `component`, `environment`, `level`) | `packages/monitoring-client/src/otel.server.ts` |
| Coverage Exempt | Projekt, das temporaer nicht in Coverage-Gates eingeht | `tooling/testing/coverage-policy.json` |
