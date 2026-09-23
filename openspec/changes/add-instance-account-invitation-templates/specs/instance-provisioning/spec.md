## ADDED Requirements

### Requirement: Wirksame Account-Einladung wird sicher für den Tenant-Realm aufgelöst

Das System SHALL einen optionalen serverweiten und einen optionalen
instanzbezogenen, versionierten Account-Einladungstext als Studio-owned
Konfiguration führen. Die wirksame Reihenfolge SHALL Instanzvorlage,
Servervorlage und eingebauter SVA-Standard sein. Daraus SHALL das System ausschließlich die
Keycloak-Lokalisierungsschlüssel `executeActionsSubject`,
`executeActionsBody` und `executeActionsBodyHtml` im exklusiv zugeordneten
Tenant-Realm ableiten. Der gespeicherte Text SHALL keine Realm-, Host-, Token-
oder Empfängerwerte kopieren.

#### Scenario: Individualvorlage wird revisionsgebunden gespeichert

- **WHEN** ein berechtigter Plattformadministrator eine gültige Vorlage mit der aktuell gelesenen Revision speichert
- **THEN** persistiert das System Betreff, Nachricht, beide Linkbeschriftungen und eine neue Revision atomar an genau dieser Instanz
- **AND** leitet es Tenantname aus `displayName` und die Startseite ausschließlich als HTTPS-Origin aus `primaryHostname` ab
- **AND** schreibt es keine Templateinhalte in Logs, technische Fehlerdetails oder Auditpayloads

#### Scenario: Veraltete Revision mutiert weder Registry noch Realm

- **WHEN** eine Speichermutation eine nicht mehr aktuelle Vorlagenrevision enthält
- **THEN** lehnt das System sie als Konflikt ab
- **AND** bleibt der aktuelle Instanzdatensatz unverändert
- **AND** erfolgt kein Keycloak-Zugriff mit Schreibwirkung

#### Scenario: Template wird begrenzt kompiliert

- **WHEN** eine gültige wirksame Vorlage für einen Versand kompiliert wird
- **THEN** ersetzt der Server ausschließlich die vier freigegebenen semantischen Platzhalter
- **AND** maskiert er Keycloak-MessageFormat-Sonderzeichen deterministisch
- **AND** erzeugt er Plaintext mit vollständigen sicheren URLs sowie vollständig escaped HTML mit ausschließlich serverseitig erzeugten Links
- **AND** gelangt kein frei eingegebenes HTML oder URI-Ziel in den Realm

#### Scenario: Exklusive Realm-Zuordnung wird vor dem Versand geprüft

- **WHEN** die wirksame Vorlage vor einer Einladung im Realm sichergestellt wird
- **THEN** löst der Server den Realm ausschließlich aus der aktuellen Instanz-Registry auf
- **AND** bricht er bei fehlender, fremder oder nicht eindeutiger `instanceId -> authRealm`-Zuordnung vor jeder Realm-Mutation ab

#### Scenario: Servervorlage wird revisionsgebunden gespeichert

- **WHEN** ein berechtigter Plattformadministrator eine gültige Servervorlage mit der aktuell gelesenen Revision speichert
- **THEN** persistiert das System genau einen typisierten Datensatz mit dem Schlüssel `account_invitation`
- **AND** schreibt es den Servertext nicht in Instanzdatensätze
- **AND** erfolgt kein Keycloak-Zugriff mit Schreibwirkung

#### Scenario: Wirksame Vorlage wird deterministisch aufgelöst

- **WHEN** das System die Vorlage für eine Instanz benötigt
- **THEN** verwendet es zuerst deren Individualvorlage
- **AND** verwendet es ohne Individualvorlage die Servervorlage
- **AND** verwendet es ohne beide Overrides den eingebauten SVA-Standard

#### Scenario: Sicherstellung vor Versand bleibt idempotent und eng begrenzt

- **WHEN** die kompilierten Realmwerte vor einem konkreten Versand abweichen
- **THEN** schreibt der Server ausschließlich die drei verwalteten Einladungsschlüssel
- **AND** verändert oder entfernt er keine fremden Realm-Lokalisierungen
- **AND** bestätigt er dieselben drei Werte durch Readback, bevor Keycloak die E-Mail versendet

### Requirement: SVA-E-Mail-Theme liefert den sicheren Standardtext

Das bestehende Keycloak-Theme `sva-kern2` SHALL neben dem Login-Theme einen
deutschen E-Mail-Typ mit einem versionierten SVA-Standardtext für
`execute-actions-email` bereitstellen. Neue Tenant-Realms SHALL dieses
E-Mail-Theme über die vorhandene serverseitige Realm-Baseline erhalten.

#### Scenario: Neuer Realm erhält den SVA-Standard

- **WHEN** der vorhandene Provisioner einen neuen Tenant-Realm mit der freigegebenen Baseline erstellt
- **THEN** setzt er zusätzlich `emailTheme = sva-kern2`
- **AND** bestätigt der finale Readback das E-Mail-Theme
- **AND** verwendet eine Account-Einladung ohne Individualvorlage die Servervorlage oder ersatzweise den versionierten deutschen SVA-Standardtext

#### Scenario: Bestandsrealm wird nicht als Fleet migriert

- **WHEN** eine Server- oder Instanzvorlage gespeichert, zurückgesetzt, gelesen oder normal reconciled wird
- **THEN** setzt oder ändert das System ihr E-Mail-Theme und ihre Einladungsschlüssel nicht automatisch
- **AND** richtet erst ein konkreter Einladungsversand den betroffenen Realm bedarfsgesteuert aus

#### Scenario: Instanz-Reset aktiviert die Vererbung

- **WHEN** eine Individualvorlage revisionsgebunden auf den Standard zurückgesetzt wird
- **THEN** entfernt das System die gespeicherte Individualvorlage
- **AND** löst es anschließend die Servervorlage oder den eingebauten SVA-Standard als wirksamen Text auf
- **AND** erfolgt beim Reset kein Keycloak-Write
