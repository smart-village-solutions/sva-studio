## ADDED Requirements

### Requirement: Plugin-Routen werden scopegebunden materialisiert

Das System SHALL Plugin-Routen und ihre Navigation anhand eines hostvalidierten Plattform- oder Tenant-Scope-Vertrags materialisieren. Die Route-Registry MUST Root- und Tenant-Beiträge getrennt auflösen und darf bei unklarem oder widersprüchlichem Scope keinen Beitrag registrieren.

#### Scenario: Plattformroute erscheint nur auf dem Root-Host

- **GIVEN** ein freigegebenes Admin-Plugin deklariert eine Plattformroute für `instance_registry_admin`
- **WHEN** die Route-Registry den Baum für den Root-Host materialisiert
- **THEN** nimmt sie die Route und ihre Navigation auf
- **AND** nimmt sie dieselbe Route nicht in einen Tenant-Routenbaum auf

#### Scenario: Tenantroute erfordert aktive Modulzuweisung

- **GIVEN** ein Plugin deklariert eine Tenantroute mit namespaced Action und Modulbindung
- **WHEN** die Route-Registry den Baum für eine konkrete Instanz materialisiert
- **THEN** nimmt sie die Route nur bei aktivem Modul und erfüllter Tenant-Autorisierung auf
- **AND** eine Plattformrolle allein schaltet die Tenantroute nicht frei

#### Scenario: Serverbeitrag verwendet denselben Scope wie die Route

- **GIVEN** ein Plugin-Pfad besitzt eine UI-Route und einen zugehörigen serverseitigen Beitrag
- **WHEN** der Host beide Beiträge registriert
- **THEN** müssen beide denselben validierten Plattform- oder Tenant-Scope verwenden
- **AND** lehnt der Host eine widersprüchliche Registrierung vor dem Runtime-Dispatch ab
