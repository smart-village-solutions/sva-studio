# 03 Kontext und Scope

## Zweck

Dieser Abschnitt beschreibt Systemgrenzen, externe Schnittstellen und den
aktuellen fachlich-technischen Scope.

## Mindestinhalte

- Fachlicher Scope und Out-of-Scope
- Kontextsicht mit externen Systemen und Integrationen
- Verantwortungsgrenzen (intern/extern)

## Aktueller Stand

### In Scope (IST)

- Web-App `sva-studio-react` mit TanStack Start
- Zentrales Routing (`@sva/core`, `@sva/routing`, Plugin-Routen)
- Auth-BFF-Endpunkte (`/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout`)
- Session-Verwaltung mit Redis (inkl. optionaler Token-Verschluesselung)
- SDK Logger + OTEL Monitoring Client + lokale Monitoring-Stacks

### Out of Scope (in diesem Repo)

- Betrieb und Quellcode des externen IdP (Keycloak Realm/Server)
- Mobile App / externe Konsumenten
- Vollstaendige Fachverfahren-Integrationen

### Externe Nachbarsysteme

- OIDC Provider (per `openid-client`)
- Redis (lokal/extern)
- OTEL Collector, Loki, Prometheus, Grafana, Alertmanager

### Verantwortungsgrenzen

- Repo verantwortet App-, Routing-, Auth-, SDK- und Doku-Logik
- Externe Dienste werden angebunden, aber nicht hier implementiert

Referenzen:

- `packages/auth/src/oidc.server.ts`
- `packages/auth/src/redis.server.ts`
- `docker-compose.yml`
- `docker-compose.monitoring.yml`
