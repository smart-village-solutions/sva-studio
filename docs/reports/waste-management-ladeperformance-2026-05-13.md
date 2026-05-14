# Waste-Management Ladeperformance

## Ziel

Die Waste-Management-Übersichten sollen ohne Änderungen an den öffentlichen HTTP-Verträgen schneller laden. Dafür wurden die teuersten internen Hot Paths reduziert.

## Umgesetzte Änderungen

### Wiederverwendete Datenbank-Pools

- Die Waste-Server-Loader in `packages/auth-runtime/src/waste-management/server-loaders.ts` erzeugen keine neuen `pg`-Pools mehr pro Request.
- Pools werden jetzt pro Waste-Datenquelle über `databaseUrl + schemaName` wiederverwendet.
- Fehlerhafte Pools werden bei Verbindungs- oder `search_path`-Fehlern invalidiert und beim nächsten Zugriff neu aufgebaut.
- Bulk-Zuordnungen für `locationTourLinks` nutzen denselben Pool-Mechanismus wie die normalen Loader.

### Entkoppelte UI-Loader

- `master-data` nutzt jetzt tab-spezifische Scopes:
  - `fractions` lädt nur Fraktionen
  - `locations` lädt nur den Orts- und Abholort-Kontext ohne Fraktionen
- `tours` blockiert initial nur noch auf `tours` und `fractions`.
- `scheduling` blockiert initial nur noch auf `scheduling`.
- Sekundäre Referenzdaten werden nach dem ersten erfolgreichen Laden nicht-blockierend nachgeladen:
  - `tours` lädt den Abholort-/Zuordnungskontext erst nach dem ersten Render
  - `locations` lädt Tour-Referenzen separat zur Stammdatenübersicht

### Rechteauflösung ohne Zusatz-Request

- Waste startet keinen separaten `GET /auth/me`-Request mehr nur für die Tab-Sichtbarkeit.
- Der globale `AuthProvider` publiziert die bereits geladene Session-Rechteinformation in einen kleinen Frontend-Session-Store.
- Das Waste-Plugin liest diese Information nur noch aus dem Shared-Store und vermeidet dadurch eine zusätzliche Rechteauflösung beim ersten Render.

## Beobachtbarkeit

- Für die Waste-Server-Loader werden Timing-Logs über den Server-Runtime-Logger geschrieben.
- Gemessen werden aktuell:
  - Datenquellen-Auflösung
  - Pool-Checkout
  - `search_path`-Setzung
  - Query-Ausführung der Waste-Overview-Loader

## Erwarteter Effekt

- Weniger Verbindungsaufbau gegen Supabase-Postgres
- Weniger parallele Waste-Overview-Requests beim ersten Render
- Schnellere wahrgenommene Ladezeit insbesondere für `fractions`, `tours` und `scheduling`
