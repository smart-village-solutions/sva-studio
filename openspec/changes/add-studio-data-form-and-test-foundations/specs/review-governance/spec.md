## ADDED Requirements

### Requirement: Governance- und Review-Kriterien fuer Studio-Foundations

Das System SHALL fuer Formular-, HTTP-Test- und Property-based-Testing-Foundations explizite Governance- und Review-Kriterien als Exit-Bedingung dokumentieren.

#### Scenario: Reviewer bewertet einen Referenzbereich

- **WHEN** ein Reviewer einen neuen oder grundlegend ueberarbeiteten Formular- oder HTTP-Test-Flow prueft
- **THEN** kann er schnell erkennen, ob der Default-Standard eingehalten wurde
- **AND** sind Ausnahmegrund, Migrationsstatus und relevante Pflichtartefakte nachvollziehbar dokumentiert

#### Scenario: Kritische Kernlogik wird auf `fast-check` geprueft

- **WHEN** ein Referenzbereich kritische Kernlogik-Hotspots aendert
- **THEN** ist eine kurze Entscheidung pro oder contra `fast-check` dokumentiert
- **AND** wird fuer die initiale Startmenge konkrete Property-basierte Abdeckung oder eine eng begruendete Verschiebung nachgewiesen

#### Scenario: Ausnahmen werden nicht implizit akzeptiert

- **WHEN** ein Flow vom Default-Standard abweicht
- **THEN** ist die Abweichung als Legacy-Ausnahme oder Spezialfall explizit begruendet
- **AND** bleibt die Entscheidung im Review nachvollziehbar

#### Scenario: Formular- und MSW-Ausnahmen werden getrennt bewertet

- **WHEN** ein Reviewer eine Abweichung vom Foundation-Stack prueft
- **THEN** bewertet er Formular-Ausnahmen getrennt von MSW-/HTTP-Test-Ausnahmen
- **AND** gilt fehlender HTTP-Bezug allein nicht als hinreichender Ausnahmegrund fuer Formularorchestrierung

### Requirement: Exit-Governance trennt Default-Standard und Referenzscope

Das System SHALL den repo-weiten Default-Standard und die kleinere Menge initialer Referenzimplementierungen als getrennte Review- und Exit-Sichten fuehren.

#### Scenario: Reviewer bewertet den Rollout-Scope

- **WHEN** der Change Referenzimplementierungen fuer den Rollout benennt
- **THEN** bleibt nachvollziehbar, welche Bereiche nur unter die Default-Regel fallen und welche Bereiche als Referenz umgesetzt werden
- **AND** werden Referenzimplementierungen als Belege fuer den Standardpfad gewertet, nicht als Sonderzonen

#### Scenario: Change erreicht den Exit-Status

- **WHEN** der Change als exit-bereit bewertet wird
- **THEN** sind Referenzimplementierungen, Ausnahmen, die vollstaendige Formularinventur und die Entscheidungskriterien fuer `fast-check` reviewbar dokumentiert
- **AND** darf fehlende Governance-Dokumentation den Exit blockieren

#### Scenario: Inventurpflicht beeinflusst den Exit-Status

- **WHEN** relevante Host- oder Plugin-Formulare in der Inventur fehlen
- **THEN** gilt das Pflichtartefakt als nicht erfuellt
- **AND** darf der Change nicht als exit-bereit bewertet werden
