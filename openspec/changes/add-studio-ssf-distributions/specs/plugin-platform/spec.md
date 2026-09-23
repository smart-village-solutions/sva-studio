## ADDED Requirements

### Requirement: Build-gebundene Plugin-Distribution

Das System MUST den kanonischen Plugin-Snapshot aus einer beim Build
festgelegten Distribution materialisieren. Die Distribution `studio` MUST das
Plugin `ssf` ausschließen; die Distribution `ssf` MUST ausschließlich `ssf`
und die dafür erforderliche hosteigene Medienfähigkeit enthalten.

#### Scenario: Standard-Studio startet ohne SSF

- **GIVEN** ein Artefakt wurde mit der Distribution `studio` gebaut
- **WHEN** der Host seinen Plugin-Snapshot materialisiert
- **THEN** enthält der Snapshot kein Plugin, keine Route, Navigation,
  Server-Handler, Job-Handler oder IAM-Vertrag von `ssf`
- **AND** kann die Modulverwaltung `ssf` nicht zuweisen

#### Scenario: SSF-Distribution materialisiert nur SSF

- **GIVEN** ein Artefakt wurde mit der Distribution `ssf` gebaut
- **WHEN** der Host seinen Plugin-Snapshot materialisiert
- **THEN** enthält er `ssf` und die erlaubte Medienfähigkeit
- **AND** materialisiert keine regulären Studio-Fachplugins

#### Scenario: Container-Laufzeit kann die Pluginmenge nicht erweitern

- **GIVEN** ein Artefakt wurde mit einer Distribution gebaut
- **WHEN** sich eine Container-Umgebungsvariable nach dem Build ändert
- **THEN** bleibt der materialisierte Plugin-Snapshot auf die attestierte
  Distribution begrenzt
