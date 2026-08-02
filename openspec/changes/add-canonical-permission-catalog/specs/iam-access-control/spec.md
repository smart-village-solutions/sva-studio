## ADDED Requirements

### Requirement: Kanonischer Permission-Katalog ist die einzige fachliche Definitionsquelle

Das System MUST bekannte Core- und Modul-Permissions in einer typsicheren, validierten Katalogsicht zusammenführen. Seed-, Bootstrap-, Reconcile-, Diagnose- und Testpfade MUST ihre Permission-Definitionen aus dieser Katalogsicht ableiten und dürfen keine unabhängigen fachlichen Parallelkataloge pflegen.

#### Scenario: Neue tenantweite Permission wird einmalig deklariert

- **WHEN** eine neue tenantweite Permission in den kanonischen Katalog aufgenommen wird
- **THEN** verwenden neue Tenant-Baselines und Reconcile-Läufe für bestehende Tenants dieselbe Definition
- **AND** ist keine zusätzliche handgeschriebene Permission-Liste im Runtime-Bootstrap erforderlich

#### Scenario: Ungültiger oder doppelter Katalogeintrag

- **WHEN** der zusammengesetzte Katalog doppelte Keys, unbekannte Module, fremde Namespaces oder widersprüchliche Root-/Tenant-Metadaten enthält
- **THEN** schlägt die Validierung vor Deployment fehl
- **AND** es wird kein partieller Katalogzustand persistiert

### Requirement: Tenant-Permissions gewähren system_admin standardmäßig Vollzugriff

Das System MUST aktive tenantweite Permissions und aktive Permissions zugewiesener Module standardmäßig als verwalteten Grant an die geschützte Tenant-Rolle `system_admin` binden. Abweichungen MUST pro Permission explizit im Katalog definiert sein. Root-Permissions dürfen niemals durch diesen Default an `system_admin` gebunden werden.

#### Scenario: Tenant-Permission ohne explizite Ausnahme

- **WHEN** eine aktive tenantweite Permission keinen expliziten `systemAdminGrant`-Wert definiert
- **THEN** behandelt der Katalog den Wert als `true`
- **AND** ergänzt der Reconcile den fehlenden Grant an `system_admin`

#### Scenario: Explizite Ausnahme vom Default-Grant

- **WHEN** eine tenantweite oder modulbezogene Permission `systemAdminGrant=false` definiert
- **THEN** erzeugt der Reconcile für diese Permission keinen automatischen `system_admin`-Grant
- **AND** bleibt die Ausnahme im Katalog nachvollziehbar

#### Scenario: Root-Permission bleibt isoliert

- **WHEN** eine Permission als `root` klassifiziert ist
- **THEN** darf der Tenant-Reconcile sie weder materialisieren noch an `system_admin` vergeben

### Requirement: Permission-Reconcile arbeitet additiv und nicht destruktiv

Das System MUST einen idempotenten, instanzgebundenen Permission-Reconcile bereitstellen, der fehlende aktive Definitionen und katalogverwaltete Grants ergänzt. Das Fehlen oder Deprecaten eines Katalogeintrags darf keine persistierte Permission, keinen manuellen Grant und keine Custom-Rollen-Zuordnung automatisch löschen.

#### Scenario: Bestehender Tenant erhält neue Permission

- **WHEN** der Reconcile für einen bestehenden Tenant nach Erweiterung des Katalogs ausgeführt wird
- **THEN** wird die fehlende Permission idempotent angelegt oder aktualisiert
- **AND** wird ein vorgesehener fehlender `system_admin`-Grant ergänzt
- **AND** wird der betroffene Permission-Snapshot invalidiert

#### Scenario: Wiederholter Reconcile

- **WHEN** derselbe Katalogstand wiederholt für denselben Tenant reconciled wird
- **THEN** entstehen keine doppelten Permission- oder Rollen-Permission-Datensätze
- **AND** bleiben Custom-Rollen, manuelle Grants und Account-Rollenzuweisungen unverändert

#### Scenario: Katalogeintrag wurde entfernt oder deprecated

- **WHEN** eine persistierte Permission nicht mehr als aktiv im Katalog enthalten ist
- **THEN** löscht der additive Reconcile weder die Permission noch bestehende manuelle Grants
- **AND** benötigt eine destruktive Bereinigung einen separaten expliziten Change

### Requirement: Modul-Permissions werden aktivierungsgebunden materialisiert

Das System MUST Definitionen eines zugewiesenen Moduls spätestens bei dessen Aktivierung materialisieren und vorgesehene verwaltete Grants herstellen. Bereits vorhandene Modul-Permission-Definitionen dürfen vor Aktivierung oder nach Deaktivierung bestehen bleiben.

#### Scenario: Modul wird aktiviert

- **WHEN** ein Modul einer Instanz zugewiesen wird
- **THEN** materialisiert der Reconcile seine aktiven Permission-Definitionen
- **AND** bindet er sie standardmäßig an `system_admin`, sofern keine explizite Ausnahme definiert ist

#### Scenario: Modul wird deaktiviert

- **WHEN** ein Modul einer Instanz entzogen wird
- **THEN** darf der eindeutig modulverwaltete `system_admin`-Grant gemäß Modulentzugsvertrag unwirksam gemacht werden
- **AND** bleibt die Permission-Definition erhalten
- **AND** bleiben manuelle Grants und Custom-Rollen unverändert

