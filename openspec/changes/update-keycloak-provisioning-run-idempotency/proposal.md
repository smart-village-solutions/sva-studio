# Change: Keycloak-Provisioning-Run-Idempotenz nachziehen

## Why
`reconcileKeycloak` und `executeKeycloakProvisioning` verlangen bereits einen `Idempotency-Key`, nutzen ihn aber im aktuellen Keycloak-Control-Plane-Pfad nicht zur persistenten Deduplizierung. Retries oder doppelte UI-Aktionen können dadurch mehrere `iam.instance_keycloak_provisioning_runs` für denselben fachlichen Auftrag anlegen.

## What Changes
- Der validierte `Idempotency-Key` wird für Keycloak-Reconcile- und Execute-Mutationen bis in Service- und Repository-Schicht weitergereicht.
- `iam.instance_keycloak_provisioning_runs` erhält einen persistenten Idempotenzbezug und eine eindeutige Deduplizierungsregel für denselben Instanz-/Intent-/Key-Scope.
- Wiederholte Requests mit identischem Key und identischem fachlichem Payload liefern deterministisch denselben Keycloak-Provisioning-Run zurück.
- Wiederverwendung eines Keys mit abweichendem fachlichem Payload wird als Konflikt behandelt und erzeugt keinen neuen Run.
- API-, Service-, Repository- und Migrationstests decken Replay, Parallelität und Payload-Mismatch ab.

## Impact
- Affected specs: `instance-provisioning`
- Affected code: `packages/auth/src/iam-instance-registry/core-mutations.ts`, `packages/auth/src/iam-instance-registry/mutation-types.ts`, `packages/auth/src/iam-instance-registry/service-keycloak*.ts`, `packages/data/src/instance-registry/index.ts`, `packages/data/migrations/*`, zugehörige Tests
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
