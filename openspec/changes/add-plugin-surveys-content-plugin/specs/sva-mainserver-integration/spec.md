## ADDED Requirements

### Requirement: Typed Survey GraphQL Adapters

Das System MUST typed, server-only SVA-Mainserver-Adapter fuer Survey-Liste, Survey-Detail, Survey-Create-or-Update, Survey-Submission, Freitext-Freigabe und Ergebnisabruf bereitstellen.

Die Adapter MUST die bestehende policy-gesteuerte Mainserver-Credential-Resolution-Chain verwenden und duerfen keinen generischen GraphQL-Executor an Browsercode, Plugincode oder App-UI-Komponenten exponieren.

#### Scenario: Survey-Liste wird ueber typed Adapter geladen

- **WENN** ein Benutzer eine gueltige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** die Survey-Liste angefordert wird
- **DANN** ruft der Host einen typed serverseitigen Survey-List-Adapter in `@sva/sva-mainserver/server` auf
- **UND** fuehrt der Adapter die neue Survey-Listenabfrage ueber den bestehenden Mainserver-Servicepfad aus
- **UND** erhaelt der Browser nur das gemappte Survey-Listenmodell

#### Scenario: Survey-Detail wird ueber typed Adapter geladen

- **WENN** ein Benutzer eine gueltige Studio-Session, einen Instanzkontext, lokale Content-Berechtigung und effektive Mainserver-Credentials besitzt
- **UND** eine einzelne Survey angefordert wird
- **DANN** ruft der Host einen typed serverseitigen Survey-Detail-Adapter auf
- **UND** fuehrt der Adapter die neue Survey-Detailabfrage mit typed Variablen aus
- **UND** werden fehlende oder invalide Antwortdaten auf einen deterministischen Integrationsfehler gemappt

#### Scenario: Survey-Plugin versucht generischen GraphQL-Zugriff

- **WENN** `@sva/plugin-surveys` Survey-Daten benoetigt
- **DANN** importiert das Plugin nicht `@sva/sva-mainserver/server`
- **UND** erhaelt keinen rohen GraphQL-Endpunkt, kein Secret, kein Token und keinen generischen Query-Executor

### Requirement: Survey GraphQL Documents folgen dem Wunsch-Schema und Snapshot-Vertrag

Das System MUST Survey-GraphQL-Dokumente aus dem eingecheckten Mainserver-Schema-Snapshot und den verifizierten Survey-Operationen ableiten.

Die anfängliche Survey-Integration MUST die im fachlichen Wunsch-Schema beschriebenen neuen Survey-Queries und -Mutations nutzen, soweit diese im Mainserver-Snapshot oder in einem verifizierten Staging-Schema vorliegen.

Das fuer Studio fuehrende Survey-Zielmodell verwendet nur die Statuswerte `DRAFT`, `ACTIVE` und `ARCHIVED` und enthaelt keine redaktionell steuerbare Option `allowsMultipleSubmissionsPerDevice`.

#### Scenario: Survey-Operation nutzt verifizierten GraphQL-Vertrag

- **WENN** eine Survey-GraphQL-Operation hinzugefuegt oder geaendert wird
- **DANN** passen Query oder Mutation, Variablen und selektierte Felder zu den verifizierten Survey-Operationen des Mainservers
- **UND** Unit-Tests decken erwartete Response-Shapes und invalides Upstream-Verhalten ab

#### Scenario: Survey-Snapshot folgt dem vereinfachten Statusmodell

- **WENN** Studio Survey-Typen, Enums oder Mapping-Layer fuer Mainserver-Responses aktualisiert
- **DANN** verwendet das Zielmodell nur `DRAFT`, `ACTIVE` und `ARCHIVED`
- **UND** werden fruehere Statuswerte wie `SCHEDULED` oder `ENDED` nicht als persistierte Studio-Statuswerte weitergefuehrt

#### Scenario: Survey-Snapshot entfernt redaktionelle Mehrfachteilnahme-Option

- **WENN** Studio den Survey-Write- und Read-Vertrag gegen den Mainserver abbildet
- **DANN** fuehrt das Zielmodell keine redaktionell bearbeitbare Option `allowsMultipleSubmissionsPerDevice`
- **UND** werden Mapping, Tests und Dokumentation entsprechend bereinigt

#### Scenario: Mainserver-Schema driftet bei Survey-Operationen

- **WENN** das Staging-Mainserver-Schema eine von Studio verwendete Survey-Operation nicht mehr unterstuetzt
- **DANN** wird der Drift vor dem Rollout gemeldet
- **UND** der betroffene Survey-Adapter gilt nicht als kompatibel, bis Dokument oder Mapping aktualisiert wurden

### Requirement: Survey-spezifische Fehler und Freigabeoperationen bleiben deterministisch

Das System MUST Mainserver- und Fachfehler fuer Survey-Operationen auf deterministische Studio-Fehler und Payload-Zustaende abbilden.

#### Scenario: Fachlicher Survey-Fehler wird strukturiert weitergegeben

- **WENN** eine Survey-Mutation fachlich fehlschlaegt, zum Beispiel wegen ungueltigem Statuswechsel oder unzulaessiger Eingabekombination
- **DANN** mappt der Host die Antwort auf einen deterministischen Studio-Fehlervertrag
- **UND** exponiert keine Secrets, Credentials oder rohen Upstream-Fehlerpayloads

#### Scenario: Freitext-Freigabe nutzt denselben host-owned Adapterpfad

- **WENN** ein berechtigter Benutzer Freitextantworten fuer eine Survey freigibt
- **DANN** erfolgt die Mutation ueber denselben host-owned Survey-Adapterpfad wie andere Survey-Mutationen
- **UND** die Freigabe wird nicht ueber einen pluginseitigen Direktzugriff am Host vorbei ausgefuehrt
