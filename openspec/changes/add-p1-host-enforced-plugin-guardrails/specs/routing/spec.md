## ADDED Requirements

### Requirement: Host kontrolliert finale Routing-Materialisierung für Plugins

Das System SHALL die finale Routing-Materialisierung für Plugin-Beiträge ausschließlich hostseitig vornehmen.

#### Scenario: Plugin liefert deklarative Route, Host baut finalen Pfad

- **WHEN** ein Plugin eine Route deklariert
- **THEN** bindet der Host diese Route in den kanonischen Route-Baum ein
- **AND** Guards, Redirects und Observability bleiben Host-Verantwortung

#### Scenario: Separater Plugin-Router ist unzulässig

- **WHEN** ein Plugin eine alternative Routing-Integration außerhalb des Host-Pfads benötigt
- **THEN** ist dies nicht Teil des zugelassenen Erweiterungsvertrags
- **AND** der Host betrachtet einen solchen Pfad als Architekturdrift
