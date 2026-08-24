## ADDED Requirements

### Requirement: Pluginverwaltete Interfaces sind aus der Tenant-Verwaltung verborgen

Das System SHALL automatisch materialisierte, pluginverwaltete Interfaces von benutzerverwalteten Interfaces unterscheiden und aus der allgemeinen Tenant-Interface-Verwaltung ausschließen.

#### Scenario: Allgemeine Interface-Liste wird geladen

- **GIVEN** für die aktive Instanz existiert ein pluginverwaltetes Waste-PostgreSQL-Interface
- **WHEN** ein Tenant-Benutzer die Interface-Liste, einen Interface-Picker oder `/interfaces` öffnet
- **THEN** enthält das Read Model dieses verwaltete Interface nicht
- **AND** daraus entsteht kein direkter Detail- oder Bearbeitungslink

#### Scenario: Tenant-Benutzer adressiert das verborgene Interface direkt

- **WHEN** ein Tenant-Benutzer die Kennung eines pluginverwalteten Interfaces über eine allgemeine Read-, Update- oder Delete-Route adressiert
- **THEN** lehnt der Host den Zugriff fail-closed ab
- **AND** verrät die Antwort keine Secrets oder unnötigen technischen Details
- **AND** eine manipulierte Client-Anfrage kann die serverseitige Ownership nicht ändern

#### Scenario: Interne Runtime löst das verwaltete Interface auf

- **WHEN** die autorisierte Waste-Host-Fassade oder der Provisionierer die Datenquelle für eine konkrete Instanz benötigt
- **THEN** darf der Host das pluginverwaltete Interface intern tenantgebunden auflösen
- **AND** bleibt die allgemeine Benutzerverwaltung weiterhin ausgeschlossen
- **AND** Secrets werden ausschließlich serverseitig entschlüsselt

#### Scenario: Host-Operator diagnostiziert ein verwaltetes Interface

- **WHEN** ein ausdrücklich berechtigter Host-Operator Provisionierung oder Laufzeitstatus diagnostiziert
- **THEN** darf eine interne Betriebsansicht redigierte Ownership-, Status- und Fehlerdaten anzeigen
- **AND** sie bietet keine allgemeine Tenant-Bearbeitung und kein Secret-Plaintext an

### Requirement: Pluginverwaltete Interfaces besitzen einen eindeutigen Owner

Das System SHALL pluginverwaltete Interfaces mit einer unveränderlichen systemseitigen Ownership und einer tenantbezogenen fachlichen Eindeutigkeit persistieren.

#### Scenario: Waste-Provisionierer materialisiert das Interface

- **WHEN** der Waste-Provisionierer für eine Instanz ein PostgreSQL-Interface anlegt oder reconciled
- **THEN** kennzeichnet der Host den Datensatz eindeutig als von `waste-management` verwaltet
- **AND** erzwingt er höchstens ein aktives Waste-Datenbankinterface pro Instanz
- **AND** ein anderes Plugin oder eine allgemeine Interface-Mutation kann diese Ownership nicht übernehmen

