# App E2E Integration Testing

Dieses Dokument beschreibt den reproduzierbaren Smoke-Test für die laufende App inklusive Docker-Service-Stack.

> Für den separaten IAM-Abnahmenachweis mit realem Keycloak-Login, JIT-Provisioning und Organisations-Smokes siehe `../guides/iam-acceptance-runbook.md`.

## Voraussetzungen

1. Docker Engine läuft lokal.
2. Node.js und pnpm sind installiert.
3. Für den wiederverwendeten Login-State sind Zugangsdaten in `apps/sva-studio-react/.env.local` oder als CI-Secrets verfügbar:

```env
PLAYWRIGHT_ROOT_BASE_URL=http://studio.localhost:4173
PLAYWRIGHT_ROOT_USERNAME=root-admin@example.org
PLAYWRIGHT_ROOT_PASSWORD=super-secret-root-password

PLAYWRIGHT_DE_MUSTERHAUSEN_BASE_URL=http://de-musterhausen.studio.localhost:4173
PLAYWRIGHT_DE_MUSTERHAUSEN_USERNAME=tenant-admin@example.org
PLAYWRIGHT_DE_MUSTERHAUSEN_PASSWORD=super-secret-tenant-password
```

`playwright/.auth/root-user.json` und `playwright/.auth/de-musterhausen-user.json` enthalten Cookies und Tokens und dürfen nicht committed werden.
4. Playwright Browser wurde installiert:

```bash
pnpm exec playwright install --with-deps chromium
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
  - `/interfaces`
- Authentifizierte clientseitige Navigation zur produktiven Plugin-Route `/plugins/news`
- Echter TanStack-Start-ServerFn-Transport:
  - `/interfaces` lädt die Übersicht über einen echten Request auf `/_server/...`
  - Die Smoke-Suite prüft explizit, dass keine HTML-Fallback-Antwort statt ServerFn-Transport zurückkommt
- Clientseitige Router-Navigation:
  - Navigation von `/` nach `/plugins/news` rendert die produktive Plugin-Route
  - Navigation von `/` nach `/interfaces` hält die Shell aktiv
  - Die Navigation erfolgt ohne Full Reload der gesamten App
- Auth-Entry-Point:
  - `/auth/login` liefert Redirect-Response (302/303/307/308)
- Service-Readiness vor Teststart:
  - Redis (`127.0.0.1:6379`)
  - Loki (`/ready`)
  - OTEL Collector (`127.0.0.1:13133`)
  - Promtail (`/ready`)

Wenn ein Service fehlt, bricht der Test früh mit klarer Fehlermeldung ab.

## Abgrenzung zum IAM-Acceptance-Gate

- Dieser Smoke prüft generische App-Routen, clientseitige Navigation und den echten `/_server`-Transport.
- Er ist bewusst von `pnpm nx run sva-studio-react:test:acceptance` getrennt.
- Der IAM-Acceptance-Lauf benötigt eine vereinbarte Testumgebung mit Keycloak-Testrealm, Testbenutzern und direktem Datenbankzugang.

## CI-Workflow

- Workflow: `.github/workflows/app-e2e.yml` (`App E2E`)
- Startet dieselben Services via Docker Compose
- startet die App über das Nx-Target `sva-studio-react:serve`
- injiziert `PLAYWRIGHT_ROOT_*` und `PLAYWRIGHT_DE_MUSTERHAUSEN_*` als Secrets/Variablen
- führt `pnpm nx run sva-studio-react:test:e2e` aus
- lädt den Playwright-Report als Artifact hoch
