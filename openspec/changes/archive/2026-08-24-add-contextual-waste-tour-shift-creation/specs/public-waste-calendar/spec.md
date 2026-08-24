## ADDED Requirements

### Requirement: Öffentliche Waste-Terminprojektion verwendet dieselbe wirksame Tourverschiebung

Das System SHALL für öffentliche Kalender-, PDF- und iCal-Ausgaben dieselbe framework-agnostische Auswahlregel für tourbezogene Ausweichtermine verwenden wie Studio und Mainserver-Materialisierung.

#### Scenario: Jahresbezogene Ausnahme verdrängt die jährliche Grundregel

- **GIVEN** für eine Tour gilt eine jahresunabhängige Grundregel an einem Monat und Tag
- **WHEN** für ein konkretes Jahr zusätzlich eine jahresbezogene Ausnahme am selben Ursprung existiert
- **THEN** zeigt die öffentliche Terminprojektion in diesem Jahr ausschließlich das Ergebnis der jahresbezogenen Ausnahme
- **AND** wendet die jährliche Grundregel nicht zusätzlich an
- **AND** Kalenderansicht, PDF und iCal bleiben zueinander konsistent

#### Scenario: Öffentliche Projektion bleibt zeitzonenunabhängig

- **WHEN** öffentliche Kalenderdaten unter unterschiedlichen Prozesszeitzonen materialisiert werden
- **THEN** bleiben Original- und Zieldatum als ISO-Kalenderdaten identisch
- **AND** Sommer- oder Winterzeit verändert keinen Abholtag
