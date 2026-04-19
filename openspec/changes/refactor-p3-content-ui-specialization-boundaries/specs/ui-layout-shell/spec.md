## ADDED Requirements

### Requirement: Fachlich spezialisierte Content-Views respektieren die gemeinsame Shell

Das System SHALL auch für spezialisierte Content-Views die gemeinsame Layout-Shell und deren Seitenmuster beibehalten.

#### Scenario: Spezialansicht bleibt im Shell-Rahmen

- **WHEN** eine spezialisierte Content-Ansicht gerendert wird
- **THEN** nutzt sie weiterhin die gemeinsame Shell, Breadcrumbs und Seitenstruktur
- **AND** fachliche Spezialisierung führt nicht zu einem konkurrierenden Layout-Grundmuster
