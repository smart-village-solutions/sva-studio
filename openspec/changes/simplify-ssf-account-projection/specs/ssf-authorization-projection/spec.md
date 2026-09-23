## ADDED Requirements

### Requirement: Die SSF-Autorisierungsrevision versioniert den wirksamen Vertrag

Das System SHALL die tenantgebundene `ssf_authorization_revision`
deterministisch aus Vertragsversion, erlaubtem Permission-Katalog und
kanonischen Studio→SSF-Abbildungsregeln bilden. Konkrete Benutzerkennungen,
Mitgliedschaften und Subject-Reihenfolge MUST die Revision nicht verändern.
Alle Benutzer desselben bestätigten Vertragsstands MUST dieselbe Revision
erhalten. Inhaltsvergleich und Generation MUST davon unabhängig die
vollständige Projektion einschließlich Subjects, Rollen und Permissions prüfen.

#### Scenario: Ein Account wird hinzugefügt

- **GIVEN** Vertrag und Abbildungsregeln bleiben unverändert
- **WHEN** Studio einen weiteren berechtigten Account synchron anlegt
- **THEN** erhält er die bereits bestätigte aktuelle Revision
- **AND** müssen vorhandene Accounts nicht wegen der Neuanlage neu geschrieben werden
- **AND** wird kein tenantweiter Reconcile zum Abschluss dieser Anlage ausgelöst

#### Scenario: Gleiche Vertragsrevision mit geänderten Benutzerrechten

- **GIVEN** die Revision bleibt gleich, aber die vollständige gewünschte Subject-Projektion ändert sich
- **WHEN** der bestehende Lifecycle den Zustand übernimmt
- **THEN** erhöht er die vorhandene Generation und invalidiert die bisherige Bestätigung
- **AND** überspringt er die Projektion nicht allein wegen gleicher Revision
- **AND** werden alte und neue Inhalte ohne zusätzliche persistierte Revision unterschieden

#### Scenario: Read-back weicht bei gleicher Revision ab

- **GIVEN** gewünschte und zurückgelesene Projektion tragen dieselbe Vertragsrevision
- **WHEN** sich Subjects, Rollen oder Permissions unterscheiden
- **THEN** schlägt die inhaltliche Bestätigung fehl und wird keine neue Readiness veröffentlicht

#### Scenario: Der Autorisierungsvertrag ändert sich

- **WHEN** sich Vertragsversion, Permission-Katalog oder kanonische Abbildungsregeln ändern
- **THEN** entsteht deterministisch eine neue Vertragsrevision
- **AND** konvergiert der bestehende Lifecycle die betroffenen Subjects darauf

### Requirement: Alte Vertragsstände bleiben bis zur Konvergenz gesperrt

Der bestehende Readiness-Leser MUST den unterstützten bestätigten
Projektionsvertragsstand prüfen. Ein veralteter gespeicherter `ready`-Status
MUST bereits vor dem ersten Reconcile abgelehnt werden. Die Umstellung MUST
die bestehende Lifecycle-Vertragsrevision aktualisieren und den vorhandenen
Vertragsdrift-Scheduler für die Konvergenz verwenden. Create MUST bis dahin
unmittelbar fehlschlagen und keinen Migrations- oder Retry-Job starten.

#### Scenario: Deployment vor dem ersten Reconcile

- **GIVEN** ein gespeicherter Ready-Datensatz verwendet noch die vorherige Projektionsvertragsversion
- **WHEN** der neue Stand Readiness für Create, Directory oder Runtime liest
- **THEN** wird der alte Vertragsstand nicht freigegeben
- **AND** plant der bestehende Lifecycle-Scheduler aufgrund seiner Vertragsdrift den Reconcile
- **AND** entstehen keine parallelen Revisionsquellen oder neue Persistenz

#### Scenario: Rollback auf den vorherigen Stand

- **GIVEN** die Projektion war bereits auf den neuen Vertragsstand konvergiert
- **WHEN** der reguläre Rollout-Prozess auf den vorherigen Stand zurückkehrt
- **THEN** darf dessen Readiness keinen nicht unterstützten Vertragsstand freigeben
- **AND** muss vor erneuter Freigabe die Konvergenz auf dessen unterstützten Stand nachgewiesen sein

### Requirement: Account-Create und Lifecycle besitzen getrennte Aufgaben

Der bestehende Tenant-Lifecycle MUST Mandantenbasis, Mapper-Drift und spätere
Rechteänderungen behandeln. Create MUST die benutzerspezifische Neuanlage
synchron abschließen und darf den Lifecycle weder als Abschluss einplanen noch
auf dessen Job warten. Beide Abläufe MUST dieselbe Tenant-Sperre verwenden;
der Source-Snapshot des Reconcile MUST innerhalb dieser Sperre gelesen werden.

#### Scenario: Create und Reconcile überschneiden sich

- **GIVEN** ein Reconcile und eine neue Account-Anlage betreffen denselben Tenant
- **WHEN** einer der Abläufe die gemeinsame Sperre hält
- **THEN** kann der andere keinen widersprechenden Projektionswrite ausführen
- **AND** liest ein nach Create gestarteter Reconcile seinen Source-Snapshot erst nach dem lokalen Commit
- **AND** entfernt er keine neuen Claims aufgrund eines vor Sperrerwerb gelesenen Bestands

#### Scenario: Spätere Rechteänderung oder Mapper-Drift

- **GIVEN** eine Account-Anlage ist bereits abgeschlossen
- **WHEN** später Rechte oder Mapper vom gewünschten Zustand abweichen
- **THEN** verwendet der Lifecycle seine vorhandene Projektion, Read-back- und Recovery-Behandlung
- **AND** wird die abgeschlossene Account-Anlage nicht rückwirkend zu einem Pending-Vorgang
- **AND** bleibt die bestehende begrenzte Gültigkeit zuvor ausgestellter Tokens unverändert

### Requirement: Directory berücksichtigt synchron abgeschlossene Accounts

Die bestehende Directory-Prüfung MUST bestätigte aktuelle Mandantenreadiness
mit einem aktiven lokalen Account, Mandantenmitgliedschaft und kanonisch
ermittelten effektiven SSF-Rechten verbinden. Der Benutzernachweis MUST ohne
Warten auf eine neue bestätigte tenantweite Subject-Liste verfügbar sein.
Create MUST dafür keinen nicht erfolgten Read-back als bestätigt speichern.

#### Scenario: Erster berechtigter Account bei leerer bestätigter Subject-Liste

- **GIVEN** der Mandant ist bestätigt bereit, aber seine letzte bestätigte Projektionsliste enthält keine Subjects
- **WHEN** die erste aktive SSF-berechtigte Account-Anlage erfolgreich commitet
- **THEN** berücksichtigt die nächste Directory-Abfrage den Account unmittelbar
- **AND** benötigt dies weder einen Projektionsjob noch einen Keycloak-Read-back

#### Scenario: Kein geeigneter Account oder keine aktuelle Readiness

- **GIVEN** es gibt nur inaktive, nicht SSF-berechtigte oder zurückgerollte Neuanlagen oder die aktuelle Mandantenreadiness fehlt
- **WHEN** die Directory-Prüfung erfolgt
- **THEN** begründen diese Anlagen keine Freigabe des Mandanten
