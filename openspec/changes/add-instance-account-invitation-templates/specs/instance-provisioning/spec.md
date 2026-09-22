## ADDED Requirements

### Requirement: Instanzbezogene Account-Einladung wird sicher in den Tenant-Realm projiziert

Das System SHALL optional einen versionierten Account-Einladungstext als
Studio-owned Instanzkonfiguration führen und daraus ausschließlich die
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

- **WHEN** eine gültige Individualvorlage projiziert wird
- **THEN** ersetzt der Server ausschließlich die vier freigegebenen semantischen Platzhalter
- **AND** maskiert er Keycloak-MessageFormat-Sonderzeichen deterministisch
- **AND** erzeugt er Plaintext mit vollständigen sicheren URLs sowie vollständig escaped HTML mit ausschließlich serverseitig erzeugten Links
- **AND** gelangt kein frei eingegebenes HTML oder URI-Ziel in den Realm

#### Scenario: Exklusive Realm-Zuordnung wird vor Mutation geprüft

- **WHEN** eine Vorlagenprojektion oder ein Reset angefordert wird
- **THEN** löst der Server den Realm ausschließlich aus der aktuellen Instanz-Registry auf
- **AND** bricht er bei fehlender, fremder oder nicht eindeutiger `instanceId -> authRealm`-Zuordnung vor jeder Realm-Mutation ab

#### Scenario: Projektion wird kausal bestätigt

- **WHEN** die drei kompilierten Lokalisierungsschlüssel nach Keycloak geschrieben wurden
- **THEN** liest der Server genau diese Schlüssel aus demselben Realm zurück
- **AND** meldet er `in_sync` nur bei vollständiger Übereinstimmung
- **AND** klassifiziert er Teilfehler oder Abweichungen als `drifted` beziehungsweise `unavailable`

#### Scenario: Retry bleibt idempotent und eng begrenzt

- **WHEN** dieselbe gespeicherte Vorlagenrevision nach einem Teilfehler erneut projiziert wird
- **THEN** schreibt der Server erneut ausschließlich die drei verwalteten Einladungsschlüssel
- **AND** verändert oder entfernt er keine fremden Realm-Lokalisierungen
- **AND** kann der exakte Readback die Revision anschließend als `in_sync` bestätigen

### Requirement: SVA-E-Mail-Theme liefert den sicheren Standardtext

Das bestehende Keycloak-Theme `sva-kern2` SHALL neben dem Login-Theme einen
deutschen E-Mail-Typ mit einem versionierten SVA-Standardtext für
`execute-actions-email` bereitstellen. Neue Tenant-Realms SHALL dieses
E-Mail-Theme über die vorhandene serverseitige Realm-Baseline erhalten.

#### Scenario: Neuer Realm erhält den SVA-Standard

- **WHEN** der vorhandene Provisioner einen neuen Tenant-Realm mit der freigegebenen Baseline erstellt
- **THEN** setzt er zusätzlich `emailTheme = sva-kern2`
- **AND** bestätigt der finale Readback das E-Mail-Theme
- **AND** verwendet eine Account-Einladung ohne Individualvorlage den versionierten deutschen Standardtext

#### Scenario: Bestandsrealm wird nicht automatisch migriert

- **WHEN** eine bestehende Instanz ohne ausdrückliche Vorlagenmutation gelesen, geprüft oder normal reconciled wird
- **THEN** setzt oder ändert das System ihr E-Mail-Theme und ihre Einladungsschlüssel nicht automatisch
- **AND** bleibt eine spätere ausdrückliche Speicherung oder Rücksetzung als kontrollierter Migrationspunkt verfügbar

#### Scenario: Reset entfernt nur die Individualisierung

- **WHEN** eine Individualvorlage revisionsgebunden auf den Standard zurückgesetzt wird
- **THEN** entfernt das System die gespeicherte Individualvorlage
- **AND** setzt es im zugeordneten Realm das E-Mail-Theme `sva-kern2`
- **AND** entfernt es ausschließlich die drei individuellen Einladungsschlüssel
- **AND** bestätigt der Readback den wirksamen SVA-Standard, ohne andere Realm-Lokalisierungen zu verändern

