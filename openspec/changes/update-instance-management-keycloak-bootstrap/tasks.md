## 1. Backend
- [ ] 1.1 Migration für verschlüsselte Tenant-Client-Secrets und Tenant-Admin-Bootstrap-Felder in `iam.instances` ergänzen
- [ ] 1.2 Core- und API-Verträge für Instanzdetail, Update, Keycloak-Status und Reconcile erweitern
- [ ] 1.3 Repository- und Service-Layer der Instanzverwaltung um Update-, Status- und Reconcile-Pfade ergänzen
- [ ] 1.4 Keycloak-Admin-Client um Client-, Mapper-, User-, Rollen- und Passwort-Bootstrap-Operationen erweitern
- [ ] 1.5 Runtime-Routes und Handler für `PATCH /api/v1/iam/instances/$instanceId`, `GET /api/v1/iam/instances/$instanceId/keycloak/status` und `POST /api/v1/iam/instances/$instanceId/keycloak/reconcile` ergänzen

## 2. Frontend
- [ ] 2.1 Instanzverwaltung um editierbare Realm-/Bootstrap-Felder erweitern
- [ ] 2.2 Keycloak-Statuspanel und Reconcile-/Bootstrap-Aktionen ergänzen
- [ ] 2.3 Write-only Secret- und Passwortfelder mit geeignetem UX-Verhalten modellieren

## 3. Qualität und Doku
- [ ] 3.1 Backend- und Frontend-Tests für Update, Secret-Verhalten, Status und Reconcile ergänzen
- [ ] 3.2 Relevante Runbooks und Agent-Doku aktualisieren
- [ ] 3.3 `openspec validate update-instance-management-keycloak-bootstrap --strict` sowie betroffene Quality Gates ausführen
