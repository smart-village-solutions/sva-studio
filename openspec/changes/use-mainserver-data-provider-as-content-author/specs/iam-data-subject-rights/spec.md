## ADDED Requirements

### Requirement: Automatische DataProvider-Bindungen bleiben referenzwahrend über Principal-Lifecycles

Das System SHALL historische automatische Principal-zu-DataProvider-Bindungen referenzwahrend erhalten, wenn ein Account oder eine Organisation deaktiviert, pseudonymisiert, gelöscht oder deren Credentials rotiert beziehungsweise entfernt werden. Ein Lifecycle-Übergang SHALL keine manuelle oder automatische Übertragung des ursprünglichen Content-DataProviders auf einen anderen Principal begründen.

Aktuelle exakte Scope-Readiness SHALL ausschließlich aus aktiven, konfliktfreien Bindungen der aktuellen Credential-Version entstehen. Historische Bindungen SHALL weiterhin die Herleitung bestehender Content-Inhaber und Auditnachweise ermöglichen.

#### Scenario: Account wird pseudonymisiert

- **GIVEN** ein Account besitzt historische automatisch bestätigte DataProvider-Bindungen
- **WHEN** der Account pseudonymisiert wird
- **THEN** bleiben technische DataProvider-Referenzen für bestehende Inhalte und Audit erhalten
- **AND** werden personenbezogene Anzeigen nach dem bestehenden Pseudonymisierungsvertrag ersetzt
- **AND** entsteht keine Bindung zu einem anderen Account

#### Scenario: Account oder Organisation wird gelöscht

- **GIVEN** ein Principal besitzt eine bestätigte DataProvider-Bindung
- **WHEN** der Principal gelöscht oder tombstoned wird
- **THEN** bleibt die Bindung als historische referenzwahrende Evidenz erhalten
- **AND** zählt sie nicht mehr als aktuelle Scope-Readiness
- **AND** wird der DataProvider keinem anderen Principal automatisch zugewiesen

#### Scenario: Credentials werden entfernt oder rotiert

- **GIVEN** eine Bindung gilt für eine konkrete Credential-Version
- **WHEN** Credentials entfernt oder rotiert werden
- **THEN** bleibt die alte Bindung historisch erhalten
- **AND** benötigt die neue Credential-Version eine neue automatische Create- oder Identity-Evidenz
- **AND** verwendet Studio bis dahin für den betroffenen Scope `credential_visible_compatibility`
