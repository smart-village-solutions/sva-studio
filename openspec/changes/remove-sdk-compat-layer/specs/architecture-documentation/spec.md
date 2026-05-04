## MODIFIED Requirements
### Requirement: Hard-Cut-Fortschritt bleibt nachvollziehbar

Die Architektur- und Entwicklungsdokumentation MUST den Fortschritt der harten Package-Transition nachvollziehbar machen, inklusive entfernter alter Importpfade, aktivierter Enforcement-Regeln und verbleibender historischer Altlast ausserhalb des aktiven Scopes.

#### Scenario: Sammelpfad wurde vollstaendig entfernt

- **WHEN** ein alter Sammelpfad wie `@sva/sdk` aus dem aktiven Workspace entfernt wurde
- **THEN** beschreiben aktive Architektur-, Entwicklungs- und Governance-Quellen den Pfad nicht mehr als verfuegbaren Vertrag
- **AND** nennen sie stattdessen die kanonischen Ersatzimporte

## ADDED Requirements
### Requirement: Entfernte Sammelpackages bleiben in aktiver Doku nicht referenziert

Die aktive Architektur- und Entwicklerdokumentation SHALL entfernte Sammelpackages nicht weiter als aktuelle Build-, Test-, Import- oder Ownership-Ziele fuehren.

#### Scenario: Teammitglied liest aktive Monorepo- und Architekturquellen nach der Entfernung

- **WHEN** ein Teammitglied `docs/monorepo.md`, `package-zielarchitektur.md`, relevante arc42-Abschnitte oder Governance-Dokumente liest
- **THEN** findet es keine aktiven Anweisungen mehr zu `packages/sdk`, `sdk:*` oder `@sva/sdk`
- **AND** die Quellen beschreiben stattdessen `@sva/plugin-sdk`, `@sva/server-runtime`, `@sva/core` und `@sva/monitoring-client/logging` als Zielpfade
