## ADDED Requirements

### Requirement: Begrenzte Redaktionsprofilanlage

Das persönliche Studio-MCP MUST fehlende Redaktionsprofile ausschließlich für ausdrücklich ausgewählte konfigurierte Tenant-Kontexte über bestehende IAM-APIs anlegen. Bestehende Rollen und individuelle Rechte MUST unverändert bleiben. Eine erfolgreiche Anlage MUST durch unabhängigen Readback bestätigt sein.

#### Scenario: Getrennte Tenant-Ergebnisse

- **WHEN** zwei Tenant-Kontexte ausdrücklich ausgewählt werden
- **THEN** wird jeder Kontext mit seiner eigenen Identität bearbeitet und erhält ein eigenes Ergebnis
- **AND** andere Kontexte bleiben unverändert

#### Scenario: Individuell angepasstes Bestandsprofil

- **WHEN** eine Rolle mit dem vorgesehenen Schlüssel bereits existiert
- **THEN** wird sie nur gelesen und verglichen
- **AND** fehlende oder zusätzliche Rechte werden ausgewiesen, ohne Rechte oder Mitgliedschaften zu ändern

#### Scenario: Organisationsbeschränkte Inhalte

- **WHEN** ein Redakteur einen bestehenden News-, Veranstaltungs- oder POI-Inhalt ändert, veröffentlicht oder löscht
- **THEN** wird der bestehende exakte Ownership-Vertrag angewendet
- **AND** fremde Organisationsinhaber werden bei ausschließlichem Organisationsgrant verweigert
- **AND** Medien und Kategorien dürfen aufgrund der bestätigten Ausnahme instanzweit verwaltet werden
