## ADDED Requirements

### Requirement: Waste-Management provisioniert eine eigene Datenbank pro Instanz

Das System SHALL für jede Studio-Instanz mit zugewiesenem `waste-management` genau eine physisch getrennte PostgreSQL-Datenbank automatisch und idempotent provisionieren.

#### Scenario: Neuer Waste-Tenant erhält eine leere Fachdatenbank

- **GIVEN** einer Instanz ist `waste-management` noch nicht zugewiesen
- **WHEN** die Modulzuweisung erfolgreich abgeschlossen wird
- **THEN** provisioniert das System asynchron genau eine dieser Instanz zugeordnete Waste-Datenbank
- **AND** wendet alle erforderlichen Waste-Migrationen an
- **AND** gibt die Waste-Runtime erst nach erfolgreichen Verbindungs- und Rechteprüfungen frei
- **AND** übernimmt keine Fachdaten eines anderen Tenants

#### Scenario: Wiederholung reconciled den vorhandenen Bestand

- **GIVEN** Datenbank, Rollen, Migrationen oder Interface sind für eine Instanz bereits vollständig oder teilweise vorhanden
- **WHEN** die Provisionierung für dieselbe Instanz erneut ausgeführt wird
- **THEN** gleicht das System den vorhandenen Bestand idempotent mit dem Sollzustand ab
- **AND** legt keine zweite Waste-Datenbank für dieselbe Instanz an
- **AND** überschreibt oder löscht keine vorhandenen Fachdaten

#### Scenario: Jede Instanz erhält eigene Runtime-Credentials

- **WHEN** die Waste-Datenbank einer Instanz provisioniert wird
- **THEN** erhält sie tenantbezogene Rollen und Secrets für die vorgesehenen Migrations-, Studio- und Public-Runtime-Zugriffe
- **AND** keine dieser Runtime-Rollen erhält clusterweite Datenbank- oder Rollenverwaltungsrechte
- **AND** Credentials einer Instanz erlauben keinen Zugriff auf Waste-Datenbanken anderer Instanzen

### Requirement: Waste-Management hält Fachzugriffe bis zur Bereitschaft geschlossen

Das System SHALL den technischen Waste-Zustand pro Instanz nachvollziehbar führen und fachliche Datenzugriffe bis zur vollständigen Bereitschaft fail-closed ablehnen.

#### Scenario: Provisionierung läuft noch

- **WHEN** die Waste-Datenbank einer Instanz noch provisioniert oder migriert wird
- **THEN** ist der Zustand mindestens als `provisioning` erkennbar
- **AND** fachliche Waste-Datenzugriffe werden mit einem stabilen, handlungsleitenden Fehler abgelehnt
- **AND** eine teilweise eingerichtete Datenquelle wird nicht produktiv verwendet

#### Scenario: Provisionierung schlägt fehl

- **WHEN** ein Provisionierungsschritt fehlschlägt
- **THEN** setzt das System den instanzbezogenen Waste-Zustand auf `failed`
- **AND** hält das verwaltete Interface deaktiviert
- **AND** stellt eine berechtigte, idempotente Wiederholungsaktion bereit
- **AND** gibt in UI, API, Audit oder Logs keine Secrets aus

#### Scenario: Alle Bereitschaftsprüfungen sind erfolgreich

- **WHEN** Datenbank und Rollen vorhanden, Waste-Migrationen aktuell und vorgesehene Runtime-Zugriffe erfolgreich geprüft sind
- **THEN** aktiviert das System das verwaltete Interface
- **AND** setzt den Waste-Zustand auf `ready`
- **AND** erst dann verarbeitet die Waste-Host-Fassade fachliche Datenzugriffe für diese Instanz

### Requirement: Die Supabase-Bestandsdaten werden ausschließlich `bb-prignitz` zugeordnet

Das System SHALL den einmaligen Supabase-Bestand nur in die provisionierte Waste-Datenbank der kanonisch identifizierten Instanz `bb-prignitz` importieren.

#### Scenario: Einmalimport prüft die Zielidentität

- **WHEN** der Supabase-Einmalimport gestartet wird
- **THEN** prüft das System vor schreibenden Operationen die kanonische Instanzidentität und deren zugeordnete Zieldatenbank
- **AND** lehnt den Import bei einer anderen oder mehrdeutigen Zielinstanz ab
- **AND** dokumentiert den Lauf mit redigierter Migrationsevidenz

#### Scenario: Ein anderer Tenant wird neu provisioniert

- **WHEN** `waste-management` für eine andere Instanz als `bb-prignitz` provisioniert wird
- **THEN** erhält diese Instanz das aktuelle leere Waste-Schema
- **AND** keine Daten aus dem Supabase-Dump werden übernommen

### Requirement: Modulentzug bewahrt die tenantbezogenen Waste-Daten

Das System SHALL beim Entzug von `waste-management` den Runtime-Zugriff deaktivieren, ohne die tenantbezogene Datenbank oder ihre Sicherungen automatisch zu löschen.

#### Scenario: Studio-Admin entzieht das Waste-Modul

- **WHEN** der Studio-Admin einer Instanz `waste-management` entzieht
- **THEN** deaktiviert das System das pluginverwaltete Interface und fachliche Waste-Zugriffe
- **AND** bewahrt Datenbank, Fachdaten, Rollen, Secrets, Jobhistorie und Sicherungen auf
- **AND** führt keine implizite Drop- oder Löschoperation aus

#### Scenario: Waste wird derselben Instanz erneut zugewiesen

- **GIVEN** der erhaltene Waste-Bestand einer früheren Zuweisung existiert noch
- **WHEN** `waste-management` derselben Instanz erneut zugewiesen wird
- **THEN** reconciled das System den vorhandenen Bestand
- **AND** aktiviert ihn erst nach erneuten Migrations-, Verbindungs- und Rechteprüfungen

## MODIFIED Requirements

### Requirement: Waste-Management erlaubt die instanzbezogene Konfiguration der Waste-Datenquelle

Das System SHALL für jede Studio-Instanz eine automatisch provisionierte und pluginverwaltete Waste-Datenquelle bereitstellen, deren technische Verbindungsdetails nicht durch Tenant-Benutzer konfiguriert werden.

#### Scenario: Berechtigter Benutzer sieht den Waste-Bereitstellungsstatus

- **WHEN** ein Benutzer mit `waste-management.settings.manage` die Modul-Einstellungen der aktiven Instanz öffnet
- **THEN** sieht er einen kompakten Status der genau einen dieser Instanz zugeordneten Waste-Datenquelle
- **AND** kann er keine Verbindungsdaten, Datenbanknamen, Rollen oder Secrets erstellen, bearbeiten oder löschen
- **AND** erhält er bei einem wiederholbaren Fehler eine berechtigte Retry-Aktion

#### Scenario: Studio validiert die verwaltete Waste-Datenquelle nachvollziehbar

- **WHEN** der Provisionierer die Waste-Datenquelle anlegt, aktualisiert oder reconciled
- **THEN** validiert das System Konfiguration, Schema und vorgesehene Runtime-Rechte serverseitig
- **AND** Erfolg oder redigierte Fehler werden über den instanzbezogenen Provisionierungsstatus nachvollziehbar projiziert
- **AND** ungültige oder unvollständige Konfigurationen werden nicht aktiv

#### Scenario: Nicht erreichbare Datenquelle wird durch Reconcile repariert

- **WHEN** die verwaltete Waste-Datenquelle einer Instanz nicht erreichbar ist oder Drift aufweist
- **THEN** bleibt der Status- und Retry-Pfad in den Waste-Modul-Einstellungen verfügbar
- **AND** ein berechtigter Benutzer kann einen serverseitigen Reconcile anstoßen
- **AND** die allgemeine Interface-Verwaltung wird dadurch nicht zur manuellen Rekonfiguration freigeschaltet

