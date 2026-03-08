## MODIFIED Requirements

### Requirement: Einheitliche Workspace-Konfiguration
Das System SHALL eine konsistente Nx-Workspace-Konfiguration über alle Packages hinweg sicherstellen.

#### Scenario: TypeScript-Path-Mappings vollständig
- **WHEN** ein Package als `@sva/<name>` im Workspace referenziert wird
- **THEN** existiert ein korrespondierender Path-Eintrag in `tsconfig.base.json`
- **AND** IDE-Auflösung und Build funktionieren ohne zusätzliche Konfiguration

#### Scenario: Sub-Path-Exports gemappt
- **WHEN** ein Package Sub-Path-Exports in `package.json` definiert (z. B. `@sva/sdk/server`)
- **THEN** existieren korrespondierende Path-Einträge in `tsconfig.base.json`
- **AND** die Sub-Path-Imports werden von IDE und Build korrekt aufgelöst

#### Scenario: Konsistente Nx-Tags
- **WHEN** ein Library-Package im Workspace konfiguriert ist
- **THEN** trägt es den Tag `type:lib`
- **AND** der Scope-Tag entspricht dem Package-Zweck (z. B. `scope:routing`, `scope:core`)

#### Scenario: Konsistente Target-Benennung
- **WHEN** ein Package Unit-Tests bereitstellt
- **THEN** ist das Target als `test:unit` benannt
- **AND** `nx affected --target=test:unit` erfasst das Package korrekt

#### Scenario: Konsistente Lint-Executors
- **WHEN** ein Package ein `lint`-Target definiert
- **THEN** nutzt es den `@nx/eslint:lint`-Executor
- **AND** die Lint-Konfiguration ist workspace-weit einheitlich

## ADDED Requirements

### Requirement: Server-API-Markierung in Core-Packages
Das System SHALL Dateien, die Node.js-spezifische APIs nutzen (z. B. `Buffer`, `crypto`, `fs`), mit dem `.server.ts`-Suffix markieren.

#### Scenario: Node.js-API in markierter Datei
- **WHEN** eine Datei `Buffer.from()` oder andere Node.js-APIs verwendet
- **THEN** hat die Datei den Suffix `.server.ts`
- **AND** Client-seitige Imports dieser Datei werden durch Build-Tools verhindert oder als Fehler erkannt
