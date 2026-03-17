## ADDED Requirements

### Requirement: Readiness-Nachweis für Redis-gestützte Autorisierung

Das System MUST die Betriebsbereitschaft der Redis-gestützten Autorisierungsstrecke explizit nachweisen.

#### Scenario: Readiness-Gate prüft Redis-Authorize-Pfad

- **WHEN** der System-Readiness-Check ausgeführt wird
- **THEN** bestätigt er die Erreichbarkeit und Nutzbarkeit von Redis für den Permission-Snapshot-Pfad
- **AND** ein Fehler im Redis-Authorize-Pfad macht den Readiness-Status negativ oder explizit degradiert sichtbar

#### Scenario: Autorisierung bleibt bei Cache-Störung fail-closed

- **WHEN** Redis oder der Snapshot-Recompute im sicherheitskritischen Pfad ausfällt
- **THEN** gewährt das System keinen stillschweigenden Zugriff
- **AND** der Fehlerzustand ist über Logs und Betriebsmetriken nachvollziehbar

### Requirement: Rechtstext-Akzeptanz als Login-Vorbedingung

Das System MUST den fachlichen Zugriff auf das IAM- und Admin-System blockieren, solange ein Benutzer die aktuelle Pflichtversion eines Rechtstexts nicht akzeptiert hat.

#### Scenario: Offene Pflichtversion blockiert fachlichen Zugriff

- **WHEN** ein authentifizierter Benutzer eine aktuelle Pflichtversion eines Rechtstexts noch nicht akzeptiert hat
- **THEN** erhält er keinen fachlichen Zugriff auf geschützte Anwendungspfade
- **AND** das System leitet ihn in einen dedizierten Akzeptanzflow

#### Scenario: Akzeptanz hebt die Sperre auf

- **WHEN** der Benutzer die geforderte Rechtstext-Version erfolgreich akzeptiert
- **THEN** wird die Akzeptanz revisionssicher gespeichert
- **AND** der Benutzer erhält anschließend Zugriff auf die ursprünglich angeforderte geschützte Anwendung

### Requirement: Fail-Closed bei unklarem Pflichttextstatus

Das System MUST bei unklarem oder fehlerhaftem Pflichttextstatus keinen stillschweigenden fachlichen Zugriff gewähren.

#### Scenario: Pflichttextstatus kann nicht bestimmt werden

- **WHEN** das System beim Login den Status erforderlicher Rechtstexte nicht verlässlich bestimmen kann
- **THEN** wird der fachliche Zugriff blockiert
- **AND** der Benutzer erhält einen klaren Fehlerzustand mit dokumentiertem nächsten sicheren Schritt
