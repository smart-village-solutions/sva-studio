## ADDED Requirements

### Requirement: Öffentliche Reminder-Konfiguration wird kanonisch und fail-closed normalisiert

Das System SHALL die öffentliche E-Mail-Reminder-Konfiguration ausschließlich dann bereitstellen, wenn alle bestehenden Pflichtfelder und explizit gesetzten optionalen Felder ihren jeweiligen Typ-, URL-, Pfad-, Adress- und Grenzwertvertrag erfüllen.

#### Scenario: Gültige Konfiguration wird kanonisch ausgegeben

- **WHEN** eine vollständige oder zulässig minimale Reminder-Konfiguration gelesen oder geschrieben wird
- **THEN** normalisiert das System Whitespace, URLs und optionale Felder nach dem bestehenden Vertrag
- **AND** bleibt die öffentliche Ausgabe semantik- und serialisierungsgleich

#### Scenario: Ungültige Konfiguration bleibt fail-closed

- **WHEN** ein Pflichtfeld fehlt oder ein gesetztes Pflicht- oder Optionalfeld den bestehenden Vertrag verletzt
- **THEN** stellt das System keine lesbare Reminder-Konfiguration bereit
- **AND** führt keine neuen Defaults oder Fallbackwerte ein

#### Scenario: Unbekannte Felder und Secrets bleiben außerhalb des normalisierten Objekts

- **WHEN** die Eingabe unbekannte Felder oder Secret-Werte enthält
- **THEN** übernimmt das System sie nicht in das normalisierte Reminder-Konfigurationsobjekt
- **AND** bleibt das Signing-Secret ausschließlich über die bestehende, an eine gültige Konfiguration gebundene Secret-Grenze lesbar
