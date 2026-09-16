## ADDED Requirements

### Requirement: Neue Tenant-Realms verwenden eine servergeführte Baseline

Das System SHALL für `realmMode = new` eine versionierte, ausschließlich serverseitig aufgelöste Keycloak-Realm-Baseline verwenden. Die Baseline SHALL die plattformweit einheitlichen nicht geheimen Realm-, Client-, Lokalisierungs-, Event-, Benutzerprofil-, Mapper- und SMTP-Werte festlegen, ohne diese Details bei jeder Tenant-Erstellung erneut abzufragen.

#### Scenario: Neuer Realm erhält die zentrale Baseline

- **WHEN** eine berechtigte Person einen neuen Tenant mit `realmMode = new` anlegt
- **THEN** leitet der Server Realmname, Login-Client-ID, Tenant-Admin-Client-ID und Realm-Baseline aus `instanceId` und serverseitiger Konfiguration ab
- **AND** setzt der Realm das freigegebene Theme, Dark Mode, ausschließlich die Sprache `de`, Event-Konfiguration, Studio-eigene Benutzerprofilattribute und den `instanceId`-Mapper
- **AND** muss der Browser diese technischen Standardwerte nicht als Eingaben liefern

#### Scenario: Abweichende New-Realm-Defaults werden abgelehnt

- **WHEN** ein Client für `realmMode = new` technische Werte mitsendet, die der serverseitigen Ableitung widersprechen
- **THEN** lehnt das System den Auftrag vor Registry- oder Keycloak-Mutation mit einem stabilen Validierungsfehler ab
- **AND** entsteht weder ein teilweise angelegter Tenant noch ein abweichender Realm-Vertrag

#### Scenario: Retry wechselt die Baseline nicht stillschweigend

- **WHEN** ein persistierter Provisionierungsauftrag nach einer Baseline-Änderung wiederholt wird
- **THEN** erkennt das System die abweichende Baseline-Version oder ihren Fingerprint vor der Mutation
- **AND** bricht der alte Auftrag fail-closed ab und muss neu geplant werden

#### Scenario: Bestands-Realm bleibt von der New-Realm-Baseline unberührt

- **WHEN** eine Instanz `realmMode = existing` verwendet
- **THEN** darf ein normaler Read-, Plan- oder Reconcile-Lauf die neue Realm-Baseline nicht automatisch auf diesen Realm schreiben
- **AND** bleiben bestehende tenant-spezifische Realm-Einstellungen erhalten

### Requirement: Realm-Baseline wird minimal und idempotent reconciled

Das System SHALL bei einem neuen Realm ausschließlich ausdrücklich Studio-owned Baseline-Felder schreiben und das Ergebnis kausal zurücklesen. Unbekannte Realm-Attribute, bestehende Standardprofilfelder und tenant-spezifische Benutzerprofilattribute MUST erhalten bleiben.

#### Scenario: Automatisierbare Baseline wird vollständig bestätigt

- **WHEN** der Provisioner einen neuen Realm erfolgreich erstellt
- **THEN** bestätigt der finale Readback Theme, Dark Mode, deutsche Lokalisierung, Events, Benutzerprofil und `instanceId`-Mapper
- **AND** markiert das System den automatischen Teil nur bei vollständiger Übereinstimmung als erfolgreich

#### Scenario: Benutzerprofil wird additiv erweitert

- **WHEN** die Baseline Studio-eigene Benutzerprofilattribute benötigt
- **THEN** ergänzt oder korrigiert der Provisioner genau diese Attribute und ihre vorgesehenen Berechtigungen
- **AND** entfernt oder verändert er keine unbekannten oder tenant-spezifischen Attribute
- **AND** bricht er bei konkurrierender Profiländerung retrybar ab, statt blind zu überschreiben

### Requirement: SMTP-Grundkonfiguration wird ohne Passwort automatisiert

Das System SHALL die nicht geheimen SMTP-Werte der serverseitigen Baseline bei neuen Realms automatisch setzen. Das SMTP-Passwort MUST außerhalb von Baseline, Registry, Snapshots, Logs, Audit und Browserantworten bleiben und SHALL einmalig direkt im Realm manuell gesetzt werden.

#### Scenario: Neuer Realm erhält nicht geheime SMTP-Werte

- **WHEN** ein neuer Realm provisioniert wird
- **THEN** setzt das System Host, Port, Absender, Benutzername und TLS-/STARTTLS-Modus aus der serverseitigen Baseline
- **AND** lässt es das Passwortfeld im Keycloak-Payload aus
- **AND** weist der Status die Nacharbeit `smtp_password_required` aus

#### Scenario: Maskiertes Passwort ist kein Funktionsnachweis

- **WHEN** Keycloak für ein gesetztes Passwort ausschließlich einen maskierten Wert wie `********` zurückliefert
- **THEN** behandelt das System diesen Wert weder als übertragbares Secret noch als erfolgreichen SMTP-Nachweis
- **AND** schreibt es den maskierten Wert niemals nach Keycloak, Registry, Snapshot oder Log

#### Scenario: SMTP-Passwortstatus wird ohne Secret gelesen

- **WHEN** das SMTP-Passwort manuell direkt in Keycloak gesetzt wurde
- **THEN** liest Studio ausschließlich, ob ein Passwortwert vorhanden ist
- **AND** gibt Studio weder den echten noch den maskierten Wert in Registry, Snapshot, Log, Audit oder Browserantwort aus

### Requirement: Manuelle Realm-Nacharbeit bleibt im Provisionierungsvertrag sichtbar

Das System SHALL das nicht automatisierbare SMTP-Passwort im vorhandenen Plan-, Run- und Detailstatus mit stabilem Grund- und Aktionscode ausweisen. Ein technischer Teilerfolg MUST von der noch offenen betrieblichen E-Mail-Nacharbeit unterscheidbar bleiben.

#### Scenario: Offene manuelle Nacharbeit bleibt sichtbar

- **WHEN** nach dem automatischen Provisioning das SMTP-Passwort noch fehlt
- **THEN** zeigt der vorhandene Status Grund und konkrete Aktion ohne Secret-Wert
- **AND** darf der automatische Baseline-Schritt erfolgreich sein
- **AND** bleibt das Setzen und operative Testen des Passworts als Nacharbeit erkennbar
