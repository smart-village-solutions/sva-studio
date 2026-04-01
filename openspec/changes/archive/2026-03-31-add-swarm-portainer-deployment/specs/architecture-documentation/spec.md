## MODIFIED Requirements

### Requirement: Nachvollziehbare Architekturentscheidungen

Das System SHALL Architekturentscheidungen mit Kontext, Begründung und Auswirkungen dokumentieren.

#### Scenario: Änderung mit Architekturwirkung

- **WHEN** ein OpenSpec-Change mit Architekturwirkung erstellt wird
- **THEN** referenziert der Change die betroffenen arc42-Abschnitte
- **AND** die Entscheidung ist für Reviewer nachvollziehbar dokumentiert
- **AND** Betriebsannahmen zu Deployment-Topologie, Ingress und Konfigurationsmanagement werden explizit benannt

#### Scenario: Deployment- und Auth-Grenzen mit Architekturwirkung

- **WHEN** ein Change Deployment-Topologie, Host-Ableitung oder Auth-Grenzen verändert
- **THEN** referenziert der Change mindestens Bausteinsicht, Laufzeitsicht, Verteilungssicht, Querschnittskonzepte, Architekturentscheidungen, Qualitätsanforderungen und Risiken
- **AND** dokumentiert, ob eine neue ADR erforderlich ist oder welche bestehende ADR fortgeschrieben wird
