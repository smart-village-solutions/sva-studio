## ADDED Requirements

### Requirement: Direkte Keycloak-Realm-Rollenzuweisungen verwenden iam.role.write

Das System SHALL direkte Zuweisungen regulärer Tenant-Realm-Rollen ausschließlich über die bestehende Permission `iam.role.write` autorisieren. Es SHALL dafür keine anwendungsspezifische oder Keycloak-spezifische zusätzliche Permission und keinen Freigabeworkflow verlangen.

#### Scenario: Berechtigter Actor weist externe Realm-Rolle zu

- **GIVEN** ein Actor besitzt im aktiven Tenant die effektive Permission `iam.role.write`
- **AND** die Zielrolle ist als reguläre Tenant-Realm-Rolle zuweisbar
- **WHEN** der Actor die Rolle einem Benutzer direkt zuweist
- **THEN** darf der serverseitige Zuweisungspfad ausgeführt werden
- **AND** ist keine zusätzliche Mainserver-, Keycloak- oder Governance-Permission erforderlich

#### Scenario: Fehlende Permission blockiert direkten API-Aufruf

- **GIVEN** ein Actor besitzt `iam.role.write` nicht
- **WHEN** er den Keycloak-Rollenzuweisungspfad direkt aufruft
- **THEN** weist der Server die Mutation mit `403 Forbidden` ab
- **AND** darf weder eine Keycloak- noch eine IAM-Mutation stattfinden

### Requirement: Tenant-Rollenpolicy schützt interne und realmfremde Rollen

Das System MUST vor jeder tenantseitigen Keycloak-Rollenzuweisung Rolle, Benutzer und Realm serverseitig auflösen. Keycloak-Builtins, Clientrollen, technische Service-Rollen sowie Root-/Plattformrollen SHALL sichtbar, aber im Tenant nicht über diesen Pfad zuweisbar sein.

#### Scenario: Keycloak-Builtin bleibt read-only

- **WHEN** eine Rolle `offline_access`, `uma_authorization` oder `default-roles-*` entspricht
- **THEN** kennzeichnet das System sie als Keycloak-Builtin
- **AND** lehnt es eine tenantseitige Assign- oder Remove-Mutation fail-closed ab

#### Scenario: Root-, Service- oder Clientrolle bleibt geschützt

- **WHEN** die Zielrolle eine Clientrolle, `realm_account_admin`, `instance_registry_admin` oder eine andere zentral klassifizierte Root-/Service-Rolle ist
- **THEN** zeigt das System sie nur mit nicht mutierbarer Schutzbegründung an
- **AND** kann auch ein manipulierter direkter API-Aufruf die Rolle im Tenant nicht zuweisen oder entziehen

#### Scenario: Reguläre externe Realm-Rolle benötigt keine Namens-Allowlist

- **WHEN** eine Realm-Rolle im gebundenen Tenant weder Builtin noch Client-, Service-, Root- oder Plattformrolle ist
- **THEN** ist sie grundsätzlich direkt zuweisbar
- **AND** hängt ihre Zuweisbarkeit nicht von einem im Studio veröffentlichten anwendungsspezifischen Rollennamen ab

### Requirement: Externe Keycloak-Rollen erzeugen keine Studio-Permissions

Das System SHALL externe Keycloak-Rollen und ihre direkten oder geerbten Zuweisungen getrennt von lokalen IAM-Rollen führen. Außer dem ausdrücklich gekoppelten Sonderpfad für `system_admin` dürfen sie keine lokale Studio-Rolle, Gruppenmitgliedschaft oder effektive Studio-Permission erzeugen.

#### Scenario: Externe Anwendungsrolle bleibt ohne Studio-Wirkung

- **WHEN** ein Benutzer eine externe Realm-Rolle direkt oder über eine Composite Role erhält
- **THEN** kann die Rolle von der konsumierenden Anwendung ausgewertet werden
- **AND** bleiben lokale `iam.account_roles`, Gruppenbeziehungen und effektive Studio-Permissions unverändert
- **AND** öffnet die Rolle allein kein Studio-UI- oder API-Gate

#### Scenario: Externe Rolle für unmapped Benutzer erzeugt kein lokales Konto

- **WHEN** ein im Tenant-Realm vorhandener, aber lokal unmapped Benutzer eine reguläre externe Realm-Rolle erhält
- **THEN** führt das System die Keycloak-Zuweisung aus
- **AND** legt es dadurch weder `iam.accounts`, Instanzmitgliedschaft noch lokale Rollenbeziehung implizit an

### Requirement: system_admin bleibt zuweisbar und besonders geschützt

Das System SHALL `system_admin` im Tenant als zuweisbare Rolle anzeigen und verwalten. Die Mutation MUST über den gekoppelten lokalen IAM-/Keycloak-Sonderpfad erfolgen und darf nicht durch den generischen externen Rollenzuweisungspfad die lokale Autorisierungsquelle umgehen.

#### Scenario: Bestehender system_admin weist system_admin zu

- **GIVEN** der Actor ist selbst `system_admin` und besitzt effektiv `iam.role.write`
- **AND** das Ziel ist ein gemapptes Tenant-Konto mit aktiver Instanzmitgliedschaft
- **WHEN** der Actor `system_admin` zuweist
- **THEN** hält das System lokale IAM-Rolle und direkte Keycloak-Sonderrolle konsistent
- **AND** ist kein zusätzlicher Freigabeschritt erforderlich

#### Scenario: Nicht-system_admin darf system_admin nicht zuweisen

- **GIVEN** ein Actor besitzt `iam.role.write`, ist aber nicht selbst `system_admin`
- **WHEN** er versucht, `system_admin` zuzuweisen oder zu entziehen
- **THEN** weist das System die Mutation mit `403 Forbidden` ab
- **AND** bleiben IAM- und Keycloak-Zustand unverändert

#### Scenario: Letzter aktiver system_admin bleibt erhalten

- **WHEN** eine Mutation dem letzten aktiven `system_admin` des Tenants diese Rolle entziehen würde
- **THEN** lehnt das System die Mutation ab
- **AND** bleiben lokale und Keycloak-seitige Zuweisung erhalten

### Requirement: Keycloak-Rollenzuweisungen sind minimale verifizierte Deltas

Das System MUST externe Realm-Rollenzuweisungen als idempotente einzelne Deltas ausführen und darf keine vollständige clientseitig gelieferte Rollenmenge als Ersatz schreiben. Nur direkte Zuweisungen sind entziehbar; geerbte effektive Rollen bleiben read-only.

#### Scenario: Einzelne Zuweisung erhält alle anderen Rollen

- **WHEN** ein Admin eine reguläre externe Realm-Rolle zuweist oder entzieht
- **THEN** verändert der Server ausschließlich diese direkte Rollenbeziehung
- **AND** bleiben Builtins, parallele externe Rollen und unbekannte Rollenzuweisungen unverändert

#### Scenario: Geerbte Rolle kann nicht direkt entzogen werden

- **GIVEN** ein Benutzer besitzt eine Rolle ausschließlich über eine Composite Role
- **WHEN** ein Admin versucht, diese Rolle direkt zu entziehen
- **THEN** führt das System keinen irreführenden Remove-Aufruf aus
- **AND** erklärt es, dass die Rolle nur über ihre direkte Composite-Herkunft verändert werden kann

#### Scenario: Erfolg wird kausal bestätigt

- **WHEN** ein Assign- oder Remove-Aufruf gegen Keycloak abgeschlossen wurde
- **THEN** liest das System die direkten Zuweisungen über denselben tenantgebundenen Provider erneut
- **AND** meldet Erfolg nur bei bestätigtem Zielzustand
- **AND** meldet einen stabilen Konflikt- oder Reconciliation-Zustand, wenn das Ergebnis nicht eindeutig nachweisbar ist
