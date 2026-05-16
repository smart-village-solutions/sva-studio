## ADDED Requirements

### Requirement: Plugin-Operations-Jobs integrieren sich in die Action-Feedback-Plattform
Das System SHALL generische Plugin-Operations-Jobs über denselben hostgeführten Action-Feedback-Vertrag an die UI rückmelden.

#### Scenario: Jobstart liefert hostgeführtes Start-Feedback
- **WHEN** ein Host-Endpunkt einen generischen Plugin-Operations-Job startet
- **THEN** kann der Host daraus ein strukturiertes Start-Outcome für die Action-Feedback-Plattform ableiten
- **AND** der Jobstart ist nicht auf eine pluginlokale Toast- oder Meldungslogik angewiesen

#### Scenario: Jobabschluss verweist auf Ergebnis- oder Monitoring-Kontext
- **WHEN** ein generischer Plugin-Operations-Job erfolgreich oder fehlerhaft terminiert
- **THEN** kann die Rückmeldung als Job-Ergebnis-Outcome mit Bezug auf Monitoring- oder Detailkontext dargestellt werden
- **AND** das System verwendet dafür denselben kanonischen Host-Vertrag wie andere Aktionen
