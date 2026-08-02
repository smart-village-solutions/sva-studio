## MODIFIED Requirements

### Requirement: Waste-Management erlaubt die instanzbezogene Konfiguration der Waste-Datenquelle

Das System SHALL für jede Studio-Instanz eine über Studio-Einstellungen pflegbare PostgreSQL-Waste-Datenquelle bereitstellen.

#### Scenario: Berechtigter Benutzer pflegt die Waste-Datenquelle über Studio-Einstellungen

- **WHEN** ein Benutzer mit `waste-management.settings.manage` die Modul-Einstellungen der aktiven Instanz bearbeitet
- **THEN** kann er die für diese Instanz vorgesehene genau eine PostgreSQL-Waste-Datenquelle auswählen oder aktualisieren
- **AND** die Änderung wird über die Host-Fassade verarbeitet
- **AND** die Verbindungsdaten werden im zentralen Studio-Postgres gehalten
- **AND** Secrets oder Zugangsdaten werden nicht im Browser offengelegt
- **AND** Waste-Management verlangt keine Supabase-Projekt-URL und keinen Supabase-Service-Role-Key

#### Scenario: Studio validiert die konfigurierte Waste-Datenquelle nachvollziehbar

- **WHEN** für eine Instanz eine Waste-Datenquelle gespeichert oder aktualisiert wird
- **THEN** validiert das System die PostgreSQL-Konfiguration serverseitig
- **AND** Erfolg oder Fehler werden für den Benutzer nachvollziehbar rückgemeldet
- **AND** ungültige oder unvollständige Konfigurationen dürfen nicht stillschweigend aktiv werden

#### Scenario: Rekonfiguration bleibt bei nicht erreichbarer Datenquelle möglich

- **WHEN** die aktuell hinterlegte Waste-Datenquelle einer Instanz nicht mehr erreichbar ist, etwa während oder nach einem Datenbankumzug
- **THEN** bleibt mindestens der Settings-Pfad zur Datenquellenkonfiguration verfügbar
- **AND** ein berechtigter Benutzer kann die Verbindungsdaten serverseitig aktualisieren und erneut prüfen
- **AND** die Unerreichbarkeit der alten Datenquelle blockiert die Rekonfiguration nicht

### Requirement: Waste-Management-Datenquellen und Migrationen bleiben administrierbar

Das System SHALL die instanzbezogene PostgreSQL-Waste-Datenquelle und deren Schema-Migrationsstand administrierbar halten.

#### Scenario: Plugin bietet Initialisierung oder Update-Migrationen an

- **WHEN** das Waste-Management-Plugin für eine Instanz erstmals gestartet wird oder nach einem Update feststellt, dass ausstehende Waste-Migrationen vorliegen
- **THEN** bietet das System die erforderliche Initialisierung oder Migration als explizite Admin-Operation an
- **AND** die Migration wird nicht als verdeckter Browser-Direktzugriff auf die Datenbank ausgeführt

#### Scenario: Migrationen sind nachvollziehbare technische Operationen

- **WHEN** eine Waste-Migration für die aktive Instanz ausgeführt wird
- **THEN** ist deren Ergebnis für Administratoren nachvollziehbar
- **AND** Erfolg, Fehler oder ausstehender Status können über Studio-Verträge eingesehen werden

## ADDED Requirements

### Requirement: Waste-Management verwendet PostgreSQL ohne Supabase-Laufzeitabhängigkeit

Das System SHALL seine fachliche Waste-Persistenz über eine direkte serverseitige PostgreSQL-Verbindung betreiben.

#### Scenario: Waste-Runtime löst eine PostgreSQL-Schnittstelle auf

- **WHEN** die Host-Fassade Waste-Daten liest, schreibt oder migriert
- **THEN** löst sie die für die aktive Instanz ausgewählte Schnittstelle vom Typ `postgresql` auf
- **AND** verwendet sie deren entschlüsselte `databaseUrl` und das konfigurierte Schema ausschließlich serverseitig
- **AND** benötigt sie keine Supabase-API, Projekt-URL oder Service-Role-Credentials

#### Scenario: Waste-Datenbank bleibt von Studio-Governance getrennt

- **WHEN** Waste-Management in derselben PostgreSQL-Serverinstanz wie das Studio betrieben wird
- **THEN** liegen die Waste-Fachdaten in der separaten Datenbank `sva_waste`
- **AND** verwenden administrative und öffentliche Runtime getrennte Rollen mit minimalen Rechten
- **AND** IAM-, Audit-, Registry- und sonstige Studio-Governance-Daten verbleiben in der Studio-Datenbank

### Requirement: Vorhandene Waste-Supabase wird einmalig offline migriert

Das System SHALL für die eine vorhandene Waste-Supabase einen kontrollierten Offline-Cutover in die neue PostgreSQL-Fachdatenbank bereitstellen.

#### Scenario: Finaler Dump entsteht ohne parallele Waste-Schreibzugriffe

- **WHEN** der produktive Cutover beginnt
- **THEN** werden Studio-App, Public-Waste-App und Waste-Worker im angekündigten Betriebsfenster kontrolliert gestoppt
- **AND** laufende Waste-Jobs werden vor dem finalen Dump beendet oder kontrolliert abgebrochen
- **AND** verbleibende schreibende Datenbanksitzungen werden ausgeschlossen
- **AND** die Quelle bleibt bis zur abgeschlossenen Umschaltung unverändert
- **AND** das System führt dafür keinen dauerhaften Anwendungs-Wartungsmodus ein

#### Scenario: Restore wird vor der Umschaltung vollständig verifiziert

- **WHEN** der PostgreSQL-Dump in die vorbereitete Ziel-Datenbank eingespielt wurde
- **THEN** prüft der Migrationsablauf Schemaobjekte, Migrationen und fachliche Zeilenzahlen
- **AND** prüft er die echte Runtime-Rolle mit Lese- und kontrollierten Schreibzugriffen
- **AND** darf die Zielverbindung erst nach erfolgreichen Pflichtprüfungen aktiviert werden

#### Scenario: Cutover schaltet beide Waste-Runtimes gemeinsam um

- **WHEN** die Ziel-Datenbank erfolgreich verifiziert wurde
- **THEN** verwenden Studio-Waste und Public-Waste dieselbe neue PostgreSQL-Fachdatenbank
- **AND** werden administrative und öffentliche Smoke-Tests vor der Freigabe gemeinsam ausgeführt
- **AND** entsteht kein dauerhafter Dual-Write- oder Replikationsvertrag

#### Scenario: Supabase bleibt zeitlich begrenzt als Rollback-Stand erhalten

- **WHEN** der Cutover erfolgreich abgeschlossen ist
- **THEN** bleibt die alte Supabase-Datenbank 14 Tage schreibgeschützt als Vergleichs- und Notfallquelle verfügbar
- **AND** beschreibt das Runbook den verlustfreien Rollback beider Runtimes vor Freigabe neuer Zielschreibzugriffe
- **AND** behandelt es einen späteren Rückwechsel als erneute kontrollierte Datenmigration
- **AND** erfolgt eine spätere Stilllegung erst nach gesonderter Bestätigung
