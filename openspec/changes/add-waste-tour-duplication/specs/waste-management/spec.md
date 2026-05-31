## ADDED Requirements
### Requirement: Waste-Management erlaubt das Duplizieren von Touren
Das System SHALL im Tourenbereich eine Duplizierungsaktion bereitstellen, die den bestehenden Create-Flow mit vorbelegten Tourdaten öffnet.

#### Scenario: Benutzer öffnet den Duplizieren-Flow
- **GIVEN** eine vorhandene Tour in der Tourentabelle
- **WHEN** ein berechtigter Benutzer die Aktion `Duplizieren` ausführt
- **THEN** öffnet das System den bestehenden Tour-Create-View
- **AND** das Formular ist mit den Stammdaten der Quell-Tour vorbelegt
- **AND** der Name erhält initial das Suffix ` (Kopie)`

### Requirement: Waste-Management kopiert abhängige Tour-Beziehungen erst nach dem Speichern
Das System SHALL Abholort-Zuordnungen und tourbezogene Datumsverschiebungen erst nach erfolgreichem Speichern der neuen Tour serverseitig übernehmen.

#### Scenario: UI erklärt die verzögerte Übernahme
- **WHEN** ein Benutzer den Create-View aus einem Duplizieren-Flow öffnet
- **THEN** sieht er vor den Save-Actions einen Hinweis zur erst nachgelagerten Übernahme der Zuordnungen

#### Scenario: Server dupliziert Beziehungen vollständig
- **WHEN** die neue Tour erfolgreich gespeichert wird
- **THEN** kopiert das System die Abholort-Zuordnungen und tourbezogenen Datumsverschiebungen der Quell-Tour auf die neue Tour
- **AND** die Original-Tour bleibt unverändert
- **AND** Teilerfolge sind nicht zulässig
