## ADDED Requirements

### Requirement: Kritische Auth- und Registry-Module ratcheten auf den globalen Coverage-Zielwert

Das System SHALL für kritische Auth-, Registry- und Routing-Module einen dokumentierten Ratcheting-Pfad auf den globalen Coverage-Zielwert bereitstellen, statt abgesenkte Floors dauerhaft beizubehalten.

#### Scenario: Kritisches Modul liegt noch unter dem Zielwert

- **GIVEN** ein kritisches Modul hat einen temporär niedrigeren Coverage-Floor als den globalen Zielwert
- **WHEN** die Coverage-Policy gepflegt wird
- **THEN** dokumentiert sie Zwischenstufen, Begründung und Abbaupfad bis zum Zielwert
- **AND** der Floor wird nicht stillschweigend auf unbestimmte Zeit als Endzustand akzeptiert

#### Scenario: Kritisches Modul verbessert seine Coverage

- **GIVEN** ein kritisches Modul stabil über seinem aktuellen Zwischenwert liegt
- **WHEN** die Policy überprüft wird
- **THEN** ratchetet der definierte Floor nach oben
- **AND** abgesenkte Floors werden nicht aus Bequemlichkeit erneut erweitert
