## ADDED Requirements

### Requirement: Persönlicher Realm-Kontext für Studio-Verwaltungsaufrufe

Der Studio-MCP SHALL für allgemeine Verwaltungsaufrufe eine ausdrücklich gewählte persönliche Provider-Anmeldung im Plattform- oder jeweiligen Tenant-Realm verwenden. Host, Realm, Tenant und Account SHALL vor dem Aufruf erkennbar sein. Der Kontext SHALL unabhängig von Browser-Sitzungen bestehen; bestehende servicegebundene Instanztools behalten ihren eigenen Vertrag.

Die persönliche Anmeldung an diesem lokalen MCP SHALL nur für Provider-Operatoren möglich sein, deren Keycloak-User-Attribut `svaStudioMcpAccess` im jeweiligen Realm administrativ auf `true` gesetzt ist. Der nur dem persönlichen MCP-Client zugewiesene Keycloak-Login-Flow SHALL bei fehlendem oder abweichendem Wert die Anmeldung verweigern. Endnutzer SHALL das Attribut weder selbst setzen noch ändern können. Eine bloße Client-Installation oder Tenant-Adminrolle SHALL nicht genügen. Die MCP-Nutzung SHALL keinem Account zusätzliche fachliche Studio-Actions verleihen.

#### Scenario: Operator wechselt von Plattform zu Tenant

- **WHEN** der Operator den Tenant-Kontext mit seiner persönlichen Anmeldung auswählt
- **THEN** adressieren folgende Verwaltungsaufrufe ausschließlich dessen gebundenen Studio-Host und Realm
- **AND** ein fehlender oder abgelaufener Tenant-Login stoppt den Aufruf ohne Fallback auf die Plattform-Anmeldung

#### Scenario: Kunden-Admin installiert eigenen MCP-Client

- **WHEN** ein Kunden-Admin mit `system_admin` einen eigenen MCP-Client installiert und sich am vorgesehenen MCP-Client anmelden will
- **THEN** stellt Keycloak ihm ohne `svaStudioMcpAccess=true` keinen MCP-Token aus

#### Scenario: Kunde ändert eigenes Profil

- **WHEN** ein Kunde versucht, `svaStudioMcpAccess` über ein eigenes Profil oder eine Registrierung zu setzen
- **THEN** übernimmt Keycloak diese Änderung nicht

### Requirement: Allgemeiner Zugriff auf begrenzte Studio-Verwaltungs-APIs

Der Studio-MCP SHALL vorhandene, freigegebene Studio-Verwaltungs-HTTP-Verträge über einen allgemeinen kontextgebundenen Aufruf für `GET`, `POST`, `PATCH`, `PUT` und `DELETE` zugänglich machen. Er SHALL relative Pfade verwenden und seinen Zielhost aus dem aktiven Kontext ableiten. Die Routengrenze SHALL keine Fachinhalte, internen Endpunkte oder beliebigen Fremdhosts öffnen und SHALL Studio-Autorisierung nicht ersetzen.

#### Scenario: Bestehende Admin-Aktion ausführen

- **WHEN** ein berechtigter Provider-Account eine zulässige Einzelaktion für Accounts, Einladungen, Rollen, Gruppen, Organisationen oder Mitgliedschaften aufruft
- **THEN** führt der zuständige Studio-Endpunkt seine bestehenden Validierungs-, Berechtigungs-, Tenant-, Audit- und Löschschutzregeln aus
- **AND** der MCP liefert ein strukturiertes Ergebnis im aktiven Kontext

#### Scenario: Unzulässiges Ziel wird abgewiesen

- **WHEN** der Aufruf einen absoluten Fremdhost, eine nicht freigegebene Route oder eine Umleitung aus dem gewählten Host heraus anfordert
- **THEN** wird kein Verwaltungsaufruf an dieses Ziel gesendet

### Requirement: Mutationen bleiben einzeln und nachvollziehbar

Der allgemeine MCP-Zugang SHALL einzelne Studio-Verwaltungsaktionen einschließlich unterstützter Deaktivierung und Löschung anbieten. Er SHALL bestehende Idempotenz- und Bestätigungsvorgaben weiterreichen und einen unklaren Write-Ausgang kenntlich machen. Er SHALL keine stillschweigende Mutation wiederholen und keine Bulk- oder fachfremden Aktionen als Teil dieses Changes öffnen.

#### Scenario: Antwort auf eine Mutation bleibt aus

- **WHEN** nach einem gesendeten Write keine eindeutige Antwort eintrifft
- **THEN** meldet der MCP den Ausgang als unklar und fordert einen autorisierten Readback vor einem weiteren Write

### Requirement: Geheimnisse und persönliche Daten bleiben an der MCP-Grenze geschützt

Der Studio-MCP SHALL Tokens, Passwörter, Einladungslinks und Schnittstellen-Secrets aus Antworten, Fehlern und Logs fernhalten. Secrettragende Schnittstellen-Mutationen SHALL nur über einen geschützten lokalen, für den konkreten Aufruf aufgelösten Secret-Bezug möglich sein und SHALL keinen Klartext in protokollierten MCP-Argumenten verlangen.

#### Scenario: Schnittstelle mit Credential anlegen

- **WHEN** ein berechtigter Operator eine Schnittstelle mit technischem Secret anlegt
- **THEN** wird das Secret nur für diesen autorisierten Aufruf aus der geschützten lokalen Quelle aufgelöst
- **AND** weder Tool-Argumente noch Tool-Ergebnis oder Diagnose enthalten dessen Klartext

### Requirement: Verwaltungsfunktionen sind unabhängig kombinierbar

Der Studio-MCP SHALL die freigegebenen Verwaltungsaktionen auch unabhängig von einer Tenant-Neuanlage für die laufende Administration anbieten. Er SHALL keinen festen Einrichtungsablauf, zusätzlichen Fertig-Status oder eine globale Reihenfolge der Aktionen erzwingen. Einzelne Einladungen, Änderungen, Deaktivierungen und Löschungen bleiben nach den jeweils bestehenden Studio-Verträgen möglich.

#### Scenario: Bestehenden Tenant verwalten

- **WHEN** ein berechtigter Provider-Account eine einzelne Ressource eines bestehenden Tenants verwaltet
- **THEN** kann er die freigegebene Aktion ohne neuen Einrichtungsauftrag oder Fertig-Status aufrufen
- **AND** die fachlichen Studio-Berechtigungen und Schutzregeln gelten unverändert

### Requirement: Einrichtungsauftrag nutzt die allgemeinen MCP-Funktionen

Ein schrittweise erhobener Einrichtungsauftrag SHALL mit den allgemeinen Verwaltungsaktionen ausführbar und durch Readbacks prüfbar sein. Die technische Instanzaktivierung SHALL dabei nicht als Nachweis einer vollständig eingerichteten Kundenumgebung gelten. Für die Übergabe SHALL jeder beauftragte Tenant eine Kundenorganisation, dauerhafte persönliche Provider-Admin-Zugänge und Kunden-Admins mit vollen Tenant-Adminrechten erhalten; Provider-Admins müssen dafür nicht Mitglied der Kundenorganisation sein. Die Einladung an den ersten Kunden-Admin SHALL im Einrichtungsfall erst nach Prüfung der beauftragten Ressourcen und des Provider-Zugriffs ausgelöst werden. Diese Reihenfolge SHALL andere zulässige Einladungen in der laufenden Verwaltung nicht sperren.

Bei der Anlage des ersten Kunden-Admins SHALL die vorhandene Option `sendPasswordSetupEmail=false` verwendet und der ausbleibende Versand geprüft werden. Erst nach bestandener Einrichtungsprüfung SHALL die Einladung über `POST /api/v1/iam/users/$userId/send-password-setup-email` versendet werden. Eine Account-Anlage mit gleichzeitigem Einladungsversand SHALL nicht als Erfüllung dieser Übergabereihenfolge gelten.

#### Scenario: Tenant ohne Mainserver wird übergeben

- **WHEN** ein Auftrag keine Mainserver-Anbindung vorsieht und alle anderen beauftragten Ressourcen geprüft sind
- **THEN** wird weder Mainserver-Provisionierung noch ein davon abhängiges Plugin vorausgesetzt
- **AND** die Kunden-Admin-Einladung folgt erst nach der Einrichtungsprüfung

#### Scenario: Einrichtung ist noch nicht abgeschlossen

- **WHEN** eine benötigte Verwaltungs-API fehlt oder eine Prüfung offen ist
- **THEN** bleibt die Lücke sichtbar und die Einrichtung wird nicht als abgeschlossen ausgegeben
- **AND** die Einladung an den ersten Kunden-Admin wird nicht ausgelöst

#### Scenario: Kunde und Provider verwalten den eingerichteten Tenant

- **WHEN** die Einrichtung geprüft und der Kunden-Admin eingeladen wurde
- **THEN** besitzt der Kunden-Admin die beauftragten vollen Tenant-Adminrechte
- **AND** der Provider kann den Tenant weiterhin über seine persönlichen Provider-Accounts administrieren
