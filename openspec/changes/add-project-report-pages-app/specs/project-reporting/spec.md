## ADDED Requirements
### Requirement: Öffentliche Reporting-App für Projektfortschritt
Das System SHALL eine eigenständige öffentliche Reporting-App bereitstellen, die den Projektfortschritt für Meilensteine und Arbeitspakete visualisiert.

#### Scenario: Reporting-App rendert öffentliche Projektsicht
- **WHEN** ein Nutzer die Reporting-App öffnet
- **THEN** sieht er ausschließlich öffentliche Projektdaten
- **AND** die Ansicht ist von der internen Studio-App getrennt

### Requirement: Zwei Hauptansichten für Fortschrittsdarstellung
Die Reporting-App SHALL zwei Hauptansichten bereitstellen: `Meilensteine` und `Arbeitspakete`.

#### Scenario: Nutzer wechselt zur Meilensteinansicht
- **WHEN** der Nutzer den Reiter `Meilensteine` aktiviert
- **THEN** zeigt die App aggregierte Fortschrittsinformationen pro Meilenstein
- **AND** jeder Meilenstein enthält einen Fortschrittsbalken

#### Scenario: Nutzer wechselt zur Arbeitspaketansicht
- **WHEN** der Nutzer den Reiter `Arbeitspakete` aktiviert
- **THEN** zeigt die App eine detaillierte Liste der Arbeitspakete
- **AND** jedes Arbeitspaket enthält einen Fortschrittsbalken

### Requirement: Filterbare und teilbare URL-Zustände
Die Reporting-App SHALL Filterzustände über URL-Search-Params modellieren, damit Ansichten direkt verlinkbar bleiben.

#### Scenario: Nutzer filtert nach Meilenstein und Status
- **WHEN** der Nutzer Filter für Meilenstein oder Status setzt
- **THEN** werden die Suchparameter in der URL aktualisiert
- **AND** ein erneutes Laden der Seite stellt dieselbe Sicht wieder her

### Requirement: Öffentliches Reporting-Datenmodell als Quelle
Die Reporting-App SHALL das öffentliche JSON-Datenmodell als kanonische Quelle für Meilenstein- und Arbeitspaketdaten verwenden.

#### Scenario: Öffentliches JSON wird verarbeitet
- **WHEN** die Reporting-App Daten lädt
- **THEN** liest sie das öffentliche Reporting-JSON
- **AND** verwendet Status-, Fortschritts- und Warnungsinformationen ohne interne Owner-Daten

### Requirement: Fortschritt wird als Balken visualisiert
Die Reporting-App SHALL Fortschritt in beiden Hauptansichten als Balken visualisieren.

#### Scenario: Fortschritt eines Arbeitspakets wird gerendert
- **WHEN** ein Arbeitspaket angezeigt wird
- **THEN** wird sein Fortschritt als Balken mit dem zum Status gehörenden Prozentwert dargestellt

#### Scenario: Fortschritt eines Meilensteins wird gerendert
- **WHEN** ein Meilenstein angezeigt wird
- **THEN** wird sein aggregierter Fortschritt als Balken dargestellt
- **AND** die Aggregation basiert auf den enthaltenen Arbeitspaketen
