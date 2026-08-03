# Change: `plugin-surveys` als normales Content-Plugin einführen

## Why

SVA Studio soll ein neues Umfrage-Modul erhalten, das sich in die bestehende Content-Plugin-Architektur einfügt und über die vorhandene SVA-Mainserver-GraphQL-Integration arbeitet. Die fachliche Zielquelle ist das aktuellere Wunsch-Schema für Umfragen, nicht das ältere Issue.

## What Changes

- Einführung eines neuen Content-Plugins `@sva/plugin-surveys` im Standardpfad der Plugin-Architektur
- Integration von Umfragen in die bestehende Inhaltsübersicht und den Flow `Neuer Inhalt`
- Definition eines schlanken Survey-Berechtigungsmodells auf Basis des Standard-Content-Musters mit gezielten Erweiterungen für Moderation und Export
- Anbindung an neue Mainserver-GraphQL-Queries und -Mutations für Surveys
- Aufbau einer Studio-UI für Liste, Erstellen und Bearbeiten mit stabiler Tab-Struktur `Basis`, `Inhalt`, `Moderation`, `Ergebnisse`, `Historie`
- Vereinfachung des fachlichen Survey-Statusmodells auf `DRAFT`, `ACTIVE` und `ARCHIVED`
- Entfernung von `allowsMultipleSubmissionsPerDevice` aus dem gewünschten Survey-Zielschema

## Impact

- Affected specs:
  - `content-management`
  - `sva-mainserver-integration`
  - `plugin-surveys` (neu)
- Affected code:
  - `packages/plugin-surveys/`
  - `packages/sva-mainserver/`
  - `apps/sva-studio-react/`
  - `packages/plugin-sdk/` nur falls bestehende Standard-Content-Helfer fuer Surveys nicht ausreichen
- Affected arc42 sections:
  - `docs/architecture/05-building-block-view.md`
  - `docs/architecture/08-cross-cutting-concepts.md`
  - `docs/architecture/09-architecture-decisions.md`
