## ADDED Requirements

### Requirement: Automatisierter Basis-IAM-Abnahmenachweis

Das System MUST für den Basis-IAM-Umfang einen reproduzierbaren Abnahmenachweis in der vereinbarten Testumgebung bereitstellen.

#### Scenario: Readiness-Gate bestätigt alle Basisabhängigkeiten

- **WHEN** der Abnahme-Flow für Paket 1 ausgeführt wird
- **THEN** bestätigt das Readiness-Gate die Betriebsbereitschaft von Keycloak, Datenbank und Redis
- **AND** ein fehlender Bestandteil blockiert die Abnahme deterministisch mit einem dokumentierten Fehlerbild

#### Scenario: OIDC-Smoke prüft Login und Claims-Vertrag

- **WHEN** der Paket-1-Abnahmeflow einen Test-Login ausführt
- **THEN** wird ein erfolgreicher OIDC-Login gegen den dedizierten Test-Realm nachgewiesen
- **AND** der resultierende Benutzerkontext enthält mindestens `sub`, `instanceId` und die erwarteten Rollen-Claims
- **AND** das Ergebnis wird als versionierter Abnahmebericht dokumentiert

### Requirement: Abgesicherte Login-zu-Account-Synchronisierung

Das System MUST im Abnahmepfad nachweisen, dass ein erfolgreicher Login deterministisch zum passenden IAM-Account-Kontext führt.

#### Scenario: Erst-Login erzeugt oder verknüpft IAM-Account

- **WHEN** ein Test-Benutzer sich in der Paket-1-/2-Testumgebung erstmals anmeldet
- **THEN** wird ein passender `iam.accounts`-Datensatz erzeugt oder wiederverwendet
- **AND** die Verknüpfung zur Keycloak-Identity ist nachweisbar korrekt

#### Scenario: Wiederholter Login bleibt idempotent

- **WHEN** derselbe Test-Benutzer den Login erneut durchläuft
- **THEN** entstehen keine doppelten Account-Datensätze
- **AND** der bestehende Account-Kontext bleibt stabil
