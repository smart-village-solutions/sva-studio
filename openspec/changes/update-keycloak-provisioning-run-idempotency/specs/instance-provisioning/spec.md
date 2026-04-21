## ADDED Requirements

### Requirement: Keycloak-Provisioning-Run-Enqueue ist idempotent

Das System SHALL Keycloak-Reconcile- und Execute-Mutationen end-to-end idempotent verarbeiten, indem der validierte `Idempotency-Key` bis zur persistenten Erzeugung von `iam.instance_keycloak_provisioning_runs` verwendet wird.

#### Scenario: Replay mit gleichem Key und gleicher Payload liefert bestehenden Run

- **WHEN** ein berechtigter Client dieselbe Keycloak-Reconcile- oder Execute-Mutation für dieselbe Instanz, denselben Intent und denselben `Idempotency-Key` mit fachlich identischer Payload erneut sendet
- **THEN** erzeugt das System keinen zusätzlichen Keycloak-Provisioning-Run
- **AND** liefert es deterministisch den bereits vorhandenen Run als Antwort zurück

#### Scenario: Key-Reuse mit abweichender Payload wird abgelehnt

- **WHEN** ein Client denselben `Idempotency-Key` im selben Scope aus Instanz und Intent wiederverwendet, aber eine fachlich abweichende Payload sendet
- **THEN** lehnt das System den Request mit einem Konfliktfehler ab
- **AND** erzeugt es keinen neuen Keycloak-Provisioning-Run

#### Scenario: Parallele Requests mit gleichem Key werden atomar dedupliziert

- **WHEN** zwei nahezu gleichzeitige Keycloak-Reconcile- oder Execute-Requests mit identischem Scope und identischem `Idempotency-Key` eingehen
- **THEN** bleibt die persistierte Run-Erzeugung effektiv genau einmalig
- **AND** referenzieren alle erfolgreichen Antworten denselben Keycloak-Provisioning-Run
