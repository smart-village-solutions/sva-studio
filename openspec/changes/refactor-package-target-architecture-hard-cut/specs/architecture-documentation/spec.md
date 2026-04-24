## ADDED Requirements

### Requirement: Package-Zielarchitektur als verbindlicher Architekturvertrag

Die Architekturdokumentation MUST die Package-Zielarchitektur als verbindlichen Architekturvertrag führen. OpenSpec-Changes mit Package-, IAM-, Daten-, Plugin-, Routing- oder Runtime-Wirkung MUST erklären, welche Zielpackages betroffen sind und ob der Change mit den Zielgrenzen vereinbar ist.

#### Scenario: Architekturwirksamer Change wird erstellt

- **WHEN** ein Change Package-Grenzen, Importkanten, IAM, Datenzugriff, Plugins, Routing oder Server-Runtime betrifft
- **THEN** referenziert er `docs/architecture/package-zielarchitektur.md`
- **AND** benennt die betroffenen Zielpackages
- **AND** dokumentiert Abweichungen als explizite technische Schuld mit Abbaupfad

#### Scenario: Zielpackage wird implementiert

- **WHEN** ein Zielpackage neu angelegt oder aus einem Sammelpackage herausgelöst wird
- **THEN** werden die betroffenen arc42-Abschnitte aktualisiert
- **AND** `package-zielarchitektur.md` bleibt konsistent mit Package-Exports, Nx-Tags und `depConstraints`

### Requirement: Hard-Cut-Fortschritt bleibt nachvollziehbar

Die Architektur- und Entwicklungsdokumentation MUST den Fortschritt der harten Package-Transition nachvollziehbar machen, inklusive alter Importpfade, entfernter Re-Exports, noch offener Boundary-Disables und verbleibender Risiken.

#### Scenario: Migrationsphase wird abgeschlossen

- **WHEN** eine Migrationsphase abgeschlossen wird
- **THEN** dokumentiert der PR entfernte alte Importpfade und aktivierte Enforcement-Regeln
- **AND** verbleibende Abweichungen sind mit Ticket, Risiko und geplantem Abbau dokumentiert

#### Scenario: Alter Sammelpfad bleibt vorübergehend bestehen

- **WHEN** ein alter Importpfad aus `@sva/auth`, `@sva/data` oder `@sva/sdk` vorübergehend bestehen bleibt
- **THEN** nennt die Dokumentation den Grund, die betroffenen Consumer und die Entfernungsvoraussetzung
- **AND** der Pfad wird nicht als stabiler öffentlicher Vertrag beschrieben
