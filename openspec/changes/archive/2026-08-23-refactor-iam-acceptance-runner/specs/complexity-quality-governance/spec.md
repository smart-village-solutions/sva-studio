## ADDED Requirements

### Requirement: Operative Acceptance-Runner halten fachliche Orchestrierung sichtbar

Das System SHALL komplexe operative Acceptance-Runner in typisierte fachliche Prüfschritte zerlegen, ohne ihre sicherheitsrelevante Ausführungsreihenfolge hinter generischen Engines oder Factories zu verbergen.

#### Scenario: Acceptance-Hotspot wird refaktoriert

- **WHEN** ein Acceptance-Runner wegen Datei-, Funktions- oder zyklomatischer Komplexität zerlegt wird
- **THEN** bleiben Pflichtprüfungen und deren Reihenfolge am öffentlichen CLI-Einstieg explizit nachvollziehbar
- **AND** Exitcodes, Fehlercodes, Redaction, Cleanup und Berichtsausgabe werden vor der Extraktion charakterisiert

#### Scenario: Complexity-Baseline wird reduziert

- **WHEN** der Refactor einen getrackten Complexity-Befund nachweislich behebt
- **THEN** wird ausschließlich der behobene Baseline-Eintrag gemäß kanonischem Policy-Vertrag entfernt
- **AND** es wird keine neue Suppression oder gleichwertige Ausnahme eingeführt
