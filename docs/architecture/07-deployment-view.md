# 07 Verteilungssicht

## Zweck

Dieser Abschnitt beschreibt die technische Verteilung auf Umgebungen und
Laufzeitknoten auf Basis des aktuellen Repos.

## Mindestinhalte

- Deployment-Topologie (lokal, CI, staging, production)
- Abhaengigkeiten zu externen Diensten (z. B. Redis, OTEL, Loki)
- Sicherheits- und Betriebsaspekte je Umgebung

## Aktueller Stand

### Lokale Entwicklungsverteilung

- App: `nx run sva-studio-react:serve` auf `localhost:3000`
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
- Redis Session Store
- OTEL Collector als Telemetrie-Hub
- Loki/Prometheus als Storage, Grafana fuer Auswertung

### Sicherheits-/Betriebsaspekte

- Monitoring-Ports in Compose explizit auf `127.0.0.1` gebunden
- Redis TLS-Unterstuetzung vorhanden, in local Dev optional
- Healthchecks fuer zentrale Monitoring-Services konfiguriert
- Graceful OTEL Shutdown im SDK vorgesehen

### Noch offen (Stand heute)

- Produktions-Topologie (z. B. K8s vs. VM) ist noch nicht repo-verbindlich definiert
- HA-/Skalierungsdetails fuer produktiven Betrieb sind nur teilweise als ADR/Doku beschrieben

Referenzen:

- `docker-compose.yml`
- `docker-compose.monitoring.yml`
- `packages/sdk/src/server/bootstrap.server.ts`
