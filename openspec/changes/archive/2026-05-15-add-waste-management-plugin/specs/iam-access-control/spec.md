## ADDED Requirements
### Requirement: Waste-Management verwendet feingranulares Modul-IAM

Das System SHALL für Waste-Management einen feingranularen, voll qualifizierten Modul-IAM-Vertrag im Namespace `waste-management.*` bereitstellen.

#### Scenario: Fachrechte sind getrennt modelliert

- **WHEN** das Waste-Management-Plugin Actions, Guards oder UI-Zustände deklariert
- **THEN** referenziert es ausschließlich fully-qualified Rechte im Namespace `waste-management.*`
- **AND** mindestens Lesen, Stammdatenpflege, Touren/Zuordnungen, Scheduling, CSV-Import, Seed, Reset und Einstellungen sind getrennt adressierbar

### Requirement: Waste-Management-Rechte sind instanzgebunden

Das System SHALL Waste-Management-Autorisierung strikt auf die aktive Instanz begrenzen.

#### Scenario: Benutzer darf Waste-Daten nur der aktiven Instanz pflegen

- **WHEN** eine Waste-Management-Operation gegen eine Ressource einer anderen Instanz gerichtet ist
- **THEN** wird die Operation verweigert
- **AND** ein passender Denial- oder Fehlergrund wird geliefert
- **AND** ein Rechtebesitz ohne passenden Instanzkontext ist nicht ausreichend

### Requirement: Hochrisiko-Rechte für Seed und Reset bleiben getrennt

Das System SHALL Seed- und Reset-Operationen als gesondert autorisierbare Hochrisiko-Aktionen behandeln.

#### Scenario: Import-Recht ist nicht gleich Reset-Recht

- **WHEN** ein Benutzer CSV-Import ausführen darf, aber kein Reset-Recht besitzt
- **THEN** bleibt der Reset-Pfad für ihn unzulässig
- **AND** die Import-Berechtigung ermöglicht keine implizite Eskalation auf Seed oder Reset

#### Scenario: Reset erfordert separates Hochrisiko-Recht

- **WHEN** ein Benutzer einen Waste-Reset in einer beliebigen Umgebung auslösen möchte
- **THEN** wird die Operation nur mit einem expliziten Reset-Recht zugelassen
- **AND** die Berechtigung bleibt von allgemeinen Schreib- oder Verwaltungsrechten getrennt
