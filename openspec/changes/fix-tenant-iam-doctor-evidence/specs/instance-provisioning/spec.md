## ADDED Requirements

### Requirement: Doctor trennt Evidenz nach Serviceidentität

Das System SHALL strukturelle Provisioning-Evidenz, tenantlokale Access-Evidenz und Reconcile-Evidenz getrennt erheben und aggregieren, sodass jeder Befund seiner zuständigen Serviceidentität und Quelle eindeutig zugeordnet bleibt.

#### Scenario: Jede Diagnoseachse weist ihre Evidenz aus

- **WHEN** eine berechtigte Person den Tenant-IAM-Doctor für eine Instanz ausführt
- **THEN** stammen Strukturbefunde aus einer hinreichend berechtigten Provisioning-Evidenz
- **AND** stammt der operative Access-Befund aus einer nicht-destruktiven Probe mit der Tenant-IAM-Serviceidentität des Ziel-Tenants
- **AND** bleibt der Reconcile-Befund als eigener Fachlauf erkennbar
- **AND** enthält jede aktuell erhobene Achse mindestens Quelle, logische Serviceidentität, Prüfzeitpunkt und nach Möglichkeit `requestId`

#### Scenario: Unsichtbarer vorhandener Client wird nicht als fehlend gemeldet

- **GIVEN** der erwartete Login-Client existiert im Tenant-Realm
- **AND** die für eine Clientsuche verwendete Identität besitzt keine nachgewiesene Lesecapability
- **WHEN** die Suche kein Clientobjekt liefert oder Keycloak den Zugriff verweigert
- **THEN** meldet der Doctor den Client nicht als `missing`
- **AND** klassifiziert er den Befund als `forbidden`, `unknown` oder einen gleichwertigen stabilen Evidenzfehler
- **AND** bleibt eine unabhängig nachgewiesene Strukturevidenz erhalten

#### Scenario: Erfolgreiche leere Suche mit Lesecapability belegt fehlenden Client

- **GIVEN** die Strukturprobe verwendet den erwarteten Realm und eine nachweislich zum Clientlesen berechtigte Serviceidentität
- **WHEN** Keycloak die kausal zugeordnete Suche erfolgreich mit einem leeren Ergebnis beantwortet
- **THEN** darf der Doctor den erwarteten Client als `missing` klassifizieren
- **AND** verweist eine Reparaturempfehlung auf den Provisioner

#### Scenario: Fehlerklassen bleiben unterscheidbar

- **WHEN** eine Probe wegen Keycloak-`403`, fehlender Konfiguration, Transportfehler oder nachgewiesener Strukturabweichung fehlschlägt
- **THEN** unterscheidet der Doctor mindestens `forbidden`, `misconfigured`, `unavailable` und `missing`
- **AND** übersetzt er diese Ursachen nicht in eine gemeinsame fehlende Ressource

#### Scenario: Veraltete oder fehlende Evidenz bleibt unbestimmt

- **WHEN** keine aktuelle, zum Ziel-Realm gehörende Strukturevidenz vorliegt
- **THEN** bleibt die betroffene Diagnoseachse `unknown` oder fachlich gleichwertig unbestimmt
- **AND** wird sie weder als `ready` noch als `missing` dargestellt

#### Scenario: Gesundheitsprüfung führt keine Reparatur aus

- **WHEN** der Doctor einen strukturellen oder operativen Defekt erkennt
- **THEN** darf er eine dem zuständigen Service zugeordnete Reparatur empfehlen
- **AND** verändert der Probe-Aufruf selbst keine Clients, Rollen, Benutzer, Secrets oder Registry-Daten

#### Scenario: Gesamtstatus bewahrt die Ursache

- **WHEN** `configuration`, `access` oder `reconcile` unterschiedliche Zustände aufweisen
- **THEN** leitet das System `overall` deterministisch aus diesen Achsen ab
- **AND** liefert es die Einzelachsen unverändert an UI und MCP
- **AND** behauptet `overall` keine Ursache, die durch keine Einzelachse belegt ist
