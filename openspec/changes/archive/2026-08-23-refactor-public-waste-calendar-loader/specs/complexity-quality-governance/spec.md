## ADDED Requirements

### Requirement: Kritische öffentliche Datenlader trennen I/O von Ableitung

Das System SHALL bei kritischen öffentlichen Datenladern den parametrisierten
Datenzugriff von I/O-freier Normalisierung und fachlicher Ergebnisableitung trennen,
ohne dafür öffentliche Vertragsflächen zu vergrößern.

#### Scenario: Öffentlicher Loader wird entflechtet

- **WHEN** ein öffentlicher Datenlader als kritischer Komplexitäts-Hotspot refaktoriert wird
- **THEN** bleiben SQL-, Schema- und Fehlergrenzen in der serverseitigen I/O-Schicht
- **AND** deterministische Normalisierung und Zusammenführung sind unabhängig vom Datenbanktransport testbar
- **AND** die bestehende öffentliche Repository-Fassade bleibt für ihre Konsumenten stabil
