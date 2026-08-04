## MODIFIED Requirements

### Requirement: Featured Projects besitzen einen eigenständigen Plugin- und IAM-Vertrag

Das System MUST `@sva/plugin-projects` als eigenständiges Plugin mit den Actions `projects.read`, `projects.create`, `projects.update` und `projects.delete` registrieren. Der fachliche Projekte-Pfad darf keine Generic-Items-, FAQ- oder Cockpit-Cards-Actions wiederverwenden. Unabhängig davon MUST der technische Generic-Items-Pfad denselben zugrunde liegenden Mainserver-Datensatz ausschließlich anhand von `generic-items.*` autorisieren dürfen.

#### Scenario: Fachliche Projekte-Berechtigungen werden getrennt ausgewertet

- **WHEN** der Host eine Operation über den fachlichen Projekte-Pfad autorisiert
- **THEN** prüft er die passende Action im Namespace `projects`
- **AND** gewährt eine Generic-Items-, FAQ- oder Cockpit-Cards-Berechtigung allein auf diesem Pfad keinen Zugriff

#### Scenario: Generischer Zugriff auf ein Featured Project

- **GIVEN** ein Mainserver-GenericItem besitzt `genericType` gleich `FeaturedProject`
- **WHEN** der Host eine Operation über den generischen Generic-Items-Pfad autorisiert
- **THEN** prüft er ausschließlich die passende Action im Namespace `generic-items`
- **AND** verlangt keine zusätzliche Action im Namespace `projects`

