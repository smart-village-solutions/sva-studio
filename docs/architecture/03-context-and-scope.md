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

Im Produktkontext adressiert SVA Studio die Verwaltung strukturierter Inhalte und Konfigurationen für die Smart Village App und angrenzende Kanäle (Headless/API-first).
Im aktuellen Repo-Ist-Stand sind davon primär die technischen Grundlagen umgesetzt (Routing, Auth, Observability, lokale Betriebsartefakte).

### In Scope (IST)

- Web-App `sva-studio-react` mit TanStack Start
- Zentrales Routing (`@sva/core`, `@sva/routing`, `@sva/plugin-...`-Routen)
- Auth-BFF-Endpunkte (`/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout`)
- Session-Verwaltung mit Redis (inkl. optionaler Token-Verschlüsselung)
- Per-User-Integration zum externen SVA-Mainserver über `@sva/sva-mainserver`
- Instanzgebundene Mainserver-Endpunktkonfiguration in der Studio-Datenbank
- SDK Logger + OTEL Monitoring Client + lokale Monitoring-Stacks

### Out of Scope (in diesem Repo)

- Betrieb und Quellcode des externen IdP (Keycloak Realm/Server)
- Mobile App / externe Konsumenten
- Vollständige Fachverfahren-Integrationen
- Produkt-/Fachmodule (z. B. konkrete CMS-Content-Modelle) sind im Code derzeit nicht als stabile API/Implementierung vorhanden

### Externe Nachbarsysteme

- OIDC Provider (per `openid-client`)
- SVA-Mainserver mit OAuth2-Token-Endpunkt und GraphQL-API
- MinIO als S3-kompatibler Objektspeicher für hostseitige Medienoriginale und Varianten
- Redis (lokal/extern)
- OTEL Collector, Loki, Prometheus, Grafana, Alertmanager

Konzept-Referenz (Kontext): `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md`

### Verantwortungsgrenzen

- Repo verantwortet App-, Routing-, Auth-, SDK- und Doku-Logik
- Repo verantwortet die serverseitige Delegation an den externen SVA-Mainserver, aber nicht dessen Betrieb, Schema oder Berechtigungsmodell
- Browser, React-Hooks und UI-Komponenten sprechen nie direkt mit dem externen Mainserver; alle Aufrufe laufen über serverseitige Studio-Bausteine
- Browser, Plugins und Fachmodule sprechen nie direkt mit MinIO oder S3-kompatiblen Clients; Medienzugriffe laufen über hostseitige Media-Endpunkte und interne Storage-Ports
- Keycloak bleibt autoritative Quelle für per-User hinterlegte Mainserver-Credentials; die Studio-DB hält nur instanzbezogene Endpunktkonfiguration
- Externe Dienste werden angebunden, aber nicht hier implementiert

Referenzen:

- `packages/auth-runtime/src/oidc.ts`
- `packages/auth-runtime/src/redis.ts`
- `packages/sva-mainserver/src/server/service.ts`
- `packages/data/src/integrations/instance-integrations.ts`
- `docker-compose.yml`
- `docker-compose.monitoring.yml`
