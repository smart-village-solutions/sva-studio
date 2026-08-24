## ADDED Requirements

### Requirement: Keycloak-AIA fuer Credential-Self-Service

Das System SHALL Passwort- und E-Mail-Aenderungen angemeldeter Nutzer ueber Keycloak Application Initiated Actions (AIA) statt ueber lokale Studio-Credential-Formulare ausfuehren.

#### Scenario: Passwortaenderung bleibt IdP-owned

- **WENN** ein angemeldeter Nutzer im Studio eine Passwortaenderung anstoesst
- **DANN** fuehrt das System die Mutation nicht ueber einen lokalen IAM-API-Endpunkt aus
- **UND** startet stattdessen einen Keycloak-Flow mit `kc_action=UPDATE_PASSWORD`
- **UND** bleibt Keycloak der einzige Mutationsort fuer das Passwort

#### Scenario: E-Mail-Aenderung bleibt IdP-owned

- **WENN** ein angemeldeter Nutzer im Studio eine E-Mail-Aenderung anstoesst
- **DANN** fuehrt das System die Mutation nicht ueber das Studio-Profilformular aus
- **UND** startet stattdessen einen Keycloak-Flow mit `kc_action=UPDATE_EMAIL`
- **UND** bleibt Keycloak der einzige fuehrende Mutationsort fuer die Identitaets-E-Mail

### Requirement: Fresh Reauth fuer sensitive Self-Service-Aktionen

Das System SHALL Passwort- und E-Mail-Aenderungen aus dem Studio nur ueber einen serverseitig kontrollierten Self-Service-Pfad mit frischer Re-Authentisierung starten.

#### Scenario: Passwortaenderung erfordert frische Re-Authentisierung

- **WENN** ein angemeldeter Nutzer die Passwortaenderung aus dem Studio startet
- **DANN** erzwingt der serverseitige Einstiegspfad frische Re-Authentisierung im OIDC-Flow
- **UND** genuegt eine alte SSO-Session alleine nicht als hinreichender Nachweis fuer diese Aktion

#### Scenario: E-Mail-Aenderung erfordert frische Re-Authentisierung

- **WENN** ein angemeldeter Nutzer die E-Mail-Aenderung aus dem Studio startet
- **DANN** erzwingt der serverseitige Einstiegspfad frische Re-Authentisierung im OIDC-Flow
- **UND** genuegt eine alte SSO-Session alleine nicht als hinreichender Nachweis fuer diese Aktion

### Requirement: Realm-seitiger E-Mail-Aenderungsworkflow bleibt Keycloak-owned

Das System SHALL fuer E-Mail-Aenderungen den von Keycloak bereitgestellten `UPDATE_EMAIL`-Workflow voraussetzen und dessen Verifikationslogik nicht im Studio nachbauen.

#### Scenario: E-Mail-Verifikation bleibt beim IdP

- **WENN** eine Zielumgebung fuer E-Mail-Aenderungen eine Verifikation verlangt
- **DANN** erfolgt diese Verifikation innerhalb des Keycloak-Workflows
- **UND** das Studio fuehrt keine eigene Pending-E-Mail- oder Verifikationslogik als Parallelzustand

### Requirement: Studio-owned Rueckkehrstatus fuer Account-AIA

Das System SHALL den Ausgang von Keycloak-gestuetzten Account-Aktionen nach Rueckkehr in einen stabilen Studio-Statusvertrag ueberfuehren.

#### Scenario: Erfolgreiche Rueckkehr wird in Studio-Status uebersetzt

- **WENN** ein Nutzer eine durch das Studio gestartete Account-AIA erfolgreich abschliesst
- **DANN** kennt der serverseitige Callback die zuvor angeforderte Account-Aktion
- **UND** leitet auf ein sanitisiertes Rueckkehrziel mit einem Studio-eigenen Erfolgsstatus weiter

#### Scenario: Abbruch wird in Studio-Status uebersetzt

- **WENN** ein Nutzer eine durch das Studio gestartete Account-AIA abbricht
- **DANN** kennt der serverseitige Callback die zuvor angeforderte Account-Aktion
- **UND** leitet auf ein sanitisiertes Rueckkehrziel mit einem Studio-eigenen Abbruchstatus weiter
