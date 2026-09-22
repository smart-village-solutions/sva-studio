## ADDED Requirements

### Requirement: SSF-Accounts werden synchron vollständig angelegt

Das System SHALL die Account-Anlage eines SSF-Mandanten innerhalb desselben
Requests abschließen: Voraussetzungen prüfen, Keycloak vollständig schreiben,
Account mit Mitgliedschaft und Rollen-/Gruppenzuweisungen lokal in einer
Transaktion speichern, Ergebnis zurückgeben. Ein erfolgreicher Request MUST
Keycloak-Write, erforderlichen technischen Rollenabgleich und lokalen Commit
abgeschlossen haben. Die Anlage MUST ohne nachgelagerten SSF-Job, technischen
Pending-Account, Polling und benutzerspezifischen Keycloak-Read-back abschließen.
Fachliche Accountstatus und bestehende Request-Idempotenz MUST erhalten bleiben.

#### Scenario: Vollständige erfolgreiche Anlage

- **GIVEN** der Mandant besitzt bestätigte aktuelle SSF-Readiness
- **AND** die gewünschten Rollen und Gruppen sind serverseitig zulässig
- **WHEN** ein berechtigter Administrator einen aktiven SSF-berechtigten Account anlegt
- **THEN** schreibt Studio alle vier SSF-Attribute und erforderlichen technischen Rollen nach Keycloak
- **AND** persistiert danach Account, Mitgliedschaft und Zuweisungen gemeinsam lokal
- **AND** liefert erst nach erfolgreichem Commit Erfolg ohne SSF-Abschlussjob

#### Scenario: Voraussetzung fehlt oder Tenant-Sperre ist belegt

- **GIVEN** die aktuelle bestätigte SSF-Readiness oder eine zulässige Zuweisung fehlt oder die bestehende Tenant-Sperre ist im begrenzten Request-Zeitbudget nicht verfügbar
- **WHEN** Studio den Create-Request bearbeitet
- **THEN** endet er vor externer und lokaler Benutzeranlage mit einem unmittelbar sichtbaren sicheren Fehler
- **AND** prüft oder repariert Create keine Realm-, Client- oder Mapper-Konfiguration
- **AND** plant er keinen Job und wartet nicht auf eine Mandantenreparatur

#### Scenario: Fachlich inaktiver oder nicht SSF-berechtigter Account

- **GIVEN** der zulässige Create-Request verlangt einen inaktiven Account oder weist keine effektiven SSF-Rechte zu
- **WHEN** Studio die Anlage abschließt
- **THEN** bewahrt es den angeforderten fachlichen Status und die kanonischen Rechte
- **AND** erzeugt es keine zusätzlichen SSF-Rechte oder Aktivierung
- **AND** setzt es keinen technischen Pending-Status für eine spätere Projektion

### Requirement: Create-Fehler werden vor dem Commit gezielt kompensiert

Das System MUST bei fehlgeschlagenem technischen Rollenabgleich oder
fehlgeschlagener lokaler Transaktion vor erfolgreichem Commit ausschließlich
den eindeutig in diesem Request angelegten Keycloak-Benutzer über denselben
tenantgebundenen Provider löschen. Fehler und fehlgeschlagene Bereinigung MUST
im bestehenden übersetzten Formularfehler sicher und korrelierbar sichtbar
sein. Ein Fehler nach erfolgreichem Commit MUST keine Delete-Kompensation
auslösen. Einladung und Mainserver-Folgepfad behalten ihre Fehlersemantik.

#### Scenario: Fehler vor lokalem Commit

- **GIVEN** Keycloak hat eine eindeutige neue Benutzer-ID zurückgegeben
- **WHEN** der technische Rollenabgleich oder die lokale Transaktion fehlschlägt
- **THEN** verwirft Studio den lokalen Teilzustand und löscht ausschließlich diese ID über denselben Provider
- **AND** meldet Studio einen Fehler ohne erfolgreichen oder technischen Pending-Account

#### Scenario: Kompensation schlägt fehl

- **GIVEN** die Anlage ist vor erfolgreichem lokalen Commit fehlgeschlagen
- **WHEN** auch die Löschung der bekannten externen Neuanlage fehlschlägt
- **THEN** bleibt der Request fehlgeschlagen und zeigt die unvollständige Bereinigung mit sicherem übersetztem Hinweis und Korrelations-ID an
- **AND** reicht ein Logeintrag allein nicht als Fehleranzeige aus
- **AND** plant Studio keinen Hintergrundabschluss des ursprünglichen Requests

#### Scenario: Externes Ergebnis ist unklar

- **GIVEN** Keycloak-Create endet ohne verlässlich bekannte neue Benutzer-ID
- **WHEN** Studio den Fehler beantwortet
- **THEN** behauptet es weder erfolgreiche Anlage noch erfolgreiche externe Bereinigung
- **AND** löscht es keinen anhand von E-Mail oder anderen unsicheren Merkmalen gesuchten Benutzer
- **AND** liefert es einen sichtbaren korrelierbaren Betriebsfehler

#### Scenario: Folgefehler nach erfolgreichem Commit

- **GIVEN** Account, Mitgliedschaft und Zuweisungen wurden erfolgreich lokal gespeichert
- **WHEN** Einladung oder optionaler Mainserver-Folgepfad fehlschlagen
- **THEN** bleiben Account und Keycloak-Benutzer erhalten
- **AND** gilt die bisherige Fehlersemantik des jeweiligen Folgepfads

### Requirement: SSF-Claims stammen aus kanonischem Studio-IAM

Das System MUST SSF-Rollen und -Permissions serverseitig aus allen effektiven
zulässigen Studio-Rollen einschließlich Gruppenrollen ableiten. Create und
Lifecycle MUST dieselbe fachliche Abbildung verwenden. Request-Clients MUST
keine SSF-Claims oder Autorisierungsrevision vorgeben können.

#### Scenario: Mehrere Rollen einschließlich Gruppenrollen

- **GIVEN** ein zulässiger Request kombiniert direkte Rollen und Gruppenrollen
- **WHEN** Studio vor dem Keycloak-Write die Claims ableitet
- **THEN** entspricht das Ergebnis der kanonischen Lifecycle-Abbildung derselben effektiven Rechte
- **AND** entsprechen die lokal gespeicherten Zuweisungen dieser validierten Ableitung

#### Scenario: Manipulierte SSF-Werte im Request

- **WHEN** ein Request zusätzliche SSF-Rollen, Permissions oder eine Revision vorgibt
- **THEN** verwirft oder ignoriert Studio diese Werte und verwendet ausschließlich kanonische serverseitige Daten

#### Scenario: Token unmittelbar nach der Anlage

- **GIVEN** die aktive SSF-berechtigte Anlage war erfolgreich und die bestehenden Anmeldevoraussetzungen sind erfüllt
- **WHEN** Keycloak einen Access-Token für den SSF-Client ausstellt
- **THEN** enthält er `studio_tenant_id`, `ssf_roles`, `ssf_permissions` und die aktuelle `ssf_authorization_revision`
- **AND** benötigt der SSF-Login keinen nachgelagerten Projektionsjob oder manuellen Keycloak-Eingriff
