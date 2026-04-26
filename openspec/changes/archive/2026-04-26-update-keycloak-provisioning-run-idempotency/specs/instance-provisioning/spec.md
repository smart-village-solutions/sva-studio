## ADDED Requirements

### Requirement: Keycloak-Provisioning-Run-Enqueue ist idempotent

Das System SHALL Keycloak-Reconcile- und Execute-Mutationen end-to-end idempotent verarbeiten, indem ausschließlich der validierte Header `Idempotency-Key` bis zur persistenten Erzeugung von `iam.instance_keycloak_provisioning_runs` verwendet wird. `Idempotency-Key` ist der einzige unterstützte Headername für diesen Idempotenzvertrag. Die Bezeichnung `X-Idempotency-Key` kann in älteren IAM-Spezifikationen als historische Benennung vorkommen, wird jedoch von Clients nicht unterstützt und darf nicht als akzeptierter Request-Header vorausgesetzt werden.

#### Scenario: Replay mit gleichem Key und gleicher Payload nutzt den bestehenden Run

- **WHEN** ein berechtigter Client dieselbe Keycloak-Reconcile- oder Execute-Mutation für dieselbe Instanz und denselben `Idempotency-Key` mit identischer Payload erneut sendet
- **THEN** erzeugt das System keinen zusätzlichen Keycloak-Provisioning-Run
- **AND** liefert `reconcileKeycloak` deterministisch die bestehende Status-/Snapshot-Antwort aus dem ursprünglichen Auftrag zurück
- **AND** liefert `executeKeycloakProvisioning` deterministisch den bereits vorhandenen Keycloak-Provisioning-Run zurück

#### Scenario: Key-Reuse mit abweichender Payload wird abgelehnt

- **WHEN** ein Client denselben `Idempotency-Key` im selben Scope aus Instanz und Mutation wiederverwendet, aber eine abweichende Payload sendet
- **THEN** lehnt das System den Request mit `409 Conflict` ab
- **AND** liefert einen stabilen Fehlercode `IDEMPOTENCY_KEY_PAYLOAD_MISMATCH`
- **AND** erzeugt es keinen neuen Keycloak-Provisioning-Run

#### Scenario: Parallele Requests mit gleichem Key werden atomar dedupliziert

- **WHEN** zwei nahezu gleichzeitige Keycloak-Reconcile- oder Execute-Requests mit identischer Instanz, Mutation, identischem `Idempotency-Key` und identischer Payload eingehen
- **THEN** bleibt die persistierte Run-Erzeugung effektiv genau einmalig
- **AND** referenzieren alle erfolgreichen Execute-Antworten denselben Keycloak-Provisioning-Run
- **AND** geben alle erfolgreichen Reconcile-Antworten denselben Status-/Snapshot-Zustand des deduplizierten Auftrags wieder
