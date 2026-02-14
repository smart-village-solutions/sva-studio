# 03 Kontext und Scope

## Zweck

Dieser Abschnitt beschreibt Systemgrenzen, externe Schnittstellen und den
aktuellen fachlich-technischen Scope.

## Mindestinhalte

- Fachlicher Scope und Out-of-Scope
- Kontextsicht mit externen Systemen und Integrationen
- Verantwortungsgrenzen (intern/extern)

## Aktueller Stand

### Fachlicher Kontext (nur Kontext)

Im Produktkontext adressiert SVA Studio die Verwaltung strukturierter Inhalte und Konfigurationen fuer die Smart Village App und angrenzende Kanaele (Headless/API-first).
Im aktuellen Repo-Ist-Stand sind primaer technische Grundlagen fuer Routing, Demo-Flows und Paketstruktur umgesetzt.

### In Scope (IST)

- Web-App `sva-studio-react` mit TanStack Start
- Routing-Komposition ueber `@sva/core` und `@sva/plugin-example`
- Demo-Server-Functions in der App (`createServerFn`)
- Einfacher DataClient mit In-Memory-Cache in `@sva/data`
- Architektur- und Governance-Dokumentation unter `docs/` und `openspec/`

### Out of Scope (in diesem Repo)

- Betrieb und Quellcode eines externen IdP
- Produktive Auth-/Session-Implementierung als stabiles Paket
- Produktiver Monitoring-Stack (Collector/Loki/Prometheus/Grafana) im Repository
- Vollstaendige Fachverfahren-Integrationen

### Externe Nachbarsysteme

- HTTP-Backends, die vom DataClient aufgerufen werden
- Externe Plattformen fuer CI/CD und Code-Hosting (GitHub)

Konzept-Referenz (Kontext): `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md`

### Verantwortungsgrenzen

- Repo verantwortet App-, Paket-, Build-/Test- und Doku-Logik
- Externe Dienste werden angebunden, aber nicht in diesem Repository betrieben

Referenzen:

- `apps/sva-studio-react/src/router.tsx`
- `apps/sva-studio-react/src/routes/-core-routes.tsx`
- `packages/data/src/index.ts`
- `.github/workflows/test-coverage.yml`
