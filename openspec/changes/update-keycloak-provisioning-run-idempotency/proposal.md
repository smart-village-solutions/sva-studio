# Change: Keycloak-Provisioning-Run-Idempotenz nachziehen

## Why
`reconcileKeycloak` und `executeKeycloakProvisioning` verlangen bereits den kanonischen Header `Idempotency-Key`, der fachlich dem in älteren Spezifikationen genannten `X-Idempotency-Key` entspricht. Im aktuellen Keycloak-Control-Plane-Pfad wird dieser Key aber nicht zur persistenten Deduplizierung genutzt. Retries oder doppelte UI-Aktionen können dadurch mehrere `iam.instance_keycloak_provisioning_runs` für denselben fachlichen Auftrag anlegen.

## What Changes
- Der validierte `Idempotency-Key` wird für Keycloak-Reconcile- und Execute-Mutationen bis in Service- und Repository-Schicht weitergereicht.
- `iam.instance_keycloak_provisioning_runs` erhält einen persistenten Idempotenzbezug und eine eindeutige Deduplizierungsregel für denselben Instanz-/Intent-/Key-Scope.
- Wiederholte Requests mit identischem Key und identischem fachlichem Payload erzeugen keinen zweiten Run und geben deterministisch die passende ursprüngliche Response-Form zurück: Reconcile liefert den bestehenden Status-/Snapshot-Pfad, Execute liefert den bestehenden Keycloak-Provisioning-Run.
- Wiederverwendung eines Keys mit abweichendem fachlichem Payload wird als Konflikt behandelt und erzeugt keinen neuen Run.
- API-, Service-, Repository- und Migrationstests decken Replay, Parallelität und Payload-Mismatch ab.

## Impact
- Affected specs: `instance-provisioning`
- Affected code: `packages/auth/src/iam-instance-registry/core-mutations.ts`, `packages/auth/src/iam-instance-registry/mutation-types.ts`, `packages/auth/src/iam-instance-registry/service-keycloak*.ts`, `packages/data/src/instance-registry/index.ts`, `packages/data/migrations/*`, zugehörige Tests
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
