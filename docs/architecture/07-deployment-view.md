# 07 Verteilungssicht

## Zweck

Dieser Abschnitt beschreibt die technische Verteilung auf Umgebungen und
Laufzeitknoten auf Basis des aktuellen Repos.

## Mindestinhalte

- Deployment-Topologie (lokal, CI, staging, production)
- Abhängigkeiten zu externen Diensten (z. B. Redis, OTEL, Loki)
- Sicherheits- und Betriebsaspekte je Umgebung

## Aktueller Stand

### Lokale Entwicklungsverteilung

- App: `pnpm nx run sva-studio-react:serve` auf `localhost:3000`
- Postgres IAM-DB: `docker-compose.yml` (`5432`)
- Redis: `docker-compose.yml` (`6379`, optional TLS `6380`)
- Monitoring Stack: `docker-compose.monitoring.yml`
  - Collector: `4317`, `4318`, `13133`
  - Loki: `3100`
  - Prometheus: `9090`
  - Grafana: `3001`
  - Promtail: `3101`
  - Alertmanager: `9093`

### Deployment-Bausteine (logisch)

- Web-App Runtime (TanStack Start / Node)
- Nx-/pnpm-basierte Build- und Test-Pipeline
- Externe Plattform (GitHub Actions) für CI-Ausführung
- Keycloak als zentraler OIDC Identity Provider
- Redis Session Store
- Postgres IAM Core Data Layer
- OTEL Collector als Telemetrie-Hub
- Loki/Prometheus als Storage, Grafana für Auswertung

### Sicherheits-/Betriebsaspekte

- Monitoring-Ports in Compose explizit auf `127.0.0.1` gebunden
- Redis TLS-Unterstützung vorhanden, in local Dev optional
- Postgres mit Healthcheck (`pg_isready`) und separatem Volume
- Healthchecks für zentrale Monitoring-Services konfiguriert
- Graceful OTEL Shutdown im SDK vorgesehen
- Keycloak wird aktuell als externer Dienst angebunden (nicht über Repo-Compose provisioniert)

### Noch offen (Stand heute)

- Produktions-Topologie (z. B. K8s vs. VM) ist noch nicht repo-verbindlich definiert
- HA-/Skalierungsdetails für produktiven Betrieb sind nur teilweise als ADR/Doku beschrieben

Referenzen:

- `docker-compose.yml`
- `docker-compose.monitoring.yml`
- `docs/development/postgres-setup.md`
- `packages/sdk/src/server/bootstrap.server.ts`
