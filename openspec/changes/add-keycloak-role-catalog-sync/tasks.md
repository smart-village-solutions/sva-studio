# Tasks: add-keycloak-role-catalog-sync

## 1. Domain- und Datenmodell

- [ ] 1.1 Mapping-Modell für Studio-Rollen zu Keycloak-Rollen definieren (`role_key`, `external_role_name`, `sync_state`, `last_synced_at`, `last_error_code`)
- [ ] 1.2 Delta-Migration für Role-Mapping- und Sync-Status-Spalten erstellen
- [ ] 1.3 Constraints und Indizes für eindeutiges Mapping und schnelle Drift-Abfragen ergänzen
- [ ] 1.4 Unit-Tests für Persistenzlogik und Mapping-Regeln ergänzen

## 2. Keycloak-Integration

- [ ] 2.1 Keycloak Admin Client um Realm-Role-CRUD erweitern (`createRole`, `updateRole`, `deleteRole`, `getRoleByName`)
- [ ] 2.2 Service-Account-Berechtigungen dokumentieren und auf Least-Privilege aktualisieren
- [ ] 2.3 Fehlerklassifikation und Retry-Regeln für Role-Operationen ergänzen
- [ ] 2.4 Unit-Tests für Keycloak-Role-API inklusive Fehlerpfade ergänzen

## 3. Rollen-CRUD-Synchronisierung

- [ ] 3.1 `POST /api/v1/iam/roles` auf Keycloak-Sync erweitern (Keycloak-First + Compensation)
- [ ] 3.2 `PATCH /api/v1/iam/roles/:id` auf bidirektional konsistente Updates erweitern
- [ ] 3.3 `DELETE /api/v1/iam/roles/:id` mit sicherer Entkopplung und Keycloak-Löschung erweitern
- [ ] 3.4 API-Responses um `syncState` und `syncError` erweitern
- [ ] 3.5 Integrationstests für Create/Update/Delete inkl. Compensation ergänzen

## 4. Drift-Erkennung und Reconciliation

- [ ] 4.1 Reconciliation-Service implementieren (Diff DB vs. Keycloak)
- [ ] 4.2 `POST /api/v1/iam/admin/reconcile` aus Platzhalterstatus in produktive Funktion überführen
- [ ] 4.3 Geplanten Reconcile-Job für lokale/staging Umgebungen ergänzen
- [ ] 4.4 Reporting für Drift-Fälle (Metriken + Audit-Events) implementieren
- [ ] 4.5 Tests für Reconcile-Szenarien (fehlende Rolle, veraltete Beschreibung, orphaned Rolle) ergänzen

## 5. UI und Bedienbarkeit

- [ ] 5.1 Rollen-Übersicht um Sync-Status pro Rolle erweitern (`synced`, `pending`, `failed`)
- [ ] 5.2 Fehlerzustände in Rollen-UI mit Retry-Aktion und verständlicher Meldung darstellen
- [ ] 5.3 Reconcile-Aktion für `system_admin` in der UI verfügbar machen
- [ ] 5.4 i18n-Keys für neue Status-/Fehlertexte (DE/EN) ergänzen
- [ ] 5.5 A11y-Tests für neue Statusindikatoren und Retry-Interaktionen ergänzen

## 6. Observability, Security und Dokumentation

- [ ] 6.1 Audit-Events für Role-Sync (`role.sync_started`, `role.sync_succeeded`, `role.sync_failed`, `role.reconciled`) ergänzen
- [ ] 6.2 Prometheus-Metriken und Alerts für Sync-Fehlerquote und Drift-Backlog ergänzen
- [ ] 6.3 Betriebsdoku für Keycloak-Rollen-Sync und Reconcile-Runbook in `docs/guides/` ergänzen
- [ ] 6.4 arc42-Abschnitte zu Runtime/Deployment/Risiken aktualisieren
- [ ] 6.5 Gesamte Test-Suite ausführen (`pnpm test:unit`, `pnpm test:types`, `pnpm test:eslint`, `pnpm test:e2e`)
- [ ] 6.6 `openspec validate add-keycloak-role-catalog-sync --strict` erfolgreich ausführen
