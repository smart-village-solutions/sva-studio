## ADDED Requirements

### Requirement: Featured Projects besitzen einen eigenständigen Plugin- und IAM-Vertrag

Das System MUST `@sva/plugin-projects` als eigenständiges Plugin mit den Actions `projects.read`, `projects.create`, `projects.update` und `projects.delete` registrieren. Projekte dürfen nicht die Generic-Items-, FAQ- oder Cockpit-Cards-Actions wiederverwenden.

#### Scenario: Projekte-Berechtigungen werden getrennt ausgewertet

- **WHEN** der Host eine Projekte-Operation autorisiert
- **THEN** prüft er die passende Action im Namespace `projects`
- **AND** gewährt eine Generic-Items-, FAQ- oder Cockpit-Cards-Berechtigung allein keinen Zugriff

### Requirement: Das Projekte-Plugin bleibt unabhängig vom Generic-Items-Plugin

Das System MUST das Projekte-Plugin als eigenständiges Workspace-Package betreiben. Eine einmalige Ableitung aus dem Generic-Items-Quellstand darf keine Runtime-Abhängigkeit, Vererbung oder automatische Synchronisierung zwischen den Fachplugins erzeugen.

#### Scenario: Generic-Items-Plugin ändert sich unabhängig

- **WHEN** das Generic-Items-Plugin später geändert wird
- **THEN** verändert sich das Verhalten des Projekte-Plugins nicht automatisch
- **AND** bleiben projektspezifische UI, Validierung und Verträge pluginlokal kontrolliert

