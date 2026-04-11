## 1. Implementierung
- [ ] 1.1 API-Mutationen `reconcileKeycloak` und `executeKeycloakProvisioning` so erweitern, dass der validierte `idempotencyKey` bis in die Service-Calls durchgereicht wird
- [ ] 1.2 Input-Typen und Service-Interfaces für Reconcile/Execute um `idempotencyKey` ergänzen
- [ ] 1.3 Repository-/Persistenzmodell für Keycloak-Provisioning-Runs um Idempotenz-Attribute und eindeutige Deduplizierungsregel erweitern
- [ ] 1.4 Datenbank-Migration für neue Spalte(n)/Constraint(s) erstellen und Down-Migration ergänzen
- [ ] 1.5 Repository-Write-Pfad auf deterministische Deduplizierung umstellen (kein doppelter Run bei gleichem Scope + Key)
- [ ] 1.6 Konfliktfall für Key-Reuse mit anderer Payload definieren und als fachlichen API-Fehler mappen
- [ ] 1.7 Unit-/Integrations-Tests für Replay, Parallelität und Payload-Mismatch ergänzen
- [ ] 1.8 Relevante arc42-Abschnitte unter `docs/architecture/` aktualisieren oder begründete Nicht-Änderung dokumentieren

## 2. Validierung
- [ ] 2.1 `pnpm nx run auth:test:unit`
- [ ] 2.2 `pnpm nx run auth:test:types`
- [ ] 2.3 `pnpm nx run auth:lint`
