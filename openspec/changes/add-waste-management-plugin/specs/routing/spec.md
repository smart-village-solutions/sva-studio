## ADDED Requirements
### Requirement: Freie Waste-Management-Plugin-Route bleibt hostvalidiert

Das System SHALL eine freie Plugin-Route für Waste-Management unter `/plugins/waste-management` materialisieren und dabei weiterhin hostgeführte Guard- und Search-Param-Validierung erzwingen.

#### Scenario: Plugin-Route wird hostseitig validiert

- **GIVEN** das Plugin `waste-management` deklariert seine freie Fachroute
- **WHEN** der Host den Route-Tree aufbaut
- **THEN** wird die Route nur über die zentrale Routing-Registry materialisiert
- **AND** Guard- und Search-Param-Vertrag bleiben hostgeführt
- **AND** das Plugin bringt keine eigene parallele Routing-Registrierung außerhalb des Host-Vertrags ein

### Requirement: Waste-Management-Search-Params sind kanonisch und teilbar

Das System SHALL für die Waste-Management-Route kanonische, typisierte Search-Params für Tabs, Filter, Suche und Paging bereitstellen.

#### Scenario: Deep-Link in fachlichen Teilzustand

- **WHEN** ein Benutzer einen Deep-Link auf einen bestimmten Waste-Management-Tab mit Filter- oder Suchzustand öffnet
- **THEN** stellt das Routing denselben fachlichen Zustand reproduzierbar wieder her
- **AND** ungültige oder unbekannte Search-Params werden deterministisch normalisiert

#### Scenario: Search-Params bleiben innerhalb des Plugin-Namespace

- **WHEN** die Waste-Management-Route ihren fachlichen Zustand serialisiert
- **THEN** bleiben die Parameter auf den Plugin-Pfadkontext begrenzt
- **AND** sie kollidieren nicht mit unverbundenen Host- oder Fremdplugin-Zuständen
