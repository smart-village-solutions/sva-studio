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

#### Scenario: Serverbeitrag wird vollständig und hostautorisiert gebunden

- **GIVEN** ein hostaktives Plugin deklariert einen Serverbeitrag und einen `server`-Entry
- **WHEN** der Host die Server-Runtime startet
- **THEN** muss genau ein ausführbarer Handler für jede deklarierte Handler-ID vorhanden sein
- **AND** lehnt der Host fehlende oder unbekannte Handler fail-closed ab
- **AND** prüft der Host exakten Pfad, Methode, Authentifizierung, Scope, Aktivierung und Berechtigung vor der Handler-Ausführung
