## MODIFIED Requirements

### Requirement: UI nutzt denselben Diagnosekern in Self-Service und Admin

Die UI SHALL denselben classification-basierten Diagnosekern in Self-Service- und Admin-Ansichten verwenden und daraus kontextabhängige, aber fachlich konsistente Fehler- und Statusbilder ableiten.

#### Scenario: Neue Diagnoseklassen werden konsistent angezeigt

- **WHEN** IAM-Fehler als `auth_resolution`, `oidc_discovery_or_exchange`, `frontend_state_or_permission_staleness` oder `legacy_workaround_or_regression` klassifiziert werden
- **THEN** zeigt die UI eine lokalisierte Diagnoseklasse an
- **AND** bleibt die Anzeige sicher, wenn ein Client eine noch unbekannte Klassifikation erhält

#### Scenario: Recovery wird nicht als gesund dargestellt

- **WHEN** ein Fehler den Status `recovery_laeuft`, `degradiert` oder `manuelle_pruefung_erforderlich` trägt
- **THEN** zeigt die UI diesen Status nachvollziehbar an
- **AND** reduziert den Zustand nicht auf eine vollständig gesunde Darstellung
