## ADDED Requirements

### Requirement: Organisationen erhalten optional einen provisionierten Mainserver-Zugang

Das System SHALL bei der Erstellung einer Organisation nach erfolgreichem lokalem Commit best-effort einen organisationsbezogenen Mainserver-Zugang über einen eindeutig zugeordneten Studio-/Keycloak-Account provisionieren, sofern die Integration konfiguriert ist. `iam.org.write` SHALL dafür einschließlich der eng begrenzten internen technischen Accounterstellung ausreichen. Die lokale Organisation SHALL unabhängig von Keycloak-, persönlichen Mainserver-Credentials und Mainserver-Verfügbarkeit erstellbar bleiben. Fehlende Zugänge SHALL später über eine explizite, idempotente Organisationsaktion provisionierbar sein.

#### Scenario: Organisation und externer Zugang werden erfolgreich erstellt

- **WHEN** ein berechtigter Administrator eine Organisation erstellt und Keycloak sowie Mainserver verfügbar sind
- **THEN** persistiert Studio zuerst die lokale Organisation
- **AND** erzeugt oder verwendet es genau einen zugeordneten Studio-/Keycloak-Account mit initial `isTechnicalAccount = true`
- **AND** provisioniert es über diesen Account den Mainserver-Zugang
- **AND** speichert es die zurückgegebenen Credentials geschützt für die Organisation
- **AND** wechselt der persistente Organisationszustand erst bei konfliktfreier DataProvider-Bindung auf `ready`

#### Scenario: Organisation wird ohne erreichbaren Mainserver erstellt

- **WHEN** die lokale Organisation gültig ist und Mainserver oder Keycloak nicht konfiguriert beziehungsweise nicht erreichbar sind
- **THEN** bleibt die lokal erstellte Organisation erfolgreich bestehen
- **AND** wird die Organisationserstellung nicht als fehlgeschlagen dargestellt
- **AND** bleiben fehlende Mainserver-Credentials als später behebbarer Zustand erkennbar

#### Scenario: Persönliche Bootstrap-Credentials fehlen

- **GIVEN** der handelnde Administrator besitzt `iam.org.write`, aber keine vollständigen persönlichen Mainserver-Credentials
- **WHEN** er eine Organisation erstellt
- **THEN** bleibt die lokal erstellte Organisation erfolgreich bestehen
- **AND** verwendet Studio keine Credentials der aktiven, der neuen oder einer anderen Organisation als Fallback
- **AND** bleibt der fehlende externe Zugang als später behebbarer Zustand sichtbar

#### Scenario: Bereits erzeugter Account bleibt nach Upstream-Ausfall zugeordnet

- **GIVEN** Studio hat den zugeordneten Account erzeugt
- **WHEN** der nachgelagerte Mainserver-Aufruf fehlschlägt oder seine Antwort verloren geht
- **THEN** löscht Studio den Account nicht kompensierend
- **AND** behält es die eindeutige Organisationszuordnung für einen Retry bei

#### Scenario: Organisation wird später nachprovisioniert

- **GIVEN** eine Organisation besitzt keine vollständigen Mainserver-Credentials
- **WHEN** ein berechtigter Administrator die explizite Organisations-Provisionierung auslöst
- **THEN** verwendet Studio den bereits zugeordneten Account oder erzeugt ihn konfliktgeschützt genau einmal
- **AND** ruft es den bestehenden Mainserver-Benutzer-Provisioning-Vertrag auf
- **AND** verändert ein Fehlschlag weder die Organisation noch bereits gültige Credentials

#### Scenario: Parallele Provisioning-Requests verwenden eine Lease

- **WHEN** mehrere Requests dieselbe Organisation gleichzeitig provisionieren wollen
- **THEN** reserviert genau eine Operation den Zustand unter `(instanceId, organizationId)` mit einer zeitlich begrenzten Lease
- **AND** erzeugen parallele Requests keinen zweiten dauerhaft zugeordneten Account
- **AND** kann eine abgelaufene Lease übernommen werden, ohne eine vorhandene Zuordnung zu ersetzen
- **AND** bleiben laufende Zwischenstände bis zum terminalen Übergang im Zustand `provisioning`
- **AND** darf eine Operation Credentials und Zustandsübergänge nur bei passender Operationsreferenz und aktiver Lease persistieren
- **AND** darf ein früherer Lauf nach einer Lease-Übernahme weder Credentials überschreiben noch Erfolg melden

#### Scenario: Prozessabbruch nach Keycloak-Erstellung wird sicher wiederaufgenommen

- **GIVEN** ein Prozess endet nach Keycloak-Erstellung, aber vor vollständiger lokaler Zuordnung
- **WHEN** ein Retry die Operation übernimmt
- **THEN** darf er nur einen eindeutigen Account mit passender deterministischer Identität sowie `instanceId`, `organizationId` und `accountPurpose = organization_mainserver` übernehmen
- **AND** übernimmt er keinen nur anhand einer ähnlichen E-Mail gefundenen fremden Account

#### Scenario: Technisches Flag und Organisationszuordnung bleiben unabhängig

- **GIVEN** ein Account ist als Mainserver-Identität einer Organisation zugeordnet
- **WHEN** ein Administrator `isTechnicalAccount` an diesem Account ändert
- **THEN** bleibt die Organisationszuordnung unverändert
- **AND** löst die Änderung allein weder Provisionierung noch Credential-Rotation aus

#### Scenario: Hard Delete löst nur die technische Accountreferenz

- **GIVEN** ein technischer Account ist einer Organisation zugeordnet und keine Provisioning-Lease ist aktiv
- **WHEN** ein berechtigter Administrator den Account über den privilegierten Hard-Delete-Pfad löscht
- **THEN** wird die Accountreferenz instanzsicher auf `null` gesetzt
- **AND** bleiben gültige Organisations-Credentials und die organisationsbezogene DataProvider-Bindung erhalten
- **AND** bleibt eine vollständig versorgte Organisation `ready`

#### Scenario: Hard Delete während aktiver Provisionierung wird abgewiesen

- **GIVEN** für den zugeordneten technischen Account läuft eine aktive Organisations-Provisioning-Lease
- **WHEN** ein Administrator den Hard Delete auslöst
- **THEN** weist das System den Delete mit einem sicheren Konflikt ab
- **AND** löscht es den Account weder in Keycloak noch lokal

### Requirement: Organisations-Provisioning besitzt einen persistenten aktuellen Zustand

Das System SHALL den aktuellen organisationsbezogenen Mainserver-Zustand kanonisch mit `not_provisioned`, `account_ready`, `provisioning`, `verification_required`, `ready`, `failed` oder `reconciliation_required` persistieren. `ready` SHALL vollständige Credentials und eine konfliktfreie aktuelle DataProvider-Bindung voraussetzen. Audit SHALL Zustandsübergänge dokumentieren, aber nicht die aktuelle Zustandsquelle ersetzen.

#### Scenario: Bestehende manuelle Credentials benötigen Verifikation

- **GIVEN** eine Organisation besitzt vor Einführung des Zustandsautomaten vollständige manuell gepflegte Credentials
- **WHEN** der Zustand migriert wird
- **THEN** erhält die Organisation `verification_required`
- **AND** rotiert oder ersetzt Studio die Credentials nicht automatisch

#### Scenario: Gewöhnliches Organisations-Update lässt gültige Credentials unverändert

- **GIVEN** eine Organisation besitzt vollständige, verifizierte Credentials im Zustand `ready`
- **WHEN** ein Update lediglich dieselbe Application-ID wiederholt und kein neues Secret liefert
- **THEN** führt Studio keinen Credential-Schreibzugriff aus
- **AND** bleiben Zustand, Verifikationszeitpunkt und DataProvider-Bindung unverändert

#### Scenario: Manuelle Credential-Änderung konkurriert mit aktiver Lease

- **GIVEN** für die Organisation läuft eine nicht abgelaufene Provisioning-Lease
- **WHEN** parallel eine tatsächliche manuelle Credential-Änderung gespeichert werden soll
- **THEN** weist Studio die Änderung mit einem Konflikt ab
- **AND** bleiben Lease, Operationsreferenz, Phase und Credentials des laufenden Provisionings unverändert

#### Scenario: Retry vervollständigt vorhandenen Zustand vor Neuprovisionierung

- **GIVEN** eine Organisation befindet sich in `verification_required` oder `reconciliation_required`
- **WHEN** ein Administrator die explizite Provisionierung erneut auslöst
- **THEN** versucht Studio zuerst vorhandene Accountzuordnung, Credentials und Binding zu vervollständigen
- **AND** synchronisiert verifizierte Organisations-Credentials vor `ready` erneut auf den zugeordneten technischen Keycloak-Account
- **AND** provisioniert oder rotiert es nicht blind neu
