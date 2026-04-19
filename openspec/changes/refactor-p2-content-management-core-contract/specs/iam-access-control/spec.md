## ADDED Requirements

### Requirement: Autorisierung baut auf hostgeführtem Content-Kern auf

Das System SHALL Autorisierung für Inhalte auf hostgeführte Kernsemantik stützen und nicht auf verstreute fachliche Sonderlogik.

#### Scenario: Inhalt bleibt über Kernsemantik autorisierbar

- **WHEN** ein Inhalt autorisiert wird
- **THEN** erfolgt die Sicherheitslogik auf Basis stabiler hostgeführter Kernsemantik
- **AND** pluginseitige Fachspezialisierung ersetzt diesen Bezugspunkt nicht
