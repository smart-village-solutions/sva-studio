## ADDED Requirements

### Requirement: Plugin-SDK-Boundary
Plugins (Packages mit Tag `scope:plugin` oder Namensschema `@sva/plugin-*`) SHALL ausschließlich über `@sva/sdk` mit dem Host-System interagieren. Direkte Imports aus `@sva/core` oder anderen internen Packages sind für Plugins nicht zulässig.

#### Scenario: Plugin importiert aus SDK
- **WHEN** ein Plugin eine Funktion oder einen Typ des Host-Systems benötigt
- **THEN** importiert es ausschließlich aus `@sva/sdk` oder dessen Sub-Exports
- **AND** die `package.json` des Plugins listet nur `@sva/sdk` als Workspace-Dependency (nicht `@sva/core`)

#### Scenario: Direktimport aus Core wird durch Lint verhindert
- **WHEN** ein Plugin-Entwickler versucht, direkt aus `@sva/core` zu importieren
- **THEN** schlägt die ESLint-Boundary-Prüfung fehl
- **AND** eine aussagekräftige Fehlermeldung verweist auf `@sva/sdk` als korrekte Schnittstelle

#### Scenario: SDK stellt Plugin-relevante Exporte bereit
- **WHEN** ein Plugin Zugriff auf Routing-Typen, Versions-Info oder andere Host-APIs benötigt
- **THEN** stellt `@sva/sdk` die entsprechenden Re-Exports bereit
- **AND** interne Implementierungsdetails von `@sva/core` werden nicht exponiert

## MODIFIED Requirements

### Requirement: Publishable Packages und Plugins
Das System SHALL Packages als eigenständige npm-Module organisieren, inklusive klarer Namenskonventionen für Core und Plugins. Plugins SHALL dabei ausschließlich über `@sva/sdk` mit dem Host-System kommunizieren und dürfen keine direkten Abhängigkeiten auf `@sva/core` oder andere interne Packages deklarieren.

#### Scenario: Package-Namensschema
- **WHEN** ein neues Paket erstellt wird
- **THEN** verwendet es ein Scope wie @sva/* und Plugins verwenden @sva/plugin-*

#### Scenario: Plugin-Dependency-Regel
- **WHEN** ein Plugin-Package erstellt oder aktualisiert wird
- **THEN** listet seine `package.json` nur `@sva/sdk` als Workspace-Dependency
- **AND** direkte Abhängigkeiten auf `@sva/core` oder andere interne Packages sind nicht vorhanden
