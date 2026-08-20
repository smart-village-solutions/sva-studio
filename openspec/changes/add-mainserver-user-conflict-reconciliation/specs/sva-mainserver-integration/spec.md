## ADDED Requirements

### Requirement: Mainserver-Identitätskonflikte bleiben ohne bestätigten Rebind fail-closed

Das System SHALL einen `local_user_conflict` aus persönlichem Mainserver-Provisioning als nicht automatisch auflösbaren Identitätskonflikt behandeln. Wiederholtes Provisioning, direkte Datenbankzugriffe und eine E-Mail-basierte automatische Verknüpfung SHALL den Konflikt nicht auflösen.

#### Scenario: Provisioning findet historische Identität mit anderem Subject

- **GIVEN** der Mainserver meldet `local_user_conflict`
- **WHEN** Studio die Provisioning-Antwort verarbeitet
- **THEN** persistiert Studio keine neuen persönlichen Credentials
- **AND** kennzeichnet es den Zustand für eine explizite Read-only-Prüfung

### Requirement: Mainserver-Rebind verwendet einen dedizierten idempotenten Upstream-Vertrag

Das System SHALL eine bestätigte persönliche Mainserver-Identität nur über einen dedizierten Rebind-Endpunkt mit Operationsreferenz, Idempotenz, Credential-Ausstellung und verifizierbarem Ergebnis an einen neuen Keycloak-Subject binden. Ohne bestätigten Upstream-Vertrag SHALL Studio den Vorgang nicht ausführen.

#### Scenario: Dedizierter Rebind ist erfolgreich

- **GIVEN** ein genehmigter Reconciliation-Vorgang mit unveränderbarer Operationsreferenz
- **WHEN** Studio den dedizierten Mainserver-Rebind aufruft
- **THEN** erhält Studio einen verifizierbaren Ziel-DataProvider und neue persönliche Credentials
- **AND** persistiert es diese ausschließlich serverseitig im Keycloak-Identitätskontext

#### Scenario: Upstream-Ergebnis ist unklar oder nachgelagerte Persistenz scheitert

- **WHEN** der Rebind-Request timeoutet, die Antwort nicht verifizierbar ist oder Keycloak-Persistenz beziehungsweise Bindungsprüfung fehlschlägt
- **THEN** finalisiert Studio den Vorgang als `reconciliation_required`
- **AND** führt keine direkte Datenbank- oder Löschkompensation aus
- **AND** kann eine Wiederholung nur über dieselbe Operationsreferenz erfolgen
