## ADDED Requirements
### Requirement: Öffentliche Reporting-App für Projektfortschritt
Das System SHALL eine eigenständige öffentliche Reporting-App bereitstellen, die den Projektfortschritt für Meilensteine und Arbeitspakete visualisiert.

#### Scenario: Reporting-App rendert öffentliche Projektsicht
- **WHEN** ein Nutzer die Reporting-App öffnet
- **THEN** sieht er ausschließlich öffentliche Projektdaten
- **AND** die Ansicht ist von der internen Studio-App getrennt

### Requirement: Visuelle Orientierung ohne technische Kopplung
Die Reporting-App SHALL sich optisch an der Studio-App orientieren dürfen, ohne direkte technische Abhängigkeiten zur Studio-App einzuführen. Die Studio-App SHALL ihrerseits keine Abhängigkeit auf die Reporting-App erhalten.

#### Scenario: Reporting-App nutzt eigene Implementierung
- **WHEN** die öffentliche Reporting-App gebaut wird
- **THEN** verwendet sie keine direkten Imports aus `apps/sva-studio-react`
- **AND** verwendet sie keine direkten Imports aus `@sva/studio-ui-react`
- **AND** implementiert ihre Oberflächenbausteine eigenständig

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
Die Reporting-App SHALL das zentral im Repository gepflegte öffentliche JSON-Datenmodell als kanonische Quelle für Meilenstein- und Arbeitspaketdaten verwenden und keine zweite fachlich gepflegte App-Kopie dieser Daten einführen. Arbeitspakete SHALL im JSON innerhalb ihres zugehörigen Meilensteins modelliert werden.

#### Scenario: Öffentliches JSON wird verarbeitet
- **WHEN** die Reporting-App Daten lädt
- **THEN** liest sie das öffentliche Reporting-JSON
- **AND** verwendet Status-, Fortschritts- und Warnungsinformationen ohne interne Owner-Daten

#### Scenario: Arbeitspakete sind Meilensteinen eindeutig zugeordnet
- **WHEN** das öffentliche Reporting-JSON gepflegt oder verarbeitet wird
- **THEN** steht jedes Arbeitspaket innerhalb genau eines Meilensteins
- **AND** existiert keine separate fachlich gepflegte Top-Level-Liste aller Arbeitspakete

### Requirement: Fortschritt wird als Balken visualisiert
Die Reporting-App SHALL Fortschritt in beiden Hauptansichten als Balken visualisieren. Der Fortschrittswert eines Arbeitspakets SHALL ausschließlich aus seinem Status über das öffentliche `statusModel` abgeleitet werden.

#### Scenario: Fortschritt eines Arbeitspakets wird gerendert
- **WHEN** ein Arbeitspaket angezeigt wird
- **THEN** wird sein Fortschritt als Balken mit dem über `statusModel` aus dem Arbeitspaket-Status abgeleiteten Prozentwert dargestellt

#### Scenario: Fortschritt eines Meilensteins wird gerendert
- **WHEN** ein Meilenstein angezeigt wird
- **THEN** wird sein aggregierter Fortschritt als Balken dargestellt
- **AND** die Aggregation basiert auf den enthaltenen Arbeitspaketen

### Requirement: Statische öffentliche Auslieferung
Die Reporting-App SHALL ohne serverseitige Runtime als statische Web-App für GitHub Pages im Repository `smart-village-solutions/sva-studio` auslieferbar sein.

#### Scenario: Deployment auf GitHub Pages
- **WHEN** die Reporting-App gebaut und veröffentlicht wird
- **THEN** kann sie als statisches Artefakt über GitHub Pages betrieben werden
- **AND** die Ansicht funktioniert ohne serverseitige Anwendungslogik
