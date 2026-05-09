## MODIFIED Requirements
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

#### Scenario: Plattformchange für Plugin-Operations dokumentiert Host-Grenzen

- **WHEN** ein Change generische Plugin-Jobs oder strukturierte Importprofile als Plattformfähigkeit einführt
- **THEN** dokumentiert er die Grenze zwischen deklarativen Plugin-Beiträgen, hostgeführter Runtime, zentraler Persistenz und optionaler UI-Anbindung explizit
- **AND** benennt mindestens `packages/plugin-sdk`, `packages/core`, `packages/routing`, `packages/auth-runtime`, `packages/data-repositories` und `packages/server-runtime` als betroffene Zielpackages
