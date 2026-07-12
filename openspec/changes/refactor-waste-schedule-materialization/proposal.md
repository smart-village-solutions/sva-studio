# Change: Persistente Waste-Terminmaterialisierung auf Basis des bestehenden Regelmodells

## Why

Der Mainserver-Sync materialisiert Tourtermine bereits deterministisch aus den bestehenden Tour-, globalen und Feiertagsverschiebungen. Die Berechnung deckt das laufende und folgende Jahr ab, behandelt `single_pickup` und `rest_of_week` und wird vor dem Transport ausgeführt.

Das Ergebnis bleibt jedoch nur für den jeweiligen Sync-Lauf im Speicher. Für Betrieb, Diagnose und reproduzierbare Sync-Snapshots fehlt eine persistierte, instanzbezogene Sicht auf die tatsächlich übertragenen Termine.

## What Changes

- Das bestehende Regelmodell aus Tourverschiebungen, globalen Verschiebungen und Feiertagsregeln bleibt die fachliche Quelle; es wird kein zweites Regelmodell eingeführt und keine bestehende Regelpersistenz migriert.
- Die vorhandene Materialisierung wird für das laufende und folgende Kalenderjahr als idempotent ersetzbarer Snapshot persistiert.
- Der Mainserver-Sync aktualisiert den Snapshot vor dem Transport und liest die zu synchronisierenden Termine ausschließlich aus diesem Snapshot.
- Monitoring und Diagnose machen Zeitpunkt, Fenster und Anzahl der materialisierten Termine sichtbar.
- Die bestehende Berechnungssemantik und ihre Regressionstests bleiben erhalten; neue Tests sichern Persistenz, idempotente Ersetzung und die Snapshot-Nutzung im Sync.

## Impact

- Affected specs: `waste-management`.
- Affected code:
  - `apps/sva-studio-react/src/lib/waste-management-mainserver-sync.*`
  - `packages/data-repositories/src/waste-management/*`
  - `packages/data/src/waste-management/*`
  - Datenmigrationen sowie `docs/development/studio-db-schema-final.sql` und `docs/development/studio-db-schema.md`
- Architektur-/Schnittstellenwirkung:
  - Der Mainserver-Sync erhält einen reproduzierbaren, persistierten Eingabesnapshot.
  - Die bestehende Regelableitung bleibt unverändert und wird nicht durch ein paralleles Regelmodell ersetzt.
- Rollback:
  - Bei einem Fehler der Snapshot-Persistenz wird kein Transport gestartet.
  - Das Schema bleibt additiv; ein Rollback deaktiviert die Snapshot-Nutzung, ohne Tour- oder Verschiebungsdaten zu verändern.

## Scope

- Nicht enthalten: ein neues Regelmodell, die Migration von Shift-/Holiday-Tabellen oder eine Neuimplementierung der Regelbearbeitung in der UI.
- Nicht enthalten: automatische Nachrechnung über das laufende und folgende Jahr hinaus.
