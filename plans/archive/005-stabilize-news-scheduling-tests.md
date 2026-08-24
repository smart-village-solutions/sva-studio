# Plan 005: News-Scheduling-Tests vom Kalenderdatum entkoppeln

> **Archivstatus:** DONE

## Status

- Status: DONE
- Priorität: BLOCKER
- Aufwand: S
- Risiko: LOW
- Abhängigkeit: keine; Voraussetzung für Plan 001
- Kategorie: Teststabilität
- Geplant bei: `5d57965dfe966a77f66aa0a955ca94a3d7cf0642`, 2026-08-15
- Ausgeliefert mit: PR #988, Merge-Commit
  `c93b4d6d54bee0dfeb79bd2130ea20e7717a3fd4`

## Ziel und Ist-Zustand

Zwei Tests in `packages/plugin-news/tests/news.pages.test.tsx` erwarten einen
zeitgesteuerten Zustand, verwenden aber `2026-08-14T09:30:00.000Z` als
vermeintlich zukünftigen Zeitpunkt. Seit dem 15. August klassifiziert die
Produktlogik diesen Wert korrekt als veröffentlicht. Derselbe Fehler ist auf
der unveränderten Basis reproduziert und blockiert den Required-Unit-Check von
PR #986.

## Scope und Vorgehen

- ausschließlich die zwei betroffenen Test-Fixtures und ihre erwarteten
  `datetime-local`-Werte auf ein stabil zukünftiges Datum umstellen,
- keine Produktlogik, Zeitzonenfunktion, Statusableitung oder Übersetzung ändern,
- fokussierte Testdatei und vollständige News-Unit-Suite ausführen,
- News-Types, Changelog-Gate und diff-check ausführen,
- eigener PR, Merge vor Aktualisierung von PR #986.

## Verifikation

```bash
pnpm nx run plugin-news:test:unit --testFiles=tests/news.pages.test.tsx
pnpm nx run plugin-news:test:unit
pnpm nx run plugin-news:test:types
pnpm check:file-placement
```

## Fertig, wenn

- beide Tests unabhängig vom aktuellen Datum grün sind,
- die vollständige News-Suite grün ist,
- ausschließlich Testdaten, Changelog und nötige PR-Metadaten geändert sind,
- der eigene PR SHA-genau grün und ohne offene Threads gemergt ist.

## STOP-Bedingungen

- Eine Produktcodeänderung wäre erforderlich.
- Der Fehler ist mit identischem Befehl auf der Basis nicht mehr reproduzierbar.
