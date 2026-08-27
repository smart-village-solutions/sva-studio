## ADDED Requirements

### Requirement: Studio provisioniert persönliche Mainserver-Nutzer mit der Initialrolle studio

Das System SHALL bei jeder von Studio ausgelösten persönlichen Benutzer-Provisionierung über `POST /api/v2/user_provisionings` exakt `role: "studio"` senden. Die Rolle SHALL ausschließlich die initiale Mainserver-Rolle bei einer Neuanlage bestimmen. Studio SHALL dafür kein Keycloak-Präfix, kein Rollen-Mapping und keine lokale Spiegelung der Mainserver-Rolle einführen. Fehlt `role` bei anderen Mainserver-Aufrufern, SHALL der Mainserver weiterhin seine Defaultrolle `restricted` verwenden.

#### Scenario: Persönlicher Studioaccount wird initial als studio angelegt

- **GIVEN** Studio provisioniert einen neuen persönlichen Mainserver-Nutzer
- **WHEN** Studio den Provisioning-Payload sendet
- **THEN** enthält der Payload exakt `role: "studio"`
- **AND** erhält der neue Mainserver-Nutzer die fachlichen API-/GraphQL-Verwaltungsrechte der Rolle `studio`
- **AND** führt Studio kein zusätzliches Keycloak-Rollen-Mapping aus

#### Scenario: Reprovisionierung bewahrt eine bestehende Rolle

- **GIVEN** ein Mainserver-Nutzer existiert bereits mit einer bestehenden Mainserver-Rolle
- **WHEN** Studio den Nutzer einzeln oder als Teil einer Bulk-Aktion erneut provisioniert
- **THEN** darf der Mainserver die bestehende Rolle nicht aufgrund des erneut gesendeten Feldes verändern
- **AND** aktualisiert Studio ausschließlich die zurückgegebenen Credentials und die dafür vorgesehenen Profildaten

#### Scenario: Cross-Tenant-Provisionierung wird abgelehnt

- **GIVEN** der für das Provisioning verwendete `studio`-Token gehört zu einer anderen Municipality als der Zielnutzer
- **WHEN** Studio den Provisioning-Endpunkt aufruft
- **THEN** lehnt der Mainserver die Anfrage mit HTTP `403` ab
- **AND** behandelt Studio die Antwort als sicheren, nicht wiederholbaren Provisioning-Fehler
- **AND** exponiert Studio keine Secrets, Tokens oder unkontrollierten Upstream-Details

#### Scenario: Ungültige Mainserver-Rolle wird abgelehnt

- **GIVEN** ein Provisioning-Aufrufer sendet `admin` oder eine unbekannte Rolle
- **WHEN** der Mainserver den Provisioning-Payload validiert
- **THEN** lehnt der Mainserver die Anfrage mit HTTP `422` ab
- **AND** fällt Studio nicht stillschweigend auf `restricted` zurück

#### Scenario: Bestehende Nutzer werden nicht automatisch migriert

- **GIVEN** ein Mainserver-Nutzer existierte bereits vor Einführung der Rolle `studio`
- **WHEN** Studio mit dem neuen Provisioning-Vertrag ausgeliefert wird
- **THEN** startet Studio keine automatische Rollen- oder Nutzermigration
- **AND** bleibt die bestehende Mainserver-Rolle unverändert, bis ein getrennt autorisierter Prozess sie ändert

## MODIFIED Requirements

### Requirement: Organisationszugänge verwenden den bestehenden Benutzer-Provisioning-Endpunkt

Das System SHALL einen organisationsbezogenen Mainserver-Zugang über denselben bestehenden Benutzer-Provisioning-Endpunkt wie persönliche Studioaccounts erzeugen. Es SHALL dafür einen realen, der Organisation instanzgebunden zugeordneten Keycloak-Subject, deterministisch aus Organisation und Tenant abgeleitete Benutzerdaten und exakt `role: "studio"` verwenden. Den Bootstrap-Bearer-Token SHALL es ausschließlich aus persönlichen Mainserver-Credentials des handelnden Administrators laden und dabei keinen Organisations-Credential-Fallback verwenden. Die Mainserver-Initialrolle SHALL keine Studio-/Keycloak-Rolle oder frei wählbare Eigenschaft des Organisationsrequests sein.

#### Scenario: Studio leitet die erforderlichen Benutzerdaten und die Initialrolle ab

- **GIVEN** eine Organisation benötigt erstmals einen Mainserver-Zugang
- **WHEN** Studio den Provisioning-Payload bildet
- **THEN** verwendet es den realen Keycloak-Subject des zugeordneten Accounts
- **AND** leitet es E-Mail und Username grundsätzlich als normalisierte Form `<org-name>.<tenant-name>@smart-village.app` ab
- **AND** verwendet es Organisations- und Tenant-Anzeigenamen für die erforderlichen Namensfelder
- **AND** ergänzt es bei einer Kollision einen stabilen Organisations-ID-Anteil
- **AND** sendet es exakt `role: "studio"`
- **AND** bleiben die Studio-/Keycloak-Rollen und Gruppen des technischen Accounts weiterhin leer

#### Scenario: Wiederholung verwendet dieselbe technische Identität

- **GIVEN** eine Organisation besitzt bereits einen zugeordneten Account
- **WHEN** Provisionierung oder Reprovisionierung erneut ausgeführt wird
- **THEN** verwendet Studio denselben Keycloak-Subject und die persistierte E-Mail
- **AND** erzeugt es keinen zweiten Account aufgrund später geänderter Anzeigenamen
- **AND** verändert der Mainserver die bestehende Mainserver-Rolle nicht aufgrund des erneut gesendeten Rollenfeldes

#### Scenario: Aktive Organisation beeinflusst den Bootstrap-Principal nicht

- **GIVEN** der handelnde Administrator hat eine aktive Organisation mit `org_only` oder fehlenden Organisations-Credentials
- **WHEN** Studio einen Organisationszugang provisioniert
- **THEN** lädt es den Provisioning-Token ausschließlich mit den persönlichen Credentials des Administrators
- **AND** verwendet es weder die aktive noch die zu provisionierende Organisation als Credential-Quelle

#### Scenario: Erfolgreiche Antwort versorgt Organisation und Principal-Binding

- **WHEN** der Mainserver gültige Application-Credentials und eine `data_provider_id` zurückgibt
- **THEN** speichert Studio Application-ID und Secret verschlüsselt im Organisations-Credential-Speicher
- **AND** exponiert es das Secret nicht über Read-Models, Logs oder Audit
- **AND** erzeugt oder bestätigt es die instanzgebundene DataProvider-Bindung für die Organisation über den bestehenden Binding-Vertrag
- **AND** bleiben die durch den Mainserver geschriebenen Keycloak-Credential-Attribute am zugeordneten Account erhalten

#### Scenario: Provisioning-Antwort begründet die garantierte Erstbindung

- **GIVEN** der Mainserver-API-Vertrag garantiert dieselbe DataProvider-ID in Provisioning-Antwort und `/data_provider.json`
- **WHEN** die Provisioning-Antwort eine gültige `data_provider_id` und vollständige Application-Credentials enthält
- **THEN** darf Studio diese ID als `create_response`-Evidenz für die credential-versionierte Organisations-Erstbindung verwenden
- **AND** verwendet es `/data_provider.json` für spätere Verifikation und Credential-Rotation

#### Scenario: Spätere Identity-Verifikation widerspricht der Erstbindung

- **GIVEN** eine Organisation besitzt eine aus der Provisioning-Antwort erzeugte Bindung
- **WHEN** `/data_provider.json` entgegen dem garantierten Vertrag eine andere DataProvider-ID liefert
- **THEN** überschreibt Studio die bestehende Bindung nicht
- **AND** persistiert es einen Binding-Konflikt und `reconciliation_required`

#### Scenario: Mainserver ist bei Organisationserstellung nicht verfügbar

- **WHEN** der Provisioning-Aufruf nicht konfiguriert ist, timeoutet oder mit einem Fehler antwortet
- **THEN** wird kein Mainserver-Zugang als erfolgreich behauptet
- **AND** wird die bereits erfolgreiche lokale Organisationserstellung nicht zurückgerollt
- **AND** bleibt der Vorgang ohne Credential-Geheimnisse diagnostizierbar und wiederholbar

#### Scenario: Upstream-Erfolg benötigt lokale Reconciliation

- **GIVEN** der Mainserver hat die Provisionierung bestätigt
- **WHEN** die anschließende lokale Credential- oder Binding-Persistenz fehlschlägt
- **THEN** bleibt der Upstream-Vorgang als erfolgreich beobachtet erhalten
- **AND** kennzeichnet Studio die lokale Folgearbeit als `reconciliation_required`
- **AND** meldet es nicht fälschlich einen Providerfehler

#### Scenario: Lost Response verhindert Accountkompensation

- **GIVEN** Studio hat den Mainserver-Provisioning-Request abgesendet
- **WHEN** keine eindeutige Antwort eintrifft
- **THEN** deaktiviert oder löscht Studio den zugeordneten technischen Account nicht automatisch
- **AND** persistiert es die Operation als `reconciliation_required`
