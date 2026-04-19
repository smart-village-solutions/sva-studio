## ADDED Requirements

### Requirement: UI nutzt denselben Diagnosekern in Self-Service und Admin

Die UI SHALL denselben classification-basierten Diagnosekern in Self-Service- und Admin-Ansichten verwenden und daraus kontextabhängige, aber fachlich konsistente Fehler- und Statusbilder ableiten.

#### Scenario: Self-Service und Admin verarbeiten denselben Fehler unterschiedlich passend

- **WHEN** derselbe IAM-Fehler in `/account` und in einer Admin-Ansicht auftritt
- **THEN** verwenden beide Ansichten dieselbe `classification`, denselben `status` und dieselbe `requestId`
- **AND** unterscheiden sich nur in Wortwahl, Detailtiefe und empfohlener Folgeaktion
