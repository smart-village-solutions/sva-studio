## MODIFIED Requirements
### Requirement: Hard-Cut-Fortschritt bleibt nachvollziehbar

Die Architektur- und Entwicklungsdokumentation MUST den Fortschritt der harten Package-Transition nachvollziehbar machen, inklusive alter Importpfade, entfernter Re-Exports, noch offener Boundary-Disables und verbleibender Risiken.

#### Scenario: Migrationsphase wird abgeschlossen

- **WHEN** eine Migrationsphase abgeschlossen wird
- **THEN** dokumentiert der PR entfernte alte Importpfade und aktivierte Enforcement-Regeln
- **AND** verbleibende Abweichungen sind mit Ticket, Risiko und geplantem Abbau dokumentiert

#### Scenario: Alter Sammelpfad bleibt voruebergehend bestehen

- **WHEN** ein alter Importpfad aus `@sva/auth`, `@sva/data` oder `@sva/sdk` voruebergehend bestehen bleibt
- **THEN** nennt die Dokumentation den Grund, die betroffenen Consumer und die Entfernungsvoraussetzung
- **AND** der Pfad wird nicht als stabiler oeffentlicher Vertrag beschrieben

#### Scenario: Dokumentation beschreibt finalen SDK-Zuschnitt konsistent

- **WHEN** Architektur- oder Entwicklerdokumentation Plugin- oder Runtime-Boundaries beschreibt
- **THEN** benennt sie `@sva/plugin-sdk` als kanonische Plugin-Boundary
- **AND** benennt sie `@sva/server-runtime` als kanonische Server-Runtime-Boundary
- **AND** beschreibt `@sva/sdk` hoechstens als deprecated Compatibility-Layer
