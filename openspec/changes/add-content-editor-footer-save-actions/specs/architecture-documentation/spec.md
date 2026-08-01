## ADDED Requirements

### Requirement: Plugin-Guide dokumentiert lange Bearbeitungsflächen

Die Entwicklungsdokumentation SHALL das Pattern „lange Bearbeitungsfläche“ für Host- und Plugin-Views mit Einsatzkriterien, gemeinsamen Studio-UI-Verträgen, einem vollständigen TypeScript-Beispiel, Ausnahmen und einer Review-Checkliste beschreiben.

#### Scenario: Plugin-Entwickler implementiert einen langen Editor

- **WHEN** ein Plugin-Entwickler den Plugin-Entwicklungsleitfaden liest
- **THEN** erkennt er, wann eine Primäraktion oben und unten erforderlich ist
- **AND** kann er den Golden Path mit `StudioDetailPageTemplate`, `StudioDetailTabs` und den gemeinsamen Aktionsverträgen übernehmen
- **AND** erkennt er, dass kurze Dialoge und kompakte Einzelformulare ausgenommen sind

#### Scenario: Reviewer prüft eine neue lange Bearbeitungsfläche

- **WHEN** ein PR eine lange Host- oder Plugin-Bearbeitungsfläche einführt
- **THEN** kann der Reviewer prüfen, ob Formulargrenze, Primäraktion, Zustände, Accessibility und Sekundäraktionen dem dokumentierten Pattern entsprechen
