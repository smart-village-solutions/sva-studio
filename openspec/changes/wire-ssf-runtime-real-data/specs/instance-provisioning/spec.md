## ADDED Requirements

### Requirement: Instanzen besitzen eine generische Zeitzone

Das System SHALL für jede Instanz eine nicht-leere Tenant-Zeitzone speichern
und im `InstanceRegistryRecord` bereitstellen. Bestehende und ohne explizite
Auswahl angelegte Instanzen MUST zunächst `Europe/Berlin` verwenden.

#### Scenario: Bestehende Instanz wird migriert

- **GIVEN** eine Instanz wurde vor Einführung der Tenant-Zeitzone angelegt
- **WHEN** die Schemamigration angewendet wird
- **THEN** besitzt die Instanz die Zeitzone `Europe/Berlin`
- **AND** ist das Feld nicht null und nicht leer
