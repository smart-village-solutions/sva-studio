## ADDED Requirements

### Requirement: Waste-Datenbankprovisionierung ist ein zentral persistenter Plugin-Operations-Job

Das System SHALL die tenantbezogene Waste-Datenbankprovisionierung als hostgeführten, namespaced und zentral persistent geführten Plugin-Operations-Job modellieren.

#### Scenario: Waste-Provisionierungsjob wird registriert

- **WHEN** `waste-management` seinen Provisionierungsbeitrag deklariert
- **THEN** registriert es den Jobtyp `waste-management.provision-tenant-database` über den kanonischen Plugin-Vertrag
- **AND** der führende Jobdatensatz liegt im zentralen Studio-Postgres
- **AND** die tenantbezogene Waste-Datenbank wird nicht zur führenden Persistenz dieses Plattformjobs

#### Scenario: Provisionierungsfortschritt wird gemeldet

- **WHEN** der Job Datenbank, Rollen, Interface, Migrationen oder Verbindungsprüfungen bearbeitet
- **THEN** projiziert er die aktuelle Phase und einen stabilen Status über den generischen Jobvertrag
- **AND** korreliert die Evidenz mindestens Instanz, Plugin und Jobtyp
- **AND** Fortschrittsdetails und Fehler enthalten keine Zugangsdaten oder Secret-Werte

#### Scenario: Derselbe Sollzustand wird mehrfach angefordert

- **WHEN** für dieselbe Instanz wiederholt eine Waste-Provisionierung angefordert wird
- **THEN** verhindert der Host konkurrierende aktive Provisionierungsjobs für denselben Sollzustand
- **AND** gibt er deterministisch den aktiven oder bereits erfolgreichen Lauf zurück oder startet einen expliziten Retry des fehlgeschlagenen Laufs
- **AND** die Ausführung bleibt auf Ebene jedes Provisionierungsschritts idempotent

