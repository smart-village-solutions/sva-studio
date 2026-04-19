## ADDED Requirements

### Requirement: Routing-Oberflächen hängen von der Erweiterungstiefe des Packages ab

Das System SHALL zulässige Routing-Oberflächen an die Erweiterungstiefe eines Packages koppeln.

#### Scenario: Normales Fachpackage erhält keine plattformnahen Routing-Hooks

- **WHEN** ein normales Fachpackage Routen beisteuert
- **THEN** nutzt es nur die regulären deklarativen Routing-Oberflächen
- **AND** tiefergehende Host- oder Infrastruktur-Hooks bleiben höheren Klassen vorbehalten
