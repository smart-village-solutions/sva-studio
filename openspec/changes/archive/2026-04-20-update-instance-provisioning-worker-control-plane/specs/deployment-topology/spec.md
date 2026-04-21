## ADDED Requirements
### Requirement: Getrennter Provisioning-Worker fuer globale Keycloak-Mutationen

Das System SHALL im produktionsnahen Swarm-Referenzprofil einen separaten Provisioning-Worker fuer globale Keycloak-Mutationen betreiben.

#### Scenario: App und Provisioner haben getrennte Laufzeitidentitaeten

- **WHEN** der Stack `studio` oder ein gleichwertiges Profil gerendert wird
- **THEN** existiert ein nicht oeffentlich exponierter Service fuer den Keycloak-Provisioner
- **AND** verwendet dieser Service eigene `KEYCLOAK_PROVISIONER_*`-Variablen
- **AND** enthaelt der normale `app`-Service diese globale Provisioner-Identitaet nicht

#### Scenario: Provisioner verarbeitet Queue-Auftraege ohne Ingress

- **WHEN** der Provisioner-Service im Swarm laeuft
- **THEN** ist er nur im internen Netzwerk erreichbar
- **AND** konsumiert er Provisioning-Auftraege aus der gemeinsamen IAM-Datenbank
- **AND** besitzt er keine oeffentlichen Traefik-Router oder Host-Port-Exposition
