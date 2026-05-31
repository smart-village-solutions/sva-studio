## ADDED Requirements
### Requirement: Waste-Management speichert ein Bundesland für Feiertagsregeln
Das System SHALL in den Waste-Einstellungen ein gültiges Bundeslandkürzel für die Feiertagsintegration speichern.

#### Scenario: Benutzer speichert Bundesland
- **WHEN** ein berechtigter Benutzer ein gültiges Bundeslandkürzel speichert
- **THEN** persistiert das System das Kürzel für die aktive Instanz

### Requirement: Waste-Management synchronisiert Feiertagsentwürfe synchron über 10 Jahre
Das System SHALL beim Settings-Speichern sowie per manueller Regeneration Feiertage für das aktuelle Jahr bis einschließlich `aktuelles Jahr + 9` laden und als Feiertags-Regelentwürfe persistieren.

#### Scenario: Sync meldet Status zurück
- **WHEN** der Feiertagssync nach dem Settings-Speichern abgeschlossen ist
- **THEN** enthält die Antwort `success`, `partial_success` oder `failed`

#### Scenario: Import legt oder bestätigt Feiertags-Regelentwürfe
- **WHEN** der Sync für ein Bundesland und einen 10-Jahres-Horizont erfolgreich läuft
- **THEN** legt das System pro geladenem Feiertag einen Feiertags-Regelentwurf an oder bestätigt einen bestehenden automatischen Eintrag erneut
- **AND** fehlende Quellbestätigung löscht bestehende automatische Einträge nicht, sondern markiert sie als `not-confirmed`

### Requirement: Manuelle globale Regeln bleiben unangetastet
Das System SHALL manuelle globale Date-Shifts nie durch automatisch importierte Feiertagsentwürfe überschreiben.

#### Scenario: Konflikt mit manueller globaler Regel
- **WHEN** ein importierter Feiertag denselben Wirkzeitraum wie eine manuelle globale Regel berührt
- **THEN** markiert das System den Feiertagsentwurf als Konflikt
- **AND** verändert die manuelle globale Regel nicht

### Requirement: Feiertags-Regelentwürfe sind separat pflegbar
Das System SHALL im Scheduling-Bereich eine eigene Pflegeoberfläche für importierte Feiertags-Regelentwürfe bereitstellen.

#### Scenario: Benutzer konfiguriert Geltungsbereich und Strategie
- **WHEN** ein Benutzer für einen importierten Feiertagsentwurf Geltungsbereich und Strategie vollständig setzt
- **THEN** speichert das System die Werte am Feiertags-Regelentwurf
- **AND** der Entwurf gilt als fachlich konfiguriert
