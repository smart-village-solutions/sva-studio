## 1. Implementation
- [ ] 1.1 `reconcileKeycloak` und `executeKeycloakProvisioning` reichen den validierten `idempotencyKey` bis in die Service-Inputs weiter.
- [ ] 1.2 Service- und Repository-Typen für Keycloak-Provisioning-Runs nehmen `idempotencyKey` und einen fachlichen Payload-Fingerprint auf.
- [ ] 1.3 Datenbank-Migration für `iam.instance_keycloak_provisioning_runs` ergänzt Idempotenzdaten und eine eindeutige Deduplizierungsregel für `instance_id + mutation + idempotency_key`; fachliche Intents werden über den Payload-Fingerprint verglichen, nicht als Unique-Scope geführt.
- [ ] 1.4 Repository-Create-Pfad dedupliziert atomar und gibt bei Replay den bestehenden Run zurück.
- [ ] 1.5 Payload-Mismatch wird deterministisch als Konfliktfehler gemappt und erzeugt keinen neuen Run.
- [ ] 1.6 Tests für API-Weitergabe, Service-Enqueue, Repository-Replay, parallele Requests und Payload-Mismatch ergänzen.
- [ ] 1.7 Betroffene arc42-Abschnitte unter `docs/architecture/` aktualisieren oder eine begründete Nicht-Änderung dokumentieren.

## 2. Validation
- [ ] 2.1 `pnpm nx run auth:test:unit`
- [ ] 2.2 `pnpm nx run data:test:unit`
- [ ] 2.3 `pnpm test:types`
- [ ] 2.4 `openspec validate update-keycloak-provisioning-run-idempotency --strict`
