# Change: End-to-End-Idempotenz für Keycloak-Provisioning-Mutationen

## Why
Die aktuelle Implementierung validiert für Reconcile/Execute zwar den Header `Idempotency-Key`, nutzt den Key aber nicht durchgehend bis in Service- und Persistenzschicht. Dadurch können Retries desselben fachlichen Requests weiterhin mehrere Provisioning-Runs erzeugen.

## What Changes
- Reconcile- und Execute-Mutationen geben den `idempotencyKey` verbindlich bis in Service- und Repository-Schicht weiter.
- Das Datenmodell für Keycloak-Provisioning-Runs wird um einen persistierten Idempotenzbezug erweitert, inklusive eindeutiger Deduplizierungsregel auf fachlichem Scope.
- Wiederholte Requests mit identischem Key und identischer Payload liefern deterministisch denselben Run statt einen neuen zu erzeugen.
- Wiederverwendung eines Keys mit abweichender Payload wird als Konflikt behandelt.
- API-, Service- und Repository-Tests werden um Replay-, Parallelitäts- und Konfliktszenarien erweitert.

## Impact
- Affected specs: `instance-provisioning`
- Affected code: `packages/auth/src/iam-instance-registry/core-mutations.ts`, `packages/auth/src/iam-instance-registry/mutation-types.ts`, `packages/auth/src/iam-instance-registry/service-*.ts`, `packages/data/src/instance-registry/index.ts`, `packages/data/migrations/*`, zugehörige Tests
- Affected arc42 sections: `05-building-block-view`, `06-runtime-view`, `08-cross-cutting-concepts`
