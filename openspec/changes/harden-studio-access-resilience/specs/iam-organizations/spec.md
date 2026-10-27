## MODIFIED Requirements

### Requirement: Multi-Org-Kontextwechsel im aktiven Instanzkontext

Das System MUST Benutzern mit mehreren Organisationszuordnungen den Kontextwechsel innerhalb der aktiven `instanceId` ermöglichen und den gewählten Organisationskontext belastbar für nachgelagerte Zugriffe bereitstellen. Die Veröffentlichung im Browser MUST an Benutzer, Instanz und aktuelle Anfragegeneration gebunden sein. Parallele Session-Feldänderungen und verspätete Kontextantworten MUST einen bestätigten Wechsel nicht unbemerkt zurücksetzen.

#### Scenario: Benutzer wechselt Organisationskontext

- **WHEN** ein authentifizierter Benutzer Mitglied in mehreren Organisationen derselben Instanz ist
- **THEN** kann er den aktiven Organisationskontext wechseln
- **AND** der gewählte Kontext wird in der Session für nachgelagerte Zugriffe bereitgestellt

#### Scenario: Systemadministrator wählt eine eigene Organisation ausdrücklich

- **GIVEN** ein `system_admin` ist Mitglied einer aktiven Organisation der aktuellen Instanz
- **WHEN** er diese Organisation als Kontext auswählt
- **THEN** wird sie in der Session für Content-Aktionen verwendet
- **AND** die Organisationsautorenschaft beim Create folgt deren `contentAuthorPolicy`
- **AND** die tenantweiten Administratorberechtigungen bleiben an die effektiven Permissions gebunden

#### Scenario: Systemadministrator arbeitet wieder persönlich

- **WHEN** ein `system_admin` den persönlichen Kontext auswählt oder noch keine Organisation gewählt hat
- **THEN** ist kein aktiver Organisationskontext gesetzt
- **AND** eine Default-Mitgliedschaft wählt keine Organisation automatisch

#### Scenario: Entzogene Mitgliedschaft beendet den gespeicherten Kontext

- **GIVEN** eine Session verwendet eine Organisationsmitgliedschaft als aktiven Kontext
- **WHEN** diese Mitgliedschaft entzogen oder ihre Organisation gelöscht oder deaktiviert wird
- **THEN** werden die Sessions des betroffenen Accounts vor der Änderung invalidiert
- **AND** die nächste Anmeldung kann keinen Kontext der entzogenen Organisation übernehmen

#### Scenario: Benutzer wählt unzulässigen Organisationskontext

- **WHEN** ein authentifizierter Benutzer einen Organisationskontext setzt, für den in der aktiven `instanceId` keine gültige Mitgliedschaft besteht
- **THEN** wird die Operation abgewiesen
- **AND** der bisherige gültige Organisationskontext bleibt erhalten

#### Scenario: Deaktivierte Organisation kann kein aktiver Kontext werden

- **WHEN** ein authentifizierter Benutzer einen deaktivierten Organisationskontext setzen will
- **THEN** wird die Operation abgewiesen
- **AND** ein weiterhin gültiger bisheriger Session-Kontext bleibt aktiv

#### Scenario: Überholter Read endet nach bestätigtem Wechsel

- **WHEN** ein alter Organisations-GET nach einem erfolgreichen Kontextwechsel abgeschlossen wird
- **THEN** verwirft der bestehende Provider die überholte Antwort
- **AND** bleiben bestätigter Kontext und daraus abgeleitete Access-Generation unverändert

#### Scenario: Identität oder Reihenfolge ändert sich während Requests

- **WHEN** ein Benutzer-/Tenantwechsel oder Logout einen laufenden Kontextread überholt
- **THEN** darf dessen Antwort nicht in den neuen Browserkontext gelangen
- **AND** werden konkurrierende Wechsel serialisiert und Antworten nur in ihrer gültigen Generation publiziert

#### Scenario: Write-Ergebnis eines Kontextwechsels ist unklar

- **WHEN** nach dem Absenden eines Kontextwechsels dessen Ergebnis nicht sicher bekannt ist
- **THEN** liest Studio vor einer weiteren Kontextentscheidung den aktuellen autoritativen Stand
- **AND** wiederholt es den Kontextwrite nicht blind
