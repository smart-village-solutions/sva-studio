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

Im Produktkontext adressiert SVA Studio die Verwaltung strukturierter Inhalte, Instanz- und IAM-Konfigurationen sowie ausgewählter Fachmodule für die Smart Village App und angrenzende Kanäle (Headless/API-first).
Der aktuelle Repo-Ist-Stand ist kein reines Fundament mehr: Neben Routing, Auth, Observability und Betriebsartefakten sind produktive Admin-Flächen für IAM, Instanzen, Medien, Mainserver-Content-Plugins und Waste-Management sowie eine separate öffentliche Waste-Weboberfläche umgesetzt.

### In Scope (IST)

- Web-App `sva-studio-react` mit TanStack Start
- Öffentliche Web-App `public-waste-calendar-web` als eigenständige, iFrame-taugliche Bürgeroberfläche für Abfallkalenderdaten
- Interne Hilfs-App `project-report` für lokale, read-only Projektstatusdarstellung
- Zentrales Routing (`@sva/core`, `@sva/routing`, `@sva/plugin-...`-Routen)
- Auth-BFF-Endpunkte (`/auth/login`, `/auth/callback`, `/auth/me`, `/auth/logout`)
- Session-Verwaltung mit Redis (inkl. optionaler Token-Verschlüsselung)
- IAM-Admin- und Governance-Flächen inklusive Rollen, Gruppen, DSR, Kontoregeln und Tenant-IAM-Diagnostik
- Instanz-Registry und Provisioning-Control-Plane für Root-Host-Administration
- Hostseitiges Medienmanagement über `/admin/media` mit S3-/MinIO-kompatibler Storage-Anbindung
- Per-User-Integration zum externen SVA-Mainserver über `@sva/sva-mainserver`
- Statische Workspace-Plugins `categories`, `news`, `events`, `poi` und `waste-management`
- Hostgeführte Mainserver-Fassaden für News, Events, POI und Kategorien
- Hostgeführte Waste-Fassade `/api/v1/waste-management/*`, generische Plugin-Jobpfade und Mainserver-Sync für `wasteTypes`
- Instanzgebundene Mainserver-Endpunktkonfiguration in der Studio-Datenbank
- Öffentliche Read-, PDF- und iCal-Pfade der Waste-Web-App mit eigener Node-Runtime
- Öffentliche Write-Pfade der Waste-Web-App ausschließlich für E-Mail-Erinnerungen mit Double-Opt-In, Abmeldung und Waste-eigener Reminder-Outbox
- `@sva/server-runtime` und `@sva/monitoring-client` für Logging, OTEL und lokale Monitoring-Stacks

### Out of Scope (in diesem Repo)

- Betrieb und Quellcode des externen IdP (Keycloak Realm/Server)
- Mobile App / externe Konsumenten
- Vollständige Fachverfahren-Integrationen außerhalb der aktuell angebundenen Mainserver-, Waste- und IAM-Domänen
- Allgemeines Runtime-Loading installierter Plugin-Distributionen; der produktive Host nutzt weiterhin einen statischen Workspace-Katalog
- Allgemeine öffentliche Schreibpfade für Bürgerflows außerhalb des E-Mail-Erinnerungsdienstes; die Waste-Web-App bleibt gegenüber den fachlichen Waste-Stammdaten weiterhin schreibgeschützt

### Externe Nachbarsysteme

- OIDC Provider (per `openid-client`)
- SVA-Mainserver mit OAuth2-Token-Endpunkt und GraphQL-API
- MinIO als S3-kompatibler Objektspeicher für hostseitige Medienoriginale und Varianten
- Redis (lokal/extern)
- OTEL Collector, Loki, Prometheus, Grafana, Alertmanager

Konzept-Referenz (Kontext): `concepts/konzeption-cms-v2/01_Einleitung/Einleitung.md`

### Verantwortungsgrenzen

- Repo verantwortet App-, Routing-, Auth-, IAM-, Instanz-, Plugin-, Mainserver-, Waste- und Doku-Logik
- Die öffentliche Abfallkalender-App bleibt fachlich im selben Repo, aber technisch von der Studio-Admin-Oberfläche getrennt und nutzt dafür nur app-lokale Auswahl-, Kalender- und Präferenzlogik.
- Die öffentliche Abfallkalender-App nutzt für ihren Serverpfad bewusst gemeinsame Workspace-Verträge aus `@sva/core` und `@sva/data-repositories`, bleibt aber deploy- und UI-seitig von `sva-studio-react` getrennt.
- Der öffentliche E-Mail-Erinnerungsdienst bleibt fachlich Teil von Waste: CTA, Formular, Double-Opt-In, Tokenseiten, Reminder-Materialisierung und Outbox liegen im Waste-Kontext; technische SMTP- oder Provider-Credentials liegen dagegen ausschließlich in der zentralen Schnittstelle `mail_transport`.
- Der eigentliche Mailversand ist bewusst an eine separate Dispatch-App oder einen äquivalenten Runtime-Adapter anschließbar; Studio und Public-Waste-App materialisieren dafür nur transportagnostische Versandaufträge.
- Repo verantwortet die serverseitige Delegation an den externen SVA-Mainserver, aber nicht dessen Betrieb, Schema oder Berechtigungsmodell
- Browser, React-Hooks und UI-Komponenten sprechen nie direkt mit dem externen Mainserver; alle Aufrufe laufen über serverseitige Studio-Bausteine
- Browser, Plugins und Fachmodule sprechen nie direkt mit MinIO oder S3-kompatiblen Clients; Medienzugriffe laufen über hostseitige Media-Endpunkte und interne Storage-Ports
- Browser der öffentlichen Abfallkalender-App sprechen weder das Studio-Plugin noch Supabase direkt an; die öffentliche Runtime kapselt Auswahlfluss, Kalenderprojektion, Präferenz-Cookie sowie PDF- und iCal-Exportpfade lokal in `apps/public-waste-calendar-web`.
- Keycloak bleibt autoritative Quelle für per-User hinterlegte Mainserver-Credentials; die Studio-DB hält nur instanzbezogene Endpunktkonfiguration
- Externe Dienste werden angebunden, aber nicht hier implementiert

Referenzen:

- `packages/auth-runtime/src/oidc.ts`
- `packages/auth-runtime/src/redis.ts`
- `packages/sva-mainserver/src/server/service.ts`
- `packages/data-repositories/src/integrations/instance-integrations.ts`
- `docker-compose.yml`
- `compose.monitoring.yaml`
