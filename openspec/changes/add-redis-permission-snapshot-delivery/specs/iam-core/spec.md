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
