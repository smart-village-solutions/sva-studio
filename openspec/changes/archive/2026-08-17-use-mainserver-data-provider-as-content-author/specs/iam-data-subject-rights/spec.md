## ADDED Requirements

### Requirement: Gelöschte Principals werden aus der aktiven Content-Zuordnung entfernt

Das System SHALL einen gelöschten Account nicht als aktiven Content-Principal oder als aktuelle Scope-Readiness weiterverwenden. Abhängig von der konfigurierten Content-Löschregel SHALL zugehöriger Content ebenfalls gelöscht oder ohne aktive Benutzerzuordnung weitergeführt werden. Weitergeführter Content SHALL lokal `NULL` oder eine neutrale Anzeige „Gelöschter Benutzer“ verwenden. Ein Lifecycle-Übergang SHALL keine automatische Übertragung auf einen anderen Account oder eine Organisation begründen.

Auditnachweise SHALL dem bestehenden Pseudonymisierungs-, Retention- und Löschvertrag folgen. Credential-Rotation oder Credential-Entfernung ohne Account-Löschung SHALL die alte Credential-Version aus der aktuellen Scope-Readiness entfernen und für eine neue Version einen neuen Identity-Nachweis verlangen.

#### Scenario: Account wird pseudonymisiert

- **GIVEN** ein Account besitzt automatisch bestätigte DataProvider-Bindungen
- **WHEN** der Account pseudonymisiert wird
- **THEN** werden personenbezogene Anzeigen nach dem bestehenden Pseudonymisierungsvertrag ersetzt
- **AND** folgt der weitere Content-Lifecycle der konfigurierten Löschregel
- **AND** entsteht keine Bindung zu einem anderen Account

#### Scenario: Account wird gelöscht

- **GIVEN** ein Account besitzt eine bestätigte DataProvider-Bindung
- **WHEN** der Account gelöscht oder tombstoned wird
- **THEN** zählt er nicht mehr als aktiver Principal oder aktuelle Scope-Readiness
- **AND** wird sein Content entsprechend der konfigurierten Regel gelöscht oder ohne aktive Benutzerzuordnung weitergeführt
- **AND** wird der DataProvider keinem anderen Principal automatisch zugewiesen

#### Scenario: Credentials werden entfernt oder rotiert

- **GIVEN** eine Bindung gilt für eine konkrete Credential-Version
- **WHEN** Credentials entfernt oder rotiert werden
- **THEN** bleibt die alte Bindung historisch erhalten
- **AND** benötigt die neue Credential-Version eine neue automatische Identity-Evidenz
- **AND** lehnt Studio Mutationen mit dieser Version bis dahin im automatischen Resolver fail-closed ab
