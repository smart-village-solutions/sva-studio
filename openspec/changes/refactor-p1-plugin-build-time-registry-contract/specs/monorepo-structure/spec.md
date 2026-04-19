## ADDED Requirements

### Requirement: Build-time-Plugin-Registry ist der kanonische Host-Vertrag

Das System SHALL genau eine kanonische Build-time-Plugin-Registry für Studio-Erweiterungen führen. Diese Registry wird zur Build-Zeit aus Workspace-Packages zusammengesetzt und dient als einzige Quelle für Host-Materialisierung.

#### Scenario: Studio-Host materialisiert Plugins aus statischer Liste

- **WHEN** der Studio-Host gebaut oder gestartet wird
- **THEN** importiert er Plugin-Packages statisch aus dem Workspace
- **AND** er erzeugt daraus eine kanonische Pluginliste als Host-Einstieg
- **AND** Runtime-Discovery oder dynamisches Plugin-Nachladen sind nicht Teil dieses Vertrags

#### Scenario: Plugin-Package registriert sich nicht selbst am Host vorbei

- **WHEN** ein Plugin-Package einen Beitrag für das Studio liefert
- **THEN** exportiert es genau einen öffentlichen deklarativen Beitrag über `@sva/sdk`
- **AND** es schreibt keine app-lokalen Registrierungen oder Sonderverdrahtungen außerhalb des Host-Einstiegs vor

### Requirement: Host-Projektionen werden aus einer einzigen Pluginquelle abgeleitet

Das System SHALL Registry, Aktionen, Routen, Navigation, Content-Typen und Übersetzungen deterministisch aus derselben kanonischen Pluginliste ableiten.

#### Scenario: Host erzeugt alle Plugin-Projektionen aus einem Manifest

- **WHEN** der Host Plugin-Beiträge materialisiert
- **THEN** entstehen Registry, Action-Registry, Route-Definitionen, Navigation, Content-Type-Definitionen und Übersetzungen aus derselben Build-time-Quelle
- **AND** parallele app-lokale Inventare derselben Plugin-Beiträge existieren nicht

#### Scenario: Doppelte oder ungültige Registry-Einträge schlagen früh fehl

- **WHEN** die kanonische Pluginliste doppelte Plugin-IDs oder ungültige Beitragsdefinitionen enthält
- **THEN** schlägt die Registry-Erzeugung fail-fast fehl
- **AND** der Host startet nicht mit mehrdeutigem Registrierungszustand
