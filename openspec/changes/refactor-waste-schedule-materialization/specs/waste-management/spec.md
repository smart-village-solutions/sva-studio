## ADDED Requirements

### Requirement: Waste-Management persistiert materialisierte Tourtermine für den Mainserver-Sync

Das System SHALL die aus dem bestehenden Termin- und Verschiebungsmodell berechneten Tourtermine als instanzbezogenen Snapshot für das laufende und folgende Kalenderjahr persistieren.

#### Scenario: Materialisierung ersetzt das vollständige Jahrfenster idempotent

- **WHEN** die Materialisierung für eine Instanz startet
- **THEN** berechnet das System Termine ausschließlich aus den bestehenden Tour-, globalen und Feiertagsverschiebungen
- **AND** ersetzt den Snapshot für das laufende und folgende Kalenderjahr atomar und ohne Duplikate
- **AND** speichert Materialisierungszeitpunkt und Jahrfenster nachvollziehbar mit dem Snapshot

#### Scenario: Mainserver-Sync transportiert ausschließlich den aktuellen Snapshot

- **WHEN** ein Mainserver-Sync gestartet wird
- **THEN** aktualisiert das System zuerst den Snapshot für das definierte Jahrfenster
- **AND** verwendet der Transport ausschließlich die danach persistierten Snapshot-Termine
- **AND** bei einem Fehler der Snapshot-Aktualisierung startet kein Transport
