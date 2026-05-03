# @sva/sva-mainserver

Serverseitige Integrationsschicht für den externen SVA-Mainserver mit typsicherer Public API für News-, Event- und POI-Daten sowie getrenntem Runtime-Einstieg für Node.

## Architektur-Rolle

`@sva/sva-mainserver` kapselt die Kommunikation mit einer instanzspezifischen SVA-Mainserver-Anbindung. Das Package trennt dabei bewusst zwischen:

- rein typbasierten Imports aus `@sva/sva-mainserver`
- serverseitiger Laufzeitlogik aus `@sva/sva-mainserver/server`

Die Server-Schicht übernimmt das Laden und Validieren der Instanzkonfiguration, die Credential-Auflösung über Keycloak, den OAuth2-Tokenabruf sowie den GraphQL-Transport inklusive Fehlerabbildung, Logging und Observability.

## Öffentliche API

### `@sva/sva-mainserver`

Der Default-Entry exportiert ausschließlich Typen für:

- Verbindungs- und Konfigurationsobjekte wie `SvaMainserverConnectionInput` und `SvaMainserverInstanceConfig`
- Listen- und Paginierungsmodelle
- domänenspezifische Datenmodelle für News, Events, POIs, Kategorien, Adressen und Payloads
- standardisierte Fehlercodes für die Integration

### `@sva/sva-mainserver/server`

Der Server-Entry exportiert die Laufzeit-API für:

- Konfigurationsfehler über `SvaMainserverError`
- Laden und Speichern instanzbezogener Einstellungen
- Laden der aktiven Instanzkonfiguration mit Validierung
- Erzeugen des Services über `createSvaMainserverService`
- direkte Helper für Verbindungsdiagnostik sowie CRUD-Operationen auf News, Events und POIs

## Nutzung und Integration

Client- und Shared-Code sollen nur Typen aus `@sva/sva-mainserver` importieren. Serverseitige Aufrufer verwenden `@sva/sva-mainserver/server`, wenn sie:

- die Mainserver-Konfiguration einer Instanz lesen oder speichern
- den Verbindungsstatus prüfen wollen
- News, Events oder POIs über die GraphQL-Schnittstelle listen, lesen, anlegen, aktualisieren oder löschen

Die Laufzeitintegration setzt gültige Instanzdaten aus dem Integrations-Repository sowie auflösbare Zugangsdaten aus der Auth-Runtime voraus. Relative Runtime-Imports bleiben Node-ESM-strikt mit expliziten `.js`-Endungen.

## Projektstruktur

```text
packages/sva-mainserver/
|- src/
|  |- index.ts                # öffentlicher Typ-Entry
|  |- index.server.ts         # serverseitiger Runtime-Entry
|  |- types.ts                # gemeinsame Typmodelle
|  |- generated/              # generierte GraphQL-Dokumente und Schemasnapshot
|  `- server/
|     |- service.ts           # Hauptservice für Diagnose und CRUD-Aufrufe
|     |- settings.ts          # Laden/Speichern der Integrationseinstellungen
|     |- config-store.ts      # Laden und Validieren der aktiven Instanzkonfiguration
|     |- upstream-url-validation.ts
|     `- errors.ts
|- package.json
|- project.json
`- vitest.config.ts
```

## Nx-Konfiguration

Das Projekt ist als Nx-Library `sva-mainserver` registriert und verwendet folgende Targets:

- `build`: TypeScript-Build über `tsc -p packages/sva-mainserver/tsconfig.lib.json`
- `check:runtime`: Node-ESM-Guard für serverseitige Runtime-Imports nach dem Build
- `lint`: ESLint für den Quellcode unter `src/`
- `test:unit`: Vitest-Unit-Tests mit projektspezifischer Konfiguration
- `test:coverage`: Vitest mit Coverage-Auswertung

Die Paket-Exports in `package.json` trennen explizit zwischen dem Typ-Entry `.` und dem Runtime-Entry `./server`.

## Verwandte Dokumentation

- [Architekturübersicht](../../docs/architecture/README.md)
- [Development Rules](../../DEVELOPMENT_RULES.md)
