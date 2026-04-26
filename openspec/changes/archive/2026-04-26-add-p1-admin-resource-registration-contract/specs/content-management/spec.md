## ADDED Requirements

### Requirement: Content-Admin-Flaechen nutzen denselben Admin-Ressourcenvertrag

Das Content-Management SHALL seine CRUD-artigen Admin-Flaechen ueber denselben hostseitigen Registrierungsvertrag fuer Admin-Ressourcen beschreiben wie andere Verwaltungsbereiche.

#### Scenario: Inhaltsverwaltung wird als Admin-Ressource registriert

- **WHEN** die Inhaltsverwaltung ihre Listen-, Erstellungs- und Detailflaechen fuer den Host bereitstellt
- **THEN** erfolgt dies ueber eine kanonische Admin-Ressourcendefinition statt ueber isolierte Sonderverdrahtung im Host
- **AND** die bestehende Inhaltslogik fuer Core-Felder, Statusmodell und Historie bleibt davon unberuehrt

#### Scenario: Typspezifische Content-Erweiterungen bleiben unter demselben Ressourcenvertrag anschliessbar

- **WHEN** ein registrierter `contentType` zusaetzliche UI-Bereiche oder Aktionen beisteuert
- **THEN** werden diese an die bestehende Content-Admin-Ressource angehaengt statt eine zweite parallele Admin-Ressource fuer denselben Inhaltsbereich zu erzeugen
- **AND** die Inhaltsverwaltung bleibt fuer den Host als eine kanonische Admin-Ressource adressierbar
