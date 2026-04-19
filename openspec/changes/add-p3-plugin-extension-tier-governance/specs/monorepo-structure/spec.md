## ADDED Requirements

### Requirement: Workspace-Packages werden nach Erweiterungstiefe klassifiziert

Das System SHALL pluginbezogene Workspace-Packages nach definierter Erweiterungstiefe klassifizieren.

#### Scenario: Fachpackage bleibt auf niedriger Erweiterungstiefe

- **WHEN** ein normales Fachpackage im Workspace registriert wird
- **THEN** erhält es nur die für diese Klasse zulässigen Host-Oberflächen
- **AND** plattformnahe Fähigkeiten werden ihm nicht implizit eingeräumt

#### Scenario: Plattformnahes Package benötigt engere Governance

- **WHEN** ein Package hostnahe oder plattformkritische Fähigkeiten benötigt
- **THEN** wird es einer höheren Erweiterungstiefe zugeordnet
- **AND** strengere Governance- und Review-Anforderungen greifen
