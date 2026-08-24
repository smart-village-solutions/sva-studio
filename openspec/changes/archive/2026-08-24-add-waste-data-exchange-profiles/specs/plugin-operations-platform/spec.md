## ADDED Requirements

### Requirement: Exportprofile werden über den Plugin-Vertrag registriert

Das System SHALL strukturierte Exportprofile über einen expliziten Plugin-Vertrag registrieren.

#### Scenario: Plugin registriert ein Exportprofil

- **WHEN** ein Plugin einen strukturierten Export anbieten will
- **THEN** enthält das Exportprofil mindestens eine technische Kennung, einen owning Namespace, das kanonische Datenprofil, erlaubte Zielformate sowie Schema-/Mappingversionen
- **AND** Kollisionen oder Namespace-Verstöße werden bei der Host-Validierung deterministisch abgewiesen

#### Scenario: Import- und Exportprofil teilen einen Datenvertrag

- **WHEN** ein Plugin dasselbe fachliche Datenprofil importieren und exportieren kann
- **THEN** referenzieren beide Richtungen denselben kanonischen Feld- und Versionsvertrag
- **AND** die Plattform erzwingt keine getrennte, driftanfällige Duplikation der Fachdatenstruktur

### Requirement: Generische Studio-Jobs können geschützte Ergebnisartefakte liefern

Das System SHALL generischen Plugin-Operations-Jobs geschützt herunterladbare Ergebnisartefakte zuordnen können.

#### Scenario: Exportjob erzeugt ein Ergebnisartefakt

- **WHEN** ein autorisierter Exportjob erfolgreich abgeschlossen wird
- **THEN** beschreibt sein Ergebnisartefakt mindestens Content-Type, sicheren Dateinamen, Größe, Prüfsumme und Ablauf
- **AND** der zentrale Jobdatensatz enthält keine eingebetteten Massendaten als Ersatz für das geschützte Artefakt

#### Scenario: Benutzer lädt ein Ergebnisartefakt herunter

- **WHEN** ein Benutzer ein Job-Ergebnisartefakt anfordert
- **THEN** prüft der Host Actor, Instanzkontext und erforderliche vollqualifizierte Action erneut
- **AND** liefert das Artefakt nur über eine zeitlich und fachlich begrenzte Downloadreferenz

#### Scenario: Ergebnisartefakt ist abgelaufen

- **WHEN** die Aufbewahrungsdauer eines Ergebnisartefakts abgelaufen ist
- **THEN** verweigert der Host den Download mit einem stabilen Fehlervertrag
- **AND** der Jobstatus bleibt ohne das Artefakt historisch nachvollziehbar
