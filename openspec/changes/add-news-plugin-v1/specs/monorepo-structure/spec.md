## ADDED Requirements

### Requirement: Fachliche Studio-Erweiterungen werden als Workspace-Plugins geführt

Das System SHALL fachliche Studio-Erweiterungen als eigenständige Workspace-Packages innerhalb des Monorepos führen.

#### Scenario: News wird als eigenständiges Plugin-Package angelegt

- **WENN** eine neue fachliche Erweiterung `News` eingeführt wird
- **DANN** existiert dafür ein eigenes Workspace-Package `@sva/plugin-news`
- **UND** das Package hängt für die Studio-Integration nur vom öffentlichen SDK-Vertrag ab

#### Scenario: Plugin importiert keine App-Interna direkt

- **WENN** ein Studio-Plugin gebaut oder geprüft wird
- **DANN** verwendet es keine direkten Laufzeitimporte aus der App oder aus nicht öffentlichen Studio-Interna
- **UND** die Kopplung zum Studio erfolgt ausschließlich über definierte Workspace-Verträge

#### Scenario: Plugin-Package hat korrekte Nx-Modulgrenzen

- **WENN** das Plugin-Package gebaut oder gelintet wird
- **DANN** enthält es einen Scope-Tag `scope:plugin` in seiner `project.json`
- **UND** `@nx/enforce-module-boundaries` erlaubt nur Importe aus `scope:sdk`
- **UND** Importe aus `scope:app`, `scope:core`, `scope:auth` oder `scope:routing` werden als Regelverletzung erkannt
