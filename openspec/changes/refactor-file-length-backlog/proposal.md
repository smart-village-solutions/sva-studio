# Change: Bestehende Dateilängenüberschreitungen schrittweise abbauen

## Why

Das `complexity-gate` meldet auf `origin/main` (`64215aa9`, Stand 02.10.2026)
164 aktuelle `fileLines`-Überschreitungen in 2.687 ausgewerteten Dateien. Die
Grenzen liegen je nach Modul bei 260, 320 oder 400 Zeilen. Die Befunde sind
bereits registriert; ein grünes Gate bedeutet hier noch nicht, dass die
Bestandslast beseitigt ist. Ein einziger Refactoring-PR wäre schwer prüfbar,
eine Aufteilung nach Einzeldateien würde zusammengehörige Verantwortung
zerreißen und unnötige Reviewkosten erzeugen.

## What Changes

- Der bestehende `fileLines`-Backlog wird in zehn Verantwortungsbereiche und
  mehrere eigenständig prüfbare PR-Abschnitte zerlegt. Die Reihenfolge und
  Startgrenzen stehen in `design.md` und `tasks.md`.
- Jeder Abschnitt reduziert die Zahl der aktuellen `fileLines`-Befunde und
  hält öffentliche Verträge, Laufzeitverhalten und fachliche Ownership stabil.
- Vor einem Abschnitt werden die betroffenen Findings gegen das dann aktuelle
  `origin/main` neu gemessen und mit laufenden Changes abgeglichen. Dadurch
  werden inzwischen erledigte oder verschobene Dateien nicht erneut bearbeitet.
- Erledigte `fileLines`-Einträge werden aus `trackedFindings` entfernt. Die
  bestehenden Schwellen, Ausschlüsse und die Baseline bleiben unverändert,
  sofern ein gesondert freigegebener Policy-Prozess etwas anderes beschließt.
- Ein Portfolio-Fortschritt wird durch die Zahl aktueller `fileLines`-Verstöße
  und den konkreten PR-Nachweis gemessen, nicht durch die Zahl neu entstandener
  Dateien oder abgeschlossener Tickets.

## Scope

- Produktive TypeScript-/TSX-Dateien, die durch die bestehende
  `tooling/quality/complexity-policy.json` in `apps/`, `packages/` und
  `scripts/` erfasst werden.
- Alle 164 zum Ausgangsstand aktuellen `fileLines`-Befunde sowie zwischenzeitlich
  auftretende neue Befunde in diesem Scope.
- Eng benachbarte Tests, Exporte und aktuelle Architektur-/Entwicklungsdoku,
  soweit ein konkreter Refactoring-Abschnitt sie berührt.

## Out of Scope

- Neue Produktfunktionen, fachliche Verhaltensänderungen, API-/DB-Migrationen
  und neue Qualitäts-Gates oder Abstraktionsschichten.
- Testdateien, generierte Artefakte und andere Pfade, die die bestehende
  Policy ausdrücklich ausschließt. Eine Ausweitung des Mess-Scopes wäre eine
  eigene Qualitätsentscheidung.
- Pauschales Anheben von Limits, Neuschreiben der Baseline oder neue
  Exemptions zur rechnerischen Verringerung des Backlogs.
- Ein über alle Abschnitte gestapelter Implementierungs-PR. Dieser Change
  beschreibt das Portfolio; jeder Lieferabschnitt erhält einen eigenen,
  direkt auf dem aktuellen `main` basierenden PR.

## Impact

- Affected spec: `complexity-quality-governance`.
- Affected code: die in `design.md` benannten Bereiche unter `apps/`,
  `packages/` und `scripts/`; `tooling/quality/complexity-policy.json` nur zum
  Entfernen tatsächlich erledigter Findings.
- Affected arc42 sections bei späteren Implementierungs-PRs:
  `05-building-block-view` für geänderte Modulgrenzen,
  `08-cross-cutting-concepts` für Querschnittspfade,
  `10-quality-requirements` und `11-risks-and-technical-debt` für gemessene
  Qualität und Restschuld. Bei IAM-/Security-Schnitten zusätzlich die in
  `docs/architecture/README.md` vorgeschriebenen Abschnitte 04, 05, 06 und 08
  prüfen.

## Completion

- `pnpm complexity-gate` wertet den gesamten definierten Scope aus und meldet
  **null aktuelle `fileLines`-Verstöße**, unabhängig davon, ob sie zuvor
  registriert waren.
- Es bleiben keine verwaisten `fileLines`-Einträge in `trackedFindings`.
- Jeder Liefer-PR belegt seine Verhaltensparität mit den für seinen Pfad
  nötigen gezielten Tests und Pflicht-Gates; kritische Invarianten erhalten
  den jeweils passenden Nachweis am exakten PR-HEAD.
- Die übrigen Komplexitätsmetriken verschlechtern sich nicht durch bloßes
  Verschieben oder Duplizieren von Code. Zusätzliche Findings werden nicht als
  Erfolg des Dateilängenprogramms gewertet.
