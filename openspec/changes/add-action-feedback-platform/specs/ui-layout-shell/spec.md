## ADDED Requirements

### Requirement: Layout-Shell hostet globale Feedback-Surfaces
Die Layout-Shell SHALL die hostgeführten globalen Feedback-Surfaces und Live-Region-Anker für die Action-Feedback-Plattform bereitstellen.

#### Scenario: Globale Feedback-Ausgabe wird in Shell verankert
- **WHEN** ein strukturiertes Outcome eine globale oder shellweite Rückmeldung erfordert
- **THEN** rendert die Layout-Shell die Rückmeldung über einen gemeinsamen hostgeführten Surface-Anker
- **AND** Plugins müssen dafür keine eigene konkurrierende globale Feedback-Infrastruktur einführen

#### Scenario: Screenreader-Ankündigung bleibt Shell-verankert
- **WHEN** ein Outcome eine globale oder regionsweite Screenreader-Ankündigung benötigt
- **THEN** stellt die Layout-Shell die erforderlichen Live-Region-Anker hostgeführt bereit
- **AND** Screenreader-Semantik bleibt über Core und Plugins hinweg konsistent
