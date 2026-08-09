## ADDED Requirements

### Requirement: Waste-Management prüft die lückenlose Fraktionszuordnung aktiver Abholorte

Das System SHALL für eine gewählte Abfallfraktion und einen einschließlich begrenzten Prüfzeitraum ermitteln, ob jeder aktive Abholort durch mindestens eine Standort–Tour-Zuordnung zu einer Tour dieser Fraktion lückenlos abgedeckt ist.

#### Scenario: Mehrere Zuordnungen decken den Prüfzeitraum gemeinsam ab

- **WHEN** sich die zentralen Gültigkeitszeiträume mehrerer einem aktiven Abholort zugeordneter Touren derselben Fraktion überlappen oder unmittelbar aneinander anschließen
- **THEN** bewertet das System den Abholort als vollständig abgedeckt

#### Scenario: Abholort besitzt keine passende Zuordnung

- **WHEN** ein aktiver Abholort keiner Tour der gewählten Fraktion zugeordnet ist
- **THEN** weist das System den Abholort als `Keine Zuordnung` aus

#### Scenario: Passende Zuordnungen lassen zeitliche Lücken

- **WHEN** ein aktiver Abholort passenden Touren zugeordnet ist, deren zentrale Gültigkeitszeiträume den Prüfzeitraum nicht vollständig abdecken
- **THEN** weist das System den Abholort als `Zeitraum unvollständig` aus
- **AND** zeigt die nicht abgedeckten Zeiträume an

#### Scenario: Unbegrenzte Tourgrenze deckt den Prüfzeitraum ab

- **WHEN** Start- oder Enddatum einer passenden Tour leer ist
- **THEN** behandelt das System die jeweilige Grenze für die Prüfung als unbegrenzt

### Requirement: Prüfergebnisse bleiben direkt bearbeitbar

Das System SHALL problematische Abholorte im Abholort-Bereich anzeigen und die bestehenden Aktionen zur Einzel- und Sammelzuweisung verfügbar halten.

#### Scenario: Benutzer behebt gefundene Zuordnungslücken

- **WHEN** die Prüfung fehlende oder unvollständige Zuordnungen findet
- **THEN** kann der Benutzer betroffene Abholorte auswählen und einer Tour zuordnen
- **AND** kann er einen einzelnen Abholort zur detaillierten Pflege seiner Tour-Zuordnungen öffnen

### Requirement: Ungültige Prüfzeiträume werden zugänglich abgewiesen

Das System SHALL eine Prüfung ohne Abfallfraktion oder mit einem Enddatum vor dem Startdatum verhindern und den Fehler am Prüfbereich zugänglich ausgeben.

#### Scenario: Enddatum liegt vor dem Startdatum

- **WHEN** ein Benutzer die Prüfung mit einem Enddatum vor dem Startdatum startet
- **THEN** führt das System keine Prüfung aus
- **AND** zeigt eine verständliche Fehlermeldung im Prüfbereich an
