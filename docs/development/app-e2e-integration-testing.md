# App E2E Integration Testing

Dieses Dokument beschreibt den reproduzierbaren Smoke-Test für die laufende App inklusive Docker-Service-Stack.

## Voraussetzungen

1. Docker Engine läuft lokal.
2. Node.js und pnpm sind installiert.
3. Playwright Browser wurde installiert:

```bash
pnpm --filter sva-studio-react exec playwright install --with-deps chromium
```

## Lokaler Lauf

1. Services starten:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d redis loki otel-collector promtail
```

2. E2E-Smoketest via Nx ausführen:

```bash
pnpm nx run sva-studio-react:test:e2e
```

3. Services wieder stoppen:

```bash
docker compose -f docker-compose.yml -f docker-compose.monitoring.yml down
```

## Was wird geprüft

- Browser-Smoketest für Kernrouten:
  - `/`
  - `/demo`
  - `/plugins/example`
- Auth-Entry-Point:
  - `/auth/login` liefert Redirect-Response (302/303/307/308)
- Service-Readiness vor Teststart:
  - Redis (`127.0.0.1:6379`)
  - Loki (`/ready`)
  - OTEL Collector (`127.0.0.1:13133`)
  - Promtail (`/ready`)

Wenn ein Service fehlt, bricht der Test früh mit klarer Fehlermeldung ab.

## CI-Workflow

- Workflow: `.github/workflows/app-e2e.yml`
- Startet dieselben Services via Docker Compose
- führt `pnpm nx run sva-studio-react:test:e2e` aus
- lädt den Playwright-Report als Artifact hoch
