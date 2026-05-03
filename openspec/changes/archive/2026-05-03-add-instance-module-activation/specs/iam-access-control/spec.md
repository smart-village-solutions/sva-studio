## ADDED Requirements

### Requirement: Modulzuweisung ist ausschliesslich dem Studio-Admin vorbehalten

Das System SHALL die Aktionen `instance-registry.assignModule`, `instance-registry.revokeModule` und `instance-registry.seedIamBaseline` ausschliesslich der Systemrolle `studio.admin` erteilen. Instanz-Operatoren oder andere Rollen duerfen diese Aktionen nicht ausfuehren. Die Rollenpruefung muss `instanceId`-scoped erfolgen.

#### Scenario: Instanz-Operator kann kein Modul zuweisen oder entziehen

- **GIVEN** ein Benutzer ist Mitglied einer Instanz-Rolle, aber nicht `studio.admin`
- **WHEN** er versucht, ein Modul einer Instanz zuzuweisen oder zu entziehen
- **THEN** verweigert das System die Operation fail-closed
- **AND** wird keine Modulzuordnung veraendert
- **AND** wird kein IAM-Seeding ausgefuehrt

### Requirement: Modulzuweisung begrenzt die fachlich wirksame Permission-Basis pro Instanz

Das System SHALL modulbezogene Permissions, Rollenbeziehungen und fachliche Autorisierung pro Instanz nur fuer zugewiesene Module wirksam werden lassen.

#### Scenario: Permission eines nicht zugewiesenen Moduls wird nicht wirksam

- **GIVEN** eine Instanz hat ein global registriertes Modul nicht zugewiesen bekommen
- **WHEN** eine Autorisierungsentscheidung fuer eine modulbezogene Action oder Ressource dieses Moduls ausgewertet wird
- **THEN** behandelt das System die modulbezogene Permission-Basis als nicht vorhanden
- **AND** wird der Zugriff fail-closed verweigert

### Requirement: Modulentzug entfernt modulbezogene Berechtigungen hart

Das System SHALL bei Entzug eines Moduls von einer Instanz die modulbezogenen RBAC-Basisdaten fuer diese Instanz hart entfernen.

#### Scenario: Modulentzug entzieht bestehende Rollenzuweisungen

- **GIVEN** Rollen einer Instanz enthalten modulbezogene `role_permissions`
- **WHEN** das zugehoerige Modul von dieser Instanz entzogen wird
- **THEN** entfernt das System diese modulbezogenen `role_permissions`
- **AND** entfernt es die zugrunde liegenden modulbezogenen Permissions
- **AND** bleiben danach keine fachlich wirksamen Restrechte des entzogenen Moduls fuer diese Instanz zurueck

### Requirement: IAM-Seeding durch Modulzuweisung darf Actor-eigene Rollenmitgliedschaft nicht veraendern

Das System SHALL sicherstellen, dass das IAM-Baseline-Seeding im Rahmen einer Modulzuweisung keine User-Role-Assignments des aufrufenden Studio-Admins anlegt oder erweitert. Das Seeding darf Permissions und `role_permissions` fuer Systemrollen schreiben, aber keine Rollenmitgliedschaften des aufrufenden Actors veraendern.

#### Scenario: Modulzuweisung verschafft dem Studio-Admin keine neuen eigenen Rechte

- **GIVEN** der Studio-Admin weist einer Instanz ein Modul zu, dessen Systemrolle er selbst nicht inne hat
- **WHEN** das IAM-Baseline-Seeding ausgefuehrt wird
- **THEN** werden Permissions und `role_permissions` der Systemrolle korrekt angelegt
- **AND** wird die Rollenmitgliedschaft des aufrufenden Studio-Admins nicht veraendert
- **AND** erwirbt der Studio-Admin durch die Zuweisung keine zusaetzlichen Rechte

### Requirement: Neu-Seeding rekonstruiert die IAM-Basis aus Core und zugewiesenen Modulen

Das System SHALL die Rekonstruktion der IAM-Basis einer Instanz deterministisch aus `Core + zugewiesenen Modulen` ableiten koennen.

#### Scenario: Studio-Admin seeded die IAM-Basis erneut

- **GIVEN** die IAM-Basis einer Instanz ist fuer aktive Module unvollstaendig oder driftet
- **WHEN** der Studio-Admin die Reparaturaktion zum Neu-Seeden ausfuehrt
- **THEN** erzeugt das System die erwarteten Permissions, kanonischen Systemrollen und `role_permissions` idempotent neu
- **AND** fuegt es keine Rechte fuer nicht zugewiesene Module hinzu

#### Scenario: Seed wird auf bereits vollstaendiger IAM-Basis ausgefuehrt

- **GIVEN** die IAM-Basis einer Instanz ist fuer alle zugewiesenen Module vollstaendig und korrekt
- **WHEN** der Studio-Admin die Reparaturaktion zum Neu-Seeden erneut ausfuehrt
- **THEN** erzeugt das System keine doppelten Permissions, Rollen oder `role_permissions`
- **AND** entfernt es keine bestehenden Eintraege
- **AND** schlaegt die Operation nicht mit einem Fehler fehl
- **AND** ist das Ergebnis identisch mit dem Ausgangszustand

### Requirement: Audit-Events fuer Modulzuweisung, Modulentzug und Reseeding sind normativ definiert

Das System SHALL fuer `instance-registry.assignModule`, `instance-registry.revokeModule` und `instance-registry.seedIamBaseline` Audit-Events mit einem normativen Mindestumfang schreiben. Das Audit-Event muss mindestens `instanceId`, `moduleId` falls modulbezogen, `actor.userId` als technische ID, `correlationId`, `before`, `after` und `outcome` enthalten. Personenbezogene Klardaten wie Name oder E-Mail duerfen nicht geloggt werden.

#### Scenario: Audit-Event enthaelt nur technische Identifikatoren und den Mutationskontext

- **GIVEN** der Studio-Admin weist einer Instanz ein Modul zu, entzieht es oder fuehrt ein Reseeding aus
- **WHEN** die Mutation abgeschlossen oder abgelehnt wird
- **THEN** schreibt das System ein Audit-Event mit `instanceId`, technischem Actor-Kontext, `correlationId`, Vorher-/Nachher-Zustand und `outcome`
- **AND** enthaelt das Audit-Event keine personenbezogenen Klardaten wie Name oder E-Mail
