## MODIFIED Requirements

### Requirement: Organisationsarten und Basispolicies

Das System SHALL Organisationen mit einem kontrollierten Organisationstyp und organisationsbezogenen Basispolicies modellieren. Zu den unterstützten Organisationstypen gehören ausdrücklich `association` für Vereine und `institution` für Institutionen. `content_author_policy` bleibt Teil der Organisationsrepräsentation und steuert neben der fachlichen Autorenschaft auch die Auflösung der effektiven Mainserver-Credentials im aktiven Organisationskontext.

#### Scenario: Unterstützte Organisation mit Typ anlegen

- **WHEN** ein Administrator eine Organisation mit einem unterstützten Organisationstyp anlegt
- **THEN** wird der Typ zusammen mit der Organisation gespeichert
- **AND** die Organisation bleibt für Hierarchie- und Filteroperationen nach Typ auswertbar

#### Scenario: Verein oder Institution anlegen und filtern

- **WHEN** ein Administrator eine Organisation vom Typ `association` oder `institution` anlegt
- **THEN** akzeptieren API und Datenbank den gewählten Typ
- **AND** der Typ steht in den Organisationsformularen und Filtern zur Verfügung
- **AND** die deutsche Oberfläche zeigt „Verein“ beziehungsweise „Institution“ an
- **AND** die englische Oberfläche zeigt „Association“ beziehungsweise „Institution“ an

#### Scenario: Ungültiger Organisationstyp wird abgewiesen

- **WHEN** ein Administrator einen nicht unterstützten Organisationstyp speichert
- **THEN** wird die Operation mit einem Validierungsfehler abgewiesen
- **AND** die Daten bleiben unverändert

#### Scenario: Organisationsbezogene Autorenpolicy steuert auch Mainserver-Credentials

- **WHEN** ein Administrator für eine Organisation eine `content_author_policy` speichert
- **THEN** wird die Policy in der Organisationsrepräsentation persistiert
- **AND** nachgelagerte Module können diese Policy als organisationsbezogenen Kontext für Autorenschaft und Mainserver-Credential-Auflösung konsumieren

## ADDED Requirements

### Requirement: Mehrfachzuordnung von Accounts

Das System SHALL Administratoren in der Organisationsansicht eine zugängliche Mehrfachauswahl
anbieten, um mehrere noch nicht zugeordnete Accounts in einem Arbeitsgang auszuwählen und der
Organisation zuzuordnen.

#### Scenario: Mehrere Accounts auswählen und zuordnen

- **WHEN** ein Administrator mehrere verfügbare Accounts auswählt und die Zuordnung ausführt
- **THEN** werden die ausgewählten Accounts nacheinander über die bestehende Zuordnungsoperation hinzugefügt
- **AND** die Auswahl unterstützt Tastaturbedienung und vermittelt ihren Mehrfachauswahlzustand an assistive Technologien
- **AND** der gewählte Standardkontextwert gilt für alle ausgewählten Accounts

#### Scenario: Eine Zuordnung schlägt fehl

- **WHEN** eine Zuordnung innerhalb einer Mehrfachauswahl fehlschlägt
- **THEN** bleiben der fehlgeschlagene sowie alle noch nicht versuchten Accounts ausgewählt
- **AND** bereits erfolgreich zugeordnete Accounts werden aus der Auswahl entfernt
- **AND** der Administrator kann die verbleibende Auswahl erneut absenden

### Requirement: Mitgliedschaftssichtbarkeit nicht bearbeiten

Das System SHALL die technische Sichtbarkeit von Organisationsmitgliedschaften nicht in den
Organisations- und Account-Formularen zur Bearbeitung anbieten. Das bestehende API- und
Datenbankfeld bleibt aus Kompatibilitätsgründen erhalten.

#### Scenario: Neue Mitgliedschaft über die Oberfläche zuordnen

- **WHEN** ein Administrator eine neue Organisationsmitgliedschaft über die Oberfläche anlegt
- **THEN** enthält das Formular keine Sichtbarkeitsauswahl
- **AND** die Oberfläche übermittelt keinen expliziten Sichtbarkeitswert
- **AND** der Server verwendet den bestehenden Standardwert `internal`

#### Scenario: Bestehende Mitgliedschaft bearbeiten

- **WHEN** ein Administrator eine bestehende Organisationsmitgliedschaft in der Organisations- oder Accountansicht bearbeitet
- **THEN** kann ausschließlich der Standardkontext geändert werden
- **AND** die gespeicherte technische Sichtbarkeit wird durch diese Bearbeitung nicht verändert
