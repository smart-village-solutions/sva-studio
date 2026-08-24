## ADDED Requirements

### Requirement: Auth-Route fuer Account-Self-Service-Aktionen

Das System SHALL einen kanonischen Auth-Runtime-Pfad fuer Keycloak-gestuetzte Account-Self-Service-Aktionen bereitstellen, statt Passwort- oder E-Mail-Aenderung direkt ueber app-lokale Links oder interne Keycloak-Login-Action-URLs zu starten.

#### Scenario: Passwort-Self-Service nutzt kanonische Auth-Route

- **WENN** ein authentifizierter Nutzer aus dem Studio eine Passwortaenderung startet
- **DANN** erfolgt der Einstieg ueber einen kanonischen Auth-Pfad wie `/auth/account-action`
- **UND** diese Route validiert Aktion und Rueckkehrziel serverseitig
- **UND** sie baut anschliessend einen OIDC-Login mit `kc_action=UPDATE_PASSWORD`

#### Scenario: E-Mail-Self-Service nutzt kanonische Auth-Route

- **WENN** ein authentifizierter Nutzer aus dem Studio eine E-Mail-Aenderung startet
- **DANN** erfolgt der Einstieg ueber denselben kanonischen Auth-Pfad
- **UND** diese Route validiert Aktion und Rueckkehrziel serverseitig
- **UND** sie baut anschliessend einen OIDC-Login mit `kc_action=UPDATE_EMAIL`

#### Scenario: Interne Keycloak-Login-Action-URLs bleiben verboten

- **WENN** das Studio Passwort- oder E-Mail-Self-Service verlinkt
- **DANN** verweist es nicht direkt auf interne Keycloak-URLs unterhalb von `/realms/.../login-actions/...`
- **UND** nutzt stattdessen ausschliesslich den OIDC-basierten Einstiegspfad

### Requirement: Rueckkehr aus Account-AIA bleibt routing-stabil

Das System SHALL nach Keycloak-gestuetzten Account-Aktionen ein sanitisiertes Rueckkehrziel und einen Studio-eigenen Statusvertrag verwenden.

#### Scenario: Erfolgreiche Rueckkehr aus Passwortaenderung

- **WENN** ein Nutzer die Passwortaenderung in Keycloak erfolgreich abschliesst
- **DANN** leitet der Callback den Nutzer auf ein zuvor validiertes Studio-Rueckkehrziel zurueck
- **UND** enthaelt dieses Ziel nur sanitierte Query-Parameter fuer den Studio-Status

#### Scenario: Nutzer bricht Action ab

- **WENN** ein Nutzer eine Keycloak-AIA fuer Account-Self-Service abbricht
- **DANN** wird er auf ein zuvor validiertes Studio-Rueckkehrziel zurueckgeleitet
- **UND** die Rueckkehr bleibt fuer die UI als Abbruchstatus unterscheidbar
